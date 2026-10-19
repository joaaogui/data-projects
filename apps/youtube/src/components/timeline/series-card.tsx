"use client";

import type { Series } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import dayjs from "dayjs";
import { useMemo } from "react";
import { ScoreBadge } from "./score-badge";
import { seriesColor, SERIES_KIND_LABEL } from "./series-colors";
import { SeriesChain } from "./series-chain";
import { computeSeriesStats, formatCadence } from "./timeline-model";

export function SeriesCard({
  series,
  videoById,
  expandedId,
}: Readonly<{
  series: Series;
  videoById: ReadonlyMap<string, VideoData>;
  expandedId: string | null;
}>) {
  const stats = useMemo(() => computeSeriesStats(series, videoById), [series, videoById]);
  const color = seriesColor(series.id);
  const span = `${dayjs(series.firstPublishedAt).format("MMM YYYY")} – ${dayjs(series.lastPublishedAt).format("MMM YYYY")}`;

  return (
    <article
      className="overflow-hidden rounded-lg border border-border bg-card"
      style={{ borderLeftColor: color, borderLeftWidth: 3 }}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-1 pt-3">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" title={series.name}>
          {series.name}
        </h3>
        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {SERIES_KIND_LABEL[series.kind]}
        </span>
        <p className="flex w-full flex-wrap items-center gap-x-2 text-xs tabular-nums text-muted-foreground">
          <span>{stats.episodes.length} episodes</span>
          <span aria-hidden>·</span>
          <span>{span}</span>
          <span aria-hidden>·</span>
          <span title={`Median gap between episodes: ${stats.medianGap}d`}>
            {formatCadence(stats.medianGap)}
          </span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1.5">
            avg score <ScoreBadge score={stats.avgScore} />
          </span>
        </p>
      </header>

      <SeriesChain
        episodes={stats.episodes}
        gaps={stats.gaps}
        medianGap={stats.medianGap}
        color={color}
        expandedId={expandedId}
      />
    </article>
  );
}
