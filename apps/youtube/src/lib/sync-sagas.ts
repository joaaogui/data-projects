import { db } from "@/db";
import { sagas, videos } from "@/db/schema";
import type { Saga, VideoData } from "@/types/youtube";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { analyzeBatchFromDb, type SegmentResult } from "./saga-ai";
import {
  BATCH_SIZE,
  buildRunContext,
  createBatches,
  findUncategorizedRuns,
  mergeSagaSegments,
  splitLargeRun,
} from "./saga-analysis";
import { SAGA_DB_BATCH_SIZE, MAX_SAGAS_PER_CHANNEL } from "./constants";
import { type SyncJobContext, withSyncJob } from "./sync-job";
import type { JobLogger } from "./sync-logger";

type SagaMode = "full" | "incremental" | "reset";

function formatDateRange(vids: VideoData[]): string {
  if (vids.length === 0) return "";
  const dates = vids.map((v) => v.publishedAt).sort((a, b) => a.localeCompare(b));
  const fmt = (iso: string) => {
    const d = new Date(iso);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };
  const first = fmt(dates[0]);
  const last = fmt(dates.at(-1)!);
  return first === last ? first : `${first} – ${last}`;
}

function logSegments(log: JobLogger, segments: SegmentResult[]) {
  if (segments.length === 0) {
    log.info("  No sagas detected in this batch");
    return;
  }
  for (const seg of segments) {
    log.info(`  → "${seg.name}" (${seg.videoIds.length} videos)`);
  }
}

function logMergeResult(
  log: JobLogger,
  before: Saga[],
  after: Saga[],
  segments: SegmentResult[],
) {
  const beforeIds = new Set(before.map((s) => s.id));
  const newSagas = after.filter((s) => s.source === "ai-detected" && !beforeIds.has(s.id));
  const extended = after.filter((s) => {
    if (s.source !== "ai-detected" || !beforeIds.has(s.id)) return false;
    const prev = before.find((b) => b.id === s.id);
    return prev && s.videoIds.length > prev.videoIds.length;
  });

  const parts: string[] = [];
  if (newSagas.length > 0) parts.push(`${newSagas.length} new`);
  if (extended.length > 0) parts.push(`${extended.length} extended`);
  const skipped = segments.length - newSagas.length - extended.length;
  if (skipped > 0) parts.push(`${skipped} merged/skipped`);

  const totalCategorized = after.reduce((sum, s) => sum + s.videoIds.length, 0);
  log.info(`  Result: ${parts.join(", ")} → ${after.length} sagas, ${totalCategorized} videos categorized`);
}

function logSummary(log: JobLogger, finalSagas: Saga[]) {
  const ai = finalSagas.filter((s) => s.source === "ai-detected");
  if (ai.length === 0) return;
  log.info(`Final: ${ai.length} AI sagas detected`);
  const top = [...ai].sort((a, b) => b.videoCount - a.videoCount).slice(0, 8);
  for (const s of top) {
    log.info(`  • "${s.name}" — ${s.videoCount} videos`);
  }
  if (ai.length > 8) {
    log.info(`  ... and ${ai.length - 8} more`);
  }
}

async function loadChannelVideos(channelId: string): Promise<VideoData[]> {
  const rows = await db
    .select()
    .from(videos)
    .where(eq(videos.channelId, channelId));

  const now = Date.now();
  return rows.map((r) => ({
    videoId: r.id,
    title: r.title,
    publishedAt: r.publishedAt.toISOString(),
    days: Math.max(1, Math.floor((now - r.publishedAt.getTime()) / (1000 * 60 * 60 * 24))),
    duration: r.duration,
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    favorites: r.favorites,
    score: r.score,
    scoreComponents: r.scoreComponents ?? { engagementScore: 0, reachScore: 0, momentumScore: 0, efficiencyScore: 0, communityScore: 0 },
    rates: r.rates ?? { likeRate: 0, commentRate: 0, engagementRate: 0, viewsPerDay: 0, viewsPerHour: 0, viewsPerContentMin: 0, engagementPerMinute: 0 },
    url: r.url,
    thumbnail: r.thumbnail,
    description: r.description ?? "",
  }));
}

async function loadChannelSagas(channelId: string): Promise<Saga[]> {
  const rows = await db
    .select()
    .from(sagas)
    .where(eq(sagas.channelId, channelId));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    source: r.source,
    playlistId: r.playlistId ?? undefined,
    videoIds: r.videoIds,
    videoCount: r.videoCount,
    dateRange: r.dateRange,
    reasoning: r.reasoning ?? undefined,
    videoEvidence: r.videoEvidence ?? undefined,
  }));
}

