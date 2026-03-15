import { db } from "@/db";
import { sagas, syncJobs, videos } from "@/db/schema";
import type { Saga, VideoData } from "@/types/youtube";
import { and, eq, notInArray } from "drizzle-orm";
import { analyzeBatchFromDb } from "./saga-ai";
import {
  BATCH_SIZE,
  buildRunContext,
  createBatches,
  findUncategorizedRuns,
  mergeSagaSegments,
  splitLargeRun,
} from "./saga-analysis";
import { createJobLogger } from "./sync-logger";

type SagaMode = "full" | "incremental" | "reset";

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

const MAX_SAGAS = 200;

async function saveSagasToDb(channelId: string, sagaList: Saga[]): Promise<void> {
  const toUpsert = sagaList.slice(0, MAX_SAGAS);

  for (const s of toUpsert) {
    await db
      .insert(sagas)
      .values({
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
      })
      .onConflictDoUpdate({
        target: sagas.id,
        set: {
          name: s.name,
          source: s.source,
          playlistId: s.playlistId ?? null,
          videoIds: s.videoIds,
          videoCount: s.videoCount,
          dateRange: s.dateRange,
          reasoning: s.reasoning ?? null,
          videoEvidence: s.videoEvidence ?? null,
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

async function isJobCancelled(jobId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: syncJobs.status })
    .from(syncJobs)
    .where(eq(syncJobs.id, jobId))
    .limit(1);
  return row?.status !== "running";
}

async function runFullAnalysis(
  channelId: string,
  jobId: string,
  allVideos: VideoData[],
  existingSagas: Saga[],
  playlistVideoIds: Set<string>,
  log: ReturnType<typeof createJobLogger>
): Promise<void> {
  const batches = createBatches(allVideos);
  let currentSagas = existingSagas.filter((s) => s.source === "ai-detected");

  log.info(`Full analysis: ${allVideos.length} videos, ${batches.length} batches`);
  await log.flush();

  await db
    .update(syncJobs)
    .set({
      progress: { phase: "analyzing", fetched: 0, total: batches.length },
      updatedAt: new Date(),
    })
    .where(eq(syncJobs.id, jobId));

  let tailContext = "";

  for (let i = 0; i < batches.length; i++) {
    if (await isJobCancelled(jobId)) {
      log.warn(`Cancelled at batch ${i + 1}/${batches.length}`);
      await saveSagasToDb(channelId, currentSagas);
      await log.flush();
      return;
    }

    const batchInput = batches[i].map((v) => ({
      videoId: v.videoId,
      title: v.title,
      publishedAt: v.publishedAt,
    }));

    const knownNames = currentSagas.map((s) => s.name);

    log.info(`Batch ${i + 1}/${batches.length} (${batchInput.length} videos)...`);
    await log.flush();

    const result = await analyzeBatchFromDb(batchInput, tailContext, knownNames);

    currentSagas = mergeSagaSegments(
      currentSagas, result.segments, allVideos, i, playlistVideoIds
    );
    tailContext = result.tailContext;

    if ((i + 1) % 3 === 0 || i === batches.length - 1) {
      await saveSagasToDb(channelId, currentSagas);
    }

    await db
      .update(syncJobs)
      .set({
        progress: { phase: "analyzing", fetched: i + 1, total: batches.length },
        updatedAt: new Date(),
      })
      .where(eq(syncJobs.id, jobId));

    log.info(`Batch ${i + 1} done — ${currentSagas.length} sagas so far`);
    await log.flush();
  }

  await saveSagasToDb(channelId, currentSagas);
}

async function runIncrementalAnalysis(
  channelId: string,
  jobId: string,
  allVideos: VideoData[],
  allSagas: Saga[],
  playlistVideoIds: Set<string>,
  log: ReturnType<typeof createJobLogger>
): Promise<void> {
  const sorted = [...allVideos].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
  );

  const sagaVideoIds = new Set(allSagas.flatMap((s) => s.videoIds));
  const runs = findUncategorizedRuns(sorted, sagaVideoIds)
    .flatMap((r) => splitLargeRun(r, BATCH_SIZE));

  if (runs.length === 0) {
    log.info("No uncategorized videos found");
    await log.flush();
    return;
  }

  const totalUncatVideos = runs.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
  log.info(`Incremental: ${runs.length} runs, ${totalUncatVideos} uncategorized videos`);
  await log.flush();

  let currentSagas = allSagas.filter((s) => s.source === "ai-detected");

  await db
    .update(syncJobs)
    .set({
      progress: { phase: "analyzing", fetched: 0, total: runs.length },
      updatedAt: new Date(),
    })
    .where(eq(syncJobs.id, jobId));

  for (let i = 0; i < runs.length; i++) {
    if (await isJobCancelled(jobId)) {
      log.warn(`Cancelled at run ${i + 1}/${runs.length}`);
      await saveSagasToDb(channelId, currentSagas);
      await log.flush();
      return;
    }

    const { overlapContext, batchVideos } = buildRunContext(runs[i], sorted, allSagas);

    const batchInput = batchVideos.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      publishedAt: v.publishedAt,
    }));

    const knownNames = currentSagas.map((s) => s.name);

    log.info(`Run ${i + 1}/${runs.length} (${batchInput.length} videos)...`);
    await log.flush();

    const result = await analyzeBatchFromDb(batchInput, overlapContext, knownNames);

    currentSagas = mergeSagaSegments(
      currentSagas, result.segments, allVideos, 1000 + i, playlistVideoIds
    );

    if ((i + 1) % 3 === 0 || i === runs.length - 1) {
      await saveSagasToDb(channelId, currentSagas);
    }

    await db
      .update(syncJobs)
      .set({
        progress: { phase: "analyzing", fetched: i + 1, total: runs.length },
        updatedAt: new Date(),
      })
      .where(eq(syncJobs.id, jobId));

    log.info(`Run ${i + 1} done — ${currentSagas.length} sagas so far`);
    await log.flush();
  }

  await saveSagasToDb(channelId, currentSagas);
}

