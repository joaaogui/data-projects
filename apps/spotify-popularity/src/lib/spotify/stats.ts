import { median } from "@data-projects/shared"
import type {
  AlbumSummary,
  CatalogStats,
  CollaboratorSummary,
  PopularityTierId,
  PopularityTierSummary,
  ReleaseYearSummary,
  SpotifyAlbumType,
  SpotifyArtist,
  SpotifyRawArtist,
  SpotifyRawTrack,
  SpotifyTrack,
  SpotifyTrackArtist,
} from "./types"

export const POPULARITY_TIER_DEFINITIONS: ReadonlyArray<{
  id: PopularityTierId
  label: string
  rangeLabel: string
  min: number
  max: number
}> = [
  { id: "viral", label: "Viral / Smash", rangeLabel: "80–100", min: 80, max: 100 },
  { id: "hit", label: "Hit", rangeLabel: "60–79", min: 60, max: 79 },
  { id: "rotation", label: "Rotation", rangeLabel: "40–59", min: 40, max: 59 },
  { id: "deep-cut", label: "Deep Cut", rangeLabel: "20–39", min: 20, max: 39 },
  { id: "vault", label: "Vault", rangeLabel: "0–19", min: 0, max: 19 },
]

export function normalizeAlbumType(rawType?: string | null, rawGroup?: string | null): SpotifyAlbumType {
  const candidate = (rawType || rawGroup || "").toLowerCase().trim()
  if (candidate === "single" || candidate === "ep") return "single"
  if (candidate === "compilation" || candidate === "appears_on") return "compilation"
  return "album"
}

export function parseReleaseYear(releaseDate?: string | null): number | null {
  if (!releaseDate) return null
  const match = /^(\d{4})/.exec(releaseDate.trim())
  if (!match) return null
  const year = Number.parseInt(match[1], 10)
  return Number.isFinite(year) ? year : null
}

export function normalizeArtist(raw: SpotifyRawArtist): SpotifyArtist {
  const images = raw.images ?? []
  const imageUrl = images[0]?.url ?? null
  const spotifyUrl = raw.external_urls?.spotify ?? ""
  const followers =
    typeof raw.followers === "number"
      ? raw.followers
      : (raw.followers?.total ?? 0)

  return {
    id: raw.id,
    name: raw.name,
    imageUrl,
    spotifyUrl,
    popularity: raw.popularity ?? 0,
    followers,
    genres: raw.genres ?? [],
    images,
    external_urls: spotifyUrl ? { spotify: spotifyUrl } : undefined,
  }
}

function normalizeTrackArtist(raw: SpotifyRawArtist): SpotifyTrackArtist {
  return {
    id: raw.id,
    name: raw.name,
    spotifyUrl: raw.external_urls?.spotify ?? "",
  }
}

