import { db } from "@/db";
import { importJobs, scrobbles } from "@/db/schema";
import type { ImportJobView, ImportLogEntry, ImportMode } from "@/types/lastfm";
import { desc, eq, sql } from "drizzle-orm";
import { env } from "./env";
import { getRecentTracks, RECENT_TRACKS_MAX_LIMIT } from "./lastfm-server";
import { createTaggedLogger } from "./logger";

const log = createTaggedLogger("import");

/**
 * How long one invocation may spend fetching before it hands control back. Kept
 * under the serverless ceiling declared by the route's `maxDuration`, so a
 * chunk always returns a saved cursor rather than being killed mid-page.
 */
const CHUNK_BUDGET_MS = 45_000;
/** Ceiling on pages per chunk, so a fast network cannot outrun the time check. */
const CHUNK_MAX_PAGES = 200;
/**
 * Each request costs Last.fm about a second of latency, so requesting strictly
 * one at a time leaves the budget idle. Three in flight with a pause between
 * batches lands near 3 requests/second -- under the rate guidance the community
 * cites, and the terms publish no number to beat.
 */
const PAGE_CONCURRENCY = 3;
const BATCH_DELAY_MS = 150;
/** Rows per INSERT. Neon's HTTP driver sends one request per statement. */
const FLUSH_SIZE = 500;
const MAX_LOG_ENTRIES = 200;

const sleep = (ms: number) => new Promise((r) => globalThis.setTimeout(r, ms));

type ImportJobRow = typeof importJobs.$inferSelect;

export function toJobView(job: ImportJobRow): ImportJobView {
  return {
    id: job.id,
    status: job.status as ImportJobView["status"],
    mode: job.mode as ImportMode,
    pagesDone: job.pagesDone,
    totalPages: job.totalPages,
    scrobblesImported: job.scrobblesImported,
    error: job.error,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
    logs: job.logs ?? [],
  };
}

export async function getLatestJob(): Promise<ImportJobRow | null> {
  const [job] = await db
    .select()
    .from(importJobs)
    .orderBy(desc(importJobs.startedAt))
    .limit(1);
  return job ?? null;
}

async function getRunningJob(): Promise<ImportJobRow | null> {
  const [job] = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.status, "running"))
    .orderBy(desc(importJobs.startedAt))
    .limit(1);
  return job ?? null;
}

async function getLatestPlayedAt(): Promise<Date | null> {
  const [row] = await db
    .select({ max: sql<string | null>`MAX(${scrobbles.playedAt})` })
    .from(scrobbles);
  return row?.max ? new Date(row.max) : null;
}

function appendLogs(existing: ImportLogEntry[], messages: string[]): ImportLogEntry[] {
  const at = new Date().toISOString();
  const next = [...existing, ...messages.map((message) => ({ at, message }))];
  return next.slice(-MAX_LOG_ENTRIES);
}

/**
 * Creates a job. Full mode walks the whole history; incremental picks up from
 * the newest stored play. Both pin an upper bound so page numbers stay stable
 * for the lifetime of the job.
 */
export async function createJob(mode: ImportMode): Promise<ImportJobRow> {
  const running = await getRunningJob();
  if (running) return running;

  const toTimestamp = Math.floor(Date.now() / 1000);
  let fromTimestamp: number | null = null;

  if (mode === "incremental") {
    const latest = await getLatestPlayedAt();
    if (!latest) {
      log.info("No stored scrobbles; promoting incremental request to a full import");
      mode = "full";
    } else {
      // Re-fetching the boundary second is cheaper than reasoning about whether
      // Last.fm treats `from` as inclusive; the unique index absorbs the repeat.
      fromTimestamp = Math.floor(latest.getTime() / 1000);
    }
  }

  const [job] = await db
    .insert(importJobs)
    .values({
      id: globalThis.crypto.randomUUID(),
      status: "running",
      mode,
      toTimestamp,
      fromTimestamp,
      nextPage: 1,
      logs: appendLogs([], [
        mode === "full"
          ? "Starting full history import"
          : `Starting incremental import from ${new Date(fromTimestamp! * 1000).toISOString()}`,
      ]),
    })
    .returning();

  return job;
}

