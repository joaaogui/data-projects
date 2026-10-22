export interface SpotifyImage {
  url: string
  height: number
  width: number
}

export type SpotifyAlbumType = "album" | "single" | "compilation"

export interface SpotifyRawArtist {
  id: string
  name: string
  images?: SpotifyImage[]
  popularity?: number
  followers?: {
    href?: string | null
    total?: number
  } | number
  genres?: string[]
  external_urls?: {
    spotify?: string
  }
}

export interface SpotifyArtist {
  id: string
  name: string
  imageUrl: string | null
  spotifyUrl: string
  popularity: number
  followers: number
  genres: string[]
  images: SpotifyImage[]
  external_urls?: {
    spotify: string
  }
}

export interface SpotifyTrackSimple {
  id: string
  name: string
  track_number: number
}

export interface SpotifyRawAlbum {
  id: string
  name: string
  album_type?: string
  album_group?: string
  total_tracks?: number
  popularity?: number
  label?: string
  images?: SpotifyImage[]
  release_date?: string
  external_urls?: {
    spotify?: string
  }
  tracks?: {
    items: SpotifyTrackSimple[]
  }
}

export interface SpotifyRawTrack {
  id: string
  name: string
  popularity?: number
  album?: SpotifyRawAlbum
  artists?: SpotifyRawArtist[]
  duration_ms?: number
  explicit?: boolean
  track_number?: number
  disc_number?: number
  preview_url?: string | null
  external_ids?: {
    isrc?: string
  }
  external_urls?: {
    spotify?: string
  }
}

export interface SpotifyTrackArtist {
  id: string
  name: string
  spotifyUrl: string
}

export interface SpotifyAlbum {
  id: string
  name: string
  imageUrl: string
  releaseDate: string
  releaseYear: number | null
  albumType: SpotifyAlbumType
  totalTracks: number
  spotifyUrl: string
  albumPopularity?: number | null
  label?: string | null
}

export interface SpotifyTrack {
  id: string
  name: string
  popularity: number
  rank: number
  deltaFromArtistAvg: number
  isAlbumLeadTrack: boolean
  durationMs: number
  explicit: boolean
  trackNumber: number
  discNumber: number
  album: SpotifyAlbum
  artists: SpotifyTrackArtist[]
  featuredArtists: SpotifyTrackArtist[]
  isCollaboration: boolean
  isrc: string | null
  spotifyUrl: string
  previewUrl: string | null
  appearancesCount?: number
  otherReleases?: string[]
}

export type PopularityTierId = "viral" | "hit" | "rotation" | "deep-cut" | "vault"

export interface PopularityTierSummary {
  id: PopularityTierId
  label: string
  rangeLabel: string
  min: number
  max: number
  count: number
  percentage: number
  topTrackName: string | null
}

export interface AlbumSummary {
  id: string
  name: string
  imageUrl: string
  spotifyUrl: string
  releaseDate: string
  releaseYear: number | null
  albumType: SpotifyAlbumType
  trackCount: number
  totalTracks: number
  avgPopularity: number
  maxPopularity: number
  topTrackId: string
  topTrackName: string
  totalDurationMs: number
  albumPopularity?: number | null
  label?: string | null
}

export interface CollaboratorTrackSummary {
  id: string
  name: string
  popularity: number
  rank: number
  releaseYear: number | null
}

export interface CollaboratorSummary {
  id: string
  name: string
  spotifyUrl: string
  trackCount: number
  avgPopularity: number
  deltaVsSoloAvg: number
  topTrackId: string
  topTrackName: string
  topTrackPopularity: number
  tracks: CollaboratorTrackSummary[]
}

export interface ReleaseYearSummary {
  year: number
  trackCount: number
  releaseCount: number
  avgPopularity: number
  maxPopularity: number
  topTrackName: string
}

export interface CatalogStats {
  totalTracks: number
  totalReleases: number
  albumCount: number
  singleCount: number
  compilationCount: number
  minYear: number | null
  maxYear: number | null
  careerSpan: string
  totalDurationMs: number
  avgDurationMs: number
  avgPopularity: number
  medianPopularity: number
  peakTrack: {
    id: string
    name: string
    popularity: number
    albumName: string
    releaseYear: number | null
  } | null
  explicitCount: number
  explicitPct: number
  collaborationCount: number
  collaborationPct: number
  soloCount: number
  soloAvgPopularity: number
  collabAvgPopularity: number
  collabPopularityDelta: number | null
  albums: AlbumSummary[]
  collaborators: CollaboratorSummary[]
  popularityTiers: PopularityTierSummary[]
  releaseYears: ReleaseYearSummary[]
}

export interface SpotifySearchResponse {
  artists: {
    items: SpotifyRawArtist[]
  }
}

export interface SpotifyAlbumsResponse {
  items: SpotifyRawAlbum[]
  next: string | null
  total: number
}

export interface SpotifySeveralAlbumsResponse {
  albums: SpotifyRawAlbum[]
}

export interface SpotifyTracksResponse {
  tracks: Array<SpotifyRawTrack | null>
}

export interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}
