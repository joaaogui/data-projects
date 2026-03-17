"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface SavedChannel {
  channelId: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  label: string | null;
  pinned: number;
  lastVisitedAt: string | null;
}

export function useSavedChannels() {
  return useQuery<SavedChannel[]>({
    queryKey: ["saved-channels"],
    queryFn: async () => {
      const res = await fetch("/api/saved-channels");
      if (!res.ok) return [];
      const data = await res.json();
      return data.channels ?? [];
    },
    staleTime: 60_000,
  });
}

export function useIsChannelTracked(channelId: string) {
  const { data: channels } = useSavedChannels();
  return channels?.some((c) => c.channelId === channelId) ?? false;
}

export function useTrackChannel() {
  const queryClient = useQueryClient();

  const track = useMutation({
    mutationFn: async (channelId: string) => {
      const res = await fetch("/api/saved-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to track channel");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-channels"] });
      queryClient.invalidateQueries({ queryKey: ["pulse"] });
    },
  });

  const untrack = useMutation({
    mutationFn: async (channelId: string) => {
      const res = await fetch("/api/saved-channels", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to untrack channel");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-channels"] });
      queryClient.invalidateQueries({ queryKey: ["pulse"] });
    },
  });

  return { track, untrack };
}
