"use client";

import { createSuggestionsHook } from "@data-projects/shared";
import { fetchShowSuggestions } from "@/services/show";
import type { OMDBSearchItem } from "@/types/omdb";

interface UseShowSuggestionsOptions {
  query: string;
  enabled?: boolean;
}

const useSuggestionsBase = createSuggestionsHook<OMDBSearchItem>(
  "show-suggestions",
  fetchShowSuggestions
);

export function useShowSuggestions({
  query,
  enabled = true,
}: UseShowSuggestionsOptions) {
  return useSuggestionsBase({ query, enabled });
}

