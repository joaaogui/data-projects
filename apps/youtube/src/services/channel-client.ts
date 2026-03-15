import type { ChannelInfo, ChannelSuggestion, PlaylistInfo, VideoData } from "@/types/youtube";

export type { ChannelInfo, ChannelSuggestion } from "@/types/youtube";

export const CHANNEL_PREFIX = "https://www.youtube.com/channel/";

export async function fetchChannelSearch(query: string): Promise<ChannelInfo> {
  const response = await fetch(`/api/youtube/search/${encodeURIComponent(query)}`);

  if (response.status === 429) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to search channel");
  }

  return response.json();
}

export async function fetchChannelById(channelId: string): Promise<ChannelInfo> {
  const response = await fetch(`/api/youtube/info/${channelId}`);

  if (response.status === 429) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch channel info");
  }

  return response.json();
}

export interface ChannelVideosResponse {
  videos: VideoData[];
  source: "database" | "none";
  fresh: boolean;
  fetchedAt: string | null;
}

export async function fetchChannelVideos(channelId: string): Promise<ChannelVideosResponse> {
  const response = await fetch(`/api/youtube/channel/${channelId}`);

  if (response.status === 429) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch channel videos");
  }

  return response.json();
}

export async function fetchChannelSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<ChannelSuggestion[]> {
  const response = await fetch(`/api/youtube/suggest/${encodeURIComponent(query)}`, {
    signal,
  });

  if (response.status === 429) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  if (!response.ok) {
    throw new Error("Failed to fetch suggestions");
  }

  return response.json();
}

export async function fetchChannelPlaylists(channelId: string): Promise<PlaylistInfo[]> {
  const response = await fetch(`/api/youtube/playlists/${channelId}`);

  if (response.status === 429) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch playlists");
  }

  return response.json();
}

export interface SagaBatchResult {
  segments: Array<{ name: string; videoIds: string[]; reasoning?: string; videoEvidence?: Record<string, string> }>;
  tailContext: string;
}

export async function analyzeSagaBatch(
  videos: Array<{ videoId: string; title: string; publishedAt: string }>,
  overlapContext?: string,
  knownSagaNames?: string[]
): Promise<SagaBatchResult> {
  const response = await fetch("/api/youtube/sagas/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videos, overlapContext, knownSagaNames }),
  });

  if (response.status === 429) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to analyze saga batch");
  }

  return response.json();
}

