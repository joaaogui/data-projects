"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchChannelVideos, type ChannelVideosResponse } from "@/services/channel-client";

const STALE_TIME_MS = 5 * 60 * 1000;

export function useChannelVideos(channelId: string | null) {
  const query = useQuery<ChannelVideosResponse>({
    queryKey: ["channel-videos", channelId],
    queryFn: () => fetchChannelVideos(channelId!), // NOSONAR
    enabled: !!channelId,
    staleTime: STALE_TIME_MS,
  });

  const videos = query.data?.videos ?? null;
  const source = query.data?.source ?? null;
  const fresh = query.data?.fresh ?? null;
  const fetchedAt = query.data?.fetchedAt ?? null;
  const needsSync = source === "none" || (source === "database" && fresh === false);

  return { ...query, videos, source, fresh, fetchedAt, needsSync };
}
