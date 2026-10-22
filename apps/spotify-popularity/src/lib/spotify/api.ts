import { getSpotifyToken, invalidateToken } from "./auth"
import {
  computeCatalogStats,
  enrichCatalogTracks,
  normalizeArtist,
} from "./stats"
import type {
  CatalogStats,
  SpotifyAlbumsResponse,
  SpotifyArtist,
  SpotifyRawTrack,
  SpotifySearchResponse,
  SpotifySeveralAlbumsResponse,
  SpotifyTrack,
  SpotifyTracksResponse,
} from "./types"

const SPOTIFY_API_BASE = "https://api.spotify.com/v1"

async function spotifyFetch<T>(endpoint: string, retry = true): Promise<T> {
  const token = await getSpotifyToken()

  const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.status === 401 && retry) {
    invalidateToken()
    return spotifyFetch<T>(endpoint, false)
  }

  if (!response.ok) {
    throw new Error(`Spotify API error: ${response.status}`)
  }

  return response.json()
}

export async function searchArtist(query: string): Promise<SpotifyArtist | null> {
  const data = await spotifyFetch<SpotifySearchResponse>(
    `/search?q=${encodeURIComponent(query)}&type=artist&limit=5`
  )

  const artists = data.artists.items || []
  if (artists.length === 0) return null

  const normalized = query.trim().toLowerCase()
  const exact = artists.find(
    (artist) => artist.name.trim().toLowerCase() === normalized
  )
  return exact ? normalizeArtist(exact) : null
}

export async function searchArtists(query: string, limit = 8): Promise<SpotifyArtist[]> {
  const safeLimit = Math.max(1, Math.min(limit, 10))
  const data = await spotifyFetch<SpotifySearchResponse>(
    `/search?q=${encodeURIComponent(query)}&type=artist&limit=${safeLimit}`
  )

  return (data.artists.items || []).map(normalizeArtist)
}

export async function getArtistAlbums(artistId: string): Promise<string[]> {
  const albumIds: string[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const data = await spotifyFetch<SpotifyAlbumsResponse>(
      `/artists/${artistId}/albums?offset=${offset}&limit=50&include_groups=album,single`
    )

    albumIds.push(...data.items.map((album) => album.id))
    hasMore = data.next !== null
    offset += 50
  }

  return albumIds
}

export interface AlbumMetadata {
  popularity?: number | null
  label?: string | null
}

export async function getSeveralAlbums(
  albumIds: string[],
  albumMetadataById?: Map<string, AlbumMetadata>
): Promise<string[]> {
  const trackIds: string[] = []

  for (let batchIndex = 0; batchIndex < albumIds.length; batchIndex += 20) {
    const batch = albumIds.slice(batchIndex, batchIndex + 20)
    const data = await spotifyFetch<SpotifySeveralAlbumsResponse>(
      `/albums?ids=${batch.join(",")}`
    )

    for (const album of data.albums) {
      if (album?.id && albumMetadataById) {
        albumMetadataById.set(album.id, {
          popularity: typeof album.popularity === "number" ? album.popularity : null,
          label: album.label ?? null,
        })
      }
      if (album?.tracks?.items) {
        trackIds.push(...album.tracks.items.map((track) => track.id))
      }
    }
  }

  return trackIds
}

export async function getTracks(trackIds: string[]): Promise<SpotifyRawTrack[]> {
  const tracks: SpotifyRawTrack[] = []

  for (let batchIndex = 0; batchIndex < trackIds.length; batchIndex += 50) {
    const batch = trackIds.slice(batchIndex, batchIndex + 50)
    const data = await spotifyFetch<SpotifyTracksResponse>(
      `/tracks?ids=${batch.join(",")}`
    )

    tracks.push(...data.tracks.filter((t): t is SpotifyRawTrack => Boolean(t)))
  }

  return tracks
}

export async function getArtistTopTracks(artistName: string): Promise<{
  artist: SpotifyArtist
  tracks: SpotifyTrack[]
  catalogStats: CatalogStats
}> {
  const artist = await searchArtist(artistName)

  if (!artist) {
    throw new Error("Artist not found — no exact name match")
  }

  const albumIds = await getArtistAlbums(artist.id)
  const albumMetadataById = new Map<string, AlbumMetadata>()
  const trackIds = await getSeveralAlbums(albumIds, albumMetadataById)
  const rawTracks = await getTracks(trackIds)

  for (const track of rawTracks) {
    if (track.album?.id) {
      const meta = albumMetadataById.get(track.album.id)
      if (meta) {
        if (track.album.popularity === undefined && meta.popularity !== null && meta.popularity !== undefined) {
          track.album.popularity = meta.popularity
        }
        if (track.album.label === undefined && meta.label) {
          track.album.label = meta.label
        }
      }
    }
  }

  const tracks = enrichCatalogTracks(rawTracks, artist)
  const catalogStats = computeCatalogStats(tracks)

  return { artist, tracks, catalogStats }
}