async function flush(
  rows: (typeof scrobbles.$inferInsert)[]
): Promise<number> {
  if (rows.length === 0) return 0;

  // Collapse repeats inside the batch so the statement does less work; the
  // unique index still guards against overlap with rows already stored.
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    const key = `${row.artistName}\u0000${row.trackName}\u0000${row.playedAt.toISOString()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let inserted = 0;
  for (let i = 0; i < unique.length; i += FLUSH_SIZE) {
    const slice = unique.slice(i, i + FLUSH_SIZE);
    const result = await db
      .insert(scrobbles)
      .values(slice)
      .onConflictDoNothing()
      .returning({ id: scrobbles.id });
    inserted += result.length;
  }
  return inserted;
}

export interface ChunkResult {
  job: ImportJobRow;
  done: boolean;
}

/**
 * Advances an import by one bounded chunk and persists the cursor. Safe to call
 * repeatedly: each call resumes from `nextPage`, and re-reading a page can only
 * produce rows the unique index already rejects.
 */
export async function runChunk(jobId: string): Promise<ChunkResult> {
  const [job] = await db.select().from(importJobs).where(eq(importJobs.id, jobId)).limit(1);
  if (!job) throw new Error(`Import job not found: ${jobId}`);
  if (job.status !== "running") return { job, done: true };

  const deadline = Date.now() + CHUNK_BUDGET_MS;
  const messages: string[] = [];

  let page = job.nextPage;
  let pagesDone = job.pagesDone;
  let imported = job.scrobblesImported;
  let totalPages = job.totalPages;
  let buffer: (typeof scrobbles.$inferInsert)[] = [];
  let pagesThisChunk = 0;
  let done = false;

  try {
    while (Date.now() < deadline && pagesThisChunk < CHUNK_MAX_PAGES) {
      // Until the first response reports totalPages, fetch a single page. A
      // concurrent first batch would overshoot the end on a short incremental
      // run and report more pages done than the job actually has.
      const batchSize =
        totalPages === null
          ? 1
          : Math.min(PAGE_CONCURRENCY, totalPages - page + 1);

      if (batchSize <= 0) {
        done = true;
        break;
      }

      const batch = Array.from({ length: batchSize }, (_, i) => page + i);
      const results = await Promise.all(
        batch.map((pageNumber) =>
          getRecentTracks({
            user: env.LASTFM_USERNAME,
            page: pageNumber,
            limit: RECENT_TRACKS_MAX_LIMIT,
            to: job.toTimestamp,
            ...(job.fromTimestamp !== null ? { from: job.fromTimestamp } : {}),
          })
        )
      );

      for (const result of results) {
        totalPages = result.totalPages;
        buffer.push(
          ...result.tracks.map((track) => ({
            artistName: track.artistName,
            artistMbid: track.artistMbid,
            trackName: track.trackName,
            trackMbid: track.trackMbid,
            albumName: track.albumName,
            albumMbid: track.albumMbid,
            playedAt: track.playedAt,
          }))
        );
      }

      // Advance only after the whole batch lands, so a mid-batch failure
      // rewinds to the first page of the batch rather than skipping it.
      pagesDone += batchSize;
      pagesThisChunk += batchSize;
      page += batchSize;

      if (buffer.length >= FLUSH_SIZE) {
        imported += await flush(buffer);
        buffer = [];
      }

      if (totalPages === null || totalPages === 0 || page > totalPages) {
        done = true;
        break;
      }

      await sleep(BATCH_DELAY_MS);
    }

    imported += await flush(buffer);

    messages.push(
      done
        ? `Finished: ${pagesDone} pages, ${imported} new scrobbles`
        : `Fetched pages ${job.nextPage}-${page - 1} of ${totalPages ?? "?"} (${imported} new so far)`
    );

    const [updated] = await db
      .update(importJobs)
      .set({
        nextPage: page,
        pagesDone,
        scrobblesImported: imported,
        totalPages,
        status: done ? "done" : "running",
        finishedAt: done ? new Date() : null,
        updatedAt: new Date(),
        logs: appendLogs(job.logs ?? [], messages),
      })
      .where(eq(importJobs.id, jobId))
      .returning();

    return { job: updated, done };
  } catch (error) {
    // Persist whatever the chunk managed to pull before failing, so a retry
    // resumes from the last good page instead of restarting the history.
    const salvaged = await flush(buffer).catch(() => 0);
    const message = error instanceof Error ? error.message : String(error);
    log.error({ err: error, jobId, page }, "Import chunk failed");

    const [failed] = await db
      .update(importJobs)
      .set({
        nextPage: page,
        pagesDone,
        scrobblesImported: imported + salvaged,
        totalPages,
        status: "error",
        error: message,
        updatedAt: new Date(),
        logs: appendLogs(job.logs ?? [], [`Failed on page ${page}: ${message}`]),
      })
      .where(eq(importJobs.id, jobId))
      .returning();

    return { job: failed, done: true };
  }
}

/** Clears the error state so the next chunk resumes from the stored cursor. */
export async function resumeJob(jobId: string): Promise<ImportJobRow> {
  const [job] = await db
    .update(importJobs)
    .set({ status: "running", error: null, updatedAt: new Date() })
    .where(eq(importJobs.id, jobId))
    .returning();
  return job;
}

export interface LibrarySummary {
  scrobbleCount: number;
  artistCount: number;
  trackCount: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
}

export async function getLibrarySummary(): Promise<LibrarySummary> {
  const [row] = await db
    .select({
      scrobbleCount: sql<number>`COUNT(*)::int`,
      artistCount: sql<number>`COUNT(DISTINCT ${scrobbles.artistName})::int`,
      // A row constructor rather than concatenation: no separator to collide
      // with, and Postgres text cannot carry a NUL byte anyway.
      trackCount: sql<number>`COUNT(DISTINCT (${scrobbles.artistName}, ${scrobbles.trackName}))::int`,
      firstPlayedAt: sql<string | null>`MIN(${scrobbles.playedAt})`,
      lastPlayedAt: sql<string | null>`MAX(${scrobbles.playedAt})`,
    })
    .from(scrobbles);

  return {
    scrobbleCount: row?.scrobbleCount ?? 0,
    artistCount: row?.artistCount ?? 0,
    trackCount: row?.trackCount ?? 0,
    firstPlayedAt: row?.firstPlayedAt ?? null,
    lastPlayedAt: row?.lastPlayedAt ?? null,
  };
}
