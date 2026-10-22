"use client";

import { formatCompact, getScoreColorClass } from "@/lib/format";
import { formatDuration } from "@/lib/scoring";
import type { Saga, VideoData } from "@/types/youtube";
import { Skeleton, Tooltip, TooltipContent, TooltipTrigger } from "@data-projects/ui";
import dayjs from "dayjs";
import { Calendar, ChevronRight, Clock, Eye, Film, Info, Trophy } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";

const SOURCE_BADGE: Record<string, { bg: string; label: string }> = {
  playlist: { bg: "bg-primary/10 text-primary", label: "Playlist" },
  "ai-detected": { bg: "bg-muted text-muted-foreground", label: "AI Detected" },
  manual: { bg: "bg-muted text-muted-foreground", label: "Manual" },
};

export function SourceBadge({ source }: Readonly<{ source: string }>) {
  const badge = SOURCE_BADGE[source] ?? SOURCE_BADGE["ai-detected"];
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${badge.bg}`}>
      {badge.label}
    </span>
  );
}

export function SagaCard({
  saga,
  videos,
  onClick,
}: Readonly<{
  saga: Saga;
  videos: VideoData[];
  onClick: () => void;
}>) {
  const sagaVideos = useMemo(() => {
    const idSet = new Set(saga.videoIds);
    return videos.filter((v) => idSet.has(v.videoId));
  }, [saga.videoIds, videos]);

  const totalViews = sagaVideos.reduce((sum, v) => sum + v.views, 0);
  const totalRuntime = sagaVideos.reduce((sum, v) => sum + v.duration, 0);
  const avgScore = sagaVideos.length > 0
    ? Math.round(sagaVideos.reduce((sum, v) => sum + v.score, 0) / sagaVideos.length)
    : 0;
  const avgViewsPerEp = sagaVideos.length > 0
    ? Math.round(totalViews / sagaVideos.length)
    : 0;
  const peakEpisode = useMemo(() => {
    if (sagaVideos.length === 0) return null;
    return sagaVideos.reduce((best, v) => (v.views > best.views ? v : best), sagaVideos[0]);
  }, [sagaVideos]);
  const thumbnails = sagaVideos.slice(0, 4);
  const firstDate = saga.dateRange.first
    ? dayjs(saga.dateRange.first).format("MMM YYYY")
    : "\u2014";
  const lastDate = saga.dateRange.last
    ? dayjs(saga.dateRange.last).format("MMM YYYY")
    : "\u2014";

  const isStandalone = saga.id === "standalone";

  return (
    <button
      onClick={onClick}
      className={`group h-full w-full min-w-0 max-w-full overflow-hidden rounded-lg border p-4 text-left hover:-translate-y-1 hover:shadow-lg transition-all duration-200 animate-scale-in flex flex-col ${isStandalone
        ? "border-dashed border-muted-foreground/30 bg-muted/30 hover:border-muted-foreground/50"
        : "border-border bg-card hover:border-primary/40"
        }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold truncate transition-colors ${isStandalone ? "text-muted-foreground" : "group-hover:text-primary"
            }`}>
            {saga.name}
          </h3>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Film className="h-3 w-3" />
              {saga.videoCount}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatCompact(totalViews)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(totalRuntime)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {firstDate} &mdash; {lastDate}
            </span>
          </div>
          {sagaVideos.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${getScoreColorClass(avgScore)}`}>
                Avg Score {avgScore}
              </span>
              <span className="tabular-nums">
                {formatCompact(avgViewsPerEp)} views/ep avg
              </span>
              {peakEpisode && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 tabular-nums cursor-help hover:text-foreground transition-colors">
                      <Trophy className="h-3 w-3 text-primary/70" />
                      Peak {formatCompact(peakEpisode.views)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs space-y-0.5">
                    <p className="font-medium text-xs line-clamp-2">{peakEpisode.title}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {peakEpisode.views.toLocaleString("en-US")} views &middot; Score {peakEpisode.score.toFixed(0)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isStandalone ? (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              Uncategorized
            </span>
          ) : (
            <SourceBadge source={saga.source} />
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>

      {saga.reasoning && (
        <p className="text-[11px] text-muted-foreground/70 italic line-clamp-2 mb-2 flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 shrink-0" />
          {saga.reasoning}
        </p>
      )}

      <div className="flex gap-1 overflow-hidden rounded-lg mt-auto">
        {Array.from({ length: 4 }, (_, i) => {
          const v = thumbnails[i];
          return v ? (
            <div key={v.videoId} className="relative flex-1 min-w-0 aspect-video">
              <Image
                src={v.thumbnail}
                alt=""
                fill
                sizes="120px"
                className="object-cover rounded-sm"
              />
            </div>
          ) : (
            <div key={`empty-${i}`} className="relative flex-1 min-w-0">
              <div className="w-full rounded-sm bg-muted" style={{ aspectRatio: "120/68" }} />
            </div>
          );
        })}
      </div>
    </button>
  );
}

export function SagaCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="flex gap-1 overflow-hidden rounded-lg mt-auto">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex-1 min-w-0">
            <Skeleton className="w-full rounded-sm" style={{ aspectRatio: "120/68" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
