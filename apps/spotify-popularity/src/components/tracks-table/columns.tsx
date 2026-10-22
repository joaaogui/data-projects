"use client"

import Link from "next/link"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  sortableHeader,
  type CellContext,
  type ColumnDef,
} from "@data-projects/ui"
import { cn, formatSigned } from "@data-projects/shared"
import {
  formatDurationMs,
  formatRuntimeMs,
  type AlbumSummary,
  type CatalogStats,
  type CollaboratorSummary,
  type ReleaseYearSummary,
  type SpotifyTrack,
} from "@/lib/spotify"
import { Crown, ExternalLink, Users } from "lucide-react"
import { TrackCover } from "@/components/track-cover"

export interface TrackColumnsOptions {
  onSelectAlbum?: (albumId: string | null) => void
  selectedAlbumId?: string | null
  catalogStats?: CatalogStats | null
  collaboratorsById?: Map<string, CollaboratorSummary>
  albumsById?: Map<string, AlbumSummary>
  yearsByYear?: Map<number, ReleaseYearSummary>
  trackAlbumRankById?: Map<string, { rank: number; count: number }>
  trackYearRankById?: Map<string, { rank: number; count: number }>
  trackSoloRankById?: Map<string, { rank: number; count: number }>
  trackDurationRankById?: Map<string, number>
}

function getAlbumTypeBadge(type: SpotifyTrack["album"]["albumType"]) {
  if (type === "single") {
    return {
      label: "Single",
      className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    }
  }
  if (type === "compilation") {
    return {
      label: "Compilation",
      className:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    }
  }
  return {
    label: "Album",
    className: "bg-spotify/10 text-spotify border-spotify/25",
  }
}

function formatSignedDurationMs(deltaMs: number): string {
  const absSeconds = Math.round(Math.abs(deltaMs) / 1000)
  if (absSeconds === 0) return "0s"
  const sign = deltaMs > 0 ? "+" : "-"
  const mins = Math.floor(absSeconds / 60)
  const secs = absSeconds % 60
  if (mins === 0) return `${sign}${secs}s`
  return `${sign}${mins}:${secs.toString().padStart(2, "0")}`
}

function formatReleaseAge(releaseDate: string, releaseYear: number | null): string | null {
  if (!releaseYear) return null
  const currentYear = new Date().getFullYear()
  const yearsAgo = currentYear - releaseYear
  if (yearsAgo <= 0) return "Released this year"
  if (yearsAgo === 1) return "1 year ago"
  return `${yearsAgo} years ago`
}

function decodeIsrc(isrc: string | null): {
  formatted: string
  country: string
  registrant: string
  year: string
  serial: string
} | null {
  if (!isrc) return null
  const clean = isrc.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
  if (clean.length !== 12) return null
  const country = clean.slice(0, 2)
  const registrant = clean.slice(2, 5)
  const yy = clean.slice(5, 7)
  const serial = clean.slice(7, 12)
  const yyNum = Number.parseInt(yy, 10)
  const currentTwoDigit = new Date().getFullYear() % 100
  const fullYear = Number.isFinite(yyNum)
    ? `${yyNum <= currentTwoDigit + 2 ? 2000 + yyNum : 1900 + yyNum} (${yy})`
    : yy
  return {
    formatted: `${country}-${registrant}-${yy}-${serial}`,
    country,
    registrant,
    year: fullYear,
    serial,
  }
}

