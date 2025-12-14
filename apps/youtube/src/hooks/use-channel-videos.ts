"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchChannelVideos } from "@/services/channel";

const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;           

export function useChannelVideos(channelId: string | null) {
  return useQuery({
    queryKey: ["channel-videos", channelId],
    queryFn: () => fetchChannelVideos(channelId!),
    enabled: !!channelId,
    staleTime: CACHE_MAX_AGE_MS,
    gcTime: CACHE_MAX_AGE_MS,
  });
}

