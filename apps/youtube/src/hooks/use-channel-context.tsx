"use client";

import type { ChannelInfo, SyncLogEntry, VideoData } from "@/types/youtube";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useAccountData, type AccountDataResult } from "./use-account-data";
import { useChannelInfo } from "./use-channel-info";
import { useChannelVideos } from "./use-channel-videos";
import { useSync, type SyncJobState, type SyncJobType } from "./use-sync";

interface ChannelContextValue {
  channelId: string;
  channelInfo: ChannelInfo | undefined;
  isLoadingChannel: boolean;
  channelError: Error | null;

  videos: VideoData[] | null;
  source: string | null;
  fresh: boolean | null;
  fetchedAt: string | null;
  isLoadingVideos: boolean;
  isFetchingVideos: boolean;

  videoSync: SyncJobState | null;
  transcriptSync: SyncJobState | null;
  sagaSync: SyncJobState | null;
  videoLogs: SyncLogEntry[];
  transcriptLogs: SyncLogEntry[];
  sagaLogs: SyncLogEntry[];
  syncVideos: () => Promise<void> | void;
  syncTranscripts: (options?: { retry?: boolean }) => Promise<void> | void;
  syncSagas: (options?: { mode?: "full" | "incremental" | "reset" }) => Promise<void> | void;
  cancelSync: (type: SyncJobType) => Promise<void> | void;
  isVideoSyncing: boolean;
  isTranscriptSyncing: boolean;
  isSagaSyncing: boolean;
  isSyncing: boolean;

  handleRefresh: () => void;

  accountData: AccountDataResult;
}

const ChannelContext = createContext<ChannelContextValue | null>(null);

export function ChannelProvider({
  channelId,
  children,
}: Readonly<{
  channelId: string;
  children: ReactNode;
}>) {
  const {
    data: channelInfo,
    isLoading: isLoadingChannel,
    error: channelError,
  } = useChannelInfo(channelId);

  const {
    videos,
    source,
    fresh,
    fetchedAt,
    isLoading: isLoadingVideos,
    isFetching: isFetchingVideos,
  } = useChannelVideos(channelId);

  const {
    videoSync,
    transcriptSync,
    sagaSync,
    videoLogs,
    transcriptLogs,
    sagaLogs,
    syncVideos,
    syncTranscripts,
    syncSagas,
    cancelSync,
    isVideoSyncing,
    isTranscriptSyncing,
    isSagaSyncing,
    isSyncing,
  } = useSync(channelId);

  const queryClient = useQueryClient();

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["channel-videos", channelId] });
    queryClient.invalidateQueries({ queryKey: ["channel-info", channelId] });
  }, [queryClient, channelId]);

  const accountData = useAccountData(
    channelId,
    videos?.map((v) => v.videoId) ?? null
  );

  const value = useMemo<ChannelContextValue>(
    () => ({
      channelId,
      channelInfo,
      isLoadingChannel,
      channelError: channelError as Error | null,
      videos,
      source,
      fresh,
      fetchedAt,
      isLoadingVideos,
      isFetchingVideos,
      videoSync,
      transcriptSync,
      sagaSync,
      videoLogs,
      transcriptLogs,
      sagaLogs,
      syncVideos,
      syncTranscripts,
      syncSagas,
      cancelSync,
      isVideoSyncing,
      isTranscriptSyncing,
      isSagaSyncing,
      isSyncing,
      handleRefresh,
      accountData,
    }),
    [
      channelId, channelInfo, isLoadingChannel, channelError,
      videos, source, fresh, fetchedAt, isLoadingVideos, isFetchingVideos,
      videoSync, transcriptSync, sagaSync, videoLogs, transcriptLogs, sagaLogs,
      syncVideos, syncTranscripts, syncSagas, cancelSync,
      isVideoSyncing, isTranscriptSyncing, isSagaSyncing, isSyncing, handleRefresh,
      accountData,
    ]
  );

  return (
    <ChannelContext.Provider value={value}>
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannel() {
  const ctx = useContext(ChannelContext);
  if (!ctx) throw new Error("useChannel must be used within ChannelProvider");
  return ctx;
}
