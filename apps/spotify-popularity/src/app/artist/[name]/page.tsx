"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  ListMusic,
} from "lucide-react"
import { cn, formatNumber } from "@data-projects/shared"
import { useArtistTracks } from "@/hooks/use-artist-tracks"
import {
  computeCatalogStats,
  type PopularityTierId,
} from "@/lib/spotify"
import { Logo } from "@/components/logo"
import { SearchArtist } from "@/components/search-artist"
import { ArtistHeader } from "@/components/artist-header"
import { CatalogInsights } from "@/components/catalog-insights"
import { TracksTable } from "@/components/tracks-table"
import { TracksTableLoading } from "@/components/tracks-table/loading"
import {
  Button,
  Navbar,
  Skeleton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@data-projects/ui"
import { SpotifyAttribution } from "@/components/spotify-attribution"

function SpotifyLogo() {
  return <Logo showText={false} />
}

type ArtistViewTab = "tracks" | "insights"

export default function ArtistPage() {
  const params = useParams()
  const artistName = decodeURIComponent(params.name as string)
  const { data, isLoading, error } = useArtistTracks(artistName)

  const [activeTab, setActiveTab] = useState<ArtistViewTab>("tracks")
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null)
  const [selectedTierId, setSelectedTierId] =
    useState<PopularityTierId | null>(null)

  const catalogStats = useMemo(() => {
    if (!data) return null
    return data.catalogStats ?? computeCatalogStats(data.tracks)
  }, [data])

  const handleSelectAlbumFromInsights = (albumId: string | null) => {
    setSelectedAlbumId(albumId)
    if (albumId !== null) {
      setActiveTab("tracks")
    }
  }

  const handleSelectTierFromInsights = (tierId: PopularityTierId | null) => {
    setSelectedTierId(tierId)
    if (tierId !== null) {
      setActiveTab("tracks")
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        homeLink={<Link href="/" />}
        logo={<SpotifyLogo />}
        appName="Spotify Popularity"
        search={<SearchArtist compact />}
        themeIconClassName="text-spotify"
      />

      <main
        id="main-content"
        className="flex-1 container mx-auto px-4 py-5 flex flex-col"
      >
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex flex-col items-center justify-center py-20 space-y-4"
          >
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold">Artist not found</h2>
            <p className="text-muted-foreground text-center max-w-md">
              No exact artist match for &quot;{artistName}&quot;. Pick a suggestion
              from search, or check the spelling.
            </p>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to search
              </Link>
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4 animate-slide-up">
            <div className="rounded-xl border border-border/50 bg-card/30 px-4 py-3 flex items-center gap-4">
              <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-7 w-48" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-28 rounded-full" />
                  <Skeleton className="h-5 w-36 rounded-full" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-36 rounded-lg" />
              <Skeleton className="h-9 w-48 rounded-lg" />
            </div>
            <TracksTableLoading />
          </div>
        )}

        {data && catalogStats && (
          <div className="flex flex-col flex-1 animate-slide-up">
            <ArtistHeader
              artist={data.artist}
              catalogStats={catalogStats}
              trackCount={data.tracks.length}
            />

            {/* View Switcher: Tracks (First) vs Releases & Insights */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div
                role="tablist"
                aria-label="Artist catalog views"
                className="inline-flex items-center rounded-xl border border-border/50 bg-card/40 backdrop-blur-sm p-1 gap-1"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      role="tab"
                      id="tab-tracks"
                      aria-selected={activeTab === "tracks"}
                      aria-controls="panel-tracks"
                      onClick={() => setActiveTab("tracks")}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all",
                        activeTab === "tracks"
                          ? "bg-spotify text-spotify-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <ListMusic className="h-4 w-4" />
                      <span>Tracks</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 font-mono text-xs",
                          activeTab === "tracks"
                            ? "bg-black/20 text-spotify-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {formatNumber(data.tracks.length)}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Browse, search, and filter all {formatNumber(data.tracks.length)} tracks ranked by Spotify popularity
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      role="tab"
                      id="tab-insights"
                      aria-selected={activeTab === "insights"}
                      aria-controls="panel-insights"
                      onClick={() => setActiveTab("insights")}
                      className={cn(
                        "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all",
                        activeTab === "insights"
                          ? "bg-spotify text-spotify-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span>Releases &amp; Insights</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 font-mono text-xs",
                          activeTab === "insights"
                            ? "bg-black/20 text-spotify-foreground"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {catalogStats.totalReleases} releases
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    Explore release rankings, catalog KPIs, collaboration stats, and popularity distribution
                  </TooltipContent>
                </Tooltip>
              </div>

              <p className="text-xs text-muted-foreground hidden md:block">
                {activeTab === "tracks"
                  ? "Sorted by Spotify Popularity Index (0–100) · Hover any badge or score for details"
                  : "Click any release or popularity tier to filter the track list"}
              </p>
            </div>

            {activeTab === "tracks" ? (
              <div
                role="tabpanel"
                id="panel-tracks"
                aria-labelledby="tab-tracks"
                className="flex-1"
              >
                <TracksTable
                  tracks={data.tracks}
                  catalogStats={catalogStats}
                  selectedAlbumId={selectedAlbumId}
                  onSelectAlbum={setSelectedAlbumId}
                  selectedTierId={selectedTierId}
                  onSelectTier={setSelectedTierId}
                />
              </div>
            ) : (
              <div
                role="tabpanel"
                id="panel-insights"
                aria-labelledby="tab-insights"
                className="flex-1"
              >
                <CatalogInsights
                  catalogStats={catalogStats}
                  selectedAlbumId={selectedAlbumId}
                  onSelectAlbum={handleSelectAlbumFromInsights}
                  selectedTierId={selectedTierId}
                  onSelectTier={handleSelectTierFromInsights}
                />
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="flex-shrink-0 py-3 text-center border-t border-border/50">
        <SpotifyAttribution />
      </footer>
    </div>
  )
}
