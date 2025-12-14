"use client";

import { useQuery } from "@tanstack/react-query";

export interface SuggestionsHookOptions {
  minLength?: number;
  staleTimeMs?: number;
  gcTimeMs?: number;
}

export function createSuggestionsHook<T>(
  queryKeyPrefix: string,
  fetcher: (query: string, signal?: AbortSignal) => Promise<T[]>,
  options: SuggestionsHookOptions = {}
) {
  const minLength = options.minLength ?? 2;
  const staleTime = options.staleTimeMs ?? 1000 * 60 * 60;
  const gcTime = options.gcTimeMs ?? 1000 * 60 * 60 * 2;

  return function useSuggestions(args: { query: string; enabled?: boolean }) {
    const { query, enabled = true } = args;
    return useQuery<T[]>({
      queryKey: [queryKeyPrefix, query],
      queryFn: ({ signal }) => fetcher(query, signal),
      enabled: enabled && query.length >= minLength,
      staleTime,
      gcTime,
    });
  };
}


