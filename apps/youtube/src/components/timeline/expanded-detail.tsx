"use client";

import { formatCompact, hqThumbnail } from "@/lib/format";
import { formatDuration } from "@/lib/scoring";
import { useVideoDescription } from "@/hooks/use-video-detail";
import type { VideoData } from "@/types/youtube";
import { ExternalLink, MessageSquare, ThumbsUp } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import { DEFAULT_WEIGHTS } from "../metric-icon";
import { ScoreRing } from "../score-ring";

/** Inline detail for one video; `children` (e.g. the series strip) renders below it. */
export function ExpandedDetail({
  video,
  children,
}: Readonly<{ video: VideoData; children?: ReactNode }>) {
  const { description, isLoading: descriptionLoading } = useVideoDescription(
    video.videoId,
    video.description
  );

  return (
    <div className="border-t border-border bg-muted/20">
      <div className="flex flex-col gap-5 p-4 sm:flex-row sm:p-5">
        <div className="relative aspect-video w-full shrink-0 sm:w-72">
          <Image
            src={hqThumbnail(video.thumbnail)}
            alt={video.title}
            fill
            sizes="(min-width: 640px) 288px, 100vw"
            className="rounded-md object-cover"
          />
          <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
            {formatDuration(video.duration)}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center gap-4">
            <ScoreRing
              score={video.score}
              scoreComponents={video.scoreComponents}
              weights={DEFAULT_WEIGHTS}
              size={52}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ThumbsUp className="h-3.5 w-3.5" />
                <span className="font-medium tabular-nums text-foreground">
                  {formatCompact(video.likes)}
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="font-medium tabular-nums text-foreground">
                  {formatCompact(video.comments)}
                </span>
              </span>
            </div>
          </div>

          {descriptionLoading && (
            <p role="status" className="text-xs text-muted-foreground">
              Loading description…
            </p>
          )}

          {description && (
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}

          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Watch on YouTube
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      {children}
    </div>
  );
}
