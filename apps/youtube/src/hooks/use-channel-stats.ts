"use client";

import { formatCompact } from "@/lib/format";
import { getScoreLabel } from "@/lib/scoring";
import type { VideoData } from "@/types/youtube";
import dayjs from "dayjs";
import { useMemo } from "react";

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
}

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

    let cadenceLabel = "N/A";
    if (sorted.length >= 2) {
      const first = dayjs(sorted[0].publishedAt);
      const last = dayjs(sorted.at(-1)!.publishedAt);
      const totalWeeks = last.diff(first, "week") || 1;
      const perWeek = sorted.length / totalWeeks;
      if (perWeek >= 1) {
        cadenceLabel = `${perWeek.toFixed(1)}/week`;
      } else {
        const perMonth = perWeek * 4.33;
        cadenceLabel = `${perMonth.toFixed(1)}/month`;
      }
    }

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
    };
  }, [videos]);
}