export function enrichCatalogTracks(
  rawTracks: SpotifyRawTrack[],
  primaryArtist: Pick<SpotifyArtist, "id" | "name">
): SpotifyTrack[] {
  const validSortedRaw = rawTracks
    .filter((t): t is SpotifyRawTrack => Boolean(t && t.id && t.name))
    .toSorted((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))

  const appearancesByKey = new Map<
    string,
    { count: number; releaseNames: string[]; primaryReleaseName: string }
  >()
  const seenNames = new Set<string>()
  const deduplicatedRaw = validSortedRaw.filter((track) => {
    const key = track.name.trim().toLowerCase()
    const releaseName = track.album?.name?.trim() || "Unknown Release"
    const existing = appearancesByKey.get(key)
    if (!existing) {
      appearancesByKey.set(key, {
        count: 1,
        releaseNames: [],
        primaryReleaseName: releaseName,
      })
    } else {
      existing.count += 1
      if (
        releaseName.toLowerCase() !== existing.primaryReleaseName.toLowerCase() &&
        !existing.releaseNames.some(
          (r) => r.toLowerCase() === releaseName.toLowerCase()
        )
      ) {
        existing.releaseNames.push(releaseName)
      }
    }

    if (seenNames.has(key)) return false
    seenNames.add(key)
    return true
  })

  if (deduplicatedRaw.length === 0) {
    return []
  }

  const totalPopularity = deduplicatedRaw.reduce(
    (sum, track) => sum + (track.popularity ?? 0),
    0
  )
  const avgPopularity = totalPopularity / deduplicatedRaw.length

  const primaryId = primaryArtist.id
  const primaryNameLower = primaryArtist.name.trim().toLowerCase()
  const leadTrackIdsByAlbum = new Set<string>()
  const seenAlbums = new Set<string>()
  const albumTrackCounts = new Map<string, number>()

  for (const raw of deduplicatedRaw) {
    const albumKey = raw.album?.id || raw.album?.name?.trim().toLowerCase() || ""
    if (albumKey) {
      albumTrackCounts.set(albumKey, (albumTrackCounts.get(albumKey) ?? 0) + 1)
    }
  }

  for (const raw of deduplicatedRaw) {
    const albumKey = raw.album?.id || raw.album?.name?.trim().toLowerCase() || ""
    if (albumKey && !seenAlbums.has(albumKey)) {
      seenAlbums.add(albumKey)
      const catalogTrackCount = albumTrackCounts.get(albumKey) ?? 1
      const declaredTotalTracks = raw.album?.total_tracks ?? 1
      if (declaredTotalTracks > 1 || catalogTrackCount > 1) {
        leadTrackIdsByAlbum.add(raw.id)
      }
    }
  }

  return deduplicatedRaw.map((raw, index) => {
    const popularity = raw.popularity ?? 0
    const rawAlbum = raw.album
    const albumKey = rawAlbum?.id || rawAlbum?.name?.trim().toLowerCase() || ""
    const catalogTrackCount = albumKey ? (albumTrackCounts.get(albumKey) ?? 1) : 1
    const totalTracks = Math.max(rawAlbum?.total_tracks ?? 1, catalogTrackCount)
    const releaseDate = rawAlbum?.release_date ?? ""
    const releaseYear = parseReleaseYear(releaseDate)
    const albumType = normalizeAlbumType(rawAlbum?.album_type, rawAlbum?.album_group)
    const albumImageUrl = rawAlbum?.images?.[0]?.url ?? ""
    const albumSpotifyUrl = rawAlbum?.external_urls?.spotify ?? ""
    const albumPopularity =
      typeof rawAlbum?.popularity === "number" ? rawAlbum.popularity : null
    const label = rawAlbum?.label ?? null

    const nameKey = raw.name.trim().toLowerCase()
    const appearanceMeta = appearancesByKey.get(nameKey)

    const creditedArtists = (raw.artists ?? []).map(normalizeTrackArtist)
    const featuredArtists = creditedArtists.filter(
      (artist) =>
        artist.id !== primaryId &&
        artist.name.trim().toLowerCase() !== primaryNameLower
    )

    return {
      id: raw.id,
      name: raw.name,
      popularity,
      rank: index + 1,
      deltaFromArtistAvg: Math.round(popularity - avgPopularity),
      isAlbumLeadTrack: leadTrackIdsByAlbum.has(raw.id),
      durationMs: raw.duration_ms ?? 0,
      explicit: Boolean(raw.explicit),
      trackNumber: raw.track_number ?? 1,
      discNumber: raw.disc_number ?? 1,
      album: {
        id: rawAlbum?.id ?? "",
        name: rawAlbum?.name ?? "Unknown Release",
        imageUrl: albumImageUrl,
        releaseDate,
        releaseYear,
        albumType,
        totalTracks,
        spotifyUrl: albumSpotifyUrl,
        albumPopularity,
        label,
      },
      artists: creditedArtists,
      featuredArtists,
      isCollaboration: featuredArtists.length > 0,
      isrc: raw.external_ids?.isrc ?? null,
      spotifyUrl: raw.external_urls?.spotify ?? "",
      previewUrl: raw.preview_url ?? null,
      appearancesCount: appearanceMeta?.count ?? 1,
      otherReleases: appearanceMeta?.releaseNames ?? [],
    }
  })
}

export function getPopularityTierId(popularity: number): PopularityTierId {
  if (popularity >= 80) return "viral"
  if (popularity >= 60) return "hit"
  if (popularity >= 40) return "rotation"
  if (popularity >= 20) return "deep-cut"
  return "vault"
}

