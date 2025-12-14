"use client";

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
  TooltipProvider,
} from "@data-projects/ui";
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
  episodes: EpisodeRating[];
}

export function EpisodeDialog({
  open,
  onOpenChange,
  seasonNumber,
  episodes,
}: Readonly<EpisodeDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Star className="h-5 w-5 text-gold fill-gold" aria-hidden="true" />
            Season {seasonNumber} Episodes
          </DialogTitle>
          <DialogDescription>
            Episode ratings (IMDb + TMDB median)
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-auto flex-1 -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-20 text-right">Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {episodes.map((episode) => (
                <TableRow key={episode.episode}>
                  <TableCell className="font-mono text-muted-foreground">
                    {episode.episode}
                  </TableCell>
                  <TableCell className="max-w-[180px]">
                    {(() => {
                      const url = getIMDbUrl(episode.imdbID);
                      if (url) {
                        return (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium hover:text-gold hover:underline inline-flex items-center gap-1 group"
                          >
                            <span className="truncate">{episode.title}</span>
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </a>
                        );
                      }
                      return <span className="font-medium truncate">{episode.title}</span>;
                    })()}
                  </TableCell>
                  <TableCell className="text-right">
                    {episode.rating === null ? (
                      <TooltipProvider>
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
                      </TooltipProvider>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              className={`inline-flex items-center gap-1 cursor-help ${getRatingColorClass(episode.rating)}`}
                            >
                              <Star className="h-3 w-3 fill-current" />
                              {formatRating(episode.rating)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="text-xs">
                            <div className="space-y-1">
                              <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">IMDb:</span>
                                <span>{formatRating(episode.imdbRating)}</span>
                              </div>
                              <div className="flex justify-between gap-3">
                                <span className="text-muted-foreground">TMDB:</span>
                                <span>{formatRating(episode.tmdbRating)}</span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}



