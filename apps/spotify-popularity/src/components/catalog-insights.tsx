"use client"

import { useState } from "react"
import Image from "next/image"
import { cn, formatNumber, formatSigned } from "@data-projects/shared"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@data-projects/ui"
import {
  type AlbumSummary,
  type CatalogStats,
  type PopularityTierId,
  formatDurationMs,
  formatRuntimeMs,
} from "@/lib/spotify"
import {
  BarChart3,
  Crown,
  Disc,
  Disc3,
  Flame,
  Sparkles,
  Users,
} from "lucide-react"

interface CatalogInsightsProps {
  catalogStats: CatalogStats
  selectedAlbumId: string | null
  onSelectAlbum: (albumId: string | null) => void
  selectedTierId: PopularityTierId | null
  onSelectTier: (tierId: PopularityTierId | null) => void
}

type ReleaseSortMode = "avg" | "peak" | "year"

function formatAlbumTypeBadge(type: AlbumSummary["albumType"]): string {
  if (type === "single") return "Single"
  if (type === "compilation") return "Compilation"
  return "Album"
}

export function CatalogInsights({
  catalogStats,
  selectedAlbumId,
  onSelectAlbum,
  selectedTierId,
  onSelectTier,
}: Readonly<CatalogInsightsProps>) {
  const [releaseSort, setReleaseSort] = useState<ReleaseSortMode>("avg")

  if (catalogStats.totalTracks === 0) {
    return null
  }

  const releaseBreakdownParts = [
    `${catalogStats.albumCount} ${catalogStats.albumCount === 1 ? "album" : "albums"}`,
    `${catalogStats.singleCount} ${catalogStats.singleCount === 1 ? "single" : "singles"}`,
  ]
  if (catalogStats.compilationCount > 0) {
    releaseBreakdownParts.push(
      `${catalogStats.compilationCount} ${
        catalogStats.compilationCount === 1 ? "compilation" : "compilations"
      }`
    )
  }

  const sortedReleases = catalogStats.albums.toSorted((a, b) => {
    if (releaseSort === "peak") {
      return (
        b.maxPopularity - a.maxPopularity ||
        b.avgPopularity - a.avgPopularity ||
        b.trackCount - a.trackCount
      )
    }
    if (releaseSort === "year") {
      return (
        b.releaseDate.localeCompare(a.releaseDate) ||
        b.avgPopularity - a.avgPopularity
      )
    }
    return (
      b.avgPopularity - a.avgPopularity ||
      b.maxPopularity - a.maxPopularity ||
      b.trackCount - a.trackCount
    )
  })

  const topYears = catalogStats.releaseYears
    .toSorted((a, b) => b.year - a.year)
    .slice(0, 8)

  return (
    <section
      aria-label="Catalog insights and release rollups"
      className="space-y-4"
    >
      {/* 4-Card KPI Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
            <span>Catalog & Releases</span>
            <Disc3 className="h-3.5 w-3.5 text-spotify" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums">
            {formatNumber(catalogStats.totalTracks)} tracks{" "}
            <span className="text-sm font-normal text-muted-foreground">
              / {catalogStats.totalReleases} releases
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {releaseBreakdownParts.join(" · ")}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
            <span>Track Popularity</span>
            <Flame className="h-3.5 w-3.5 text-spotify" />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-lg sm:text-xl font-bold font-mono tabular-nums cursor-default w-fit">
                {catalogStats.avgPopularity} avg{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  · {catalogStats.medianPopularity} med
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Mean track popularity is {catalogStats.avgPopularity}/100 and median is{" "}
              {catalogStats.medianPopularity}/100 across all {catalogStats.totalTracks} tracks
            </TooltipContent>
          </Tooltip>
          <p className="text-xs text-muted-foreground truncate">
            {catalogStats.peakTrack ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 cursor-default max-w-full truncate">
                    Peak:{" "}
                    <span className="text-foreground font-medium truncate">
                      #1 {catalogStats.peakTrack.name}
                    </span>{" "}
                    <span className="font-mono text-spotify shrink-0">
                      ({catalogStats.peakTrack.popularity})
                    </span>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Highest-ranked catalog track: &quot;{catalogStats.peakTrack.name}&quot; on{" "}
                  {catalogStats.peakTrack.albumName} ({catalogStats.peakTrack.popularity}/100)
                </TooltipContent>
              </Tooltip>
            ) : (
              "No tracks"
            )}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
            <span>Collabs vs. Solo</span>
            <Users className="h-3.5 w-3.5 text-spotify" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums">
            {catalogStats.collaborationPct}% collabs{" "}
            <span className="text-sm font-normal text-muted-foreground">
              ({catalogStats.collaborationCount}/{catalogStats.totalTracks})
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            avg pop{" "}
            <span className="font-mono text-foreground">
              {catalogStats.collabAvgPopularity}
            </span>{" "}
            collab vs{" "}
            <span className="font-mono text-foreground">
              {catalogStats.soloAvgPopularity}
            </span>{" "}
            solo
            {catalogStats.collabPopularityDelta !== null && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "ml-1 font-mono cursor-default",
                      catalogStats.collabPopularityDelta >= 0
                        ? "text-emerald-500"
                        : "text-muted-foreground"
                    )}
                  >
                    ({formatSigned(catalogStats.collabPopularityDelta)})
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Collaborations average{" "}
                  {Math.abs(catalogStats.collabPopularityDelta)} popularity points{" "}
                  {catalogStats.collabPopularityDelta >= 0 ? "higher" : "lower"} than solo tracks
                </TooltipContent>
              </Tooltip>
            )}
          </p>
        </div>

        <div className="rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
            <span>Length & Explicit</span>
            <Sparkles className="h-3.5 w-3.5 text-spotify" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums">
            {formatDurationMs(catalogStats.avgDurationMs)} avg{" "}
            <span className="text-sm font-normal text-muted-foreground">
              · {catalogStats.explicitPct}% explicit
            </span>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {catalogStats.explicitCount} explicit tracks ·{" "}
            {formatRuntimeMs(catalogStats.totalDurationMs)} total
          </p>
        </div>
      </div>

      {/* Releases Shelf + Popularity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Top Releases / Albums Shelf */}
        <div className="lg:col-span-7 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-4 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Disc className="h-4 w-4 text-spotify" />
                <h2 className="text-sm font-semibold tracking-tight">
                  Releases by Popularity
                </h2>
                <span className="text-xs text-muted-foreground font-mono">
                  ({catalogStats.albums.length})
                </span>
              </div>

              <div className="inline-flex items-center rounded-lg bg-muted/60 p-0.5 text-xs">
                {(
                  [
                    {
                      id: "avg",
                      label: "Avg Pop",
                      tooltip: "Sort releases by mean track popularity",
                    },
                    {
                      id: "peak",
                      label: "Peak Pop",
                      tooltip: "Sort releases by highest single track popularity",
                    },
                    {
                      id: "year",
                      label: "Newest",
                      tooltip: "Sort releases chronologically from newest to oldest",
                    },
                  ] as const
                ).map((option) => (
                  <Tooltip key={option.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setReleaseSort(option.id)}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-medium transition-colors",
                          releaseSort === option.id
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {option.label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{option.tooltip}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-3">
              Click any release below to filter the track catalog and jump directly to its tracks.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[26rem] overflow-y-auto pr-1">
              {sortedReleases.map((album) => {
                const isSelected = selectedAlbumId === album.id
                return (
                  <Tooltip key={album.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSelectAlbum(isSelected ? null : album.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          "group flex items-center gap-3 rounded-lg border p-2.5 text-left transition-all",
                          isSelected
                            ? "border-spotify bg-spotify/10 ring-1 ring-spotify"
                            : "border-border/40 bg-card/50 hover:border-spotify/40 hover:bg-muted/40"
                        )}
                      >
                        {album.imageUrl ? (
                          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                            <Image
                              src={album.imageUrl}
                              alt={album.name}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          </div>
                        ) : (
                          <div className="h-12 w-12 shrink-0 rounded-md bg-muted flex items-center justify-center">
                            <Disc className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-sm font-medium truncate group-hover:text-spotify transition-colors">
                              {album.name}
                            </span>
                            <span className="shrink-0 font-mono text-xs font-semibold text-spotify">
                              {album.avgPopularity} avg
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            <span className="px-1.5 py-0.2 rounded bg-muted/80 uppercase tracking-wider text-[10px]">
                              {formatAlbumTypeBadge(album.albumType)}
                            </span>
                            {album.releaseYear && (
                              <span className="font-mono">{album.releaseYear}</span>
                            )}
                            <span>·</span>
                            <span className="font-mono">
                              {album.trackCount}{" "}
                              {album.trackCount === 1 ? "track" : "tracks"}
                            </span>
                            <span>·</span>
                            <span className="font-mono">
                              Peak {album.maxPopularity}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                            <Crown className="h-3 w-3 text-spotify shrink-0" />
                            <span className="truncate">{album.topTrackName}</span>
                            <span className="shrink-0 font-mono text-[10px]">
                              ({formatRuntimeMs(album.totalDurationMs)})
                            </span>
                          </div>
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Filter tracks to &quot;{album.name}&quot; ({album.trackCount}{" "}
                      {album.trackCount === 1 ? "track" : "tracks"} · Avg pop{" "}
                      {album.avgPopularity}/100 · Peak {album.maxPopularity}/100)
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        </div>

        {/* Popularity Distribution & Career Timeline */}
        <div className="lg:col-span-5 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-spotify" />
                <h2 className="text-sm font-semibold tracking-tight">
                  Popularity Distribution
                </h2>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Click a tier to filter tracks
              </span>
            </div>

            <div className="space-y-1.5">
              {catalogStats.popularityTiers.map((tier) => {
                const isSelected = selectedTierId === tier.id
                return (
                  <Tooltip key={tier.id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onSelectTier(isSelected ? null : tier.id)}
                        aria-pressed={isSelected}
                        className={cn(
                          "w-full rounded-lg px-2.5 py-1.5 text-left transition-all border",
                          isSelected
                            ? "border-spotify bg-spotify/10 ring-1 ring-spotify"
                            : "border-transparent hover:border-border/60 hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[11px] text-muted-foreground w-12 shrink-0">
                              {tier.rangeLabel}
                            </span>
                            <span className="font-medium truncate">
                              {tier.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                            <span className="font-semibold text-foreground">
                              {tier.count}
                            </span>
                            <span className="text-muted-foreground w-9 text-right">
                              ({tier.percentage}%)
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-spotify/60 to-spotify transition-all duration-500"
                            style={{
                              width: `${Math.max(tier.count > 0 ? 4 : 0, tier.percentage)}%`,
                            }}
                          />
                        </div>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {tier.count > 0
                        ? `Filter ${tier.count} tracks in ${tier.label} tier (${tier.rangeLabel} popularity) · Top: "${tier.topTrackName}"`
                        : `No tracks in ${tier.label} tier (${tier.rangeLabel} popularity)`}
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>

          {topYears.length > 0 && (
            <div className="pt-2 border-t border-border/40">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground mb-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-spotify" />
                  <span>Release Era Snapshot</span>
                </div>
                <span className="text-[11px] font-mono">
                  {catalogStats.careerSpan}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {topYears.map((yr) => (
                  <Tooltip key={yr.year}>
                    <TooltipTrigger asChild>
                      <div className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-card/50 px-2 py-1 text-xs cursor-default">
                        <span className="font-mono font-semibold">{yr.year}</span>
                        <span className="text-muted-foreground font-mono text-[11px]">
                          {yr.trackCount}t · {yr.avgPopularity} avg
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {yr.year}: {yr.trackCount}{" "}
                      {yr.trackCount === 1 ? "track" : "tracks"} across{" "}
                      {yr.releaseCount}{" "}
                      {yr.releaseCount === 1 ? "release" : "releases"} · Lead:{" "}
                      &quot;{yr.topTrackName}&quot; ({yr.maxPopularity}/100)
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
