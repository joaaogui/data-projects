import {
  type CatalogStats,
  type SpotifyArtist,
  formatRuntimeMs,
} from "@/lib/spotify"
import { formatCompact, formatNumber } from "@data-projects/shared"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@data-projects/ui"
import Image from "next/image"
import {
  Calendar,
  Clock,
  Disc3,
  ExternalLink,
  Flame,
  Users,
} from "lucide-react"

interface ArtistHeaderProps {
  artist: SpotifyArtist
  catalogStats: CatalogStats
  trackCount?: number
}

export function ArtistHeader({
  artist,
  catalogStats,
}: Readonly<ArtistHeaderProps>) {
  const avatarUrl = artist.imageUrl ?? artist.images?.[0]?.url ?? null
  const spotifyUrl = artist.spotifyUrl || artist.external_urls?.spotify || ""

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

  return (
    <header className="mb-4 rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        {avatarUrl && (
          <div className="relative shrink-0 self-start sm:self-center">
            <div className="relative h-14 w-14 sm:h-16 sm:w-16 rounded-full overflow-hidden shadow-lg shadow-spotify/15">
              <Image
                src={avatarUrl}
                alt={artist.name}
                fill
                className="object-cover"
                sizes="64px"
                priority
              />
            </div>
            <div className="absolute inset-0 rounded-full ring-2 ring-spotify/30" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight truncate">
                {artist.name}
              </h1>
              {spotifyUrl && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a
                      href={spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-spotify transition-colors shrink-0 p-1 rounded-md hover:bg-muted/50"
                      aria-label={`Open ${artist.name} on Spotify`}
                    >
                      <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    Open {artist.name} artist profile on Spotify
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {artist.genres.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {artist.genres.slice(0, 4).map((genre) => (
                  <Tooltip key={genre}>
                    <TooltipTrigger asChild>
                      <span className="px-2 py-0.5 rounded-full bg-muted/40 border border-border/50 text-xs text-muted-foreground capitalize cursor-default">
                        {genre}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Spotify genre classification: <span className="capitalize font-medium">{genre}</span>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {artist.popularity > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-spotify/15 text-spotify font-medium cursor-default">
                    <Flame className="h-3.5 w-3.5" />
                    Artist Pop{" "}
                    <span className="font-mono font-semibold">
                      {artist.popularity}
                    </span>
                    /100
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Spotify Artist Popularity ({artist.popularity}/100) — algorithmically calculated from recent streaming volume and momentum across all tracks
                </TooltipContent>
              </Tooltip>
            )}

            {artist.followers > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted/70 text-foreground/90 font-medium cursor-default">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono">
                      {formatCompact(artist.followers)}
                    </span>{" "}
                    followers
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {formatNumber(artist.followers)} total followers on Spotify
                </TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-mono cursor-default">
                  <Disc3 className="h-3.5 w-3.5 text-spotify" />
                  <span className="text-foreground font-medium">
                    {formatNumber(catalogStats.totalTracks)}
                  </span>{" "}
                  tracks · {catalogStats.totalReleases} releases · avg{" "}
                  <span className="text-spotify font-semibold">
                    {catalogStats.avgPopularity}
                  </span>
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                {releaseBreakdownParts.join(" · ")} · Mean track popularity:{" "}
                {catalogStats.avgPopularity}/100 (median {catalogStats.medianPopularity}/100)
              </TooltipContent>
            </Tooltip>

            {catalogStats.careerSpan !== "—" && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-mono cursor-default">
                    <Calendar className="h-3 w-3 text-spotify" />
                    {catalogStats.careerSpan}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Catalog release span ({catalogStats.careerSpan})
                </TooltipContent>
              </Tooltip>
            )}

            {catalogStats.totalDurationMs > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted/50 text-muted-foreground font-mono cursor-default">
                    <Clock className="h-3 w-3 text-spotify" />
                    {formatRuntimeMs(catalogStats.totalDurationMs)}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Total deduplicated catalog runtime ({formatRuntimeMs(catalogStats.totalDurationMs)})
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