export async function syncChannelSagas(
  channelId: string,
  jobId: string,
  mode: SagaMode
): Promise<void> {
  const t0 = Date.now();
  const log = createJobLogger(jobId, "Saga Analysis");
  log.info(`Starting saga analysis (mode: ${mode}) for channel ${channelId}`);

  try {
    await db
      .update(syncJobs)
      .set({ status: "running", progress: { phase: "init", fetched: 0 }, updatedAt: new Date() })
      .where(eq(syncJobs.id, jobId));
    await log.flush();

    const allVideos = await loadChannelVideos(channelId);
    if (allVideos.length === 0) {
      log.warn("No videos found — sync videos first");
      await log.flush();
      await db
        .update(syncJobs)
        .set({ status: "failed", error: "No videos found", updatedAt: new Date() })
        .where(eq(syncJobs.id, jobId));
      return;
    }

    log.info(`Loaded ${allVideos.length} videos from database`);
    await log.flush();

    const allSagas = await loadChannelSagas(channelId);
    const playlistVideoIds = new Set(
      allSagas.filter((s) => s.source === "playlist").flatMap((s) => s.videoIds)
    );

    if (mode === "reset") {
      log.info("Reset mode: deleting existing AI sagas...");
      await db
        .delete(sagas)
        .where(and(eq(sagas.channelId, channelId), eq(sagas.source, "ai-detected")));
      await log.flush();

      await runFullAnalysis(channelId, jobId, allVideos, [], playlistVideoIds, log);
    } else if (mode === "incremental") {
      await runIncrementalAnalysis(channelId, jobId, allVideos, allSagas, playlistVideoIds, log);
    } else {
      const existingAi = allSagas.filter((s) => s.source === "ai-detected");
      await runFullAnalysis(channelId, jobId, allVideos, existingAi, playlistVideoIds, log);
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log.info(`Completed in ${elapsed}s`);
    await log.flush();

    await db
      .update(syncJobs)
      .set({
        status: "completed",
        progress: { phase: "done", fetched: 0, total: 0 },
        updatedAt: new Date(),
      })
      .where(eq(syncJobs.id, jobId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error(`Failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${message}`);
    await log.flush();
    await db
      .update(syncJobs)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(syncJobs.id, jobId));
    throw error;
  }
}
