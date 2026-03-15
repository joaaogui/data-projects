"use client";

import { useSagaStorage } from "@/hooks/use-saga-storage";
import type { VideoData } from "@/types/youtube";
import { useCallback, useMemo } from "react";
import { useChannel } from "./use-channel-context";
import type { SyncJobState } from "./use-sync";

export interface AnalysisProgress {
  phase: "idle" | "analyzing" | "done" | "error";
  currentBatch: number;
  totalBatches: number;
  error?: string;
}

function toProgress(sagaSync: SyncJobState | null, hasAiSagas: boolean): AnalysisProgress {
  if (!sagaSync) {
    return {
      phase: hasAiSagas ? "done" : "idle",
      currentBatch: 0,
      totalBatches: 0,
    };
  }

  switch (sagaSync.status) {
    case "pending":
    case "running":
      return {
        phase: "analyzing",
        currentBatch: sagaSync.progress?.fetched ?? 0,
        totalBatches: sagaSync.progress?.total ?? 0,
      };
    case "completed":
      return { phase: "done", currentBatch: 0, totalBatches: 0 };
    case "failed":
      return {
        phase: "error",
        currentBatch: 0,
        totalBatches: 0,
        error: sagaSync.error ?? "Analysis failed",
      };
  }
}

export function useChannelSagas(channelId: string | null, videos: VideoData[] | undefined) {
  const {
    allSagas, aiSagas,
    isLoading: isLoadingSagas,
  } = useSagaStorage(channelId);

  const { sagaSync, sagaLogs, syncSagas, cancelSync } = useChannel();

  const progress = useMemo(
    () => toProgress(sagaSync, aiSagas.length > 0),
    [sagaSync, aiSagas.length]
  );

  const realSagas = useMemo(
    () => [...allSagas].sort((a, b) => a.dateRange.first.localeCompare(b.dateRange.first)),
    [allSagas]
  );

  const uncategorizedVideoIds = useMemo(() => {
    if (!videos) return [];
    const sagaVideoIds = new Set(realSagas.flatMap((s) => s.videoIds));
    return videos.filter((v) => !sagaVideoIds.has(v.videoId)).map((v) => v.videoId);
  }, [videos, realSagas]);

  const sagas = realSagas;

  const startAnalysis = useCallback(() => {
    if (!channelId || !videos || videos.length === 0) return;
    syncSagas({ mode: "full" });
  }, [channelId, videos, syncSagas]);

  const resetAndReanalyze = useCallback(() => {
    if (!channelId || !videos || videos.length === 0) return;
    syncSagas({ mode: "reset" });
  }, [channelId, videos, syncSagas]);

  const startIncrementalAnalysis = useCallback(() => {
    if (!channelId || !videos || videos.length === 0) return;
    syncSagas({ mode: "incremental" });
  }, [channelId, videos, syncSagas]);

  const stopAnalysis = useCallback(() => {
    cancelSync("sagas");
  }, [cancelSync]);

  return {
    sagas,
    uncategorizedVideoIds,
    isLoadingSagas,
    progress,
    sagaLogs,
    startAnalysis,
    resetAndReanalyze,
    startIncrementalAnalysis,
    stopAnalysis,
  };
}
