"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { useMemo } from "react";
import { indexToX, visibleRange } from "./map-layout";
import type { MapLayout, Viewport } from "./map-model";
import { ordinalWeeks } from "./map-shapes";
import { FOCUS_RING } from "./timeline-model";

/**
 * Weekly runs laid on the ordinal track (a week's width = its upload count),
 * height = uploads that week; gray tint = average score, accent = share inside a story.
 */
function OverviewBars({ layout }: Readonly<{ layout: MapLayout }>) {
  const { width, spec } = layout;
  const { weeks, maxCount } = useMemo(() => {
    const items = layout.nodes.map((n) => ({ time: n.time, score: n.video.score, inThread: n.seriesId !== null }));
    const runs = ordinalWeeks(items);
    return { weeks: runs, maxCount: Math.max(1, ...runs.map((w) => w.count)) };
  }, [layout.nodes]);
  const slotLeft = (index: number) => indexToX(index, spec.pitch) - spec.pitch / 2;

  return (
    <>
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${maxCount}`} preserveAspectRatio="none">
        {weeks.map((week) => {
          const x = slotLeft(week.startIndex);
          const w = week.count * spec.pitch * 0.9;
          return (
            <g key={week.startIndex}>
              <rect
                x={x}
                y={maxCount - week.count}
                width={w}
                height={week.count}
                className="fill-foreground"
                opacity={0.15 + (0.35 * week.avgScore) / 100}
              />
              <rect
                x={x}
                y={maxCount - week.count * week.threadShare}
                width={w}
                height={week.count * week.threadShare}
                className="fill-data"
                opacity={0.65}
              />
            </g>
          );
        })}
      </svg>
      {layout.years.slice(1).map((year) => (
        <span
          key={year.index}
          aria-hidden
          className="pointer-events-none absolute top-0 h-full border-l border-border pl-1 text-[10px] leading-none text-muted-foreground"
          style={{ left: `${(slotLeft(year.index) / width) * 100}%` }}
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
  const { width } = layout;
  const maxLeft = Math.max(0, width - viewport.width);
  const leftPct = (viewport.left / width) * 100;
  const widthPct = Math.max(0.6, (viewport.width / width) * 100);
  const [lo, hi] = visibleRange(layout.nodes.length, layout.spec.pitch, viewport.left, viewport.left + viewport.width);
  const first = layout.nodes[lo]?.time;
  const last = layout.nodes[Math.max(lo, hi - 1)]?.time;
  const format = (time: number | undefined) =>
    time === undefined ? "" : new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

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
      aria-valuetext={`Videos ${lo + 1} to ${hi} of ${layout.nodes.length}, ${format(first)} to ${format(last)}`}
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
