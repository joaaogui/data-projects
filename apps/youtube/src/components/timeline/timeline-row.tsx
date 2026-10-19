"use client";

import { formatCompact } from "@/lib/format";
import type { VideoData } from "@/types/youtube";
import dayjs from "dayjs";
import Image from "next/image";
import { ExpandedDetail } from "./expanded-detail";
import { ScoreBadge } from "./score-badge";
import { ContinuityLine, SeriesChip } from "./series-chip";
import { seriesColor } from "./series-colors";
import { SeriesStrip } from "./series-strip";
import { FOCUS_RING, videoDomId } from "./timeline-model";
import { useTimelineNav } from "./timeline-nav-context";

export function TimelineRow({
  video,
  isExpanded,
  isHighlighted,
}: Readonly<{
  video: VideoData;
  isExpanded: boolean;
  isHighlighted: boolean;
}>) {
  const { seriesIndex, toggle } = useTimelineNav();
  const position = seriesIndex.byVideo.get(video.videoId);

  return (
    <div
      id={videoDomId(video.videoId)}
      className={`relative overflow-hidden border-b border-border transition-colors duration-700 last:border-b-0 ${
        isHighlighted ? "bg-data/10" : ""
      }`}
    >
      {position && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ backgroundColor: seriesColor(position.series.id) }}
        />
      )}

      <button
        type="button"
        onClick={() => toggle(video.videoId)}
        aria-expanded={isExpanded}
        className={`flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:ring-inset sm:gap-4 ${FOCUS_RING}`}
      >
        <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
          {dayjs(video.publishedAt).format("MMM D")}
        </span>

        <div className="relative aspect-video w-16 shrink-0 overflow-hidden rounded bg-muted sm:w-20">
          <Image src={video.thumbnail} alt="" fill sizes="80px" className="object-cover" />
        </div>

        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="min-w-0 truncate text-sm">{video.title}</span>
          {position && <SeriesChip position={position} />}
        </span>

        <span className="hidden w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
          {formatCompact(video.views)}
        </span>

        <ScoreBadge score={video.score} />
      </button>

      {position && <ContinuityLine position={position} />}

      {isExpanded && (
        <ExpandedDetail video={video}>
          {position && <SeriesStrip position={position} />}
        </ExpandedDetail>
      )}
    </div>
  );
}
