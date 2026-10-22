import { apiFetch, ApiError } from "@data-projects/shared"
import type { CatalogStats, SpotifyArtist, SpotifyTrack } from "@/lib/spotify"

export { ApiError }

export interface ArtistTracksResponse {
  artist: SpotifyArtist
  tracks: SpotifyTrack[]
  catalogStats?: CatalogStats
}

export interface ArtistSuggestion {
  id: string
  name: string
  imageUrl: string | null
  genres: string[]
}

export async function fetchArtistTracks(artistName: string): Promise<ArtistTracksResponse> {
  return apiFetch<ArtistTracksResponse>(`/api/artist/${encodeURIComponent(artistName)}`, {
    fallbackError: "Failed to fetch artist tracks",
  })
}

export async function fetchArtistSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<ArtistSuggestion[]> {
  return apiFetch<ArtistSuggestion[]>(`/api/suggest/${encodeURIComponent(query)}`, {
    signal,
    fallbackError: "Failed to fetch suggestions",
  })
}
