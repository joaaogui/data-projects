"use client";

import type { Saga, SagaSuggestion } from "@/types/youtube";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";

async function fetchSuggestions(
  videoIds: string[],
  sagas: Array<{ id: string; name: string }>
): Promise<SagaSuggestion[]> {
  const res = await fetch("/api/youtube/sagas/suggest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoIds, sagas }),
  });
  if (!res.ok) throw new Error("Failed to fetch suggestions");
  const data = await res.json();
  return data.suggestions ?? [];
}

export function useSagaSuggestions(
  channelId: string | null,
  uncategorizedVideoIds: string[],
  sagas: Saga[]
) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const mutation = useMutation({
    mutationFn: () => {
      const realSagas = sagas
        .filter((s) => s.id !== "standalone")
        .map((s) => ({ id: s.id, name: s.name }));
      return fetchSuggestions(uncategorizedVideoIds, realSagas);
    },
  });

  const canSuggest =
    !!channelId && uncategorizedVideoIds.length > 0 && sagas.length > 0;

  const getSuggestions = useCallback(() => {
    if (!canSuggest) return;
    setDismissedIds(new Set());
    mutation.mutate();
  }, [canSuggest, mutation.mutate]);

  const dismissSuggestion = useCallback((videoId: string) => {
    setDismissedIds((prev) => new Set(prev).add(videoId));
  }, []);

  const suggestions = useMemo(
    () =>
      (mutation.data ?? []).filter((s) => !dismissedIds.has(s.videoId)),
    [mutation.data, dismissedIds]
  );

  const reset = useCallback(() => {
    mutation.reset();
    setDismissedIds(new Set());
  }, [mutation.reset]);

  return {
    suggestions,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
    getSuggestions,
    dismissSuggestion,
    reset,
  };
}
