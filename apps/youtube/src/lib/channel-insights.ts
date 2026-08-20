import type { VideoData } from "@/types/youtube";

export const DURATION_RANGES = [
  { label: "<1m", range: "under 1 min", min: 0, max: 60 },
  { label: "1-5m", range: "1-5 min", min: 60, max: 300 },
  { label: "5-10m", range: "5-10 min", min: 300, max: 600 },
  { label: "10-20m", range: "10-20 min", min: 600, max: 1200 },
  { label: "20-40m", range: "20-40 min", min: 1200, max: 2400 },
  { label: "40m+", range: "40+ min", min: 2400, max: Infinity },
] as const;

export interface ChannelFingerprint {
  medianViews: number;
  viewsSkew: number;
  topTenViewShare: number;
  hitRate: number;
  scoreStdDev: number;
  consistency: "Consistent" | "Mixed" | "Volatile";
  bestDuration: {
    label: string;
    range: string;
    avgScore: number;
    count: number;
  } | null;
  bestYear: {
    year: string;
    avgScore: number;
    count: number;
  } | null;
}

function mean(values: number[]): number {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sampleFloor(videoCount: number): number {
  return Math.min(10, Math.max(3, Math.ceil(videoCount * 0.01)));
}

export function computeChannelFingerprint(
  videos: VideoData[]
): ChannelFingerprint | null {
  if (videos.length === 0) return null;

  const views = videos.map((video) => video.views);
  const scores = videos.map((video) => video.score);
  const totalViews = views.reduce((sum, value) => sum + value, 0);
  const medianViews = median(views);
  const averageViews = mean(views);
  const averageScore = mean(scores);
  const scoreStdDev = Math.sqrt(
    mean(scores.map((score) => (score - averageScore) ** 2))
  );

  const topCount = Math.max(1, Math.ceil(videos.length * 0.1));
  const topViews = [...views]
    .sort((a, b) => b - a)
    .slice(0, topCount)
    .reduce((sum, value) => sum + value, 0);

  const minSample = sampleFloor(videos.length);
  const durationCandidates = DURATION_RANGES.map((bucket) => {
    const matching = videos.filter(
      (video) => video.duration >= bucket.min && video.duration < bucket.max
    );
    return {
      label: bucket.label,
      range: bucket.range,
      count: matching.length,
      avgScore: mean(matching.map((video) => video.score)),
    };
  }).filter((bucket) => bucket.count >= minSample);

  const bestDuration =
    [...durationCandidates].sort(
      (a, b) => b.avgScore - a.avgScore || b.count - a.count
    )[0] ?? null;

  const yearMap = new Map<string, VideoData[]>();
  for (const video of videos) {
    const year = new Date(video.publishedAt).getUTCFullYear().toString();
    const existing = yearMap.get(year) ?? [];
    existing.push(video);
    yearMap.set(year, existing);
  }

  const yearCandidates = [...yearMap.entries()]
    .map(([year, yearVideos]) => ({
      year,
      count: yearVideos.length,
      avgScore: mean(yearVideos.map((video) => video.score)),
    }))
    .filter((year) => year.count >= minSample);

  const bestYear =
    [...yearCandidates].sort(
      (a, b) => b.avgScore - a.avgScore || b.count - a.count
    )[0] ?? null;

  let consistency: ChannelFingerprint["consistency"] = "Volatile";
  if (scoreStdDev < 12) consistency = "Consistent";
  else if (scoreStdDev < 20) consistency = "Mixed";

  return {
    medianViews,
    viewsSkew: medianViews > 0 ? averageViews / medianViews : 0,
    topTenViewShare: totalViews > 0 ? (topViews / totalViews) * 100 : 0,
    hitRate:
      (videos.filter((video) => video.score >= 70).length / videos.length) * 100,
    scoreStdDev,
    consistency,
    bestDuration,
    bestYear,
  };
}
