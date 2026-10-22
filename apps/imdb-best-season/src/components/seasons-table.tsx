"use client";

import { useState, useMemo, useCallback } from "react";
import {
  DataTable,
  sortableHeader,
  Button,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  type ColumnDef,
  type Row,
} from "@data-projects/ui";
import { cn } from "@data-projects/shared";
import { EpisodeDialog } from "@/components/episode-dialog";
import { calculateMedian, computeSeasonStats, formatSignedDecimal } from "@/lib/ratings";
import { Info, Trophy, Star } from "lucide-react";
import type { RankedSeason } from "@/types/omdb";

interface SeasonsTableProps {
  seasons: RankedSeason[];
}

interface TableMeta {
  seasons: RankedSeason[];
  showMedianRating: number;
  onViewEpisodes: (season: RankedSeason) => void;
}

function getArcDotColorClass(rating: number | null): string {
  if (rating === null) return "bg-muted-foreground/30";
  if (rating >= 8.0) return "bg-emerald-500";
  if (rating >= 6.5) return "bg-amber-500";
  return "bg-red-500";
}

function createColumns(meta: TableMeta): ColumnDef<RankedSeason>[] {
  return [
    {
      id: "rank",
      header: "Rank",
      cell: ({ row }) => {
        const seasonNumber = row.original.seasonNumber;
        const originalIndex = meta.seasons.findIndex((s) => s.seasonNumber === seasonNumber);
        const isFirst = originalIndex === 0;
        return (
          <div className="flex items-center gap-2">
            {isFirst ? (
              <>
                <Trophy className="h-5 w-5 text-gold fill-gold" aria-hidden="true" />
                <span className="sr-only">1 / Best season</span>
              </>
            ) : (
              <span className="w-5 text-center text-muted-foreground font-mono">
                {originalIndex + 1}
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "seasonNumber",
      header: sortableHeader("Season"),
      cell: ({ row }) => (
        <span data-testid={`season-number-${row.original.seasonNumber}`} className="font-semibold whitespace-nowrap">
          Season {row.original.seasonNumber}
        </span>
      ),
    },
    {
      accessorKey: "rating",
      header: sortableHeader("Rating"),
      cell: ({ row }) => {
        const season = row.original;
        const { rating, seasonNumber } = season;
        const originalIndex = meta.seasons.findIndex((s) => s.seasonNumber === seasonNumber);
        const isFirst = originalIndex === 0;
        const stats = computeSeasonStats(season, meta.showMedianRating);
        const delta = season.deltaFromShowMedian ?? stats.deltaFromShowMedian;
        const meanRating = season.meanRating ?? stats.meanRating;
        const imdbMedian = season.imdbMedian ?? stats.imdbMedian;
        const tmdbMedian = season.tmdbMedian ?? stats.tmdbMedian;
        const minRating = season.minRating ?? stats.minRating;
        const maxRating = season.maxRating ?? stats.maxRating;
        const highRatedCount = season.highRatedCount ?? stats.highRatedCount;
        const ratedCount = season.episodes.filter((ep) => ep.rating !== null).length;
        const highRatedPct =
          ratedCount > 0 ? Math.round((highRatedCount / ratedCount) * 100) : 0;

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-2 cursor-default w-fit">
                <Star
                  className={`h-4 w-4 ${
                    isFirst ? "text-gold fill-gold" : "text-muted-foreground"
                  }`}
                />
                <span
                  data-testid={`season-rating-${seasonNumber}`}
                  className={`font-mono ${isFirst ? "text-gold font-bold" : ""}`}
                >
                  {rating.toFixed(2)}
                </span>
                <span
                  className={cn(
                    "font-mono text-[11px] px-1.5 py-0.5 rounded tabular-nums",
                    delta > 0.005
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : delta < -0.005
                        ? "bg-red-500/15 text-red-600 dark:text-red-400"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {formatSignedDecimal(delta, 2)}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs space-y-1">
              <div className="font-semibold text-foreground font-mono">
                Median {rating.toFixed(2)} · Mean {meanRating.toFixed(2)}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">
                vs. Series Median ({meta.showMedianRating.toFixed(2)}):{" "}
                <span className="text-foreground font-medium">
                  {formatSignedDecimal(delta, 2)}
                </span>
              </div>
              {(imdbMedian !== null || tmdbMedian !== null) && (
                <div className="font-mono text-[11px] text-muted-foreground">
                  IMDb Median: {imdbMedian !== null ? imdbMedian.toFixed(2) : "N/A"} · TMDB Median:{" "}
                  {tmdbMedian !== null ? tmdbMedian.toFixed(2) : "N/A"}
                </div>
              )}
              {minRating !== null && maxRating !== null && (
                <div className="font-mono text-[11px] text-muted-foreground">
                  Range: {minRating.toFixed(1)}–{maxRating.toFixed(1)} (spread{" "}
                  {(maxRating - minRating).toFixed(1)})
                </div>
              )}
              <div className="font-mono text-[11px] text-muted-foreground">
                {highRatedPct}% of episodes rated ≥ 8.0 ({highRatedCount}/{ratedCount})
              </div>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "peakEpisode",
      accessorFn: (row) => {
        const best = row.bestEpisode ?? computeSeasonStats(row).bestEpisode;
        return best?.rating ?? 0;
      },
      header: sortableHeader("Peak Episode"),
      cell: ({ row }) => {
        const season = row.original;
        const best = season.bestEpisode ?? computeSeasonStats(season).bestEpisode;
        if (!best) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex items-center gap-1.5 text-xs max-w-[230px]">
            <span className="truncate font-medium">
              Ep {best.episode}: {best.title}
            </span>
            <span className="shrink-0 font-mono text-gold font-semibold">
              (★ {best.rating.toFixed(1)})
            </span>
          </div>
        );
      },
    },
    {
      id: "episodeArc",
      header: "Episode Arc",
      cell: ({ row }) => {
        const orderedEpisodes = [...row.original.episodes].sort(
          (a, b) => a.episode - b.episode
        );
        return (
          <div className="flex items-center gap-1 py-1 min-w-[100px] max-w-[220px] flex-wrap">
            {orderedEpisodes.map((ep) => (
              <Tooltip key={ep.episode}>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      "inline-block h-3.5 w-2 rounded-sm transition-transform hover:scale-125 cursor-default",
                      getArcDotColorClass(ep.rating)
                    )}
                    aria-label={`Ep ${ep.episode}: ${ep.title} — ${
                      ep.rating !== null ? ep.rating.toFixed(1) : "N/A"
                    }`}
                  />
                </TooltipTrigger>
                <TooltipContent className="text-xs font-mono">
                  Ep {ep.episode}: <span className="font-sans font-medium">{ep.title}</span> —{" "}
                  {ep.rating !== null ? `★ ${ep.rating.toFixed(1)}` : "N/A"}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        );
      },
    },
    {
      id: "episodes",
      accessorFn: (row) => row.episodes.length,
      header: sortableHeader("Episodes"),
      cell: ({ row }) => {
        const season = row.original;
        const stats = computeSeasonStats(season, meta.showMedianRating);
        const best = season.bestEpisode ?? stats.bestEpisode;
        const worst = season.worstEpisode ?? stats.worstEpisode;
        const premiereDelta =
          season.premiereToFinaleDelta !== undefined
            ? season.premiereToFinaleDelta
            : stats.premiereToFinaleDelta;
        const ratedCount = season.episodes.filter((ep) => ep.rating !== null).length;

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-muted-foreground whitespace-nowrap cursor-default">
                {season.episodes.length} episodes
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs space-y-1">
              <div className="font-semibold text-foreground">
                {ratedCount} of {season.episodes.length} episodes rated
              </div>
              {best && (
                <div className="text-muted-foreground">
                  Peak: <span className="text-foreground font-medium">Ep {best.episode} &quot;{best.title}&quot;</span>{" "}
                  <span className="font-mono text-emerald-500">(★ {best.rating.toFixed(1)})</span>
                </div>
              )}
              {worst && (
                <div className="text-muted-foreground">
                  Lowest: <span className="text-foreground font-medium">Ep {worst.episode} &quot;{worst.title}&quot;</span>{" "}
                  <span className="font-mono">(★ {worst.rating.toFixed(1)})</span>
                </div>
              )}
              {premiereDelta !== null && (
                <div className="font-mono text-[11px] text-muted-foreground">
                  Premiere → Finale delta: {formatSignedDecimal(premiereDelta, 2)}
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => meta.onViewEpisodes(row.original)}
          className="hover:bg-muted"
        >
          <Info className="h-4 w-4" />
          <span className="sr-only">View episodes</span>
        </Button>
      ),
    },
  ];
}

export function SeasonsTable({ seasons }: Readonly<SeasonsTableProps>) {
  const [selectedSeason, setSelectedSeason] = useState<RankedSeason | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleViewEpisodes = useCallback((season: RankedSeason) => {
    setSelectedSeason(season);
    setDialogOpen(true);
  }, []);

  const showMedianRating = useMemo(() => {
    const ratings = seasons.map((s) => s.rating).filter((r) => r > 0);
    return ratings.length > 0 ? calculateMedian(ratings) : 0;
  }, [seasons]);

  const seriesEpisodeRanks = useMemo(() => {
    const allRated: { key: string; rating: number }[] = [];
    for (const s of seasons) {
      for (const ep of s.episodes) {
        if (ep.rating !== null) {
          allRated.push({
            key: `${s.seasonNumber}-${ep.episode}`,
            rating: ep.rating,
          });
        }
      }
    }
    allRated.sort((a, b) => b.rating - a.rating);
    const rankMap = new Map<string, { rank: number; total: number }>();
    const total = allRated.length;
    allRated.forEach((item, idx) => {
      rankMap.set(item.key, { rank: idx + 1, total });
    });
    return rankMap;
  }, [seasons]);

  const tableMeta: TableMeta = useMemo(
    () => ({
      seasons,
      showMedianRating,
      onViewEpisodes: handleViewEpisodes,
    }),
    [seasons, showMedianRating, handleViewEpisodes]
  );

  const columns = useMemo(() => createColumns(tableMeta), [tableMeta]);

  const getRowClassName = useCallback((row: Row<RankedSeason>) => {
    const originalIndex = seasons.findIndex(
      (s) => s.seasonNumber === row.original.seasonNumber
    );
    const isFirst = originalIndex === 0;
    return isFirst
      ? "bg-gold/5 hover:bg-gold/10 border-l-2 border-l-gold"
      : "";
  }, [seasons]);

  if (seasons.length === 0) {
    return <div data-testid="seasons-table-empty">No seasons found</div>;
  }

  return (
    <>
      <div data-testid="seasons-table" className="h-full">
        <DataTable
          columns={columns}
          data={seasons}
          emptyMessage="No seasons found"
          rowClassName={getRowClassName}
        />
      </div>

      {selectedSeason && (
        <EpisodeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          seasonNumber={selectedSeason.seasonNumber}
          seasonMedianRating={selectedSeason.rating}
          episodes={selectedSeason.episodes}
          seriesEpisodeRanks={seriesEpisodeRanks}
        />
      )}
    </>
  );
}
