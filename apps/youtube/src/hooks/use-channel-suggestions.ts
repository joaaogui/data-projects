"use client";

import { createSuggestionsHook } from "@data-projects/shared";
import { fetchChannelSuggestions, type ChannelSuggestion } from "@/services/channel";

interface UseChannelSuggestionsOptions {
  query: string;
  enabled?: boolean;
}

const useSuggestionsBase = createSuggestionsHook<ChannelSuggestion>(
  "channel-suggestions",
  fetchChannelSuggestions
);

export function useChannelSuggestions({
  query,
  enabled = true,
}: UseChannelSuggestionsOptions) {
  return useSuggestionsBase({ query, enabled });
}

