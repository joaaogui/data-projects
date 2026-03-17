"use client";

import { useMutation } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

export interface TranscriptSearchResult {
  videoId: string;
  title: string;
  publishedAt: string;
  score: number;
  views: number;
  thumbnail: string;
  language: string | null;
  duration: number;
  matchOffset: number;
  textLength: number;
  contextSnippet: string;
}

async function fetchSearch(
  channelId: string,
  query: string,
  regex: boolean,
): Promise<TranscriptSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (regex) params.set("regex", "true");
  const res = await fetch(`/api/transcripts/search/${channelId}?${params}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Search failed (${res.status})`);
  }
  const data = await res.json();
  return data.results ?? [];
}

async function fetchRegex(channelId: string, prompt: string): Promise<string> {
  const res = await fetch(`/api/transcripts/search/${channelId}/ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `AI generation failed (${res.status})`);
  }
  const data = await res.json();
  return data.regex;
}

const DEBOUNCE_MS = 300;

export function useTranscriptSearch(channelId: string | null) {
  const [query, setQuery] = useState("");
  const [highlightPattern, setHighlightPattern] = useState<string | null>(null);
  const [generatedRegex, setGeneratedRegex] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mutation = useMutation({
    mutationFn: ({ q, regex }: { q: string; regex: boolean }) => {
      if (!channelId || !q.trim()) return Promise.resolve([]);
      return fetchSearch(channelId, q.trim(), regex);
    },
  });

  const mutationRef = useRef(mutation);
  mutationRef.current = mutation;

  const search = useCallback(
    (q: string) => {
      setQuery(q);
      setGeneratedRegex(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (q.trim().length >= 2 && channelId) {
        const escaped = q.trim().replaceAll(String.raw`[.*+?^\${}()|[\]\\]`, "\\$&");
        setHighlightPattern(escaped);
        debounceRef.current = setTimeout(() => {
          mutationRef.current.mutate({ q, regex: false });
        }, DEBOUNCE_MS);
      } else {
        setHighlightPattern(null);
      }
    },
    [channelId]
  );

  const aiSearch = useCallback(
    async (prompt: string) => {
      if (!channelId || !prompt.trim()) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setIsGenerating(true);
      try {
        const regex = await fetchRegex(channelId, prompt.trim());
        setGeneratedRegex(regex);
        setHighlightPattern(regex);
        mutationRef.current.mutate({ q: regex, regex: true });
      } catch (err) {
        mutationRef.current.reset();
        throw err;
      } finally {
        setIsGenerating(false);
      }
    },
    [channelId]
  );

  const reset = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery("");
    setHighlightPattern(null);
    setGeneratedRegex(null);
    setIsGenerating(false);
    mutationRef.current.reset();
  }, []);

  return {
    query,
    setQuery,
    search,
    aiSearch,
    reset,
    highlightPattern,
    generatedRegex,
    isGenerating,
    results: mutation.data ?? [],
    isSearching: mutation.isPending,
    error: mutation.error?.message ?? null,
    hasSearched: mutation.isSuccess || mutation.isError,
  };
}
