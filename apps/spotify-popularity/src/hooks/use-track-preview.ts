"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchTrackPreview } from "@/services/preview"

interface UseTrackPreviewOptions {
  trackName: string
  artistName: string
  enabled?: boolean
}

export function useTrackPreview({
  trackName,
  artistName,
  enabled = false,
}: UseTrackPreviewOptions) {
  return useQuery({
    queryKey: ["track-preview", trackName, artistName],
    queryFn: () => fetchTrackPreview(trackName, artistName),
    enabled,
    staleTime: 1000 * 60 * 60 * 24 * 7, // 1 week (previews don't change)
    gcTime: 1000 * 60 * 60 * 24 * 7,
  })
}

