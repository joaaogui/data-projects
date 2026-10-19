"use client";

import type { Series } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import { useMemo, useState } from "react";
import { SeriesCard } from "./series-card";
import { FOCUS_RING, filterSeries } from "./timeline-model";

const SERIES_BATCH_SIZE = 20;

/** Series mode: cards sorted by last (newest) or first (oldest) upload. */
export function SeriesList({
  series,
  videoById,
  query,
  newestFirst,
  expandedId,
  standaloneCount,
  onShowTimeline,
}: Readonly<{
  series: Series[];
  videoById: ReadonlyMap<string, VideoData>;
  query: string;
  newestFirst: boolean;
  expandedId: string | null;
  standaloneCount: number;
  onShowTimeline: () => void;
}>) {
  const [visibleCount, setVisibleCount] = useState(SERIES_BATCH_SIZE);

  const sorted = useMemo(() => {
    const matching = filterSeries(series, query, videoById);
    return [...matching].sort((a, b) =>
      newestFirst
        ? Date.parse(b.lastPublishedAt) - Date.parse(a.lastPublishedAt)
        : Date.parse(a.firstPublishedAt) - Date.parse(b.firstPublishedAt)
    );
  }, [series, query, videoById, newestFirst]);

  const visible = sorted.slice(0, visibleCount);
  const hidden = sorted.length - visible.length;

  return (
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
      {sorted.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No series match &ldquo;{query}&rdquo;
        </p>
      )}

      {visible.map((item) => (
        <SeriesCard key={item.id} series={item} videoById={videoById} expandedId={expandedId} />
      ))}

      {hidden > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + SERIES_BATCH_SIZE)}
            className={`rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${FOCUS_RING}`}
          >
            Show {Math.min(SERIES_BATCH_SIZE, hidden)} more series
            <span className="ml-1.5 text-xs font-normal">
              · {hidden.toLocaleString()} remaining
            </span>
          </button>
        </div>
      )}

      <footer className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          Standalone videos:{" "}
          <span className="font-medium tabular-nums text-foreground">
            {standaloneCount.toLocaleString()}
          </span>
        </span>
        <button
          type="button"
          onClick={onShowTimeline}
          className={`rounded px-1.5 py-0.5 font-medium text-foreground underline-offset-2 hover:underline ${FOCUS_RING}`}
        >
          View in Timeline
        </button>
      </footer>
    </div>
  );
}
