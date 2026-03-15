export interface GlobalStats {
  channels: number;
  videos: number;
  transcripts: number;
  sagas: number;
  syncJobs: number;
  suggestions: number;
  transcriptsNoContent: number;
  videosWithoutTranscripts: number;
}

export interface ChannelRow {
  id: string;
  title: string;
  thumbnail_url: string | null;
  fetched_at: string;
  video_count: number;
  transcript_count: number;
  has_excerpt: number;
  has_full_text: number;
  null_transcripts: number;
  playlist_sagas: number;
  ai_sagas: number;
}

import type { FetchProgress } from "./youtube";

export interface SyncJob {
  id: string;
  channelId: string;
  channelTitle: string | null;
  type: "videos" | "transcripts";
  status: "pending" | "running" | "completed" | "failed";
  progress: FetchProgress | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StatsData {
  global: GlobalStats;
  channels: ChannelRow[];
}

export type CleanupAction =
  | "delete-transcripts"
  | "delete-sagas"
  | "delete-ai-sagas"
  | "delete-videos"
  | "delete-channel"
  | "delete-sync-jobs"
  | "delete-suggestion-cache"
  | "delete-completed-sync-jobs"
  | "delete-null-transcripts";

export interface CleanupRequest {
  action: CleanupAction;
  channelId?: string;
}

export interface BulkRequest {
  action: "sync-videos" | "sync-transcripts" | CleanupAction;
  channelIds: string[];
}
