"use client";

import type { SeriesPosition } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import dayjs from "dayjs";
import { ArrowLeft, ArrowRight, MousePointerClick } from "lucide-react";
import { ExpandedDetail } from "./expanded-detail";
import { seriesColor, SERIES_KIND_LABEL } from "./series-colors";
import { SeriesStrip } from "./series-strip";
import { FOCUS_RING } from "./timeline-model";

interface MapDetailProps {
  video: VideoData | null;
  position: SeriesPosition | null;
  onReveal: (videoId: string) => void;
  className?: string;
}

const STEP_BUTTON = `flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 ${FOCUS_RING}`;

/** Detail for the selected node: thread position, prev/next episode, the video and its episode strip. */
export function MapDetail({ video, position, onReveal, className = "" }: Readonly<MapDetailProps>) {
  if (!video) {
    return (
      <div className={`flex shrink-0 items-center gap-2 rounded-md border border-dashed border-border px-4 py-3 text-xs text-muted-foreground ${className}`}>
        <MousePointerClick aria-hidden className="h-3.5 w-3.5" />
        Select a video on the map to see its details and the story it belongs to.
      </div>
    );
  }

  return (
    <section
      aria-label="Selected video"
      className={`@container shrink-0 overflow-y-auto rounded-md border border-border ${className}`}
    >
      <header className="space-y-1.5 px-4 pb-3 pt-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug" title={video.title}>
          {video.title}
        </h3>
        <p className="text-xs text-muted-foreground">{dayjs(video.publishedAt).format("ddd, MMM D, YYYY")}</p>
        {position && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: seriesColor(position.series.id) }} />
              <span className="font-medium tabular-nums text-foreground">
                Part {position.index + 1} of {position.total}
              </span>
              <span className="truncate">
                · {position.series.name} ({SERIES_KIND_LABEL[position.series.kind]})
              </span>
            </span>
            <span className="ml-auto flex gap-1.5">
              <button
                type="button"
                disabled={!position.prevVideoId}
                onClick={() => position.prevVideoId && onReveal(position.prevVideoId)}
                className={STEP_BUTTON}
              >
                <ArrowLeft aria-hidden className="h-3 w-3" />
                Previous
              </button>
              <button
                type="button"
                disabled={!position.nextVideoId}
                onClick={() => position.nextVideoId && onReveal(position.nextVideoId)}
                className={STEP_BUTTON}
              >
                Next
                <ArrowRight aria-hidden className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
      </header>
      <ExpandedDetail video={video}>{position && <SeriesStrip position={position} />}</ExpandedDetail>
    </section>
  );
}
