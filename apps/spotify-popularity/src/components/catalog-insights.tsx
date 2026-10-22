"use client"

import { useState } from "react"
import Image from "next/image"
import { cn } from "@data-projects/shared"
import {
  type AlbumSummary,
  type CatalogStats,
  type PopularityTierId,
  formatRuntimeMs,
} from "@/lib/spotify"
import { BarChart3, Disc, Sparkles } from "lucide-react"

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
    .slice(0, 6)

  return (
    <section
      aria-label="Catalog insights and release rollups"
      className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6"
    >
      {/* Top Releases / Albums Shelf */}
      <div className="lg:col-span-7 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm p-4 flex flex-col justify-between">
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
                { id: "avg", label: "Avg Pop" },
                { id: "peak", label: "Peak Pop" },
                { id: "year", label: "Newest" },
              ] as const
            ).map((option) => (
              <button
                key={option.id}
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
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
          {sortedReleases.slice(0, 12).map((album) => {
            const isSelected = selectedAlbumId === album.id
            return (
              <button
                key={album.id}
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
                      {album.trackCount} {album.trackCount === 1 ? "track" : "tracks"}
                    </span>
                    <span>·</span>
                    <span className="font-mono">Peak {album.maxPopularity}</span>
                  </div>

                  <div className="text-[11px] text-muted-foreground truncate">
                    <span className="text-foreground/80 font-medium">#1:</span>{" "}
                    {album.topTrackName} ({formatRuntimeMs(album.totalDurationMs)})
                  </div>
                </div>
              </button>
            )
          })}
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
              Click a tier to filter
            </span>
          </div>

          <div className="space-y-1.5">
            {catalogStats.popularityTiers.map((tier) => {
              const isSelected = selectedTierId === tier.id
              return (
                <button
                  key={tier.id}
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
                      <span className="font-medium truncate">{tier.label}</span>
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
                      style={{ width: `${Math.max(tier.count > 0 ? 4 : 0, tier.percentage)}%` }}
                    />
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {topYears.length > 0 && (
          <div className="pt-2 border-t border-border/40">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <Sparkles className="h-3.5 w-3.5 text-spotify" />
              <span>Recent Era Snapshot</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topYears.map((yr) => (
                <div
                  key={yr.year}
                  title={`${yr.year}: ${yr.trackCount} tracks across ${yr.releaseCount} releases · Top: ${yr.topTrackName} (${yr.maxPopularity})`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/40 bg-card/50 px-2 py-1 text-xs"
                >
                  <span className="font-mono font-semibold">{yr.year}</span>
                  <span className="text-muted-foreground font-mono text-[11px]">
                    {yr.trackCount}t · {yr.avgPopularity} avg
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
