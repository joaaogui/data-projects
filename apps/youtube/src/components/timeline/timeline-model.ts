import type { Series } from "@/lib/series";
import type { VideoData } from "@/types/youtube";

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Gaps beyond this many median gaps (and at least a week) read as a "long break". */
export const LONG_BREAK_FACTOR = 4;
const LONG_BREAK_MIN_DAYS = 7;

const DAY_MS = 86_400_000;

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(
    0,
    Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS)
  );
}

/** "6d", "3 mo", "1.5 y": a duration without sign, for gaps and spans. */
export function formatSpan(days: number): string {
  if (days === 0) return "0d";
  if (days < 45) return `${days}d`;
  if (days < 730) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} y`;
}

export function formatGap(days: number): string {
  return days === 0 ? "same day" : `+${formatSpan(days)}`;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function isLongBreak(gapDays: number, medianGapDays: number): boolean {
  return (
    gapDays > medianGapDays * LONG_BREAK_FACTOR && gapDays >= LONG_BREAK_MIN_DAYS
  );
}

export interface SeriesStats {
  episodes: VideoData[];
  /** Days between consecutive episodes; gaps[i] precedes episodes[i + 1]. */
  gaps: number[];
  medianGap: number;
  avgScore: number;
}

export function computeSeriesStats(
  series: Series,
  videoById: ReadonlyMap<string, VideoData>
): SeriesStats {
  const episodes = series.videoIds.flatMap((id) => {
    const video = videoById.get(id);
    return video ? [video] : [];
  });
  const gaps = episodes
    .slice(1)
    .map((video, i) => daysBetween(episodes[i].publishedAt, video.publishedAt));
  const avgScore =
    episodes.length === 0
      ? 0
      : episodes.reduce((sum, v) => sum + v.score, 0) / episodes.length;
  return { episodes, gaps, medianGap: median(gaps), avgScore };
}
