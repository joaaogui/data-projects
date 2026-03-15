"use client";

import { useSagaStorage } from "@/hooks/use-saga-storage";
import { sagaAnalysisStore } from "@/lib/saga-analysis-store";
import type { Saga, VideoData } from "@/types/youtube";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

export type { AnalysisPhase, AnalysisProgress } from "@/lib/saga-analysis-store";

export function useChannelSagas(channelId: string | null, videos: VideoData[] | undefined) {
  const {
    allSagas, aiSagas, playlistSagas,
    setAiSagas, saveAiSagas, deleteAiSagas,
    isLoading: isLoadingSagas,
  } = useSagaStorage(channelId);

  const progress = useSyncExternalStore(
    sagaAnalysisStore.subscribe,
    sagaAnalysisStore.getSnapshot,
    sagaAnalysisStore.getSnapshot
  );

  useEffect(() => { sagaAnalysisStore.saveFn = saveAiSagas; }, [saveAiSagas]);
  useEffect(() => { sagaAnalysisStore.deleteFn = deleteAiSagas; }, [deleteAiSagas]);
  useEffect(() => { sagaAnalysisStore.setAiFn = setAiSagas; }, [setAiSagas]);
  useEffect(() => {
    sagaAnalysisStore.playlistVideoIds = new Set(playlistSagas.flatMap((s) => s.videoIds));
  }, [playlistSagas]);

  useEffect(() => {
    if (aiSagas.length > 0 && progress.phase === "idle" && !sagaAnalysisStore.isRunning()) {
      sagaAnalysisStore.markDoneIfLoaded();
    }
  }, [aiSagas.length, progress.phase]);

  const realSagas = useMemo(
    () => [...allSagas].sort((a, b) => a.dateRange.first.localeCompare(b.dateRange.first)),
    [allSagas]
  );

  const uncategorizedVideoIds = useMemo(() => {
    if (!videos) return [];
    const sagaVideoIds = new Set(realSagas.flatMap((s) => s.videoIds));
    return videos.filter((v) => !sagaVideoIds.has(v.videoId)).map((v) => v.videoId);
  }, [videos, realSagas]);

  const sagas = useMemo(() => {
    if (uncategorizedVideoIds.length === 0) return realSagas;

    const dates = uncategorizedVideoIds
      .map((id) => videos?.find((v) => v.videoId === id)?.publishedAt)
      .filter((d): d is string => Boolean(d))
      .sort((a, b) => a.localeCompare(b));

    const standaloneSaga: Saga = {
      id: "standalone",
      name: "Standalone Videos",
      source: "manual",
      videoIds: uncategorizedVideoIds,
      videoCount: uncategorizedVideoIds.length,
      dateRange: { first: dates[0] ?? "", last: dates.at(-1) ?? "" },
    };

    return [...realSagas, standaloneSaga];
  }, [realSagas, uncategorizedVideoIds, videos]);

  const startAnalysis = useCallback(() => {
    if (!channelId || !videos || videos.length === 0) return;
    sagaAnalysisStore.startAnalysis(channelId, videos, aiSagas, true);
  }, [channelId, videos, aiSagas]);

  const resetAndReanalyze = useCallback(() => {
    if (!channelId || !videos || videos.length === 0) return;
    sagaAnalysisStore.startAnalysis(channelId, videos, aiSagas, false);
  }, [channelId, videos, aiSagas]);

  const startIncrementalAnalysis = useCallback(() => {
    if (!channelId || !videos || videos.length === 0) return;
    sagaAnalysisStore.startIncremental(channelId, videos, allSagas, aiSagas);
  }, [channelId, videos, allSagas, aiSagas]);

  const stopAnalysis = useCallback(() => {
    sagaAnalysisStore.stop();
  }, []);

  return {
    sagas,
    uncategorizedVideoIds,
    isLoadingSagas,
    progress,
    startAnalysis,
    resetAndReanalyze,
    startIncrementalAnalysis,
    stopAnalysis,
  };
}
