"use client";

import type { SeriesPosition } from "@/lib/series";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef } from "react";
import { seriesColor, SERIES_KIND_LABEL } from "./series-colors";
import {
  computeSeriesStats,
  FOCUS_RING,
  formatGap,
  isLongBreak,
} from "./timeline-model";
import { useTimelineNav } from "./timeline-nav-context";

/**
 * The whole series as numbered nodes on a line. Nodes only (no thumbnails) so a
 * 100+ episode series stays cheap; the current node is scrolled into view.
 */
export function SeriesStrip({ position }: Readonly<{ position: SeriesPosition }>) {
  const { videoById, reveal } = useTimelineNav();
  const { series, index } = position;
  const color = seriesColor(series.id);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { episodes, gaps, medianGap } = useMemo(
    () => computeSeriesStats(series, videoById),
    [series, videoById]
  );

  useEffect(() => {
    const scroller = scrollerRef.current;
    const current = scroller?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!scroller || !current) return;
    scroller.scrollLeft =
      current.offsetLeft - scroller.clientWidth / 2 + current.offsetWidth / 2;
  }, [series.id, index]);

  return (
    <div className="border-t border-border px-4 pb-3 pt-2.5 sm:px-5">
      <p className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="truncate font-medium text-foreground">{series.name}</span>
        <span className="shrink-0">
          · {SERIES_KIND_LABEL[series.kind]} · episode {index + 1} of {position.total}
        </span>
      </p>

      <div ref={scrollerRef} className="relative overflow-x-auto pb-1 pt-3">
        <ol className="flex w-max items-center" aria-label={`Episodes of ${series.name}`}>
          {episodes.map((episode, i) => {
            const isCurrent = i === index;
            const gap = i > 0 ? gaps[i - 1] : null;
            return (
              <li key={episode.videoId} className="flex items-center">
                {gap !== null && (
                  <span aria-hidden className="relative block h-7 w-16 shrink-0">
                    <span
                      className="absolute inset-x-0 top-1/2 h-px opacity-60"
                      style={{ backgroundColor: color }}
                    />
                    <span
                      className={`absolute inset-x-0 bottom-1/2 mb-px whitespace-nowrap text-center text-[10px] leading-none tabular-nums ${
                        isLongBreak(gap, medianGap)
                          ? "font-medium text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatGap(gap)}
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => reveal(episode.videoId)}
                  aria-current={isCurrent ? "true" : undefined}
                  aria-label={`Episode ${i + 1}: ${episode.title}`}
                  title={`${i + 1}. ${episode.title} · ${dayjs(episode.publishedAt).format("MMM D, YYYY")}`}
                  className={`flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full border px-1.5 text-[11px] font-medium tabular-nums transition-colors ${FOCUS_RING} ${
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {i + 1}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
