"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, Calendar } from "lucide-react";
import { Button } from "@data-projects/ui";
import Image from "next/image";
import dayjs from "dayjs";
import type { VideoData } from "@/types/youtube";
import { formatDuration } from "@/lib/scoring";

interface ChronologicalNavProps {
  currentVideo: VideoData;
  allVideos: VideoData[];
}

function VideoCard({ video }: Readonly<{ video: VideoData }>) {
  const date = dayjs(video.publishedAt).format("MMM D, YYYY");

  return (
    <a
      href={video.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 rounded-lg border border-border/50 bg-card/60 p-3 transition-colors hover:bg-muted/50 flex-1 min-w-0"
      onClick={(e) => e.stopPropagation()}
    >
      <Image
        src={video.thumbnail}
        alt={video.title}
        width={100}
        height={56}
        className="rounded object-cover flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
          {video.title}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {date}
          </span>
          <span>{formatDuration(video.duration)}</span>
        </div>
      </div>
    </a>
  );
}

export function ChronologicalNav({ currentVideo, allVideos }: Readonly<ChronologicalNavProps>) {
  const sorted = useMemo(() => {
    return [...allVideos].sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );
  }, [allVideos]);

  const originIndex = useMemo(
    () => sorted.findIndex((v) => v.videoId === currentVideo.videoId),
    [sorted, currentVideo.videoId]
  );

  const [centerIndex, setCenterIndex] = useState(originIndex);

  const prev = centerIndex > 0 ? sorted[centerIndex - 1] : null;
  const center = sorted[centerIndex];
  const next = centerIndex < sorted.length - 1 ? sorted[centerIndex + 1] : null;
  const isAtOrigin = centerIndex === originIndex;

  const centerDate = dayjs(center?.publishedAt).format("MMM D, YYYY");

  return (
    <div className="px-4 py-4 sm:px-6">
      <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>
          Video {centerIndex + 1} of {sorted.length} chronologically &middot; Published {centerDate}
        </span>
        {!isAtOrigin && (
          <button
            className="text-xs text-primary hover:underline transition-colors"
            onClick={(e) => { e.stopPropagation(); setCenterIndex(originIndex); }}
          >
            Back to selected
          </button>
        )}
        <a
          href={center?.url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1 text-xs hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          Watch on YouTube
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-stretch gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-auto w-8 flex-shrink-0 rounded-lg border border-border/50"
            disabled={!prev}
            onClick={(e) => { e.stopPropagation(); setCenterIndex((i) => i - 1); }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          {prev ? (
            <VideoCard video={prev} />
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-border/40 p-4 text-sm text-muted-foreground">
              Oldest video
            </div>
          )}
        </div>
        <div className="flex items-stretch gap-2">
          {next ? (
            <VideoCard video={next} />
          ) : (
            <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-border/40 p-4 text-sm text-muted-foreground">
              Newest video
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-auto w-8 flex-shrink-0 rounded-lg border border-border/50"
            disabled={!next}
            onClick={(e) => { e.stopPropagation(); setCenterIndex((i) => i + 1); }}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
