"use client"

import { useMemo, useState } from "react"
import {
  Button,
  DataTable,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type VisibilityState,
} from "@data-projects/ui"
import { cn, formatNumber } from "@data-projects/shared"
import {
  POPULARITY_TIER_DEFINITIONS,
  computeCatalogStats,
  formatRuntimeMs,
  getPopularityTierId,
  type AlbumSummary,
  type CatalogStats,
  type CollaboratorSummary,
  type PopularityTierId,
  type ReleaseYearSummary,
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
  catalogStats?: CatalogStats | null
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
  catalogStats: providedCatalogStats,
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

  const catalogStats = useMemo(
    () => providedCatalogStats ?? computeCatalogStats(tracks),
    [providedCatalogStats, tracks]
  )

  const lookupContext = useMemo(() => {
    const collaboratorsById = new Map<string, CollaboratorSummary>()
    for (const collab of catalogStats.collaborators ?? []) {
      if (collab.id) collaboratorsById.set(collab.id, collab)
      collaboratorsById.set(collab.name.trim().toLowerCase(), collab)
    }

    const albumsById = new Map<string, AlbumSummary>()
    for (const album of catalogStats.albums) {
      albumsById.set(album.id, album)
      if (album.name) albumsById.set(album.name, album)
    }

    const yearsByYear = new Map<number, ReleaseYearSummary>()
    for (const yr of catalogStats.releaseYears) {
      yearsByYear.set(yr.year, yr)
    }

    const sortedByPop = tracks.toSorted((a, b) => b.popularity - a.popularity)

    const albumTracksMap = new Map<string, SpotifyTrack[]>()
    const yearTracksMap = new Map<number, SpotifyTrack[]>()
    const soloTracks: SpotifyTrack[] = []

    for (const t of sortedByPop) {
      const albumKey = t.album.id || t.album.name
      const list = albumTracksMap.get(albumKey)
      if (list) list.push(t)
      else albumTracksMap.set(albumKey, [t])

      if (t.album.releaseYear !== null) {
        const yList = yearTracksMap.get(t.album.releaseYear)
        if (yList) yList.push(t)
        else yearTracksMap.set(t.album.releaseYear, [t])
      }

      if (!t.isCollaboration) {
        soloTracks.push(t)
      }
    }

    const trackAlbumRankById = new Map<string, { rank: number; count: number }>()
    for (const list of albumTracksMap.values()) {
      const count = list.length
      list.forEach((t, idx) => {
        trackAlbumRankById.set(t.id, { rank: idx + 1, count })
      })
    }

    const trackYearRankById = new Map<string, { rank: number; count: number }>()
    for (const list of yearTracksMap.values()) {
      const count = list.length
      list.forEach((t, idx) => {
        trackYearRankById.set(t.id, { rank: idx + 1, count })
      })
    }

    const trackSoloRankById = new Map<string, { rank: number; count: number }>()
    const soloCount = soloTracks.length
    soloTracks.forEach((t, idx) => {
      trackSoloRankById.set(t.id, { rank: idx + 1, count: soloCount })
    })

    const sortedByDuration = tracks.toSorted(
      (a, b) => b.durationMs - a.durationMs
    )
    const trackDurationRankById = new Map<string, number>()
    sortedByDuration.forEach((t, idx) => {
      trackDurationRankById.set(t.id, idx + 1)
    })

    return {
      collaboratorsById,
      albumsById,
      yearsByYear,
      trackAlbumRankById,
      trackYearRankById,
      trackSoloRankById,
      trackDurationRankById,
    }
  }, [tracks, catalogStats])

  const tableColumns = useMemo(
    () =>
      createTrackColumns({
        onSelectAlbum: setSelectedAlbumId,
        selectedAlbumId,
        catalogStats,
        ...lookupContext,
      }),
    [setSelectedAlbumId, selectedAlbumId, catalogStats, lookupContext]
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
              {
                id: "all",
                label: "All",
                count: counts.all,
                tooltip: "Show tracks from all release types",
              },
              {
                id: "album",
                label: "Albums",
                count: counts.albums,
                tooltip: "Filter to full-length studio/live album tracks",
              },
              {
                id: "single",
                label: "Singles",
                count: counts.singles,
                tooltip: "Filter to single and EP releases",
              },
              ...(counts.compilations > 0
                ? [
                    {
                      id: "compilation" as const,
                      label: "Compilations",
                      count: counts.compilations,
                      tooltip: "Filter to compilation and guest-appearance releases",
                    },
                  ]
                : []),
            ] as const
          ).map((pill) => {
            const active = releaseType === pill.id
            return (
              <Tooltip key={pill.id}>
                <TooltipTrigger asChild>
                  <button
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
                </TooltipTrigger>
                <TooltipContent>{pill.tooltip}</TooltipContent>
              </Tooltip>
            )
          })}

          <span className="hidden sm:inline text-border mx-1">|</span>

          <div className="inline-flex items-center gap-1 text-xs text-muted-foreground mr-1">
            <span>Tracks:</span>
          </div>
          {(
            [
              {
                id: "all",
                label: "All Tracks",
                count: counts.all,
                tooltip: "Show all tracks in the catalog",
              },
              {
                id: "solo",
                label: "Solo",
                count: counts.solo,
                tooltip: "Tracks credited solely to this artist (no featured collaborators)",
              },
              {
                id: "collab",
                label: "Collabs",
                count: counts.collab,
                tooltip: "Tracks featuring one or more collaborating artists",
              },
              {
                id: "explicit",
                label: "Explicit",
                count: counts.explicit,
                tooltip: "Tracks flagged with explicit lyrics (E)",
              },
              {
                id: "lead",
                label: "Album #1s",
                count: counts.lead,
                tooltip:
                  "Most popular track (#1) from each multi-track album or EP in the catalog",
              },
            ] as const
          ).map((pill) => {
            const active = attributeFilter === pill.id
            return (
              <Tooltip key={pill.id}>
                <TooltipTrigger asChild>
                  <button
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
                </TooltipTrigger>
                <TooltipContent>{pill.tooltip}</TooltipContent>
              </Tooltip>
            )
          })}

          {/* Active Album / Popularity Tier Filter Pills */}
          {selectedAlbumName && (
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>
                Filtered to release &quot;{selectedAlbumName}&quot; — click to clear
              </TooltipContent>
            </Tooltip>
          )}

          {selectedTierDef && (
            <Tooltip>
              <TooltipTrigger asChild>
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
              </TooltipTrigger>
              <TooltipContent>
                Filtered to {selectedTierDef.label} popularity tier ({selectedTierDef.rangeLabel}) — click to clear
              </TooltipContent>
            </Tooltip>
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
