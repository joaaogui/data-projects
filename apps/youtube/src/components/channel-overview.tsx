"use client";

import { useChannelSagas } from "@/hooks/use-channel-sagas";
import { useChannelStats } from "@/hooks/use-channel-stats";
import { formatCompact, getScoreColorClass } from "@/lib/format";
import type { VideoData } from "@/types/youtube";
import { Minus, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Image from "next/image";
import { SagaCard } from "./sagas/saga-card";

const BUCKET_LABELS = ["0-20", "20-40", "40-60", "60-80", "80-100"] as const;

const BUCKET_FILL_COLORS = [
  "fill-red-500",
  "fill-orange-500",
  "fill-amber-500",
  "fill-teal-500",
  "fill-emerald-500",
];

interface ChannelOverviewProps {
  videos: VideoData[];
  channelId: string;
  onNavigateToVideo: (videoId: string) => void;
  onNavigateToSagas: () => void;
}

function ScoreDistribution({
  distribution,
  avgScore,
}: Readonly<{ distribution: number[]; avgScore: number }>) {
  const maxCount = Math.max(...distribution, 1);
  const barWidth = 40;
  const gap = 12;
  const chartHeight = 100;
  const svgWidth = distribution.length * barWidth + (distribution.length - 1) * gap;
  const avgX = (avgScore / 100) * svgWidth;

  const bucketSummary = distribution
    .map((count, i) => `${BUCKET_LABELS[i]}: ${count}`)
    .join(", ");

  return (
    <svg
      viewBox={`0 0 ${svgWidth} ${chartHeight + 20}`}
      className="w-full max-w-md"
      aria-label={`Score distribution: ${bucketSummary}. Channel average: ${avgScore.toFixed(0)}`}
    >
      {distribution.map((count, i) => {
        const barHeight = (count / maxCount) * chartHeight;
        const x = i * (barWidth + gap);
        const y = chartHeight - barHeight;
        return (
          <g key={BUCKET_LABELS[i]}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={4}
              className={`${BUCKET_FILL_COLORS[i]} opacity-80`}
            />
            <text
              x={x + barWidth / 2}
              y={chartHeight + 14}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {BUCKET_LABELS[i]}
            </text>
          </g>
        );
      })}
      <line
        x1={avgX}
        y1={0}
        x2={avgX}
        y2={chartHeight}
        strokeDasharray="4 3"
        className="stroke-foreground/60"
        strokeWidth={1.5}
      />
      <text
        x={avgX}
        y={-4}
        textAnchor="middle"
        className="fill-foreground text-[9px] font-medium"
      >
        avg {avgScore.toFixed(0)}
      </text>
    </svg>
  );
}

function VideoRow({
  video,
  onClick,
}: Readonly<{ video: VideoData; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full text-left rounded-xl p-2 -mx-2 hover:bg-muted/60 transition-colors"
    >
      <div className="relative w-16 shrink-0 aspect-video rounded-md overflow-hidden bg-muted">
        <Image
          src={video.thumbnail}
          alt=""
          fill
          sizes="64px"
          className="object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium line-clamp-2 leading-tight">
          {video.title}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {formatCompact(video.views)} views
        </p>
      </div>
      <span
        className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${getScoreColorClass(video.score)}`}
      >
        {video.score.toFixed(0)}
      </span>
    </button>
  );
}

function PublishingTrend({
  sparklinePoints,
  scoreTrend,
}: Readonly<{ sparklinePoints: number[]; scoreTrend: number }>) {
  if (sparklinePoints.length < 2) return null;

  const width = 400;
  const height = 60;
  const padding = 4;

  const min = Math.min(...sparklinePoints);
  const max = Math.max(...sparklinePoints);
  const range = max - min || 1;

  const coords = sparklinePoints.map((val, i) => ({
    x: padding + (i / (sparklinePoints.length - 1)) * (width - padding * 2),
    y: padding + (1 - (val - min) / range) * (height - padding * 2),
  }));

  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
  const lastCoord = coords.at(-1) ?? coords[0];
  const firstCoord = coords[0];
  const areaD = `${pathD} L ${lastCoord.x} ${height} L ${firstCoord.x} ${height} Z`;

  let strokeColor = "stroke-muted-foreground";
  let fillColor = "fill-muted-foreground/5";
  let TrendIcon = Minus;
  let trendColor = "text-muted-foreground";
  let trendLabel = "Stable";

  if (scoreTrend > 2) {
    strokeColor = "stroke-emerald-600 dark:stroke-emerald-400";
    fillColor = "fill-emerald-500/10";
    TrendIcon = TrendingUp;
    trendColor = "text-emerald-600 dark:text-emerald-400";
    trendLabel = `+${scoreTrend.toFixed(1)}`;
  } else if (scoreTrend < -2) {
    strokeColor = "stroke-red-500 dark:stroke-red-400";
    fillColor = "fill-red-500/10";
    TrendIcon = TrendingDown;
    trendColor = "text-red-500 dark:text-red-400";
    trendLabel = scoreTrend.toFixed(1);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <TrendIcon className={`h-4 w-4 ${trendColor}`} />
        <span className={`text-xs font-medium ${trendColor}`}>{trendLabel}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="none">
        <path d={areaD} className={fillColor} />
        <path d={pathD} className={strokeColor} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function SagasPreview({
  channelId,
  videos,
  onNavigateToSagas,
}: Readonly<{
  channelId: string;
  videos: VideoData[];
  onNavigateToSagas: () => void;
}>) {
  const { sagas, isLoadingSagas } = useChannelSagas(channelId, videos);

  if (isLoadingSagas) return null;

  const realSagas = sagas.filter((s) => s.id !== "standalone");

  if (realSagas.length === 0) {
    return (
      <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-3">Sagas</h3>
        <button
          onClick={onNavigateToSagas}
          className="w-full flex flex-col items-center gap-3 py-6 px-4 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-muted/40 transition-colors"
        >
          <Sparkles className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Discover story arcs across this channel&apos;s videos
          </p>
        </button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Sagas</h3>
        <button
          onClick={onNavigateToSagas}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View all &rarr;
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {realSagas.slice(0, 3).map((saga) => (
          <SagaCard
            key={saga.id}
            saga={saga}
            videos={videos}
            onClick={onNavigateToSagas}
          />
        ))}
      </div>
    </div>
  );
}

export function ChannelOverview({
  videos,
  channelId,
  onNavigateToVideo,
  onNavigateToSagas,
}: Readonly<ChannelOverviewProps>) {
  const stats = useChannelStats(videos);

  if (!stats) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Sync this channel to see analytics
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      {/* Score Distribution */}
      <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-3">Score Distribution</h3>
        <ScoreDistribution
          distribution={stats.scoreDistribution}
          avgScore={stats.avgScore}
        />
      </div>

      {/* Top & Bottom Performers */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-3">Outperformers</h3>
          <div className="space-y-1">
            {stats.topPerformers.map((video) => (
              <VideoRow
                key={video.videoId}
                video={video}
                onClick={() => onNavigateToVideo(video.videoId)}
              />
            ))}
          </div>
        </div>
        <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
          <h3 className="text-sm font-semibold mb-3">Underperformers</h3>
          <div className="space-y-1">
            {stats.bottomPerformers.map((video) => (
              <VideoRow
                key={video.videoId}
                video={video}
                onClick={() => onNavigateToVideo(video.videoId)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Publishing Trend */}
      <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
        <h3 className="text-sm font-semibold mb-3">Publishing Trend</h3>
        <PublishingTrend
          sparklinePoints={stats.sparklinePoints}
          scoreTrend={stats.scoreTrend}
        />
      </div>

      {/* Sagas Preview */}
      <SagasPreview
        channelId={channelId}
        videos={videos}
        onNavigateToSagas={onNavigateToSagas}
      />
    </div>
  );
}
