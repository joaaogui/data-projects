import type { SpotifyArtist, SpotifyTrack } from "@/lib/spotify"

export interface ArtistTracksResponse {
  artist: SpotifyArtist
  tracks: SpotifyTrack[]
}

export interface ArtistSuggestion {
  id: string
  name: string
  imageUrl: string | null
  genres: string[]
}

export async function fetchArtistTracks(artistName: string): Promise<ArtistTracksResponse> {
  const response = await fetch(`/api/artist/${encodeURIComponent(artistName)}`)

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to fetch artist tracks")
  }

  return response.json()
}

export async function fetchArtistSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<ArtistSuggestion[]> {
  const response = await fetch(`/api/suggest/${encodeURIComponent(query)}`, {
    signal,
  })

  if (!response.ok) {
    throw new Error("Failed to fetch suggestions")
  }

  return response.json()
}



