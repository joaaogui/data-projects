import {
  type CatalogStats,
  type SpotifyArtist,
  formatDurationMs,
  formatRuntimeMs,
} from "@/lib/spotify"
import { formatCompact, formatNumber, formatSigned } from "@data-projects/shared"
import Image from "next/image"
import {
  Clock,
  Disc3,
  ExternalLink,
  Flame,
  Sparkles,
  Users,
  Calendar,
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
    <div className="space-y-5 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        {avatarUrl && (
          <div className="relative shrink-0 self-start sm:self-auto">
            <div className="relative h-20 w-20 sm:h-28 sm:w-28 md:h-32 md:w-32 rounded-full overflow-hidden shadow-2xl shadow-spotify/20">
              <Image
                src={avatarUrl}
                alt={artist.name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 80px, (max-width: 768px) 112px, 128px"
                priority
              />
            </div>
            <div className="absolute inset-0 rounded-full ring-2 ring-spotify/30" />
          </div>
        )}

        <div className="text-left space-y-2 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span>Artist Profile</span>
            {catalogStats.careerSpan !== "—" && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Calendar className="h-3 w-3 text-spotify" />
                  {catalogStats.careerSpan}
                </span>
              </>
            )}
            {catalogStats.totalDurationMs > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <Clock className="h-3 w-3 text-spotify" />
                  {formatRuntimeMs(catalogStats.totalDurationMs)} catalog
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight truncate">
              {artist.name}
            </h1>
            {spotifyUrl && (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-spotify transition-colors shrink-0"
                title="Open artist on Spotify"
                aria-label={`Open ${artist.name} on Spotify`}
              >
                <ExternalLink className="h-5 w-5 sm:h-6 sm:w-6" />
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
            {artist.popularity > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-spotify/15 text-spotify font-medium"
                title="Spotify artist popularity index (0–100)"
              >
                <Flame className="h-3.5 w-3.5" />
                Artist Pop <span className="font-mono font-semibold">{artist.popularity}</span>/100
              </span>
            )}
            {artist.followers > 0 && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/70 text-foreground/90 font-medium"
                title={`${formatNumber(artist.followers)} followers on Spotify`}
              >
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono">{formatCompact(artist.followers)}</span> followers
              </span>
            )}
            {artist.genres.slice(0, 4).map((genre) => (
              <span
                key={genre}
                className="px-2.5 py-1 rounded-full bg-muted/40 border border-border/50 text-muted-foreground capitalize"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      </div>

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
          <div className="text-lg sm:text-xl font-bold font-mono tabular-nums">
            {catalogStats.avgPopularity} avg{" "}
            <span className="text-sm font-normal text-muted-foreground">
              · {catalogStats.medianPopularity} med
            </span>
          </div>
          <p
            className="text-xs text-muted-foreground truncate"
            title={
              catalogStats.peakTrack
                ? `#1 ${catalogStats.peakTrack.name} (${catalogStats.peakTrack.popularity}/100)`
                : undefined
            }
          >
            {catalogStats.peakTrack ? (
              <>
                Peak: <span className="text-foreground font-medium">#1 {catalogStats.peakTrack.name}</span>{" "}
                <span className="font-mono text-spotify">({catalogStats.peakTrack.popularity})</span>
              </>
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
            <span className="font-mono text-foreground">{catalogStats.collabAvgPopularity}</span>{" "}
            collab vs{" "}
            <span className="font-mono text-foreground">{catalogStats.soloAvgPopularity}</span>{" "}
            solo
            {catalogStats.collabPopularityDelta !== null && (
              <span
                className={
                  catalogStats.collabPopularityDelta >= 0
                    ? "ml-1 font-mono text-emerald-500"
                    : "ml-1 font-mono text-muted-foreground"
                }
              >
                ({formatSigned(catalogStats.collabPopularityDelta)})
              </span>
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
    </div>
  )
}
