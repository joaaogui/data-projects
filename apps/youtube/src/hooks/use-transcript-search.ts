"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useState } from "react";

export interface TranscriptSearchResult {
  videoId: string;
  title: string;
  publishedAt: string;
  score: number;
  views: number;
  thumbnail: string;
  language: string | null;
  contextSnippet: string;
}

async function searchTranscripts(channelId: string, query: string): Promise<TranscriptSearchResult[]> {
  const res = await fetch(`/api/transcripts/search/${channelId}?q=${encodeURIComponent(query)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Search failed (${res.status})`);
  }
  const data = await res.json();
  return data.results ?? [];
}

export function useTranscriptSearch(channelId: string | null) {
  const [query, setQuery] = useState("");

  const mutation = useMutation({
    mutationFn: (searchQuery: string) => {
      if (!channelId || !searchQuery.trim()) return Promise.resolve([]);
      return searchTranscripts(channelId, searchQuery.trim());
    },
  });

  const search = useCallback(
    (q: string) => {
      setQuery(q);
      if (q.trim().length >= 2 && channelId) {
        mutation.mutate(q);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [channelId]
  );

  return {
    query,
    setQuery,
    search,
    results: mutation.data ?? [],
    isSearching: mutation.isPending,
    error: mutation.error?.message ?? null,
    hasSearched: mutation.isSuccess || mutation.isError,
  };
}
