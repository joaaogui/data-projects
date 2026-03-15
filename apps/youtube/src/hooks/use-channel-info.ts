"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchChannelById } from "@/services/channel-client";

const ONE_DAY_MS = 1000 * 60 * 60 * 24;

export function useChannelInfo(channelId: string | null) {
  return useQuery({
    queryKey: ["channel-info", channelId],
    queryFn: () => fetchChannelById(channelId!),
    enabled: !!channelId,
    staleTime: ONE_DAY_MS,
  });
}
