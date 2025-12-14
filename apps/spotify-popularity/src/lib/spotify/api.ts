import { getSpotifyToken, invalidateToken } from "./auth"
import {
  SpotifySearchResponse,
  SpotifyAlbumsResponse,
  SpotifySeveralAlbumsResponse,
  SpotifyTracksResponse,
  SpotifyTrack,
  SpotifyArtist,
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
    `/search?q=${encodeURIComponent(query)}&type=artist&limit=1`
  )
  
  return data.artists.items[0] || null
}

export async function searchArtists(query: string, limit = 8): Promise<SpotifyArtist[]> {
  const safeLimit = Math.max(1, Math.min(limit, 10))
  const data = await spotifyFetch<SpotifySearchResponse>(
    `/search?q=${encodeURIComponent(query)}&type=artist&limit=${safeLimit}`
  )
  
  return data.artists.items || []
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

export async function getSeveralAlbums(albumIds: string[]): Promise<string[]> {
  const trackIds: string[] = []
  
  for (let batchIndex = 0; batchIndex < albumIds.length; batchIndex += 20) {
    const batch = albumIds.slice(batchIndex, batchIndex + 20)
    const data = await spotifyFetch<SpotifySeveralAlbumsResponse>(
      `/albums?ids=${batch.join(",")}`
    )
    
    for (const album of data.albums) {
      if (album.tracks?.items) {
        trackIds.push(...album.tracks.items.map((track) => track.id))
      }
    }
  }

  return trackIds
}

export async function getTracks(trackIds: string[]): Promise<SpotifyTrack[]> {
  const tracks: SpotifyTrack[] = []
  
  for (let batchIndex = 0; batchIndex < trackIds.length; batchIndex += 50) {
    const batch = trackIds.slice(batchIndex, batchIndex + 50)
    const data = await spotifyFetch<SpotifyTracksResponse>(
      `/tracks?ids=${batch.join(",")}`
    )
    
    tracks.push(...data.tracks.filter(Boolean))
  }

  return tracks
}

export async function getArtistTopTracks(artistName: string): Promise<{
  artist: SpotifyArtist
  tracks: SpotifyTrack[]
}> {
  const artist = await searchArtist(artistName)
  
  if (!artist) {
    throw new Error("Artist not found")
  }

  const albumIds = await getArtistAlbums(artist.id)
  const trackIds = await getSeveralAlbums(albumIds)
  const tracks = await getTracks(trackIds)

  // Sort by popularity and remove duplicates (by name)
  const seen = new Set<string>()
  const uniqueTracks = tracks
    .toSorted((a, b) => b.popularity - a.popularity)
    .filter((track) => {
      const key = track.name.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

  return { artist, tracks: uniqueTracks }
}

