"use client";

import { formatCompact } from "@/lib/format";
import { getScoreLabel } from "@/lib/scoring";
import type { VideoData } from "@/types/youtube";
import { Button, Card, CardContent, Tooltip, TooltipContent, TooltipTrigger } from "@data-projects/ui";
import dayjs from "dayjs";
import { Calendar, ChevronDown, ChevronUp, Eye, Minus, ThumbsUp, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";

const COLLAPSED_KEY = "youtube-dashboard-collapsed";

interface ChannelDashboardProps {
  videos: VideoData[];
}

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
    strokeColor = "stroke-emerald-600 dark:stroke-emerald-400";
    fillColor = "fill-emerald-500/10";
  } else if (trend < -2) {
    strokeColor = "stroke-red-500 dark:stroke-red-400";
    fillColor = "fill-red-500/10";
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={`${className}`} preserveAspectRatio="none">
      <path d={areaD} className={fillColor} />
      <path d={pathD} fill="none" className={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendIcon({ value }: Readonly<{ value: number }>) {
  if (value > 2) return <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />;
  if (value < -2) return <TrendingDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function ChannelDashboard({ videos }: Readonly<ChannelDashboardProps>) {
  const [collapsed, setCollapsed] = useState(() => {
    if (globalThis.window === undefined) return false;
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch { }
      return next;
    });
  }, []);

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

  if (collapsed) {
    return (
      <div className="flex items-center justify-between mb-4 flex-shrink-0 rounded-2xl glass px-3 sm:px-4 py-2.5">
        <div className="flex items-center gap-2 sm:gap-4 text-sm min-w-0 overflow-hidden">
          <span className="font-medium shrink-0">{videos.length} videos</span>
          <span className="text-muted-foreground/40 shrink-0">&middot;</span>
          <span className="shrink-0">Avg <span className={`font-semibold ${scoreLabel.color}`}>{stats.avgScore.toFixed(1)}</span></span>
          <span className="text-muted-foreground/40 hidden sm:inline">&middot;</span>
          <span className="hidden sm:inline">{formatCompact(stats.totalViews)} views</span>
          <span className="text-muted-foreground/40 hidden sm:inline">&middot;</span>
          <span className="hidden sm:inline">{stats.cadenceLabel}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={toggleCollapsed} className="h-7 w-7 p-0 shrink-0">
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mb-4 flex-shrink-0 space-y-2">
      <div className="flex items-center justify-between rounded-2xl glass px-3 sm:px-4 py-2.5 animate-fade-down">
        <div className="flex items-center gap-2 sm:gap-4 text-sm min-w-0 overflow-hidden">
          <span className="font-medium shrink-0">{videos.length} videos</span>
          <span className="text-muted-foreground/40 shrink-0">&middot;</span>
          <span className="shrink-0">Avg <span className={`font-semibold ${scoreLabel.color}`}>{stats.avgScore.toFixed(1)}</span></span>
          <span className="text-muted-foreground/40 hidden sm:inline">&middot;</span>
          <span className="hidden sm:inline">{formatCompact(stats.totalViews)} views</span>
          <span className="text-muted-foreground/40 hidden sm:inline">&middot;</span>
          <span className="hidden sm:inline">{stats.cadenceLabel}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={toggleCollapsed} className="h-7 w-7 p-0 shrink-0">
          <ChevronUp className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
          <Card className="glass rounded-2xl overflow-hidden group hover:glow-primary transition-shadow duration-300">
            <CardContent className="p-3 sm:p-4 relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-sky-500/8 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                <Eye className="h-3.5 w-3.5 text-sky-500" />
                <span className="text-xs font-medium uppercase tracking-wider">Total Views</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold tabular-nums animate-count-up" style={{ animationDelay: '150ms' }}>{formatCompact(stats.totalViews)}</p>
              <p className="text-xs text-muted-foreground mt-1">{videos.length} videos</p>
            </CardContent>
          </Card>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '60ms' }}>
          <Card className="glass rounded-2xl overflow-hidden group hover:glow-primary transition-shadow duration-300">
            <CardContent className="p-3 sm:p-4 relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-emerald-500/8 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="animate-slide-right inline-flex" style={{ animationDelay: '200ms' }}>
                    <TrendIcon value={stats.scoreTrend} />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider">Avg Score</span>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <div>
                  <p className={`text-xl sm:text-2xl font-bold tabular-nums animate-count-up ${scoreLabel.color}`} style={{ animationDelay: '150ms' }}>
                    {stats.avgScore.toFixed(1)}
                  </p>
                  <p className={`text-xs font-medium ${scoreLabel.color}`}>{scoreLabel.label}</p>
                </div>
                <Sparkline points={stats.sparklinePoints} className="w-16 h-7 ml-auto" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="animate-fade-up lg:col-span-2" style={{ animationDelay: '120ms' }}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Card className="glass rounded-2xl cursor-help overflow-hidden group hover:glow-primary transition-shadow duration-300 h-full">
                <CardContent className="p-3 sm:p-4 relative h-full">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-amber-500/8 to-transparent rounded-bl-full" />
                  <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-medium uppercase tracking-wider">Top Performer</span>
                  </div>
                  <div className="flex items-center gap-2.5 mt-1.5">
                    <div className="relative flex-shrink-0">
                      <Image
                        src={stats.topVideo.thumbnail}
                        alt={stats.topVideo.title}
                        width={56}
                        height={32}
                        sizes="56px"
                        style={{ width: 56, height: "auto" }}
                        className="rounded-lg object-cover ring-1 ring-border/30"
                      />
                      <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center">
                        <Trophy className="h-2.5 w-2.5 text-white" />
                      </div>
                    </div>
                    <p className="text-xs font-medium line-clamp-2 leading-snug">{stats.topVideo.title}</p>
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
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '180ms' }}>
          <Card className="glass rounded-2xl overflow-hidden group hover:glow-primary transition-shadow duration-300">
            <CardContent className="p-3 sm:p-4 relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-violet-500/8 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                <ThumbsUp className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-xs font-medium uppercase tracking-wider">Avg Engagement</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold tabular-nums animate-count-up" style={{ animationDelay: '150ms' }}>
                {stats.avgEngagement.toFixed(1)}
                <span className="text-sm font-normal text-muted-foreground">/1K</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">weighted per 1K views</p>
            </CardContent>
          </Card>
        </div>

        <div className="animate-fade-up col-span-2 sm:col-span-1" style={{ animationDelay: '240ms' }}>
          <Card className="glass rounded-2xl overflow-hidden group hover:glow-primary transition-shadow duration-300">
            <CardContent className="p-3 sm:p-4 relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-orange-500/8 to-transparent rounded-bl-full" />
              <div className="flex items-center gap-2 text-muted-foreground mb-1.5">
                <Calendar className="h-3.5 w-3.5 text-orange-500" />
                <span className="text-xs font-medium uppercase tracking-wider">Upload Cadence</span>
              </div>
              <p className="text-xl sm:text-2xl font-bold tabular-nums animate-count-up" style={{ animationDelay: '150ms' }}>{stats.cadenceLabel}</p>
              <p className="text-xs text-muted-foreground mt-1">average frequency</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
