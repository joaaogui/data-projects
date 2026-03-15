import type { ChannelInfo, ChannelSuggestion, PlaylistInfo, VideoData } from "@/types/youtube";

export type { ChannelInfo, ChannelSuggestion } from "@/types/youtube";

export const CHANNEL_PREFIX = "https://www.youtube.com/channel/";

async function apiFetch(
  url: string,
  init?: RequestInit,
  fallbackError = "Request failed"
): Promise<Response> {
  const response = await fetch(url, init);

  if (response.status === 429) {
    throw new Error("Too many requests. Please wait a moment and try again.");
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || fallbackError);
  }

  return response;
}

export async function fetchChannelSearch(query: string): Promise<ChannelInfo> {
  const response = await apiFetch(
    `/api/youtube/search/${encodeURIComponent(query)}`,
    undefined,
    "Failed to search channel"
  );
  return response.json();
}

export async function fetchChannelById(channelId: string): Promise<ChannelInfo> {
  const response = await apiFetch(
    `/api/youtube/info/${channelId}`,
    undefined,
    "Failed to fetch channel info"
  );
  return response.json();
}

export interface ChannelVideosResponse {
  videos: VideoData[];
  source: "database" | "none";
  fresh: boolean;
  fetchedAt: string | null;
}

export async function fetchChannelVideos(channelId: string): Promise<ChannelVideosResponse> {
  const response = await apiFetch(
    `/api/youtube/channel/${channelId}`,
    undefined,
    "Failed to fetch channel videos"
  );
  return response.json();
}

export async function fetchChannelSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<ChannelSuggestion[]> {
  const response = await apiFetch(
    `/api/youtube/suggest/${encodeURIComponent(query)}`,
    { signal },
    "Failed to fetch suggestions"
  );
  return response.json();
}

export async function fetchChannelPlaylists(channelId: string): Promise<PlaylistInfo[]> {
  const response = await apiFetch(
    `/api/youtube/playlists/${channelId}`,
    undefined,
    "Failed to fetch playlists"
  );
  return response.json();
}

