import { apiFetch } from "@data-projects/shared";
import type { ChannelInfo, ChannelSuggestion, VideoData } from "@/types/youtube";

export type { ChannelInfo, ChannelSuggestion } from "@/types/youtube";

export const CHANNEL_PREFIX = "https://www.youtube.com/channel/";

export async function fetchChannelSearch(query: string): Promise<ChannelInfo> {
  return apiFetch<ChannelInfo>(
    `/api/youtube/search/${encodeURIComponent(query)}`,
    { fallbackError: "Failed to search channel" },
  );
}

export async function fetchChannelById(channelId: string): Promise<ChannelInfo> {
  return apiFetch<ChannelInfo>(`/api/youtube/info/${channelId}`, {
    fallbackError: "Failed to fetch channel info",
  });
}

export interface ChannelVideosResponse {
  videos: VideoData[];
  source: "database" | "none";
  fresh: boolean;
  fetchedAt: string | null;
}

export async function fetchChannelVideos(
  channelId: string,
): Promise<ChannelVideosResponse> {
  return apiFetch<ChannelVideosResponse>(
    `/api/youtube/channel/${channelId}?fields=compact`,
    { fallbackError: "Failed to fetch channel videos" },
  );
}

export interface VideoDetailResponse {
  videoId: string;
  description: string | null;
}

export async function fetchVideoDetail(
  videoId: string,
): Promise<VideoDetailResponse> {
  return apiFetch<VideoDetailResponse>(`/api/youtube/video/${videoId}`, {
    fallbackError: "Failed to fetch video details",
  });
}

export async function fetchChannelSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<ChannelSuggestion[]> {
  return apiFetch<ChannelSuggestion[]>(
    `/api/youtube/suggest/${encodeURIComponent(query)}`,
    { signal, fallbackError: "Failed to fetch suggestions" },
  );
}
