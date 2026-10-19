import type { Series, SeriesPosition } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import dayjs from "dayjs";

export type TimelineMode = "timeline" | "series";

export interface YearGroup {
  year: string;
  videos: VideoData[];
  avgScore: number;
}

export const YEAR_BATCH_SIZE = 2;
export const VIDEO_BATCH_SIZE = 100;

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Gaps beyond this many median gaps (and at least a week) read as a "long break". */
export const LONG_BREAK_FACTOR = 4;
const LONG_BREAK_MIN_DAYS = 7;

const DAY_MS = 86_400_000;

export function videoDomId(videoId: string): string {
  return `timeline-video-${videoId}`;
}

export function yearDomId(year: string): string {
  return `timeline-year-${year}`;
}

export function yearOf(video: VideoData): string {
  return dayjs(video.publishedAt).format("YYYY");
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(
    0,
    Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS)
  );
}

/** Title match OR series-name match; `onlySeries` drops standalone videos. */
export function filterVideos(
  videos: VideoData[],
  query: string,
  onlySeries: boolean,
  byVideo: ReadonlyMap<string, SeriesPosition>
): VideoData[] {
  const q = query.trim().toLowerCase();
  if (!q && !onlySeries) return videos;
  return videos.filter((video) => {
    const position = byVideo.get(video.videoId);
    if (onlySeries && !position) return false;
    if (!q) return true;
    return (
      video.title.toLowerCase().includes(q) ||
      (position?.series.name.toLowerCase().includes(q) ?? false)
    );
  });
}

/** A series matches by name or by any of its episode titles. */
export function filterSeries(
  series: Series[],
  query: string,
  videoById: ReadonlyMap<string, VideoData>
): Series[] {
  const q = query.trim().toLowerCase();
  if (!q) return series;
  return series.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.videoIds.some((id) => videoById.get(id)?.title.toLowerCase().includes(q))
  );
}

export function groupByYear(videos: VideoData[], newestFirst: boolean): YearGroup[] {
  const map = new Map<string, VideoData[]>();
  for (const video of videos) {
    const year = yearOf(video);
    const bucket = map.get(year);
    if (bucket) bucket.push(video);
    else map.set(year, [video]);
  }

  const direction = newestFirst ? 1 : -1;
  return [...map.entries()]
    .sort(([a], [b]) => direction * b.localeCompare(a))
    .map(([year, vids]) => ({
      year,
      videos: [...vids].sort(
        (a, b) =>
          direction *
          (new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      ),
      avgScore: vids.reduce((sum, v) => sum + v.score, 0) / vids.length,
    }));
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

export function formatCadence(medianDays: number): string {
  if (medianDays <= 1.5) return "~1 per day";
  if (medianDays <= 4) return "~2 per week";
  if (medianDays <= 10) return "~1 per week";
  if (medianDays <= 20) return "~1 per 2 weeks";
  if (medianDays <= 45) return "~1 per month";
  return `median gap ${formatSpan(Math.round(medianDays))}`;
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