function CollaboratorDossierTooltip({
  track,
  collaboratorsById,
}: Readonly<{
  track: SpotifyTrack
  collaboratorsById?: Map<string, CollaboratorSummary>
}>) {
  return (
    <div className="space-y-2.5 max-w-xs py-0.5">
      {track.featuredArtists.map((artist) => {
        const collab =
          collaboratorsById?.get(artist.id) ??
          collaboratorsById?.get(artist.name.trim().toLowerCase())

        if (!collab) {
          return (
            <div key={artist.id || artist.name} className="space-y-1 text-xs">
              <div className="font-semibold text-foreground">{artist.name}</div>
              <div className="flex items-center gap-2 pt-0.5">
                <Link
                  href={`/artist/${encodeURIComponent(artist.name)}`}
                  className="text-spotify hover:underline font-medium"
                >
                  Explore {artist.name} catalog →
                </Link>
                {artist.spotifyUrl && (
                  <a
                    href={artist.spotifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-spotify"
                  >
                    Spotify <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>
          )
        }

        const topCollabTrack = collab.tracks[0]
        const previewTracks = collab.tracks.slice(0, 3)

        return (
          <div
            key={collab.id}
            className="space-y-1 text-xs border-b border-border/40 last:border-b-0 pb-2 last:pb-0"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold text-foreground">{collab.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {collab.trackCount} {collab.trackCount === 1 ? "track" : "tracks"} together in catalog
              </span>
            </div>

            <div className="font-mono text-[11px] text-muted-foreground">
              Avg pop <span className="text-spotify font-semibold">{collab.avgPopularity}</span>/100 ·{" "}
              <span
                className={cn(
                  collab.deltaVsSoloAvg > 0
                    ? "text-emerald-500"
                    : "text-muted-foreground"
                )}
              >
                {formatSigned(collab.deltaVsSoloAvg)} vs solo avg
              </span>
            </div>

            {topCollabTrack && (
              <div className="text-[11px] text-muted-foreground">
                #1 together: <span className="text-foreground font-medium">&quot;{topCollabTrack.name}&quot;</span>{" "}
                <span className="font-mono">
                  (pop {topCollabTrack.popularity}, #{topCollabTrack.rank} overall)
                </span>
              </div>
            )}

            {previewTracks.length > 0 && (
              <ul className="space-y-0.5 pt-0.5 text-[11px] text-muted-foreground">
                {previewTracks.map((t) => (
                  <li key={t.id} className="truncate font-mono">
                    • <span className="font-sans text-foreground/90">{t.name}</span>
                    {t.releaseYear ? ` (${t.releaseYear})` : ""} — pop {t.popularity}
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <Link
                href={`/artist/${encodeURIComponent(collab.name)}`}
                className="text-spotify hover:underline font-medium"
              >
                Explore {collab.name} catalog →
              </Link>
              {collab.spotifyUrl && (
                <a
                  href={collab.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-spotify"
                >
                  Spotify <ExternalLink className="h-2.5 w-2.5" />
                </a>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function PopularityAndRankTooltip({
  track,
  catalogStats,
  albumSummary,
  albumRankInfo,
  yearRankInfo,
}: Readonly<{
  track: SpotifyTrack
  catalogStats?: CatalogStats | null
  albumSummary?: AlbumSummary
  albumRankInfo?: { rank: number; count: number }
  yearRankInfo?: { rank: number; count: number }
}>) {
  const totalTracks = catalogStats?.totalTracks ?? 0
  const percentile =
    totalTracks > 0
      ? Math.max(1, Math.round((track.rank / totalTracks) * 100))
      : null
  const deltaMean = catalogStats
    ? track.popularity - catalogStats.avgPopularity
    : track.deltaFromArtistAvg
  const deltaMedian = catalogStats
    ? track.popularity - catalogStats.medianPopularity
    : null
  const deltaRelease = albumSummary
    ? track.popularity - albumSummary.avgPopularity
    : null

  return (
    <div className="space-y-1.5 max-w-xs text-xs py-0.5">
      <div className="font-semibold text-foreground">
        {percentile !== null && totalTracks > 0
          ? `Top ${percentile}% of catalog · #${track.rank} of ${totalTracks}`
          : `Catalog rank #${track.rank} · Popularity ${track.popularity}/100`}
      </div>

      {albumRankInfo && (
        <div className="text-muted-foreground">
          Rank on release:{" "}
          <span className="font-mono text-foreground">
            #{albumRankInfo.rank} of {albumRankInfo.count}
          </span>{" "}
          on &quot;{track.album.name}&quot;
        </div>
      )}

      {yearRankInfo && track.album.releaseYear && (
        <div className="text-muted-foreground">
          Rank in release year:{" "}
          <span className="font-mono text-foreground">
            #{yearRankInfo.rank} of {yearRankInfo.count}
          </span>{" "}
          in {track.album.releaseYear}
        </div>
      )}

      <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono text-[11px] text-muted-foreground pt-0.5 border-t border-border/40">
        <span>{formatSigned(deltaMean)} vs artist mean</span>
        {deltaMedian !== null && (
          <span>· {formatSigned(deltaMedian)} vs artist median</span>
        )}
        {deltaRelease !== null && (
          <span>· {formatSigned(deltaRelease)} vs release avg</span>
        )}
      </div>
    </div>
  )
}

export function createTrackColumns(
  options: TrackColumnsOptions = {}
): ColumnDef<SpotifyTrack>[] {
  const {
    onSelectAlbum,
    selectedAlbumId,
    catalogStats,
    collaboratorsById,
    albumsById,
    yearsByYear,
    trackAlbumRankById,
    trackYearRankById,
    trackSoloRankById,
    trackDurationRankById,
  } = options

  return [
    {
      id: "rank",
      accessorKey: "rank",
      header: sortableHeader("#"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const track = row.original
        const albumKey = track.album.id || track.album.name
        const albumSummary = albumsById?.get(albumKey)
        const albumRankInfo = trackAlbumRankById?.get(track.id)
        const yearRankInfo = trackYearRankById?.get(track.id)
        return (
          <div className="flex flex-col items-start gap-0.5 min-w-[2.75rem]">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground cursor-default">
                  #{track.rank}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <PopularityAndRankTooltip
                  track={track}
                  catalogStats={catalogStats}
                  albumSummary={albumSummary}
                  albumRankInfo={albumRankInfo}
                  yearRankInfo={yearRankInfo}
                />
              </TooltipContent>
            </Tooltip>
            {track.isAlbumLeadTrack && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-0.5 rounded bg-spotify/15 px-1 py-0.2 text-[10px] font-medium text-spotify cursor-default">
                    <Crown className="h-2.5 w-2.5" />
                    #1
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {`Most popular track on "${track.album.name}" (#1 of ${albumSummary?.trackCount ?? track.album.totalTracks} tracks)`}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    {
      id: "name",
      accessorKey: "name",
      header: sortableHeader("Track"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const track = row.original
        const featuredNames = track.featuredArtists.map((a) => a.name).join(", ")
        return (
          <div className="flex items-center gap-3 min-w-[200px]">
            <TrackCover
              trackId={track.id}
              trackName={track.name}
              artistName={track.artists[0]?.name || ""}
              imageUrl={track.album.imageUrl}
              albumName={track.album.name}
              spotifyUrl={track.spotifyUrl}
              previewUrl={track.previewUrl}
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0">
                <a
                  href={track.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:text-spotify transition-colors truncate"
                >
                  {track.name}
                </a>
                {track.explicit && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        aria-label="Explicit lyrics"
                        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold uppercase text-muted-foreground border border-border/60 cursor-default"
                      >
                        E
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Explicit lyrics</TooltipContent>
                  </Tooltip>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="font-mono text-[11px] cursor-default">
                      {track.discNumber > 1 ? `D${track.discNumber} · ` : ""}Track #
                      {track.trackNumber}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {track.discNumber > 1
                      ? `Disc ${track.discNumber}, Track ${track.trackNumber} on "${track.album.name}"`
                      : `Track ${track.trackNumber} of ${track.album.totalTracks} on "${track.album.name}"`}
                  </TooltipContent>
                </Tooltip>
                {featuredNames && (
                  <>
                    <span>·</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate max-w-[220px] cursor-default">
                          feat.{" "}
                          <span className="text-foreground/80">{featuredNames}</span>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <CollaboratorDossierTooltip
                          track={track}
                          collaboratorsById={collaboratorsById}
                        />
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      id: "album",
      accessorFn: (row: SpotifyTrack) => row.album.name,
      header: sortableHeader("Release"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const track = row.original
        const { album } = track
        const albumKey = album.id || album.name
        const albumSummary = albumsById?.get(albumKey)
        const albumRankInfo = trackAlbumRankById?.get(track.id)
        const isSelected = Boolean(selectedAlbumId && selectedAlbumId === album.id)
        const badge = getAlbumTypeBadge(album.albumType)
        const otherReleases = track.otherReleases ?? []

        const releaseTooltipContent = (
          <div className="space-y-1.5 max-w-xs text-xs py-0.5">
            <div className="font-semibold text-foreground">
              {album.name}
            </div>
            <div className="text-muted-foreground font-mono text-[11px]">
              {badge.label}
              {album.releaseDate ? ` · ${album.releaseDate}` : ""}
              {album.label ? ` · ${album.label}` : ""}
            </div>
            {albumSummary && albumRankInfo && (
              <div className="text-muted-foreground">
                Ranked{" "}
                <span className="font-mono text-foreground font-medium">
                  #{albumRankInfo.rank} of {albumSummary.trackCount}
                </span>{" "}
                on this release by popularity
              </div>
            )}
            {albumSummary && catalogStats && (
              <div className="text-muted-foreground font-mono text-[11px]">
                Avg <span className="text-spotify font-semibold">{albumSummary.avgPopularity}</span>/100 (
                {formatSigned(albumSummary.avgPopularity - catalogStats.avgPopularity)} vs artist avg) · Peak: &quot;{albumSummary.topTrackName}&quot; ({albumSummary.maxPopularity})
              </div>
            )}
            {(album.albumPopularity != null || albumSummary) && (
              <div className="text-muted-foreground font-mono text-[11px]">
                {album.albumPopularity != null && (
                  <span>Spotify Album Popularity: {album.albumPopularity}/100 · </span>
                )}
                {albumSummary && (
                  <span>Runtime: {formatRuntimeMs(albumSummary.totalDurationMs)}</span>
                )}
              </div>
            )}
            {otherReleases.length > 0 && (
              <div className="text-[11px] text-muted-foreground pt-0.5 border-t border-border/40">
                Also appears on: {otherReleases.slice(0, 3).join(", ")}
                {otherReleases.length > 3 ? ` (+${otherReleases.length - 3} more)` : ""}
              </div>
            )}
            {onSelectAlbum && album.id && (
              <div className="text-[11px] text-spotify pt-0.5">
                {isSelected
                  ? `Click to clear release filter`
                  : `Click to filter table to "${album.name}"`}
              </div>
            )}
          </div>
        )

        return (
          <div className="flex flex-col gap-0.5 min-w-[150px] max-w-[240px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  {onSelectAlbum && album.id ? (
                    <button
                      type="button"
                      onClick={() => onSelectAlbum(isSelected ? null : album.id)}
                      className={cn(
                        "text-sm font-medium text-left truncate transition-colors hover:text-spotify",
                        isSelected && "text-spotify underline underline-offset-2"
                      )}
                    >
                      {album.name}
                    </button>
                  ) : (
                    <span className="text-sm font-medium truncate cursor-default">
                      {album.name}
                    </span>
                  )}
                </TooltipTrigger>
                <TooltipContent>{releaseTooltipContent}</TooltipContent>
              </Tooltip>
              {album.spotifyUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={album.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open "${album.name}" on Spotify`}
                      className="text-muted-foreground/70 hover:text-spotify shrink-0 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    {`Open "${album.name}" on Spotify`}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono truncate">
              {album.totalTracks} {album.totalTracks === 1 ? "track" : "tracks"}
              {album.label ? ` · ${album.label}` : ""}
            </span>
          </div>
        )
      },
    },
    {
      id: "albumType",
      accessorFn: (row: SpotifyTrack) => row.album.albumType,
      header: sortableHeader("Type"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const { album } = row.original
        const badge = getAlbumTypeBadge(album.albumType)
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium cursor-default",
                  badge.className
                )}
              >
                {badge.label}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {`${badge.label} released ${album.releaseDate || "unknown date"} · ${album.totalTracks} ${album.totalTracks === 1 ? "track" : "tracks"}`}
            </TooltipContent>
          </Tooltip>
        )
      },
    },
    {
      id: "releaseDate",
      accessorFn: (row: SpotifyTrack) => row.album.releaseDate,
      header: sortableHeader("Released"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const { album } = row.original
        const yearStats =
          album.releaseYear !== null ? yearsByYear?.get(album.releaseYear) : undefined
        const ageLabel = formatReleaseAge(album.releaseDate, album.releaseYear)

        if (!album.releaseDate) {
          return (
            <span className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
              —
            </span>
          )
        }

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap cursor-default">
                {album.releaseDate}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs space-y-1">
              <div className="font-semibold text-foreground">
                Released {album.releaseDate}
                {ageLabel ? ` (${ageLabel})` : ""}
              </div>
              {yearStats && (
                <div className="font-mono text-[11px] text-muted-foreground">
                  {yearStats.trackCount} {yearStats.trackCount === 1 ? "track" : "tracks"} across{" "}
                  {yearStats.releaseCount} {yearStats.releaseCount === 1 ? "release" : "releases"} in{" "}
                  {yearStats.year} · Year avg pop: {yearStats.avgPopularity} · #1: &quot;{yearStats.topTrackName}&quot;
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        )
      },
    },
    {
      id: "durationMs",
      accessorKey: "durationMs",
      header: sortableHeader("Duration"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const track = row.original
        const durationRank = trackDurationRankById?.get(track.id)
        const totalTracks = catalogStats?.totalTracks ?? 0
        const deltaMs = catalogStats
          ? track.durationMs - catalogStats.avgDurationMs
          : null

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-xs text-muted-foreground tabular-nums cursor-default">
                {formatDurationMs(track.durationMs)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs space-y-1">
              <div className="font-semibold text-foreground font-mono">
                {formatDurationMs(track.durationMs)}
                {deltaMs !== null && (
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    ({formatSignedDurationMs(deltaMs)} vs catalog avg{" "}
                    {formatDurationMs(catalogStats!.avgDurationMs)})
                  </span>
                )}
              </div>
              {durationRank && totalTracks > 0 && (
                <div className="font-mono text-[11px] text-muted-foreground">
                  #{durationRank} longest of {totalTracks} tracks
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        )
      },
    },
    {
      id: "credits",
      accessorFn: (row: SpotifyTrack) => row.featuredArtists.length,
      header: sortableHeader("Credits"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const track = row.original
        if (!track.isCollaboration) {
          const soloRankInfo = trackSoloRankById?.get(track.id)
          const soloCount = soloRankInfo?.count ?? catalogStats?.soloCount ?? 0
          const soloAvg = catalogStats?.soloAvgPopularity ?? 0
          const collabAvg = catalogStats?.collabAvgPopularity ?? 0
          const deltaVsSolo = track.popularity - soloAvg

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground cursor-default">
                  Solo
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs space-y-1">
                <div className="font-semibold text-foreground">
                  {soloRankInfo
                    ? `Solo track #${soloRankInfo.rank} of ${soloCount} solo tracks`
                    : "Solo release — no featured artists"}
                </div>
                {catalogStats && (
                  <>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      Solo catalog avg ({soloAvg}) vs Collab avg ({collabAvg})
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      This track: {formatSigned(deltaVsSolo)} vs solo avg
                    </div>
                  </>
                )}
              </TooltipContent>
            </Tooltip>
          )
        }
        const names = track.featuredArtists.map((a) => a.name).join(", ")
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex flex-col gap-0.5 max-w-[180px] cursor-default">
                <span className="inline-flex w-fit items-center gap-1 rounded-md bg-spotify/10 border border-spotify/25 px-2 py-0.5 text-xs font-medium text-spotify">
                  <Users className="h-3 w-3" />
                  Collab (+{track.featuredArtists.length})
                </span>
                <span className="text-[11px] text-muted-foreground truncate">
                  {names}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <CollaboratorDossierTooltip
                track={track}
                collaboratorsById={collaboratorsById}
              />
            </TooltipContent>
          </Tooltip>
        )
      },
    },
    {
      id: "popularity",
      accessorKey: "popularity",
      header: sortableHeader("Popularity"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const track = row.original
        const { popularity, deltaFromArtistAvg } = track
        const albumKey = track.album.id || track.album.name
        const albumSummary = albumsById?.get(albumKey)
        const albumRankInfo = trackAlbumRankById?.get(track.id)
        const yearRankInfo = trackYearRankById?.get(track.id)

        const tooltipNode = (
          <PopularityAndRankTooltip
            track={track}
            catalogStats={catalogStats}
            albumSummary={albumSummary}
            albumRankInfo={albumRankInfo}
            yearRankInfo={yearRankInfo}
          />
        )

        return (
          <div className="flex items-center gap-2.5 min-w-[155px]">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2.5 cursor-default">
                  <div className="hidden sm:block w-20 h-2 bg-muted rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full bg-gradient-to-r from-spotify/70 to-spotify rounded-full transition-all duration-500"
                      style={{ width: `${popularity}%` }}
                    />
                  </div>
                  <span className="font-mono font-semibold text-spotify w-7 text-right tabular-nums">
                    {popularity}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{tooltipNode}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    "font-mono text-[11px] px-1.5 py-0.5 rounded tabular-nums cursor-default",
                    deltaFromArtistAvg > 0
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {formatSigned(deltaFromArtistAvg)}
                </span>
              </TooltipTrigger>
              <TooltipContent>{tooltipNode}</TooltipContent>
            </Tooltip>
          </div>
        )
      },
    },
    {
      id: "spotify",
      accessorKey: "spotifyUrl",
      header: sortableHeader("Spotify"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const { spotifyUrl, isrc, name } = row.original
        const label = isrc
          ? `Open "${name}" on Spotify · ISRC: ${isrc}`
          : `Open "${name}" on Spotify`
        const decodedIsrc = decodeIsrc(isrc)

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-card/60 px-2 py-1 text-xs text-muted-foreground hover:border-spotify/50 hover:text-spotify transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span className="hidden xl:inline font-mono text-[10px]">
                  {isrc ? isrc.slice(-5) : "Open"}
                </span>
              </a>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs space-y-1">
              <div className="font-semibold text-foreground">
                Open &quot;{name}&quot; on Spotify
              </div>
              {decodedIsrc ? (
                <div className="font-mono text-[11px] text-muted-foreground space-y-0.5 pt-0.5 border-t border-border/40">
                  <div className="text-foreground font-medium">
                    ISRC: {decodedIsrc.formatted}
                  </div>
                  <div>
                    Country: {decodedIsrc.country} · Registrant: {decodedIsrc.registrant}
                  </div>
                  <div>
                    Year: {decodedIsrc.year} · Serial: {decodedIsrc.serial}
                  </div>
                </div>
              ) : (
                isrc && (
                  <div className="font-mono text-[11px] text-muted-foreground">
                    ISRC: {isrc}
                  </div>
                )
              )}
            </TooltipContent>
          </Tooltip>
        )
      },
    },
  ]
}

export const columns: ColumnDef<SpotifyTrack>[] = createTrackColumns()
