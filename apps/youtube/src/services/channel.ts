import type { VideoData } from "@/types/youtube";

export const CHANNEL_PREFIX = "https://www.youtube.com/channel/";

export interface ChannelInfo {
  channelId: string;
  channelTitle: string;
  thumbnails: {
    default: {
      url: string;
    };
  };
}

export interface ChannelSuggestion {
  channelId: string;
  channelTitle: string;
  thumbnails?: { default?: { url?: string } };
  videoCount?: number;
}

export async function fetchChannelSearch(query: string): Promise<ChannelInfo> {
  const response = await fetch(`/api/youtube/search/${encodeURIComponent(query)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to search channel");
  }

  return response.json();
}

export async function fetchChannelById(channelId: string): Promise<ChannelInfo> {
  const response = await fetch(`/api/youtube/info/${channelId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch channel info");
  }

  return response.json();
}

export async function fetchChannelVideos(channelId: string): Promise<VideoData[]> {
  const response = await fetch(`/api/youtube/channel/${channelId}`);

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

  if (!response.ok) {
    throw new Error("Failed to fetch suggestions");
  }

  return response.json();
}

