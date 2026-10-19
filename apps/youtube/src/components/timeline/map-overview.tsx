"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { useMemo } from "react";
import { axisPeriods, timeToX, xToTime } from "./map-layout";
import type { MapLayout, Viewport } from "./map-model";
import { bucketWeeks } from "./map-shapes";
import { FOCUS_RING } from "./timeline-model";

/** Weekly upload bars over the whole channel: gray = all uploads, accent = share inside a story. */
function OverviewBars({ layout }: Readonly<{ layout: MapLayout }>) {
  const { scale } = layout;
  const { buckets, years, maxCount } = useMemo(() => {
    const first = layout.nodes[0].time;
    const last = layout.nodes[layout.nodes.length - 1].time;
    const items = layout.nodes.map((n) => ({ time: n.time, score: n.video.score, inThread: n.seriesId !== null }));
    const weekly = bucketWeeks(items, first, last);
    return {
      buckets: weekly,
      years: axisPeriods("year", first, last).slice(1),
      maxCount: Math.max(1, ...weekly.map((b) => b.count)),
    };
  }, [layout.nodes]);
  const barWidth = 7 * scale.pxPerDay * 0.8;

  return (
    <>
      <svg
        aria-hidden
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${scale.width} ${maxCount}`}
        preserveAspectRatio="none"
      >
        {buckets.map((b) =>
          b.count === 0 ? null : (
            <g key={b.start}>
              <rect
                x={timeToX(scale, b.start)}
                y={maxCount - b.count}
                width={barWidth}
                height={b.count}
                className="fill-foreground"
                opacity={0.15 + (0.35 * b.avgScore) / 100}
              />
              <rect
                x={timeToX(scale, b.start)}
                y={maxCount - b.count * b.threadShare}
                width={barWidth}
                height={b.count * b.threadShare}
                className="fill-data"
                opacity={0.65}
              />
            </g>
          )
        )}
      </svg>
      {years.map((year) => (
        <span
          key={year.time}
          aria-hidden
          className="pointer-events-none absolute top-0 h-full border-l border-border pl-1 text-[10px] leading-none text-muted-foreground"
          style={{ left: `${(timeToX(scale, year.time) / scale.width) * 100}%` }}
        >
          {year.label}
        </span>
      ))}
    </>
  );
}

interface MapOverviewProps {
  layout: MapLayout;
  viewport: Viewport;
  onScrollTo: (left: number) => void;
}

/** Whole-channel strip with the map's visible window; click, drag or arrow keys move the map. */
export function MapOverview({ layout, viewport, onScrollTo }: Readonly<MapOverviewProps>) {
  const width = layout.scale.width;
  const maxLeft = Math.max(0, width - viewport.width);
  const leftPct = (viewport.left / width) * 100;
  const widthPct = Math.max(0.6, (viewport.width / width) * 100);
  const centerTime = xToTime(layout.scale, viewport.left + viewport.width / 2);

  const scrollToPointer = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onScrollTo(fraction * width - viewport.width / 2);
  };

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const page = viewport.width * 0.8;
    const targets: Record<string, number> = {
      ArrowLeft: viewport.left - page,
      ArrowRight: viewport.left + page,
      Home: 0,
      End: maxLeft,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    onScrollTo(targets[event.key]);
  };

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Map position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(maxLeft ? (viewport.left / maxLeft) * 100 : 100)}
      aria-valuetext={new Date(centerTime).toLocaleDateString(undefined, { month: "short", year: "numeric" })}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        scrollToPointer(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) scrollToPointer(event);
      }}
      onKeyDown={handleKey}
      className={`relative h-12 shrink-0 cursor-pointer touch-none select-none overflow-hidden rounded-md border border-border bg-muted/30 ${FOCUS_RING}`}
    >
      <OverviewBars layout={layout} />
      {viewport.width > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 rounded-sm border border-foreground/40 bg-foreground/10"
          style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        />
      )}
    </div>
  );
}
