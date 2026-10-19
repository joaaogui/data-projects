"use client";

import { formatCompact } from "@/lib/format";
import type { VideoData } from "@/types/youtube";
import dayjs from "dayjs";
import Image from "next/image";
import { Fragment, useState } from "react";
import { ExpandedDetail } from "./expanded-detail";
import { ScoreBadge } from "./score-badge";
import {
  FOCUS_RING,
  formatGap,
  isLongBreak,
  videoDomId,
} from "./timeline-model";
import { useTimelineNav } from "./timeline-nav-context";

const COLLAPSE_ABOVE = 12;
const EDGE_COUNT = 5;

/** Vertical rail: first/last segments start/stop at the node centre (26px = half the row). */
function Rail({ isFirst, isLast }: Readonly<{ isFirst?: boolean; isLast?: boolean }>) {
  let position = "inset-y-0";
  if (isFirst && isLast) position = "hidden";
  else if (isFirst) position = "bottom-0 top-[26px]";
  else if (isLast) position = "top-0 h-[26px]";
  return <span aria-hidden className={`absolute left-[11px] w-0.5 bg-border ${position}`} />;
}

function GapLabel({ gap, medianGap }: Readonly<{ gap: number; medianGap: number }>) {
  const long = isLongBreak(gap, medianGap);
  return (
    <li className="relative py-0.5 pl-7">
      <Rail />
      <span
        className={`inline-block rounded px-1.5 text-[11px] tabular-nums ${
          long
            ? "border border-dashed border-foreground/40 font-medium text-foreground"
            : "text-muted-foreground"
        }`}
      >
        {long ? `long break · ${formatGap(gap)}` : formatGap(gap)}
      </span>
    </li>
  );
}

function EpisodeRow({
  video,
  number,
  color,
  isFirst,
  isLast,
  isExpanded,
}: Readonly<{
  video: VideoData;
  number: number;
  color: string;
  isFirst: boolean;
  isLast: boolean;
  isExpanded: boolean;
}>) {
  const { toggle } = useTimelineNav();
  return (
    <li id={videoDomId(video.videoId)} className="relative pl-7">
      <Rail isFirst={isFirst} isLast={isLast} />
      <span
        aria-hidden
        className="absolute left-1.5 top-5 h-3 w-3 rounded-full border-2 border-background"
        style={{ backgroundColor: color }}
      />
      <div className="overflow-hidden rounded-md">
        <button
          type="button"
          onClick={() => toggle(video.videoId)}
          aria-expanded={isExpanded}
          className={`flex h-[52px] w-full items-center gap-3 px-2 text-left transition-colors hover:bg-muted/50 focus-visible:ring-inset ${FOCUS_RING}`}
        >
          <span className="w-12 shrink-0 text-xs font-medium tabular-nums">Part {number}</span>
          <span
            title={dayjs(video.publishedAt).format("MMM D, YYYY")}
            className="hidden w-[4.75rem] shrink-0 whitespace-nowrap font-mono text-xs text-muted-foreground sm:block"
          >
            {dayjs(video.publishedAt).format("MMM D [’]YY")}
          </span>
          <div className="relative aspect-video w-14 shrink-0 overflow-hidden rounded bg-muted">
            <Image src={video.thumbnail} alt="" fill sizes="56px" className="object-cover" />
          </div>
          <span className="min-w-0 flex-1 truncate text-sm">{video.title}</span>
          <span className="hidden w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
            {formatCompact(video.views)}
          </span>
          <ScoreBadge score={video.score} />
        </button>
        {isExpanded && <ExpandedDetail video={video} />}
      </div>
    </li>
  );
}

/** Vertical chain of episodes with gap labels; long chains show first/last 5 until expanded. */
export function SeriesChain({
  episodes,
  gaps,
  medianGap,
  color,
  expandedId,
}: Readonly<{
  episodes: VideoData[];
  gaps: number[];
  medianGap: number;
  color: string;
  expandedId: string | null;
}>) {
  const [showAll, setShowAll] = useState(false);
  const collapsed = !showAll && episodes.length > COLLAPSE_ABOVE;
  const hiddenCount = episodes.length - EDGE_COUNT * 2;

  return (
    <ol className="px-3 pb-3 pt-1" aria-label="Episodes">
      {episodes.map((video, i) => {
        if (collapsed && i >= EDGE_COUNT && i < episodes.length - EDGE_COUNT) {
          if (i !== EDGE_COUNT) return null;
          return (
            <li key="more" className="relative py-1.5 pl-7">
              <Rail />
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className={`rounded-md border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${FOCUS_RING}`}
              >
                Show {hiddenCount} more episodes
              </button>
            </li>
          );
        }
        // No gap label across the collapsed middle: it would span unseen episodes.
        const showGap = i > 0 && !(collapsed && i === episodes.length - EDGE_COUNT);
        return (
          <Fragment key={video.videoId}>
            {showGap && <GapLabel gap={gaps[i - 1]} medianGap={medianGap} />}
            <EpisodeRow
              video={video}
              number={i + 1}
              color={color}
              isFirst={i === 0}
              isLast={i === episodes.length - 1}
              isExpanded={expandedId === video.videoId}
            />
          </Fragment>
        );
      })}
    </ol>
  );
}
