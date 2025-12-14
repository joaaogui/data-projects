"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchArtistTracks } from "@/services/artist"

export function useArtistTracks(artistName: string | null) {
  return useQuery({
    queryKey: ["artist-tracks", artistName],
    queryFn: () => fetchArtistTracks(artistName!),
    enabled: !!artistName,
  })
}
