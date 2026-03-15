import { BATCH_SIZE, createBatches, mergeSagaSegments } from "@/lib/saga-analysis";
import { analyzeSagaBatch } from "@/services/channel-client";
import type { Saga, VideoData } from "@/types/youtube";

export type AnalysisPhase = "idle" | "transcribing" | "analyzing" | "done" | "paused" | "error";

export interface AnalysisProgress {
  phase: AnalysisPhase;
  currentBatch: number;
  totalBatches: number;
  videosProcessed: number;
  videosTotal: number;
  error?: string;
}

type Listener = () => void;

type SaveFn = (sagas: Saga[]) => Promise<unknown>;
type DeleteFn = () => Promise<unknown>;
type SetAiFn = (sagas: Saga[]) => void;

const INITIAL_PROGRESS: AnalysisProgress = {
  phase: "idle",
  currentBatch: 0,
  totalBatches: 0,
  videosProcessed: 0,
  videosTotal: 0,
};

interface UncategorizedRun { start: number; end: number }

function findUncategorizedRuns(sorted: VideoData[], sagaVideoIds: Set<string>): UncategorizedRun[] {
  const runs: UncategorizedRun[] = [];
  let runStart = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (sagaVideoIds.has(sorted[i].videoId)) {
      if (runStart >= 0) runs.push({ start: runStart, end: i - 1 });
      runStart = -1;
    } else if (runStart === -1) {
      runStart = i;
    }
  }
  if (runStart >= 0) runs.push({ start: runStart, end: sorted.length - 1 });
  return runs;
}

function buildRunContext(
  run: UncategorizedRun,
  sorted: VideoData[],
  allSagas: Saga[]
): { overlapContext: string; batchVideos: VideoData[] } {
  const runSize = run.end - run.start + 1;
  const contextSize = runSize <= 2 ? 4 : 2;
  const contextStart = Math.max(0, run.start - contextSize);
  const contextEnd = Math.min(sorted.length - 1, run.end + contextSize);
  const batchVideos = sorted.slice(contextStart, contextEnd + 1);

  const contextBefore = sorted.slice(contextStart, run.start);
  const contextAfter = sorted.slice(run.end + 1, contextEnd + 1);

  let overlapContext = "";
  if (contextBefore.length > 0) {
    const beforeSagas = allSagas.filter((s) =>
      contextBefore.some((v) => s.videoIds.includes(v.videoId))
    );
    if (beforeSagas.length > 0) {
      overlapContext += `Previous saga: "${beforeSagas.at(-1)?.name}". `;
    }
  }
  if (contextAfter.length > 0) {
    const afterSagas = allSagas.filter((s) =>
      contextAfter.some((v) => s.videoIds.includes(v.videoId))
    );
    if (afterSagas.length > 0) {
      overlapContext += `Next saga: "${afterSagas[0]?.name}".`;
    }
  }
  return { overlapContext, batchVideos };
}

class SagaAnalysisStore {
  private progress: AnalysisProgress = { ...INITIAL_PROGRESS };
  private readonly listeners = new Set<Listener>();
  private cancelled = false;
  private currentSagas: Saga[] = [];
  private activeChannelId: string | null = null;
  private running = false;

  saveFn: SaveFn | null = null;
  deleteFn: DeleteFn | null = null;
  setAiFn: SetAiFn | null = null;
  playlistVideoIds = new Set<string>();

  getSnapshot = (): AnalysisProgress => this.progress;

  getActiveChannelId(): string | null {
    return this.activeChannelId;
  }

