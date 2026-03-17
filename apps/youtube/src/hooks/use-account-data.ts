"use client";

import type { AccountChannelData } from "@/types/youtube";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef } from "react";

async function fetchAccountData(
  channelId: string,
  videoIds: string[]
): Promise<AccountChannelData> {
  const res = await fetch(`/api/youtube/account/${channelId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoIds }),
  });
  if (!res.ok) {
    throw new Error(`Account data fetch failed: ${res.status}`);
  }
  return res.json();
}

export interface AccountDataResult {
  isSubscribed: boolean;
  likedVideoIds: Set<string>;
  playlistMap: Map<string, string[]>;
  isLoading: boolean;
  error: string | null;
  isError: boolean;
}

export function useAccountData(
  channelId: string | null,
  videoIds: string[] | null
): AccountDataResult {
  const videoCount = videoIds?.length ?? 0;
  const stableVideoIds = useRef(videoIds);
  if (videoIds && stableVideoIds.current !== videoIds) {
    const prev = stableVideoIds.current;
    const changed = prev?.length !== videoIds.length || prev[0] !== videoIds[0] || prev.at(-1) !== videoIds.at(-1);
    if (changed) {
      stableVideoIds.current = videoIds;
    }
  }

  const query = useQuery<AccountChannelData>({
    queryKey: ["account-data", channelId, videoCount],
    queryFn: () => {
      const cid = channelId;
      const vids = stableVideoIds.current;
      if (!cid || !vids) throw new Error("Precondition failed");
      return fetchAccountData(cid, vids);
    },
    enabled: !!channelId && !!stableVideoIds.current && videoCount > 0,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const likedVideoIds = useMemo(
    () => new Set(query.data?.likedVideoIds ?? []),
    [query.data?.likedVideoIds]
  );

  const playlistMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const pl of query.data?.playlists ?? []) {
      for (const vid of pl.videoIds) {
        const existing = map.get(vid) ?? [];
        existing.push(pl.title);
        map.set(vid, existing);
      }
    }
    return map;
  }, [query.data?.playlists]);

  const isSubscribed = query.data?.isSubscribed ?? false;
  const isLoading = query.isLoading;
  const error = query.error?.message ?? null;
  const isError = query.isError;

  return useMemo(() => ({
    isSubscribed,
    likedVideoIds,
    playlistMap,
    isLoading,
    error,
    isError,
  }), [isSubscribed, likedVideoIds, playlistMap, isLoading, error, isError]);
}