async function saveSagasToDb(channelId: string, sagaList: Saga[]): Promise<void> {
  const toUpsert = sagaList.slice(0, MAX_SAGAS_PER_CHANNEL);

  for (let i = 0; i < toUpsert.length; i += SAGA_DB_BATCH_SIZE) {
    const chunk = toUpsert.slice(i, i + SAGA_DB_BATCH_SIZE);
    await db
      .insert(sagas)
      .values(
        chunk.map((s) => ({
          id: s.id,
          channelId,
          name: s.name,
          source: s.source,
          playlistId: s.playlistId ?? null,
          videoIds: s.videoIds,
          videoCount: s.videoCount,
          dateRange: s.dateRange,
          reasoning: s.reasoning ?? null,
          videoEvidence: s.videoEvidence ?? null,
        }))
      )
      .onConflictDoUpdate({
        target: sagas.id,
        set: {
          name: sql`excluded.name`,
          source: sql`excluded.source`,
          playlistId: sql`excluded.playlist_id`,
          videoIds: sql`excluded.video_ids`,
          videoCount: sql`excluded.video_count`,
          dateRange: sql`excluded.date_range`,
          reasoning: sql`excluded.reasoning`,
          videoEvidence: sql`excluded.video_evidence`,
        },
      });
  }

  const incomingIds = toUpsert.map((s) => s.id);
  if (incomingIds.length > 0) {
    await db
      .delete(sagas)
      .where(
        and(
          eq(sagas.channelId, channelId),
          eq(sagas.source, "ai-detected"),
          notInArray(sagas.id, incomingIds)
        )
      );
  }
}

async function runFullAnalysis(
  channelId: string,
  allVideos: VideoData[],
  existingSagas: Saga[],
  playlistVideoIds: Set<string>,
  log: JobLogger,
  ctx: SyncJobContext,
): Promise<void> {
  const batches = createBatches(allVideos);
  let currentSagas = existingSagas.filter((s) => s.source === "ai-detected");

  log.info(`Full analysis: ${allVideos.length} videos → ${batches.length} batches (${BATCH_SIZE} videos/batch)`);
  if (currentSagas.length > 0) {
    log.info(`Continuing from ${currentSagas.length} existing AI sagas`);
  }
  await log.flush();
  await ctx.updateProgress({ phase: "analyzing", fetched: 0, total: batches.length });

  let tailContext = "";

  for (let i = 0; i < batches.length; i++) {
    if (await ctx.isCancelled()) {
      log.warn(`Cancelled at batch ${i + 1}/${batches.length}`);
      await saveSagasToDb(channelId, currentSagas);
      await log.flush();
      return;
    }

    const batchVideos = batches[i];
    const batchInput = batchVideos.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      publishedAt: v.publishedAt,
    }));

    const knownNames = currentSagas.map((s) => s.name);
    const dateRange = formatDateRange(batchVideos);

    log.info(`Batch ${i + 1}/${batches.length} — ${batchInput.length} videos (${dateRange}), ${knownNames.length} known sagas`);
    await log.flush();

    const t0 = Date.now();
    const result = await analyzeBatchFromDb(batchInput, tailContext, knownNames);
    const aiMs = Date.now() - t0;

    log.info(`  AI responded in ${(aiMs / 1000).toFixed(1)}s — ${result.segments.length} segments found`);
    logSegments(log, result.segments);

    const beforeMerge = [...currentSagas];
    currentSagas = mergeSagaSegments(
      currentSagas, result.segments, allVideos, i, playlistVideoIds
    );
    tailContext = result.tailContext;

    logMergeResult(log, beforeMerge, currentSagas, result.segments);

    if ((i + 1) % 3 === 0 || i === batches.length - 1) {
      await saveSagasToDb(channelId, currentSagas);
      log.info(`  Saved ${currentSagas.length} sagas to database`);
    }

    await ctx.updateProgress({ phase: "analyzing", fetched: i + 1, total: batches.length });
    await log.flush();
  }

  await saveSagasToDb(channelId, currentSagas);
  logSummary(log, currentSagas);
  await log.flush();
}

