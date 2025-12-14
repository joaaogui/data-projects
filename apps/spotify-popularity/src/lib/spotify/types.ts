export interface SpotifyImage {
  url: string
  height: number
  width: number
}

export interface SpotifyArtist {
  id: string
  name: string
  images: SpotifyImage[]
  popularity: number
  genres: string[]
  external_urls?: {
    spotify: string
  }
}

export interface SpotifyAlbum {
  id: string
  name: string
  images: SpotifyImage[]
  release_date: string
  tracks?: {
    items: SpotifyTrackSimple[]
  }
}

export interface SpotifyTrackSimple {
  id: string
  name: string
  track_number: number
}

export interface SpotifyTrack {
  id: string
  name: string
  popularity: number
  album: SpotifyAlbum
  artists: SpotifyArtist[]
  duration_ms: number
  preview_url: string | null
  external_urls: {
    spotify: string
  }
}

export interface SpotifySearchResponse {
  artists: {
    items: SpotifyArtist[]
  }
}

export interface SpotifyAlbumsResponse {
  items: SpotifyAlbum[]
  next: string | null
  total: number
}

export interface SpotifySeveralAlbumsResponse {
  albums: SpotifyAlbum[]
}

export interface SpotifyTracksResponse {
  tracks: SpotifyTrack[]
}

export interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

