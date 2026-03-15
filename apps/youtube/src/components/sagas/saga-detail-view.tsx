"use client";

import { formatCompact } from "@/lib/format";
import { formatDuration } from "@/lib/scoring";
import type { Saga, VideoData } from "@/types/youtube";
import { Button } from "@data-projects/ui";
import dayjs from "dayjs";
import { ArrowLeft, Calendar, ExternalLink, Eye, Film, Info, MessageSquare, ThumbsUp } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import { SourceBadge } from "./saga-card";

function SagaVideoRow({ video, index, evidence }: Readonly<{ video: VideoData; index: number; evidence?: string }>) {
  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/60"
    >
      <span className="text-xs text-muted-foreground/50 font-medium tabular-nums pt-1 w-5 text-right shrink-0">
        {index + 1}
      </span>
      <div className="relative shrink-0 w-[168px] aspect-video">
        <Image
          src={video.thumbnail}
          alt=""
          fill
          sizes="168px"
          className="rounded-md object-cover"
        />
        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded tabular-nums font-medium">
          {formatDuration(video.duration)}
        </span>
      </div>
      <div className="flex-1 min-w-0 py-0.5">
        <h4 className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {video.title}
        </h4>
        <p className="text-xs text-muted-foreground mt-1">
          {dayjs(video.publishedAt).format("MMM D, YYYY")}
          {video.days > 0 && <span className="ml-1 text-muted-foreground/60">({video.days}d ago)</span>}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatCompact(video.views)}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="h-3 w-3" />
            {formatCompact(video.likes)}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {formatCompact(video.comments)}
          </span>
        </div>
        {evidence && (
          <p className="mt-1.5 text-[11px] italic text-muted-foreground/60 line-clamp-2">
            &ldquo;{evidence}&rdquo;
          </p>
        )}
      </div>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary shrink-0 mt-1 transition-colors" />
    </a>
  );
}

export function SagaDetailView({
  saga,
  videos,
  onBack,
}: Readonly<{
  saga: Saga;
  videos: VideoData[];
  onBack: () => void;
}>) {
  const sagaVideos = useMemo(() => {
    const idSet = new Set(saga.videoIds);
    return videos
      .filter((v) => idSet.has(v.videoId))
      .sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
  }, [saga.videoIds, videos]);

  const firstDate = saga.dateRange.first
    ? dayjs(saga.dateRange.first).format("MMM D, YYYY")
    : "\u2014";
  const lastDate = saga.dateRange.last
    ? dayjs(saga.dateRange.last).format("MMM D, YYYY")
    : "\u2014";

  const totalViews = sagaVideos.reduce((sum, v) => sum + v.views, 0);
  const totalDuration = sagaVideos.reduce((sum, v) => sum + v.duration, 0);

  return (
    <div className="flex flex-col h-full animate-fade-up">
      <div className="flex-shrink-0 mb-4 space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-7 px-2">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold truncate">{saga.name}</h3>
              <SourceBadge source={saga.source} />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground px-1">
          <span className="flex items-center gap-1">
            <Film className="h-3 w-3" />
            {sagaVideos.length} episodes
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {firstDate} &mdash; {lastDate}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatCompact(totalViews)} total views
          </span>
          <span>
            {formatDuration(totalDuration)} total runtime
          </span>
        </div>

        {saga.reasoning && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/40 border border-border/30 px-3 py-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
            <div>
              <span className="font-medium text-foreground/70">AI reasoning: </span>
              {saga.reasoning}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 px-1">
        {sagaVideos.map((video, i) => (
          <SagaVideoRow key={video.videoId} video={video} index={i} evidence={saga.videoEvidence?.[video.videoId]} />
        ))}
      </div>
    </div>
  );
}