async function runIncrementalAnalysis(
  channelId: string,
  allVideos: VideoData[],
  allSagas: Saga[],
  playlistVideoIds: Set<string>,
  log: JobLogger,
  ctx: SyncJobContext,
): Promise<void> {
  const sorted = [...allVideos].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );

  const sagaVideoIds = new Set(allSagas.flatMap((s) => s.videoIds));
  const runs = findUncategorizedRuns(sorted, sagaVideoIds)
    .flatMap((r) => splitLargeRun(r, BATCH_SIZE));

  if (runs.length === 0) {
    log.info("All videos are already categorized — nothing to do");
    await log.flush();
    return;
  }

  const totalUncatVideos = runs.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
  log.info(`Incremental: ${totalUncatVideos} uncategorized videos in ${runs.length} runs`);
  log.info(`Existing: ${allSagas.length} sagas (${allSagas.filter((s) => s.source === "ai-detected").length} AI, ${allSagas.filter((s) => s.source === "playlist").length} playlist)`);
  await log.flush();

  let currentSagas = allSagas.filter((s) => s.source === "ai-detected");
  await ctx.updateProgress({ phase: "analyzing", fetched: 0, total: runs.length });

  for (let i = 0; i < runs.length; i++) {
    if (await ctx.isCancelled()) {
      log.warn(`Cancelled at run ${i + 1}/${runs.length}`);
      await saveSagasToDb(channelId, currentSagas);
      await log.flush();
      return;
    }

    const runSize = runs[i].end - runs[i].start + 1;
    const { overlapContext, batchVideos } = buildRunContext(runs[i], sorted, allSagas);
    const contextVideos = batchVideos.length - runSize;
    const dateRange = formatDateRange(batchVideos);

    const batchInput = batchVideos.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      publishedAt: v.publishedAt,
    }));

    const knownNames = currentSagas.map((s) => s.name);

    log.info(`Run ${i + 1}/${runs.length} — ${runSize} uncategorized + ${contextVideos} context videos (${dateRange})`);
    await log.flush();

    const t0 = Date.now();
    const result = await analyzeBatchFromDb(batchInput, overlapContext, knownNames);
    const aiMs = Date.now() - t0;

    log.info(`  AI responded in ${(aiMs / 1000).toFixed(1)}s — ${result.segments.length} segments found`);
    logSegments(log, result.segments);

    const beforeMerge = [...currentSagas];
    currentSagas = mergeSagaSegments(
      currentSagas, result.segments, allVideos, 1000 + i, playlistVideoIds
    );

    logMergeResult(log, beforeMerge, currentSagas, result.segments);

    if ((i + 1) % 3 === 0 || i === runs.length - 1) {
      await saveSagasToDb(channelId, currentSagas);
      log.info(`  Saved ${currentSagas.length} sagas to database`);
    }

    await ctx.updateProgress({ phase: "analyzing", fetched: i + 1, total: runs.length });
    await log.flush();
  }

  await saveSagasToDb(channelId, currentSagas);
  logSummary(log, currentSagas);
  await log.flush();
}

export async function syncChannelSagas(
  channelId: string,
  jobId: string,
  mode: SagaMode
): Promise<void> {
  await withSyncJob(jobId, "Saga Analysis", async (log, ctx) => {
    log.info(`Starting saga analysis — mode: ${mode}`);

    const allVideos = await loadChannelVideos(channelId);
    if (allVideos.length === 0) {
      log.warn("No videos found — sync videos first");
      throw new Error("No videos found");
    }

    const dateRange = formatDateRange(allVideos);
    log.info(`Loaded ${allVideos.length} videos (${dateRange})`);
    await log.flush();

    const allSagas = await loadChannelSagas(channelId);
    const aiCount = allSagas.filter((s) => s.source === "ai-detected").length;
    const plCount = allSagas.filter((s) => s.source === "playlist").length;
    const manualCount = allSagas.filter((s) => s.source === "manual").length;
    const playlistVideoIds = new Set(
      allSagas.filter((s) => s.source === "playlist").flatMap((s) => s.videoIds)
    );

    if (allSagas.length > 0) {
      const parts = [];
      if (aiCount > 0) parts.push(`${aiCount} AI`);
      if (plCount > 0) parts.push(`${plCount} playlist`);
      if (manualCount > 0) parts.push(`${manualCount} manual`);
      log.info(`Found ${allSagas.length} existing sagas (${parts.join(", ")})`);
    } else {
      log.info("No existing sagas — starting fresh");
    }
    await log.flush();

    if (mode === "reset") {
      log.info(`Reset mode: deleting ${aiCount} AI sagas...`);
      await db
        .delete(sagas)
        .where(and(eq(sagas.channelId, channelId), eq(sagas.source, "ai-detected")));
      await log.flush();

      await runFullAnalysis(channelId, allVideos, [], playlistVideoIds, log, ctx);
    } else if (mode === "incremental") {
      await runIncrementalAnalysis(channelId, allVideos, allSagas, playlistVideoIds, log, ctx);
    } else {
      const existingAi = allSagas.filter((s) => s.source === "ai-detected");
      await runFullAnalysis(channelId, allVideos, existingAi, playlistVideoIds, log, ctx);
    }
  });
}
