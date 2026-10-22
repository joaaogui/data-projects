"use client"

import { useMemo, useState } from "react"
import {
  Button,
  DataTable,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  type VisibilityState,
} from "@data-projects/ui"
import { cn, formatNumber } from "@data-projects/shared"
import {
  POPULARITY_TIER_DEFINITIONS,
  formatRuntimeMs,
  getPopularityTierId,
  type PopularityTierId,
  type SpotifyAlbumType,
  type SpotifyTrack,
} from "@/lib/spotify"
import {
  Check,
  Filter,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import { createTrackColumns } from "./columns"

export type TrackAttributeFilter =
  | "all"
  | "solo"
  | "collab"
  | "explicit"
  | "lead"

export type ReleaseTypeFilter = "all" | SpotifyAlbumType

interface TracksTableProps {
  tracks: SpotifyTrack[]
  selectedAlbumId?: string | null
  onSelectAlbum?: (albumId: string | null) => void
  selectedTierId?: PopularityTierId | null
  onSelectTier?: (tierId: PopularityTierId | null) => void
}

const OPTIONAL_COLUMNS: ReadonlyArray<{ id: string; label: string }> = [
  { id: "album", label: "Release / Album" },
  { id: "albumType", label: "Release Type" },
  { id: "releaseDate", label: "Release Date" },
  { id: "durationMs", label: "Duration" },
  { id: "credits", label: "Credits / Collabs" },
  { id: "spotify", label: "Spotify / ISRC" },
]

export function TracksTable({
  tracks,
  selectedAlbumId: controlledAlbumId,
  onSelectAlbum: controlledOnSelectAlbum,
  selectedTierId: controlledTierId,
  onSelectTier: controlledOnSelectTier,
}: Readonly<TracksTableProps>) {
  const [searchQuery, setSearchQuery] = useState("")
  const [releaseType, setReleaseType] = useState<ReleaseTypeFilter>("all")
  const [attributeFilter, setAttributeFilter] =
    useState<TrackAttributeFilter>("all")
  const [internalAlbumId, setInternalAlbumId] = useState<string | null>(null)
  const [internalTierId, setInternalTierId] =
    useState<PopularityTierId | null>(null)
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const selectedAlbumId =
    controlledAlbumId !== undefined ? controlledAlbumId : internalAlbumId
  const setSelectedAlbumId = controlledOnSelectAlbum ?? setInternalAlbumId

  const selectedTierId =
    controlledTierId !== undefined ? controlledTierId : internalTierId
  const setSelectedTierId = controlledOnSelectTier ?? setInternalTierId

  const counts = useMemo(() => {
    let albums = 0
    let singles = 0
    let compilations = 0
    let solo = 0
    let collab = 0
    let explicit = 0
    let lead = 0

    for (const track of tracks) {
      if (track.album.albumType === "album") albums += 1
      else if (track.album.albumType === "single") singles += 1
      else if (track.album.albumType === "compilation") compilations += 1

      if (track.isCollaboration) collab += 1
      else solo += 1

      if (track.explicit) explicit += 1
      if (track.isAlbumLeadTrack) lead += 1
    }

    return {
      all: tracks.length,
      albums,
      singles,
      compilations,
      solo,
      collab,
      explicit,
      lead,
    }
  }, [tracks])

  const selectedAlbumName = useMemo(() => {
    if (!selectedAlbumId) return null
    const match = tracks.find(
      (t) => (t.album.id || t.album.name) === selectedAlbumId
    )
    return match?.album.name ?? selectedAlbumId
  }, [tracks, selectedAlbumId])

  const selectedTierDef = useMemo(() => {
    if (!selectedTierId) return null
    return (
      POPULARITY_TIER_DEFINITIONS.find((t) => t.id === selectedTierId) ?? null
    )
  }, [selectedTierId])

  const filteredTracks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return tracks.filter((track) => {
      if (releaseType !== "all" && track.album.albumType !== releaseType) {
        return false
      }

      if (attributeFilter === "solo" && track.isCollaboration) return false
      if (attributeFilter === "collab" && !track.isCollaboration) return false
      if (attributeFilter === "explicit" && !track.explicit) return false
      if (attributeFilter === "lead" && !track.isAlbumLeadTrack) return false

      if (
        selectedAlbumId &&
        (track.album.id || track.album.name) !== selectedAlbumId
      ) {
        return false
      }

      if (
        selectedTierId &&
        getPopularityTierId(track.popularity) !== selectedTierId
      ) {
        return false
      }

      if (query) {
        const inTitle = track.name.toLowerCase().includes(query)
        const inAlbum = track.album.name.toLowerCase().includes(query)
        const inArtists = track.artists.some((a) =>
          a.name.toLowerCase().includes(query)
        )
        const inIsrc = track.isrc?.toLowerCase().includes(query) ?? false
        if (!inTitle && !inAlbum && !inArtists && !inIsrc) {
          return false
        }
      }

      return true
    })
  }, [
    tracks,
    releaseType,
    attributeFilter,
    selectedAlbumId,
    selectedTierId,
    searchQuery,
  ])

  const filteredStats = useMemo(() => {
    if (filteredTracks.length === 0) {
      return { avgPopularity: 0, totalDurationMs: 0 }
    }
    const sumPop = filteredTracks.reduce((sum, t) => sum + t.popularity, 0)
    const sumDur = filteredTracks.reduce((sum, t) => sum + t.durationMs, 0)
    return {
      avgPopularity: Math.round(sumPop / filteredTracks.length),
      totalDurationMs: sumDur,
    }
  }, [filteredTracks])

  const tableColumns = useMemo(
    () =>
      createTrackColumns({
        onSelectAlbum: setSelectedAlbumId,
        selectedAlbumId,
      }),
    [setSelectedAlbumId, selectedAlbumId]
  )

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    releaseType !== "all" ||
    attributeFilter !== "all" ||
    selectedAlbumId !== null ||
    selectedTierId !== null

  const resetAllFilters = () => {
    setSearchQuery("")
    setReleaseType("all")
    setAttributeFilter("all")
    setSelectedAlbumId(null)
    setSelectedTierId(null)
  }

  const toggleColumn = (columnId: string) => {
    setColumnVisibility((prev) => ({
      ...prev,
      [columnId]: prev[columnId] === false,
    }))
  }

  return (
    <div className="space-y-3">
      {/* Interactive Filter Bar */}
      <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by track, release, collaborator, or ISRC..."
              aria-label="Filter tracks by title, release, collaborator, or ISRC"
              className="pl-9 pr-8 h-9 text-sm bg-background/60 border-border/60 focus:border-spotify"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search query"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Live Filtered Summary + Column Visibility Toggle */}
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-2.5">
            <div className="text-xs text-muted-foreground font-mono">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {formatNumber(filteredTracks.length)}
              </span>{" "}
              of {formatNumber(tracks.length)} tracks · Avg pop{" "}
              <span className="font-semibold text-spotify">
                {filteredStats.avgPopularity}
              </span>
              {filteredTracks.length > 0 && (
                <span className="hidden sm:inline">
                  {" "}
                  · {formatRuntimeMs(filteredStats.totalDurationMs)}
                </span>
              )}
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 border-border/60 text-xs"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Columns
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-52 p-2">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Toggle Columns
                </div>
                <div className="space-y-0.5">
                  {OPTIONAL_COLUMNS.map((col) => {
                    const isVisible = columnVisibility[col.id] !== false
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => toggleColumn(col.id)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-muted transition-colors"
                      >
                        <span>{col.label}</span>
                        {isVisible && <Check className="h-3.5 w-3.5 text-spotify" />}
                      </button>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Filter Pills Row */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/30">
          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-1">
            <Filter className="h-3 w-3" />
            <span>Release:</span>
          </div>
          {(
            [
              { id: "all", label: "All", count: counts.all },
              { id: "album", label: "Albums", count: counts.albums },
              { id: "single", label: "Singles", count: counts.singles },
              ...(counts.compilations > 0
                ? [
                    {
                      id: "compilation" as const,
                      label: "Compilations",
                      count: counts.compilations,
                    },
                  ]
                : []),
            ] as const
          ).map((pill) => {
            const active = releaseType === pill.id
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setReleaseType(pill.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-spotify text-spotify-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{pill.label}</span>
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    active ? "opacity-90" : "opacity-70"
                  )}
                >
                  {pill.count}
                </span>
              </button>
            )
          })}

          <span className="hidden sm:inline text-border mx-1">|</span>

          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-1">
            <span>Tracks:</span>
          </div>
          {(
            [
              { id: "all", label: "All Tracks", count: counts.all },
              { id: "solo", label: "Solo", count: counts.solo },
              { id: "collab", label: "Collabs", count: counts.collab },
              { id: "explicit", label: "Explicit", count: counts.explicit },
              { id: "lead", label: "Album #1s", count: counts.lead },
            ] as const
          ).map((pill) => {
            const active = attributeFilter === pill.id
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setAttributeFilter(pill.id)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "bg-spotify text-spotify-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span>{pill.label}</span>
                <span
                  className={cn(
                    "font-mono text-[11px]",
                    active ? "opacity-90" : "opacity-70"
                  )}
                >
                  {pill.count}
                </span>
              </button>
            )
          })}

          {/* Active Album / Popularity Tier Filter Pills */}
          {selectedAlbumName && (
            <button
              type="button"
              onClick={() => setSelectedAlbumId(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-spotify/50 bg-spotify/15 px-2.5 py-1 text-xs font-medium text-spotify hover:bg-spotify/25 transition-colors"
            >
              <span className="truncate max-w-[180px]">
                Release: {selectedAlbumName}
              </span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          )}

          {selectedTierDef && (
            <button
              type="button"
              onClick={() => setSelectedTierId(null)}
              className="inline-flex items-center gap-1.5 rounded-full border border-spotify/50 bg-spotify/15 px-2.5 py-1 text-xs font-medium text-spotify hover:bg-spotify/25 transition-colors"
            >
              <span>
                Tier: {selectedTierDef.label} ({selectedTierDef.rangeLabel})
              </span>
              <X className="h-3 w-3 shrink-0" />
            </button>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        columns={tableColumns}
        data={filteredTracks}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
        pagination={{
          pageSize: 25,
          showInfo: true,
          itemName: "tracks",
        }}
        emptyMessage="No tracks match the active filters."
      />
    </div>
  )
}
