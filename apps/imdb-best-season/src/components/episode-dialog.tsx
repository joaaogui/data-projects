"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@data-projects/ui";
import { cn, formatNumber } from "@data-projects/shared";
import { calculateMedian, formatSignedDecimal } from "@/lib/ratings";
import { Star, ExternalLink, AlertCircle } from "lucide-react";
import type { EpisodeRating } from "@/types/omdb";

function getIMDbUrl(imdbID: string | undefined): string | null {
  if (!imdbID) {
    return null;
  }
  return `https://www.imdb.com/title/${imdbID}/`;
}

function getRatingColorClass(rating: number | null): string {
  if (rating === null) {
    return "text-muted-foreground";
  }
  if (rating >= 8) {
    return "text-green-500";
  }
  if (rating >= 6) {
    return "text-orange-500";
  }
  return "text-red-500";
}

function formatRating(rating: number | null): string {
  if (rating === null) return "N/A";
  return rating.toFixed(1);
}

interface EpisodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seasonNumber: number;
  seasonMedianRating?: number;
  episodes: EpisodeRating[];
  seriesEpisodeRanks?: Map<string, { rank: number; total: number }>;
}

export function EpisodeDialog({
  open,
  onOpenChange,
  seasonNumber,
  seasonMedianRating: providedSeasonMedian,
  episodes,
  seriesEpisodeRanks,
}: Readonly<EpisodeDialogProps>) {
  const seasonMedian = useMemo(() => {
    if (providedSeasonMedian !== undefined && providedSeasonMedian > 0) {
      return providedSeasonMedian;
    }
    const ratings = episodes
      .map((ep) => ep.rating)
      .filter((r): r is number => r !== null);
    return ratings.length > 0 ? calculateMedian(ratings) : 0;
  }, [providedSeasonMedian, episodes]);

  const seasonRanks = useMemo(() => {
    const rated = episodes
      .filter((ep): ep is EpisodeRating & { rating: number } => ep.rating !== null)
      .sort((a, b) => b.rating - a.rating);
    const map = new Map<number, { rank: number; count: number }>();
    const count = rated.length;
    rated.forEach((ep, idx) => {
      map.set(ep.episode, { rank: idx + 1, count });
    });
    return map;
  }, [episodes]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Star className="h-5 w-5 text-gold fill-gold" aria-hidden="true" />
            Season {seasonNumber} Episodes
          </DialogTitle>
          <DialogDescription>
            Episode ratings (IMDb + TMDB median · Season median{" "}
            {seasonMedian > 0 ? seasonMedian.toFixed(2) : "N/A"})
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto flex-1 -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="hidden sm:table-cell whitespace-nowrap">Air Date</TableHead>
                <TableHead className="hidden sm:table-cell w-16 text-right">Runtime</TableHead>
                <TableHead className="w-36 text-right">Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {episodes.map((episode) => {
                const seasonRankInfo = seasonRanks.get(episode.episode);
                const seriesRankInfo = seriesEpisodeRanks?.get(
                  `${seasonNumber}-${episode.episode}`
                );
                const deltaVsSeason =
                  episode.rating !== null && seasonMedian > 0
                    ? episode.rating - seasonMedian
                    : null;

                const titleElement = (() => {
                  const url = getIMDbUrl(episode.imdbID);
                  if (url) {
                    return (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:text-gold hover:underline inline-flex items-center gap-1 group max-w-full"
                      >
                        <span className="truncate">{episode.title}</span>
                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </a>
                    );
                  }
                  return <span className="font-medium truncate">{episode.title}</span>;
                })();

                return (
                  <TableRow key={episode.episode}>
                    <TableCell className="font-mono text-muted-foreground">
                      {episode.episode}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {episode.overview || seasonRankInfo || seriesRankInfo ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate cursor-default">{titleElement}</div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs text-xs space-y-1">
                            <div className="font-semibold text-foreground">
                              S{seasonNumber}E{episode.episode}: {episode.title}
                            </div>
                            {episode.overview && (
                              <p className="text-muted-foreground leading-relaxed">
                                {episode.overview}
                              </p>
                            )}
                            {(seasonRankInfo || seriesRankInfo) && (
                              <div className="font-mono text-[11px] text-muted-foreground pt-0.5 border-t border-border/40">
                                {seasonRankInfo && (
                                  <span>
                                    Rank in Season: #{seasonRankInfo.rank} of {seasonRankInfo.count}
                                  </span>
                                )}
                                {seasonRankInfo && seriesRankInfo && <span> · </span>}
                                {seriesRankInfo && (
                                  <span>
                                    Series: #{seriesRankInfo.rank} of {seriesRankInfo.total}
                                  </span>
                                )}
                              </div>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        titleElement
                      )}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {episode.released || "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell font-mono text-xs text-muted-foreground text-right whitespace-nowrap">
                      {episode.runtime ? `${episode.runtime}m` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {episode.rating === null ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center gap-1 text-muted-foreground cursor-help">
                              <AlertCircle className="h-3 w-3" />
                              N/A
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-[220px] text-center">
                            <p className="text-xs mb-2">
                              Rating unavailable from APIs.
                            </p>
                            {episode.imdbID && (
                              <a
                                href={getIMDbUrl(episode.imdbID)!}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
                              >
                                View on IMDb
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center justify-end gap-1.5 cursor-help">
                              <span
                                className={`inline-flex items-center gap-1 font-mono ${getRatingColorClass(episode.rating)}`}
                              >
                                <Star className="h-3 w-3 fill-current" />
                                {formatRating(episode.rating)}
                              </span>
                              {deltaVsSeason !== null && (
                                <span
                                  className={cn(
                                    "font-mono text-[10px] px-1 py-0.2 rounded tabular-nums",
                                    deltaVsSeason > 0.05
                                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                      : deltaVsSeason < -0.05
                                        ? "bg-red-500/15 text-red-600 dark:text-red-400"
                                        : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {formatSignedDecimal(deltaVsSeason, 1)}
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs text-xs">
                            <div className="space-y-1">
                              <div className="flex justify-between gap-3 font-mono">
                                <span className="text-muted-foreground">IMDb:</span>
                                <span>{formatRating(episode.imdbRating)}</span>
                              </div>
                              <div className="flex justify-between gap-3 font-mono">
                                <span className="text-muted-foreground">TMDB:</span>
                                <span>
                                  {formatRating(episode.tmdbRating)}
                                  {episode.tmdbVoteCount
                                    ? ` (${formatNumber(episode.tmdbVoteCount)} votes)`
                                    : ""}
                                </span>
                              </div>
                              {deltaVsSeason !== null && (
                                <div className="flex justify-between gap-3 font-mono">
                                  <span className="text-muted-foreground">vs. Season Med:</span>
                                  <span>{formatSignedDecimal(deltaVsSeason, 2)}</span>
                                </div>
                              )}
                              {seasonRankInfo && (
                                <div className="flex justify-between gap-3 font-mono pt-0.5 border-t border-border/40">
                                  <span className="text-muted-foreground">Rank in Season:</span>
                                  <span>
                                    #{seasonRankInfo.rank} of {seasonRankInfo.count}
                                  </span>
                                </div>
                              )}
                              {seriesRankInfo && (
                                <div className="flex justify-between gap-3 font-mono">
                                  <span className="text-muted-foreground">Rank in Series:</span>
                                  <span>
                                    #{seriesRankInfo.rank} of {seriesRankInfo.total}
                                  </span>
                                </div>
                              )}
                              {episode.overview && (
                                <p className="text-muted-foreground pt-1 border-t border-border/40 leading-relaxed max-w-[240px]">
                                  {episode.overview}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
