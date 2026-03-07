"use client";

import { useMemo } from "react";
import { Card, CardContent, Tooltip, TooltipTrigger, TooltipContent } from "@data-projects/ui";
import { TrendingUp, TrendingDown, Minus, Eye, ThumbsUp, Calendar, Trophy } from "lucide-react";
import { getScoreLabel } from "@/lib/scoring";
import type { VideoData } from "@/types/youtube";
import Image from "next/image";
import dayjs from "dayjs";

interface ChannelDashboardProps {
  videos: VideoData[];
}

const formatCompact = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString("en-US");
};

function Sparkline({ points, className = "" }: Readonly<{ points: number[]; className?: string }>) {
  if (points.length < 2) return null;

  const width = 80;
  const height = 28;
  const padding = 2;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;

  const coords = points.map((val, i) => ({
    x: padding + (i / (points.length - 1)) * (width - padding * 2),
    y: padding + (1 - (val - min) / range) * (height - padding * 2),
  }));

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const lastCoord = coords.at(-1) ?? coords[0];
  const firstCoord = coords[0];
  const areaD = `${pathD} L ${lastCoord.x} ${height} L ${firstCoord.x} ${height} Z`;

  const trend = (points.at(-1) ?? 0) - points[0];
  let strokeColor = "stroke-muted-foreground";
  let fillColor = "fill-muted-foreground/5";
  if (trend > 2) {
    strokeColor = "stroke-emerald-500";
    fillColor = "fill-emerald-500/10";
  } else if (trend < -2) {
    strokeColor = "stroke-red-400";
    fillColor = "fill-red-400/10";
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`${className}`} preserveAspectRatio="none">
      <path d={areaD} className={fillColor} />
      <path d={pathD} fill="none" className={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendIcon({ value }: Readonly<{ value: number }>) {
  if (value > 2) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (value < -2) return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function ChannelDashboard({ videos }: Readonly<ChannelDashboardProps>) {
  const stats = useMemo(() => {
    if (videos.length === 0) return null;

    const avgScore = videos.reduce((s, v) => s + v.score, 0) / videos.length;
    const avgEngagement = videos.reduce((s, v) => s + (v.rates?.engagementRate || 0), 0) / videos.length;
    const totalViews = videos.reduce((s, v) => s + v.views, 0);
    const topVideo = [...videos].sort((a, b) => b.score - a.score).at(0)!;

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

    return { avgScore, avgEngagement, totalViews, topVideo, cadenceLabel, sparklinePoints, scoreTrend };
  }, [videos]);

  if (!stats) return null;

  const scoreLabel = getScoreLabel(stats.avgScore);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4 flex-shrink-0">
      <Card className="bg-card/60 backdrop-blur-sm border-border/50">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Eye className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">Total Views</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold tabular-nums">{formatCompact(stats.totalViews)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{videos.length} videos</p>
        </CardContent>
      </Card>

      <Card className="bg-card/60 backdrop-blur-sm border-border/50">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <div className="flex items-center gap-1.5">
              <TrendIcon value={stats.scoreTrend} />
              <span className="text-xs font-medium uppercase tracking-wider">Avg Score</span>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <p className={`text-xl sm:text-2xl font-bold tabular-nums ${scoreLabel.color}`}>
                {stats.avgScore.toFixed(1)}
              </p>
              <p className={`text-xs font-medium ${scoreLabel.color}`}>{scoreLabel.label}</p>
            </div>
            <Sparkline points={stats.sparklinePoints} className="w-16 h-6 ml-auto" />
          </div>
        </CardContent>
      </Card>

      <Tooltip>
        <TooltipTrigger asChild>
          <Card className="bg-card/60 backdrop-blur-sm border-border/50 cursor-help">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Trophy className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium uppercase tracking-wider">Top Performer</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Image
                  src={stats.topVideo.thumbnail}
                  alt={stats.topVideo.title}
                  width={48}
                  height={27}
                  className="rounded object-cover flex-shrink-0"
                />
                <p className="text-xs font-medium line-clamp-2 leading-tight">{stats.topVideo.title}</p>
              </div>
            </CardContent>
          </Card>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-medium">{stats.topVideo.title}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Score: {stats.topVideo.score.toFixed(1)} &middot; {formatCompact(stats.topVideo.views)} views
          </p>
        </TooltipContent>
      </Tooltip>

      <Card className="bg-card/60 backdrop-blur-sm border-border/50">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ThumbsUp className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">Avg Engagement</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold tabular-nums">
            {stats.avgEngagement.toFixed(1)}
            <span className="text-sm font-normal text-muted-foreground">/1K</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">weighted per 1K views</p>
        </CardContent>
      </Card>

      <Card className="bg-card/60 backdrop-blur-sm border-border/50 col-span-2 sm:col-span-1">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-xs font-medium uppercase tracking-wider">Upload Cadence</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold tabular-nums">{stats.cadenceLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5">average frequency</p>
        </CardContent>
      </Card>
    </div>
  );
}