  isRunning(): boolean {
    return this.running;
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private emit() {
    this.progress = { ...this.progress };
    for (const listener of this.listeners) listener();
  }

  private setProgress(updater: Partial<AnalysisProgress>) {
    Object.assign(this.progress, updater);
    this.emit();
  }

  stop() {
    this.cancelled = true;
    if (this.running) {
      this.setProgress({ phase: "paused" });
    }
  }

  markDoneIfLoaded() {
    if (this.progress.phase === "idle" && !this.running) {
      this.setProgress({ phase: "done" });
    }
  }

  async startAnalysis(
    channelId: string,
    videos: VideoData[],
    existingAiSagas: Saga[],
    preserveExisting: boolean
  ) {
    if (this.running) return;
    this.running = true;
    this.cancelled = false;
    this.activeChannelId = channelId;

    if (preserveExisting) {
      this.currentSagas = [...existingAiSagas];
    } else {
      await this.deleteFn?.();
      this.currentSagas = [];
    }

    const batches = createBatches(videos);

    this.setProgress({
      phase: "transcribing",
      currentBatch: 0,
      totalBatches: batches.length,
      videosProcessed: 0,
      videosTotal: videos.length,
      error: undefined,
    });

    let tailContext = "";

    for (let i = 0; i < batches.length; i++) {
      if (this.cancelled) {
        console.log(`[Saga Analysis] Paused at batch ${i + 1}, saving ${this.currentSagas.length} sagas`);
        await this.saveFn?.([...this.currentSagas]);
        this.setProgress({ phase: "paused" });
        this.running = false;
        return;
      }

      this.setProgress({
        phase: "analyzing",
        currentBatch: i + 1,
        videosProcessed: Math.min(i * BATCH_SIZE, videos.length),
      });

      try {
        const batchInput = batches[i].map((v) => ({
          videoId: v.videoId,
          title: v.title,
          publishedAt: v.publishedAt,
        }));

        const knownNames = this.currentSagas
          .filter((s) => s.source === "ai-detected")
          .map((s) => s.name);

        const result = await analyzeSagaBatch(batchInput, tailContext, knownNames);

        this.currentSagas = mergeSagaSegments(
          this.currentSagas, result.segments, videos, i, this.playlistVideoIds
        );
        tailContext = result.tailContext;

        this.setAiFn?.([...this.currentSagas]);

        if ((i + 1) % 5 === 0) {
          console.log(`[Saga Analysis] Batch ${i + 1}/${batches.length}, saving ${this.currentSagas.length} sagas`);
          await this.saveFn?.([...this.currentSagas]);
        }

        this.setProgress({
          videosProcessed: Math.min((i + 1) * BATCH_SIZE, videos.length),
        });
      } catch (err) {
        console.error(`[Saga Analysis] Batch ${i + 1} failed:`, err);
        await this.saveFn?.([...this.currentSagas]);
        this.setProgress({
          phase: "error",
          error: err instanceof Error ? err.message : "Analysis failed",
        });
        this.running = false;
        return;
      }
    }

    console.log(`[Saga Analysis] Complete, saving final ${this.currentSagas.length} sagas`);
    await this.saveFn?.([...this.currentSagas]);
    this.setProgress({ phase: "done", videosProcessed: videos.length });
    this.running = false;
  }

  async startIncremental(
    channelId: string,
    videos: VideoData[],
    allSagas: Saga[],
    aiSagas: Saga[]
  ) {
    if (this.running) return;
    this.running = true;
    this.cancelled = false;
    this.activeChannelId = channelId;

    const sorted = [...videos].sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );

    const sagaVideoIds = new Set(allSagas.flatMap((s) => s.videoIds));
    const runs = findUncategorizedRuns(sorted, sagaVideoIds);

    if (runs.length === 0) {
      this.setProgress({ phase: "done" });
      this.running = false;
      return;
    }

    const totalUncatVideos = runs.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
    console.log(`[Incremental] Found ${runs.length} uncategorized runs, ${totalUncatVideos} videos`);

    this.currentSagas = [...aiSagas];

    this.setProgress({
      phase: "analyzing",
      currentBatch: 0,
      totalBatches: runs.length,
      videosProcessed: 0,
      videosTotal: totalUncatVideos,
      error: undefined,
    });

    let processedVideos = 0;

    for (let i = 0; i < runs.length; i++) {
      if (this.cancelled) {
        await this.saveFn?.([...this.currentSagas]);
        this.setProgress({ phase: "paused" });
        this.running = false;
        return;
      }

      const { overlapContext, batchVideos } = buildRunContext(runs[i], sorted, allSagas);

      this.setProgress({ currentBatch: i + 1, videosProcessed: processedVideos });

      try {
        const batchInput = batchVideos.map((v) => ({
          videoId: v.videoId,
          title: v.title,
          publishedAt: v.publishedAt,
        }));

        const knownNames = this.currentSagas
          .filter((s) => s.source === "ai-detected")
          .map((s) => s.name);

        const result = await analyzeSagaBatch(batchInput, overlapContext, knownNames);

        this.currentSagas = mergeSagaSegments(
          this.currentSagas, result.segments, videos, 1000 + i, this.playlistVideoIds
        );

        processedVideos += runs[i].end - runs[i].start + 1;
        this.setAiFn?.([...this.currentSagas]);

        if ((i + 1) % 5 === 0) {
          await this.saveFn?.([...this.currentSagas]);
        }
      } catch (err) {
        console.error(`[Incremental] Run ${i + 1} failed:`, err);
        await this.saveFn?.([...this.currentSagas]);
        this.setProgress({
          phase: "error",
          error: err instanceof Error ? err.message : "Analysis failed",
        });
        this.running = false;
        return;
      }
    }

    console.log(`[Incremental] Done, saving ${this.currentSagas.length} sagas`);
    await this.saveFn?.([...this.currentSagas]);
    this.setProgress({ phase: "done", videosProcessed: totalUncatVideos });
    this.running = false;
  }
}

export const sagaAnalysisStore = new SagaAnalysisStore();
