"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { useArtistTracks } from "@/hooks/use-artist-tracks"
import { Logo } from "@/components/logo"
import { SearchArtist } from "@/components/search-artist"
import { ArtistHeader } from "@/components/artist-header"
import { TracksTable } from "@/components/tracks-table"
import { TracksTableLoading } from "@/components/tracks-table/loading"
import { Button, Skeleton, Navbar } from "@data-projects/ui"
import { SpotifyAttribution } from "@/components/spotify-attribution"

function SpotifyLogo() {
  return <Logo showText={false} />;
}

export default function ArtistPage() {
  const params = useParams()
  const artistName = decodeURIComponent(params.name as string)
  const { data, isLoading, error } = useArtistTracks(artistName)

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar
        homeLink={<Link href="/" />}
        logo={<SpotifyLogo />}
        appName="Spotify Popularity"
        search={<SearchArtist compact />}
        themeIconClassName="text-spotify"
      />


      <main className="flex-1 min-h-0 container mx-auto px-4 py-6 flex flex-col overflow-hidden">
        {error && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold">Artist not found</h2>
            <p className="text-muted-foreground text-center max-w-md">
              We couldn&apos;t find an artist named &quot;{artistName}&quot;.
              Please check the spelling and try again.
            </p>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to search
              </Link>
            </Button>
          </div>
        )}

        { }
        {isLoading && (
          <div className="space-y-8 animate-slide-up">
            { }
            <div className="flex flex-col sm:flex-row items-center gap-6 mb-8">
              <Skeleton className="h-32 w-32 sm:h-40 sm:w-40 rounded-full" />
              <div className="text-center sm:text-left space-y-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-10 w-64" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            </div>
            <TracksTableLoading />
          </div>
        )}

        { }
        {data && (
          <div className="flex flex-col flex-1 min-h-0 animate-slide-up">
            <ArtistHeader artist={data.artist} trackCount={data.tracks.length} />
            <div className="flex-1 min-h-0">
              <TracksTable tracks={data.tracks} />
            </div>
          </div>
        )}
      </main>

      { }
      <footer className="flex-shrink-0 py-3 text-center border-t border-border/50">
        <SpotifyAttribution />
      </footer>
    </div>
  )
}
