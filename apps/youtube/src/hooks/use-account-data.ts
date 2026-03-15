"use client";

import type { AccountChannelData } from "@/types/youtube";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

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
    const body = await res.text().catch(() => "");
    console.error("[useAccountData] failed:", res.status, body.slice(0, 200));
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
  const idKey = videoIds?.join(",") ?? "";

  const query = useQuery<AccountChannelData>({
    queryKey: ["account-data", channelId, idKey],
    queryFn: () => fetchAccountData(channelId!, videoIds!),
    enabled: !!channelId && !!videoIds && videoIds.length > 0,
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
