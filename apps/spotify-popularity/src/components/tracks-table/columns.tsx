"use client"

import {
  sortableHeader,
  type CellContext,
  type ColumnDef,
} from "@data-projects/ui"
import { cn, formatSigned } from "@data-projects/shared"
import { formatDurationMs, type SpotifyTrack } from "@/lib/spotify"
import { Crown, ExternalLink, Users } from "lucide-react"
import { TrackCover } from "@/components/track-cover"

export interface TrackColumnsOptions {
  onSelectAlbum?: (albumId: string | null) => void
  selectedAlbumId?: string | null
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

export function createTrackColumns(
  options: TrackColumnsOptions = {}
): ColumnDef<SpotifyTrack>[] {
  const { onSelectAlbum, selectedAlbumId } = options

  return [
    {
      id: "rank",
      accessorKey: "rank",
      header: sortableHeader("#"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const track = row.original
        return (
          <div className="flex flex-col items-start gap-0.5 min-w-[2.75rem]">
            <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
              #{track.rank}
            </span>
            {track.isAlbumLeadTrack && (
              <span
                title={`Highest-popularity track on "${track.album.name}"`}
                className="inline-flex items-center gap-0.5 rounded bg-spotify/15 px-1 py-0.2 text-[10px] font-medium text-spotify"
              >
                <Crown className="h-2.5 w-2.5" />
                #1
              </span>
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
                  <span
                    title="Explicit lyrics"
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold uppercase text-muted-foreground border border-border/60"
                  >
                    E
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span className="font-mono text-[11px]">
                  {track.discNumber > 1 ? `D${track.discNumber} · ` : ""}Track #
                  {track.trackNumber}
                </span>
                {featuredNames && (
                  <>
                    <span>·</span>
                    <span className="truncate max-w-[220px]" title={`feat. ${featuredNames}`}>
                      feat. <span className="text-foreground/80">{featuredNames}</span>
                    </span>
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
        const { album } = row.original
        const isSelected = Boolean(selectedAlbumId && selectedAlbumId === album.id)
        return (
          <div className="flex flex-col gap-0.5 min-w-[150px] max-w-[240px]">
            <div className="flex items-center gap-1.5 min-w-0">
              {onSelectAlbum && album.id ? (
                <button
                  type="button"
                  onClick={() => onSelectAlbum(isSelected ? null : album.id)}
                  title={
                    isSelected
                      ? "Clear release filter"
                      : `Filter tracks from "${album.name}"`
                  }
                  className={cn(
                    "text-sm font-medium text-left truncate transition-colors hover:text-spotify",
                    isSelected && "text-spotify underline underline-offset-2"
                  )}
                >
                  {album.name}
                </button>
              ) : (
                <span className="text-sm font-medium truncate">{album.name}</span>
              )}
              {album.spotifyUrl && (
                <a
                  href={album.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open "${album.name}" on Spotify`}
                  className="text-muted-foreground/70 hover:text-spotify shrink-0 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              {album.totalTracks} {album.totalTracks === 1 ? "track" : "tracks"}
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
        const badge = getAlbumTypeBadge(row.original.album.albumType)
        return (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
              badge.className
            )}
          >
            {badge.label}
          </span>
        )
      },
    },
    {
      id: "releaseDate",
      accessorFn: (row: SpotifyTrack) => row.album.releaseDate,
      header: sortableHeader("Released"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {row.original.album.releaseDate || "—"}
        </span>
      ),
    },
    {
      id: "durationMs",
      accessorKey: "durationMs",
      header: sortableHeader("Duration"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {formatDurationMs(row.original.durationMs)}
        </span>
      ),
    },
    {
      id: "credits",
      accessorFn: (row: SpotifyTrack) => row.featuredArtists.length,
      header: sortableHeader("Credits"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const track = row.original
        if (!track.isCollaboration) {
          return (
            <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 text-xs text-muted-foreground">
              Solo
            </span>
          )
        }
        const names = track.featuredArtists.map((a) => a.name).join(", ")
        return (
          <div className="flex flex-col gap-0.5 max-w-[180px]" title={names}>
            <span className="inline-flex w-fit items-center gap-1 rounded-md bg-spotify/10 border border-spotify/25 px-2 py-0.5 text-xs font-medium text-spotify">
              <Users className="h-3 w-3" />
              Collab (+{track.featuredArtists.length})
            </span>
            <span className="text-[11px] text-muted-foreground truncate">
              {names}
            </span>
          </div>
        )
      },
    },
    {
      id: "popularity",
      accessorKey: "popularity",
      header: sortableHeader("Popularity"),
      cell: ({ row }: CellContext<SpotifyTrack, unknown>) => {
        const { popularity, deltaFromArtistAvg } = row.original
        return (
          <div className="flex items-center gap-2.5 min-w-[155px]">
            <div className="hidden sm:block w-20 h-2 bg-muted rounded-full overflow-hidden shrink-0">
              <div
                className="h-full bg-gradient-to-r from-spotify/70 to-spotify rounded-full transition-all duration-500"
                style={{ width: `${popularity}%` }}
              />
            </div>
            <span className="font-mono font-semibold text-spotify w-7 text-right tabular-nums">
              {popularity}
            </span>
            <span
              title="Difference vs. artist average track popularity"
              className={cn(
                "font-mono text-[11px] px-1.5 py-0.5 rounded tabular-nums",
                deltaFromArtistAvg > 0
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {formatSigned(deltaFromArtistAvg)}
            </span>
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
        const title = isrc
          ? `Open "${name}" on Spotify (ISRC: ${isrc})`
          : `Open "${name}" on Spotify`
        return (
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={title}
            aria-label={title}
            className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-card/60 px-2 py-1 text-xs text-muted-foreground hover:border-spotify/50 hover:text-spotify transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden xl:inline font-mono text-[10px]">
              {isrc ? isrc.slice(-5) : "Open"}
            </span>
          </a>
        )
      },
    },
  ]
}

export const columns: ColumnDef<SpotifyTrack>[] = createTrackColumns()
