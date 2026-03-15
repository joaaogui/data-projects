"use client";

import { formatCompact } from "@/lib/format";
import { getScoreLabel } from "@/lib/scoring";
import type { VideoData } from "@/types/youtube";
import dayjs from "dayjs";
import { useMemo } from "react";

export interface MonthBucket {
  label: string;
  totalViews: number;
  avgEngagement: number;
  avgScore: number;
  videoCount: number;
}

export interface DurationBucket {
  label: string;
  range: string;
  count: number;
  avgScore: number;
  avgViews: number;
}

export interface CadenceStats {
  avgDaysBetween: number;
  uploadsPerWeek: number;
  uploadsPerMonth: number;
  dayOfWeekCounts: number[];
  bestDay: string;
  trend: "accelerating" | "decelerating" | "steady";
}

export interface ChannelStats {
  avgScore: number;
  avgEngagement: number;
  totalViews: number;
  topVideo: VideoData;
  cadenceLabel: string;
  sparklinePoints: number[];
  scoreTrend: number;
  videoCount: number;
  scoreLabel: ReturnType<typeof getScoreLabel>;
  totalViewsFormatted: string;
  scoreDistribution: number[];
  topPerformers: VideoData[];
  bottomPerformers: VideoData[];
  monthlyBuckets: MonthBucket[];
  durationBuckets: DurationBucket[];
  cadence: CadenceStats;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function computeCadenceLabel(sorted: VideoData[]): string {
  if (sorted.length < 2) return "N/A";
  const first = dayjs(sorted[0].publishedAt);
  const last = dayjs(sorted.at(-1)!.publishedAt);
  const totalWeeks = last.diff(first, "week") || 1;
  const perWeek = sorted.length / totalWeeks;
  if (perWeek >= 1) {
    return `${perWeek.toFixed(1)}/week`;
  }
  const perMonth = perWeek * 4.33;
  return `${perMonth.toFixed(1)}/month`;
}

function computeCadenceStats(videos: VideoData[], sorted: VideoData[]): CadenceStats {
  const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const v of videos) {
    const dow = new Date(v.publishedAt).getDay();
    dayOfWeekCounts[dow]++;
  }
  const bestDayIdx = dayOfWeekCounts.indexOf(Math.max(...dayOfWeekCounts));

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const diff = dayjs(sorted[i].publishedAt).diff(dayjs(sorted[i - 1].publishedAt), "day");
    gaps.push(diff);
  }
  const avgDaysBetween = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;

  const firstHalfGaps = gaps.slice(0, Math.floor(gaps.length / 2));
  const secondHalfGaps = gaps.slice(Math.floor(gaps.length / 2));
  const firstAvg = firstHalfGaps.length > 0 ? firstHalfGaps.reduce((a, b) => a + b, 0) / firstHalfGaps.length : 0;
  const secondAvg = secondHalfGaps.length > 0 ? secondHalfGaps.reduce((a, b) => a + b, 0) / secondHalfGaps.length : 0;
  let cadenceTrend: CadenceStats["trend"] = "steady";
  if (secondAvg < firstAvg * 0.8) {
    cadenceTrend = "accelerating";
  } else if (secondAvg > firstAvg * 1.2) {
    cadenceTrend = "decelerating";
  }

  const totalWeeks = sorted.length >= 2 ? Math.max(1, dayjs(sorted.at(-1)!.publishedAt).diff(dayjs(sorted[0].publishedAt), "week")) : 1;
  const uploadsPerWeek = sorted.length / totalWeeks;

  return {
    avgDaysBetween,
    uploadsPerWeek,
    uploadsPerMonth: uploadsPerWeek * 4.33,
    dayOfWeekCounts,
    bestDay: DAY_NAMES[bestDayIdx],
    trend: cadenceTrend,
  };
}

