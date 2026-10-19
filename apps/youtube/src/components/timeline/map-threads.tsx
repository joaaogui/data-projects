import { visibleSlice } from "./map-layout";
import type { MapLayout, MapThread } from "./map-model";
import { LANE_LABEL_HEIGHT } from "./map-model";
import { threadPath } from "./map-shapes";
import { MapGrid } from "./map-axis";
import { SERIES_KIND_LABEL } from "./series-colors";

export interface MapLayerProps {
  layout: MapLayout;
  from: number;
  to: number;
  selectedSeriesId: string | null;
  /** Threads with at least one search match; null when no search is active. */
  matchedSeries: ReadonlySet<string> | null;
}

export function visibleThreads(layout: MapLayout, from: number, to: number): MapThread[] {
  return layout.threads.filter((thread) => thread.endX >= from && thread.startX <= to);
}

export function isThreadDimmed(id: string, selectedSeriesId: string | null, matched: ReadonlySet<string> | null) {
  return (selectedSeriesId !== null && id !== selectedSeriesId) || (matched !== null && !matched.has(id));
}

/** SVG layer under the nodes: gridlines and one curve per thread, clipped to the render window. */
export function MapThreads({ layout, from, to, selectedSeriesId, matchedSeries }: Readonly<MapLayerProps>) {
  const left = Math.max(0, from);
  const width = Math.max(0, Math.min(layout.scale.width, to) - left);
  const threads = visibleThreads(layout, from, to).sort(
    (a, b) => Number(a.series.id === selectedSeriesId) - Number(b.series.id === selectedSeriesId)
  );

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute top-0"
      style={{ left, width, height: layout.height }}
      viewBox={`${left} 0 ${width} ${layout.height}`}
    >
      <MapGrid layout={layout} from={from} to={to} />
      {threads.map((thread) => {
        const [lo, hi] = visibleSlice(thread.xs, from, to, 1);
        if (hi - lo < 2) return null;
        const selected = thread.series.id === selectedSeriesId;
        const dimmed = isThreadDimmed(thread.series.id, selectedSeriesId, matchedSeries);
        return (
          <path
            key={thread.series.id}
            d={threadPath(thread.nodes.slice(lo, hi))}
            fill="none"
            stroke={thread.color}
            strokeWidth={selected ? 3 : 1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={dimmed ? 0.15 : 0.85}
          />
        );
      })}
    </svg>
  );
}

interface MapLabelsProps extends MapLayerProps {
  /** Shown in the Other uploads band when the channel has no threads. */
  note: string | null;
}

/** Thread names at each lane start (sticky while the thread is on screen) and the band header. */
export function MapLabels({ layout, from, to, selectedSeriesId, matchedSeries, note }: Readonly<MapLabelsProps>) {
  return (
    <div aria-hidden className="pointer-events-none">
      {visibleThreads(layout, from, to).map((thread) => {
        const width = thread.endX - thread.startX;
        if (width < 36) return null;
        const dimmed = isThreadDimmed(thread.series.id, selectedSeriesId, matchedSeries);
        return (
          <div
            key={thread.series.id}
            className={`absolute z-10 transition-opacity motion-reduce:transition-none ${dimmed ? "opacity-30" : ""}`}
            style={{ left: thread.startX, top: thread.top + 2, width, height: LANE_LABEL_HEIGHT - 2 }}
          >
            <span className="sticky left-1 inline-flex max-w-full items-center gap-1 rounded bg-background/85 px-1 text-[11px] leading-4 text-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: thread.color }} />
              <span className="truncate font-medium">{thread.series.name}</span>
              <span className="shrink-0 rounded border border-border px-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                {SERIES_KIND_LABEL[thread.series.kind]}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{thread.nodes.length}</span>
            </span>
          </div>
        );
      })}
      <div
        className="absolute left-0 border-t border-dashed border-border"
        style={{ top: layout.band.top, width: layout.scale.width, height: LANE_LABEL_HEIGHT }}
      >
        <span className="sticky left-1 inline-flex items-center gap-2 px-1 text-[11px] leading-4 text-muted-foreground">
          <span className="font-medium text-foreground/80">Other uploads</span>
          {note && <span>{note}</span>}
        </span>
      </div>
    </div>
  );
}
