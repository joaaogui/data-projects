import { SpotifyArtist } from "@/lib/spotify"
import Image from "next/image"
import { ExternalLink } from "lucide-react"

interface ArtistHeaderProps {
  artist: SpotifyArtist
  trackCount: number
}

export function ArtistHeader({ artist, trackCount }: Readonly<ArtistHeaderProps>) {
  return (
    <div className="flex items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
      {artist.images[0] && (
        <div className="relative shrink-0">
          <div className="relative h-20 w-20 sm:h-32 sm:w-32 md:h-40 md:w-40 rounded-full overflow-hidden shadow-2xl shadow-spotify/20">
            <Image
              src={artist.images[0].url}
              alt={artist.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 80px, (max-width: 768px) 128px, 160px"
              priority
            />
          </div>
          <div className="absolute inset-0 rounded-full ring-2 ring-spotify/30" />
        </div>
      )}

      <div className="text-left space-y-1 sm:space-y-2 min-w-0">
        <p className="text-xs sm:text-sm uppercase tracking-wider text-muted-foreground">
          Artist
        </p>
        <div className="flex items-center gap-2 sm:gap-3">
          <h1 className="text-xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight truncate">
            {artist.name}
          </h1>
          {artist.external_urls?.spotify && (
            <a
              href={artist.external_urls.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-spotify transition-colors shrink-0"
              title="Open on Spotify"
            >
              <ExternalLink className="h-5 w-5 sm:h-6 sm:w-6 md:h-8 md:w-8" />
            </a>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground">
          <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-muted/50">
            {trackCount} tracks
          </span>
          {artist.genres.slice(0, 2).map((genre) => (
            <span
              key={genre}
              className="hidden sm:inline px-3 py-1 rounded-full bg-spotify/10 text-spotify capitalize"
            >
              {genre}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

