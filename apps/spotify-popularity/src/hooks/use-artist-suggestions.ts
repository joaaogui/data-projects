"use client"

import { createSuggestionsHook } from "@data-projects/shared"
import { fetchArtistSuggestions, type ArtistSuggestion } from "@/services/artist"

interface UseArtistSuggestionsOptions {
  query: string
  enabled?: boolean
}

const useSuggestionsBase = createSuggestionsHook<ArtistSuggestion>(
  "artist-suggestions",
  fetchArtistSuggestions
)

export function useArtistSuggestions({
  query,
  enabled = true,
}: UseArtistSuggestionsOptions) {
  return useSuggestionsBase({ query, enabled })
}

