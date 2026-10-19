"use client";

import type { SeriesPosition } from "@/lib/series";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { seriesColor } from "./series-colors";
import { FOCUS_RING, formatSpan } from "./timeline-model";
import { useTimelineNav } from "./timeline-nav-context";

/** "Part 3/12 · Series name": the text carries the info, the dot is only an accent. */
export function SeriesChip({ position }: Readonly<{ position: SeriesPosition }>) {
  const { series, index, total } = position;
  return (
    <span
      className="inline-flex max-w-[16rem] shrink-0 items-center gap-1.5 rounded border border-border bg-background px-1.5 py-px text-[11px] text-muted-foreground"
      title={`${series.name}: part ${index + 1} of ${total}`}
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: seriesColor(series.id) }}
      />
      <span className="shrink-0 font-medium tabular-nums text-foreground">
        Part {index + 1}/{total}
      </span>
      <span className="hidden truncate sm:inline">{series.name}</span>
    </span>
  );
}

const LINK_CLASS = `inline-flex max-w-full items-center gap-1 rounded px-0.5 transition-colors hover:text-foreground ${FOCUS_RING}`;

/** Under the title: jump buttons to the previous / next episode (they may be in another year). */
export function ContinuityLine({ position }: Readonly<{ position: SeriesPosition }>) {
  const { videoById, reveal } = useTimelineNav();
  const prev = position.prevVideoId ? videoById.get(position.prevVideoId) : undefined;
  const next = position.nextVideoId ? videoById.get(position.nextVideoId) : undefined;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 pl-36 pr-2 text-xs text-muted-foreground sm:pl-[10.5rem]">
      {prev ? (
        <button
          type="button"
          onClick={() => reveal(prev.videoId)}
          title={`Go to previous episode: ${prev.title}`}
          className={LINK_CLASS}
        >
          <ArrowLeft aria-hidden className="h-3 w-3 shrink-0" />
          <span className="shrink-0">continues</span>
          <span className="max-w-[28ch] truncate text-foreground/80">{prev.title}</span>
          {position.gapDays !== null && (
            <span className="shrink-0 tabular-nums">
              · {position.gapDays === 0 ? "same day" : `${formatSpan(position.gapDays)} later`}
            </span>
          )}
        </button>
      ) : (
        <span>starts the series</span>
      )}
      {next && (
        <button
          type="button"
          onClick={() => reveal(next.videoId)}
          title={`Go to next episode: ${next.title}`}
          className={LINK_CLASS}
        >
          next
          <ArrowRight aria-hidden className="h-3 w-3 shrink-0" />
        </button>
      )}
    </div>
  );
}
