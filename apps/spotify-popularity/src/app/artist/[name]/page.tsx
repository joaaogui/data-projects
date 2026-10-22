"use client"

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, AlertCircle } from "lucide-react"
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
import { Button, Skeleton, Navbar } from "@data-projects/ui"
import { SpotifyAttribution } from "@/components/spotify-attribution"

function SpotifyLogo() {
  return <Logo showText={false} />
}

export default function ArtistPage() {
  const params = useParams()
  const artistName = decodeURIComponent(params.name as string)
  const { data, isLoading, error } = useArtistTracks(artistName)

  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null)
  const [selectedTierId, setSelectedTierId] =
    useState<PopularityTierId | null>(null)

  const catalogStats = useMemo(() => {
    if (!data) return null
    return data.catalogStats ?? computeCatalogStats(data.tracks)
  }, [data])

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
        className="flex-1 container mx-auto px-4 py-6 flex flex-col"
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
          <div className="space-y-8 animate-slide-up">
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-4">
              <Skeleton className="h-28 w-28 sm:h-32 sm:w-32 rounded-full" />
              <div className="text-center sm:text-left space-y-3 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-64" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-24 rounded-full" />
                  <Skeleton className="h-6 w-28 rounded-full" />
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} className="h-24 w-full rounded-xl" />
              ))}
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

            <CatalogInsights
              catalogStats={catalogStats}
              selectedAlbumId={selectedAlbumId}
              onSelectAlbum={setSelectedAlbumId}
              selectedTierId={selectedTierId}
              onSelectTier={setSelectedTierId}
            />

            <p className="mb-3 text-xs sm:text-sm text-muted-foreground">
              Popularity is Spotify&apos;s 0–100 score for how often a track is
              played relative to others. Click any release or popularity tier
              above to filter the catalog table below.
            </p>

            <div className="flex-1">
              <TracksTable
                tracks={data.tracks}
                selectedAlbumId={selectedAlbumId}
                onSelectAlbum={setSelectedAlbumId}
                selectedTierId={selectedTierId}
                onSelectTier={setSelectedTierId}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="flex-shrink-0 py-3 text-center border-t border-border/50">
        <SpotifyAttribution />
      </footer>
    </div>
  )
}
