import { db } from "@/db";
import { syncJobs, transcripts, videos } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  TRANSCRIPT_SYNC_BATCH_SIZE,
  TRANSCRIPT_SYNC_CONCURRENCY,
  TRANSCRIPT_SYNC_GAP_MS,
  TRANSCRIPT_SYNC_STAGGER_MS,
  TRANSCRIPT_SYNC_LOG_EVERY_N,
  TRANSCRIPT_SYNC_DB_CHUNK_SIZE,
} from "@/lib/constants";
import { createJobLogger, type JobLogger } from "./sync-logger";
import { fetchFullTranscriptWithStatus } from "./transcript";
import { runWorkerPool, WorkerPoolError } from "./utils";

interface BatchStats {
  ok: number;
  noCaptions: number;
  errors: number;
}

export async function syncChannelTranscripts(channelId: string, jobId: string): Promise<void> {
  const t0 = Date.now();
  const log = createJobLogger(jobId, "Sync Transcripts");
  log.info(`Starting transcript sync for channel ${channelId}`);

  const totals: BatchStats = { ok: 0, noCaptions: 0, errors: 0 };

  try {
    const pending = await db
      .select({ id: videos.id })
      .from(videos)
      .leftJoin(transcripts, eq(videos.id, transcripts.videoId))
      .where(and(eq(videos.channelId, channelId), isNull(transcripts.videoId)));

    const total = pending.length;
    const totalBatches = Math.ceil(total / TRANSCRIPT_SYNC_BATCH_SIZE);
    log.info(`Found ${total} videos missing transcripts (${totalBatches} batches)`);

    await log.flush();
    await db
      .update(syncJobs)
      .set({
        status: "running",
        progress: { phase: "transcripts", fetched: 0, total },
        updatedAt: new Date(),
      })
      .where(eq(syncJobs.id, jobId));

    if (total === 0) {
      log.info("Nothing to sync, marking completed");
      await log.flush();
      await db
        .update(syncJobs)
        .set({ status: "completed", progress: { phase: "done", fetched: 0, total: 0 }, updatedAt: new Date() })
        .where(eq(syncJobs.id, jobId));
      return;
    }

    let processed = 0;

    for (let i = 0; i < pending.length; i += TRANSCRIPT_SYNC_BATCH_SIZE) {
      const [currentJob] = await db
        .select({ status: syncJobs.status })
        .from(syncJobs)
        .where(eq(syncJobs.id, jobId))
        .limit(1);
      if (currentJob?.status !== "running") {
        log.warn(`Cancelled at ${processed}/${total} (ok: ${totals.ok}, skip: ${totals.noCaptions}, err: ${totals.errors})`);
        await log.flush();
        return;
      }

      const batch = pending.slice(i, i + TRANSCRIPT_SYNC_BATCH_SIZE);
      const videoIds = batch.map((v) => v.id);
      const batchNum = Math.ceil((i + 1) / TRANSCRIPT_SYNC_BATCH_SIZE);

      log.info(`Processing batch ${batchNum}/${totalBatches} (${videoIds.length} videos)...`);
      await log.flush();

      const batchStart = Date.now();
      const batchStats = await processTranscriptBatch(videoIds, log, processed, total);

      totals.ok += batchStats.ok;
      totals.noCaptions += batchStats.noCaptions;
      totals.errors += batchStats.errors;
      processed += videoIds.length;

      const batchTime = ((Date.now() - batchStart) / 1000).toFixed(1);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      log.info(`Batch ${batchNum} done: ${processed}/${total} in ${batchTime}s [ok:${batchStats.ok} skip:${batchStats.noCaptions} err:${batchStats.errors}] (total ${elapsed}s)`);

      if (batchStats.errors > 0) {
        log.warn(`${batchStats.errors} transcript(s) failed in batch ${batchNum}`);
      }

      await log.flush();
      await db
        .update(syncJobs)
        .set({
          progress: { phase: "transcripts", fetched: totals.ok + totals.noCaptions, total },
          updatedAt: new Date(),
        })
        .where(eq(syncJobs.id, jobId));
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log.info(`Completed in ${elapsed}s — ok: ${totals.ok}, no_captions: ${totals.noCaptions}, errors: ${totals.errors} (of ${total} total)`);
    await log.flush();

    await db
      .update(syncJobs)
      .set({
        status: "completed",
        progress: { phase: "done", fetched: totals.ok + totals.noCaptions, total },
        updatedAt: new Date(),
      })
      .where(eq(syncJobs.id, jobId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error(`Failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${message} (ok: ${totals.ok}, err: ${totals.errors})`);
    await log.flush();
    await db
      .update(syncJobs)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(syncJobs.id, jobId));
    throw error;
  }
}

interface TranscriptRow {
  videoId: string;
  fullText: string | null;
  excerpt: string | null;
  language: string | null;
}

async function flushTranscriptRows(rows: TranscriptRow[]) {
  for (let i = 0; i < rows.length; i += TRANSCRIPT_SYNC_DB_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + TRANSCRIPT_SYNC_DB_CHUNK_SIZE);
    await db
      .insert(transcripts)
      .values(
        chunk.map((r) => ({
          videoId: r.videoId,
          fullText: r.fullText,
          excerpt: r.excerpt,
          language: r.language,
          fetchedAt: new Date(),
        }))
      )
      .onConflictDoUpdate({
        target: transcripts.videoId,
        set: {
          fullText: sql`excluded.full_text`,
          excerpt: sql`excluded.excerpt`,
          language: sql`excluded.language`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });
  }
}

async function processTranscriptBatch(
  videoIds: string[],
  log: JobLogger,
  baseProcessed: number,
  grandTotal: number,
): Promise<BatchStats> {
  const stats: BatchStats = { ok: 0, noCaptions: 0, errors: 0 };
  const rows: TranscriptRow[] = [];
  let done = 0;

  async function processOne(videoId: string) {
    const outcome = await fetchFullTranscriptWithStatus(videoId);

    if (outcome.status === "error") {
      stats.errors++;
      if (stats.errors <= 3) {
        log.warn(`Transcript error for ${videoId}: ${outcome.reason}`);
      }
    } else {
      const data = outcome.status === "ok" ? outcome.data : null;
      if (outcome.status === "ok") stats.ok++;
      else stats.noCaptions++;

      rows.push({
        videoId,
        fullText: data?.fullText ?? null,
        excerpt: data?.excerpt ?? null,
        language: data?.language ?? null,
      });
    }

    done++;
    if (done % TRANSCRIPT_SYNC_LOG_EVERY_N === 0 || done === videoIds.length) {
      const globalDone = baseProcessed + done;
      log.info(`  ${globalDone}/${grandTotal} transcripts processed (batch: ${done}/${videoIds.length})`);
      await log.flush();
    }
  }

  try {
    await runWorkerPool(videoIds, processOne, {
      concurrency: TRANSCRIPT_SYNC_CONCURRENCY,
      gapMs: TRANSCRIPT_SYNC_GAP_MS,
      staggerMs: TRANSCRIPT_SYNC_STAGGER_MS,
    });
  } catch (err) {
    if (err instanceof WorkerPoolError) {
      stats.errors += err.errors.length;
      for (const { item, error } of err.errors.slice(0, 3)) {
        log.warn(`Transcript worker error for ${item}: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      throw err;
    }
  }

  await flushTranscriptRows(rows);

  return stats;
}