const DURATION_RANGES: Array<{ label: string; range: string; min: number; max: number }> = [
  { label: "<1m", range: "0-60s", min: 0, max: 60 },
  { label: "1-5m", range: "1-5 min", min: 60, max: 300 },
  { label: "5-10m", range: "5-10 min", min: 300, max: 600 },
  { label: "10-20m", range: "10-20 min", min: 600, max: 1200 },
  { label: "20-40m", range: "20-40 min", min: 1200, max: 2400 },
  { label: "40m+", range: "40+ min", min: 2400, max: Infinity },
];

export function useChannelStats(videos: VideoData[] | null): ChannelStats | null {
  return useMemo(() => {
    if (!videos || videos.length === 0) return null;

    const avgScore = videos.reduce((s, v) => s + v.score, 0) / videos.length;
    const avgEngagement = videos.reduce((s, v) => s + (v.rates?.engagementRate || 0), 0) / videos.length;
    const totalViews = videos.reduce((s, v) => s + v.views, 0);
    const topVideo = [...videos].sort((a, b) => b.score - a.score)[0];

    const sorted = [...videos].sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );

    const cadenceLabel = computeCadenceLabel(sorted);

    const bucketSize = Math.max(1, Math.floor(sorted.length / 12));
    const sparklinePoints: number[] = [];
    for (let i = 0; i < sorted.length; i += bucketSize) {
      const bucket = sorted.slice(i, i + bucketSize);
      const avg = bucket.reduce((s, v) => s + v.score, 0) / bucket.length;
      sparklinePoints.push(avg);
    }

    const recentHalf = sorted.slice(Math.floor(sorted.length / 2));
    const olderHalf = sorted.slice(0, Math.floor(sorted.length / 2));
    const recentAvg = recentHalf.length > 0 ? recentHalf.reduce((s, v) => s + v.score, 0) / recentHalf.length : 0;
    const olderAvg = olderHalf.length > 0 ? olderHalf.reduce((s, v) => s + v.score, 0) / olderHalf.length : 0;
    const scoreTrend = recentAvg - olderAvg;

    const scoreDistribution = [0, 0, 0, 0, 0];
    for (const v of videos) {
      const bucket = Math.min(4, Math.floor(v.score / 20));
      scoreDistribution[bucket]++;
    }

    const sortedByScore = [...videos].sort((a, b) => b.score - a.score);
    const topPerformers = sortedByScore.slice(0, 5);
    const bottomPerformers = sortedByScore.slice(-5).reverse();

    const monthMap = new Map<string, VideoData[]>();
    for (const v of sorted) {
      const key = dayjs(v.publishedAt).format("YYYY-MM");
      const arr = monthMap.get(key) ?? [];
      arr.push(v);
      monthMap.set(key, arr);
    }
    const monthlyBuckets: MonthBucket[] = [...monthMap.entries()].map(([key, vids]) => ({
      label: dayjs(key + "-01").format("MMM YY"),
      totalViews: vids.reduce((s, v) => s + v.views, 0),
      avgEngagement: vids.reduce((s, v) => s + (v.rates?.engagementRate ?? 0), 0) / vids.length,
      avgScore: vids.reduce((s, v) => s + v.score, 0) / vids.length,
      videoCount: vids.length,
    }));

    const durationBuckets: DurationBucket[] = DURATION_RANGES.map(({ label, range, min, max }) => {
      const matching = videos.filter((v) => v.duration >= min && v.duration < max);
      return {
        label,
        range,
        count: matching.length,
        avgScore: matching.length > 0 ? matching.reduce((s, v) => s + v.score, 0) / matching.length : 0,
        avgViews: matching.length > 0 ? matching.reduce((s, v) => s + v.views, 0) / matching.length : 0,
      };
    });

    const cadence = computeCadenceStats(videos, sorted);

    return {
      avgScore,
      avgEngagement,
      totalViews,
      topVideo,
      cadenceLabel,
      sparklinePoints,
      scoreTrend,
      videoCount: videos.length,
      scoreLabel: getScoreLabel(avgScore),
      totalViewsFormatted: formatCompact(totalViews),
      scoreDistribution,
      topPerformers,
      bottomPerformers,
      monthlyBuckets,
      durationBuckets,
      cadence,
    };
  }, [videos]);
}
