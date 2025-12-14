"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchChannelById } from "@/services/channel";

export function useChannelInfo(channelId: string | null) {
  return useQuery({
    queryKey: ["channel-info", channelId],
    queryFn: () => fetchChannelById(channelId!),
    enabled: !!channelId,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24 * 7,
  });
}