export function computeCatalogStats(tracks: SpotifyTrack[]): CatalogStats {
  const totalTracks = tracks.length

  if (totalTracks === 0) {
    return {
      totalTracks: 0,
      totalReleases: 0,
      albumCount: 0,
      singleCount: 0,
      compilationCount: 0,
      minYear: null,
      maxYear: null,
      careerSpan: "—",
      totalDurationMs: 0,
      avgDurationMs: 0,
      avgPopularity: 0,
      medianPopularity: 0,
      peakTrack: null,
      explicitCount: 0,
      explicitPct: 0,
      collaborationCount: 0,
      collaborationPct: 0,
      soloCount: 0,
      soloAvgPopularity: 0,
      collabAvgPopularity: 0,
      collabPopularityDelta: null,
      albums: [],
      collaborators: [],
      popularityTiers: POPULARITY_TIER_DEFINITIONS.map((tier) => ({
        ...tier,
        count: 0,
        percentage: 0,
        topTrackName: null,
      })),
      releaseYears: [],
    }
  }

  const sortedByPop = tracks.toSorted((a, b) => b.popularity - a.popularity)
  const peak = sortedByPop[0]

  const popularities = tracks.map((t) => t.popularity)
  const totalPopularity = popularities.reduce((sum, p) => sum + p, 0)
  const avgPopularity = Math.round(totalPopularity / totalTracks)
  const medianPopularity = Math.round(median(popularities))

  const totalDurationMs = tracks.reduce((sum, t) => sum + t.durationMs, 0)
  const avgDurationMs = Math.round(totalDurationMs / totalTracks)

  const explicitCount = tracks.filter((t) => t.explicit).length
  const explicitPct = Math.round((explicitCount / totalTracks) * 100)

  const collabTracks = tracks.filter((t) => t.isCollaboration)
  const soloTracks = tracks.filter((t) => !t.isCollaboration)
  const collaborationCount = collabTracks.length
  const soloCount = soloTracks.length
  const collaborationPct = Math.round((collaborationCount / totalTracks) * 100)

  const soloAvgPopularity =
    soloCount > 0
      ? Math.round(soloTracks.reduce((sum, t) => sum + t.popularity, 0) / soloCount)
      : 0
  const collabAvgPopularity =
    collaborationCount > 0
      ? Math.round(
          collabTracks.reduce((sum, t) => sum + t.popularity, 0) / collaborationCount
        )
      : 0
  const collabPopularityDelta =
    soloCount > 0 && collaborationCount > 0
      ? collabAvgPopularity - soloAvgPopularity
      : null

  // Group by album
  const albumMap = new Map<
    string,
    {
      meta: SpotifyTrack["album"]
      tracks: SpotifyTrack[]
    }
  >()

  for (const track of sortedByPop) {
    const key = track.album.id || track.album.name
    const existing = albumMap.get(key)
    if (existing) {
      existing.tracks.push(track)
    } else {
      albumMap.set(key, {
        meta: track.album,
        tracks: [track],
      })
    }
  }

  const albums: AlbumSummary[] = Array.from(albumMap.values())
    .map(({ meta, tracks: albumTracks }) => {
      const topTrack = albumTracks[0]
      const sumPop = albumTracks.reduce((sum, t) => sum + t.popularity, 0)
      const sumDur = albumTracks.reduce((sum, t) => sum + t.durationMs, 0)

      return {
        id: meta.id || meta.name,
        name: meta.name,
        imageUrl: meta.imageUrl,
        spotifyUrl: meta.spotifyUrl,
        releaseDate: meta.releaseDate,
        releaseYear: meta.releaseYear,
        albumType: meta.albumType,
        trackCount: albumTracks.length,
        totalTracks: meta.totalTracks,
        avgPopularity: Math.round(sumPop / albumTracks.length),
        maxPopularity: topTrack.popularity,
        topTrackId: topTrack.id,
        topTrackName: topTrack.name,
        totalDurationMs: sumDur,
        albumPopularity: meta.albumPopularity ?? null,
        label: meta.label ?? null,
      }
    })
    .toSorted(
      (a, b) =>
        b.avgPopularity - a.avgPopularity ||
        b.maxPopularity - a.maxPopularity ||
        b.trackCount - a.trackCount
    )

  // Group by collaborator
  const collabMap = new Map<
    string,
    {
      artist: SpotifyTrackArtist
      tracks: SpotifyTrack[]
    }
  >()

  for (const track of sortedByPop) {
    for (const featured of track.featuredArtists) {
      const key = featured.id || featured.name.trim().toLowerCase()
      const existing = collabMap.get(key)
      if (existing) {
        existing.tracks.push(track)
      } else {
        collabMap.set(key, {
          artist: featured,
          tracks: [track],
        })
      }
    }
  }

  const collaborators: CollaboratorSummary[] = Array.from(collabMap.values())
    .map(({ artist, tracks: artistTracks }) => {
      const topTrack = artistTracks[0]
      const sumPop = artistTracks.reduce((sum, t) => sum + t.popularity, 0)
      const avgPop = Math.round(sumPop / artistTracks.length)
      return {
        id: artist.id || artist.name,
        name: artist.name,
        spotifyUrl: artist.spotifyUrl,
        trackCount: artistTracks.length,
        avgPopularity: avgPop,
        deltaVsSoloAvg: avgPop - soloAvgPopularity,
        topTrackId: topTrack.id,
        topTrackName: topTrack.name,
        topTrackPopularity: topTrack.popularity,
        tracks: artistTracks.map((t) => ({
          id: t.id,
          name: t.name,
          popularity: t.popularity,
          rank: t.rank,
          releaseYear: t.album.releaseYear,
        })),
      }
    })
    .toSorted(
      (a, b) =>
        b.trackCount - a.trackCount ||
        b.avgPopularity - a.avgPopularity ||
        b.topTrackPopularity - a.topTrackPopularity
    )

  const albumCount = albums.filter((a) => a.albumType === "album").length
  const singleCount = albums.filter((a) => a.albumType === "single").length
  const compilationCount = albums.filter((a) => a.albumType === "compilation").length

  // Years & Career span
  const years = tracks
    .map((t) => t.album.releaseYear)
    .filter((y): y is number => y !== null)
  const minYear = years.length > 0 ? Math.min(...years) : null
  const maxYear = years.length > 0 ? Math.max(...years) : null
  let careerSpan = "—"
  if (minYear !== null && maxYear !== null) {
    careerSpan = minYear === maxYear ? `${minYear}` : `${minYear}–${maxYear}`
  }

  // Popularity tiers
  const popularityTiers: PopularityTierSummary[] = POPULARITY_TIER_DEFINITIONS.map(
    (tier) => {
      const matching = sortedByPop.filter(
        (t) => t.popularity >= tier.min && t.popularity <= tier.max
      )
      return {
        ...tier,
        count: matching.length,
        percentage: Math.round((matching.length / totalTracks) * 100),
        topTrackName: matching[0]?.name ?? null,
      }
    }
  )

  // Release year breakdown
  const yearMap = new Map<
    number,
    {
      tracks: SpotifyTrack[]
      releaseIds: Set<string>
    }
  >()

  for (const track of sortedByPop) {
    const year = track.album.releaseYear
    if (year === null) continue
    const existing = yearMap.get(year)
    const releaseKey = track.album.id || track.album.name
    if (existing) {
      existing.tracks.push(track)
      existing.releaseIds.add(releaseKey)
    } else {
      yearMap.set(year, {
        tracks: [track],
        releaseIds: new Set([releaseKey]),
      })
    }
  }

  const releaseYears: ReleaseYearSummary[] = Array.from(yearMap.entries())
    .map(([year, { tracks: yearTracks, releaseIds }]) => {
      const sumPop = yearTracks.reduce((sum, t) => sum + t.popularity, 0)
      const topTrack = yearTracks[0]
      return {
        year,
        trackCount: yearTracks.length,
        releaseCount: releaseIds.size,
        avgPopularity: Math.round(sumPop / yearTracks.length),
        maxPopularity: topTrack.popularity,
        topTrackName: topTrack.name,
      }
    })
    .toSorted((a, b) => a.year - b.year)

  return {
    totalTracks,
    totalReleases: albums.length,
    albumCount,
    singleCount,
    compilationCount,
    minYear,
    maxYear,
    careerSpan,
    totalDurationMs,
    avgDurationMs,
    avgPopularity,
    medianPopularity,
    peakTrack: {
      id: peak.id,
      name: peak.name,
      popularity: peak.popularity,
      albumName: peak.album.name,
      releaseYear: peak.album.releaseYear,
    },
    explicitCount,
    explicitPct,
    collaborationCount,
    collaborationPct,
    soloCount,
    soloAvgPopularity,
    collabAvgPopularity,
    collabPopularityDelta,
    albums,
    collaborators,
    popularityTiers,
    releaseYears,
  }
}

export function formatDurationMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "0:00"
  const totalSeconds = Math.round(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

export function formatRuntimeMs(durationMs: number): string {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "0m"
  const totalMinutes = Math.max(1, Math.round(durationMs / 60_000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}
