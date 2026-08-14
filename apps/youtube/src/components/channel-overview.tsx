"use client";

import { useChannelSagas } from "@/hooks/use-channel-sagas";
import { useChannelStats } from "@/hooks/use-channel-stats";
import type { CadenceStats, DurationBucket, MonthBucket } from "@/hooks/use-channel-stats";
import { formatCompact, getScoreColorClass } from "@/lib/format";
import type { VideoData } from "@/types/youtube";
import dayjs from "dayjs";
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";
import { SagaCard } from "./sagas/saga-card";

const BUCKET_LABELS = ["0-20", "20-40", "40-60", "60-80", "80-100"] as const;

interface ChannelOverviewProps {
  videos: VideoData[];
  channelId: string;
  onNavigateToVideo: (videoId: string) => void;
  onNavigateToSagas: () => void;
}

function Panel({
  title,
  action,
  className = "",
  children,
}: Readonly<{
  title: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}>) {
  return (
    <section className={`rounded-lg border border-border bg-card p-4 sm:p-5 ${className}`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** The headline the rest of the page then backs up with detail. */
function Summary({
  videos,
  stats,
}: Readonly<{ videos: VideoData[]; stats: ReturnType<typeof useChannelStats> }>) {
  const facts = useMemo(() => {
    if (!stats || videos.length === 0) return null;

    const times = videos.map((v) => new Date(v.publishedAt).getTime());
    const firstYear = dayjs(Math.min(...times)).format("YYYY");
    const lastYear = dayjs(Math.max(...times)).format("YYYY");

    const peakIndex = stats.scoreDistribution.indexOf(
      Math.max(...stats.scoreDistribution)
    );
    const peakShare = Math.round(
      (stats.scoreDistribution[peakIndex] / stats.videoCount) * 100
    );

    const topDuration = [...stats.durationBuckets].sort((a, b) => b.count - a.count)[0];

    return {
      span: firstYear === lastYear ? firstYear : `${firstYear}-${lastYear}`,
      peakBand: BUCKET_LABELS[peakIndex],
      peakShare,
      topDuration,
    };
  }, [videos, stats]);

  if (!stats || !facts) return null;

  const trend = stats.scoreTrend;
  let trendPhrase = "holding steady against";
  if (trend > 2) trendPhrase = `trending ${trend.toFixed(1)} points above`;
  else if (trend < -2) trendPhrase = `${Math.abs(trend).toFixed(1)} points below`;

  return (
    <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
      <span className="font-medium text-foreground">
        {stats.videoCount} videos
      </span>{" "}
      published across {facts.span}.{" "}
      <span className="font-medium text-foreground">{facts.peakShare}%</span> land
      in the {facts.peakBand} score band, and recent uploads are {trendPhrase}{" "}
      older ones. Most run{" "}
      <span className="font-medium text-foreground">{facts.topDuration.range}</span>
      , usually posted on{" "}
      <span className="font-medium text-foreground">{stats.cadence.bestDay}</span>.
    </p>
  );
}

/**
 * Horizontal bars: a wide panel reads far better this way than as five thin
 * vertical columns, and the counts can sit inline instead of in a tooltip.
 */
function ScoreDistribution({
  distribution,
  avgScore,
  total,
}: Readonly<{ distribution: number[]; avgScore: number; total: number }>) {
  const maxCount = Math.max(...distribution, 1);
  const avgBand = Math.min(4, Math.floor(avgScore / 20));

  return (
    <div
      className="space-y-2"
      aria-label={distribution
        .map((count, i) => `${BUCKET_LABELS[i]}: ${count}`)
        .join(", ")}
    >
      {distribution.map((count, i) => {
        const isAvgBand = i === avgBand;
        return (
          <div key={BUCKET_LABELS[i]} className="flex items-center gap-3">
            <span
              className={`w-14 shrink-0 text-right font-mono text-xs ${isAvgBand ? "text-foreground" : "text-muted-foreground"}`}
            >
              {BUCKET_LABELS[i]}
            </span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-sm bg-muted/50">
              <div
                className={`h-full rounded-sm ${i === 4 ? "bg-data" : "bg-foreground/25"}`}
                style={{ width: `${Math.max((count / maxCount) * 100, count > 0 ? 1.5 : 0)}%` }}
              />
              {isAvgBand && (
                <span className="absolute inset-y-0 right-2 flex items-center text-[11px] text-muted-foreground">
                  channel average {avgScore.toFixed(0)}
                </span>
              )}
            </div>
            <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{count}</span>
              {total > 0 && ` · ${Math.round((count / total) * 100)}%`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Trajectory({
  sparklinePoints,
  scoreTrend,
  cadence,
}: Readonly<{
  sparklinePoints: number[];
  scoreTrend: number;
  cadence: CadenceStats;
}>) {
  const width = 240;
  const height = 56;
  const padding = 3;

  const min = Math.min(...sparklinePoints);
  const max = Math.max(...sparklinePoints);
  const range = max - min || 1;

  const coords = sparklinePoints.map((val, i) => ({
    x: padding + (i / Math.max(1, sparklinePoints.length - 1)) * (width - padding * 2),
    y: padding + (1 - (val - min) / range) * (height - padding * 2),
  }));
  const pathD = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  const rising = scoreTrend > 2;
  const falling = scoreTrend < -2;
  const TrendIcon = rising ? TrendingUp : TrendingDown;

  let delta = "Stable";
  if (rising) delta = `+${scoreTrend.toFixed(1)}`;
  else if (falling) delta = scoreTrend.toFixed(1);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-medium tabular-nums ${rising ? "text-data" : "text-foreground"}`}>
          {delta}
        </span>
        {(rising || falling) && (
          <TrendIcon className={`h-4 w-4 ${rising ? "text-data" : "text-muted-foreground"}`} />
        )}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Average score of recent uploads versus older ones.
      </p>

      {sparklinePoints.length >= 2 && (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          preserveAspectRatio="none"
          aria-label="Score over time"
        >
          <path
            d={pathD}
            fill="none"
            className={rising ? "stroke-data" : "stroke-foreground/50"}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}

      <dl className="grid grid-cols-2 gap-y-3 border-t border-border pt-4 text-xs">
        <div>
          <dt className="text-muted-foreground">Every</dt>
          <dd className="mt-0.5 font-medium tabular-nums">
            {cadence.avgDaysBetween.toFixed(1)} days
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rhythm</dt>
          <dd className="mt-0.5 font-medium capitalize">{cadence.trend}</dd>
        </div>
      </dl>
    </div>
  );
}

function VideoRow({
  video,
  rank,
  onClick,
}: Readonly<{ video: VideoData; rank: number; onClick: () => void }>) {
  return (
    <button
      onClick={onClick}
      className="-mx-2 flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-muted/60"
    >
      <span className="w-3 shrink-0 font-mono text-xs text-muted-foreground/60">
        {rank}
      </span>
      <div className="relative aspect-video w-14 shrink-0 overflow-hidden rounded bg-muted">
        <Image src={video.thumbnail} alt="" fill sizes="56px" className="object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-xs font-medium">{video.title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {formatCompact(video.views)} views
        </p>
      </div>
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${getScoreColorClass(video.score)}`}
      >
        {video.score.toFixed(0)}
      </span>
    </button>
  );
}

function ViewsOverTimeChart({ buckets }: Readonly<{ buckets: MonthBucket[] }>) {
  const maxViews = Math.max(...buckets.map((b) => b.totalViews), 1);
  const maxEng = Math.max(...buckets.map((b) => b.avgEngagement), 1);
  const width = 600;
  const height = 130;
  const pad = 4;

  const coordsFor = (pick: (b: MonthBucket) => number, maxVal: number) =>
    buckets.map((b, i) => ({
      x: pad + (i / Math.max(1, buckets.length - 1)) * (width - pad * 2),
      y: pad + (1 - pick(b) / maxVal) * (height - pad * 2),
    }));

  const toPath = (cs: { x: number; y: number }[]) =>
    cs.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");

  const viewsCoords = coordsFor((b) => b.totalViews, maxViews);
  const engCoords = coordsFor((b) => b.avgEngagement, maxEng);
  const labelStep = Math.max(1, Math.floor(buckets.length / 8));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-data" />
          Views
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-3 bg-foreground/40" />
          Engagement /1K
        </span>
      </div>
      <svg viewBox={`0 0 ${width} ${height + 16}`} className="w-full" preserveAspectRatio="none">
        <path
          d={toPath(viewsCoords)}
          fill="none"
          className="stroke-data"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={toPath(engCoords)}
          fill="none"
          className="stroke-foreground/40"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {buckets.map((b, i) =>
          i % labelStep === 0 ? (
            <text
              key={b.label}
              x={viewsCoords[i].x}
              y={height + 12}
              textAnchor="middle"
              className="fill-muted-foreground text-[8px]"
            >
              {b.label}
            </text>
          ) : null
        )}
      </svg>
    </div>
  );
}

function UploadRhythm({ cadence }: Readonly<{ cadence: CadenceStats }>) {
  const dayNames = ["S", "M", "T", "W", "T", "F", "S"];
  const maxCount = Math.max(...cadence.dayOfWeekCounts, 1);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-2xl font-medium tabular-nums">
          {cadence.uploadsPerMonth.toFixed(1)}
        </p>
        <p className="text-xs text-muted-foreground">uploads per month</p>
      </div>
      <div className="flex h-20 items-end gap-1.5">
        {cadence.dayOfWeekCounts.map((count, i) => (
          <div key={`${dayNames[i]}-${i}`} className="flex flex-1 flex-col items-center gap-1.5">
            <div
              className={`w-full rounded-sm ${cadence.bestDay === ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i] ? "bg-data" : "bg-foreground/20"}`}
              style={{ height: `${Math.max((count / maxCount) * 56, 2)}px` }}
              title={`${count} uploads`}
            />
            <span className="text-[10px] text-muted-foreground">{dayNames[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DurationMix({ buckets }: Readonly<{ buckets: DurationBucket[] }>) {
  // Scaled against the largest bucket, not the total: relative shape is what
  // makes this readable at a glance, and the exact count is printed anyway.
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);
  const total = buckets.reduce((s, b) => s + b.count, 0) || 1;

  return (
    <div className="grid grid-cols-3 gap-x-6 gap-y-4 sm:grid-cols-6">
      {buckets.map((b) => (
        <div key={b.label} className="space-y-2">
          <div className="flex items-baseline justify-between gap-1">
            <span className="font-mono text-xs text-muted-foreground">{b.label}</span>
            <span className="text-sm font-medium tabular-nums">{b.count}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${b.count === maxCount ? "bg-data" : "bg-foreground/30"}`}
              style={{ width: `${Math.max((b.count / maxCount) * 100, b.count > 0 ? 3 : 0)}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {b.count > 0
              ? `${Math.round((b.count / total) * 100)}% · avg ${b.avgScore.toFixed(0)}`
              : "—"}
          </p>
        </div>
      ))}
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
      <Panel title="Sagas">
        <button
          onClick={onNavigateToSagas}
          className="flex w-full flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-6 transition-colors hover:bg-muted/40"
        >
          <Sparkles className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Discover story arcs across this channel&apos;s videos
          </p>
        </button>
      </Panel>
    );
  }

  return (
    <Panel
      title="Sagas"
      action={
        <button
          onClick={onNavigateToSagas}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          View all &rarr;
        </button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {realSagas.slice(0, 3).map((saga) => (
          <SagaCard key={saga.id} saga={saga} videos={videos} onClick={onNavigateToSagas} />
        ))}
      </div>
    </Panel>
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
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Sync this channel to see analytics
        </p>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto p-1">
      <Summary videos={videos} stats={stats} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Score distribution" className="lg:col-span-2">
          <ScoreDistribution
            distribution={stats.scoreDistribution}
            avgScore={stats.avgScore}
            total={stats.videoCount}
          />
        </Panel>
        <Panel title="Trajectory">
          <Trajectory
            sparklinePoints={stats.sparklinePoints}
            scoreTrend={stats.scoreTrend}
            cadence={stats.cadence}
          />
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel title="Outperformers">
          <div className="space-y-0.5">
            {stats.topPerformers.map((video, i) => (
              <VideoRow
                key={video.videoId}
                video={video}
                rank={i + 1}
                onClick={() => onNavigateToVideo(video.videoId)}
              />
            ))}
          </div>
        </Panel>
        <Panel title="Underperformers">
          <div className="space-y-0.5">
            {stats.bottomPerformers.map((video, i) => (
              <VideoRow
                key={video.videoId}
                video={video}
                rank={i + 1}
                onClick={() => onNavigateToVideo(video.videoId)}
              />
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {stats.monthlyBuckets.length > 2 && (
          <Panel title="Views & engagement over time" className="lg:col-span-2">
            <ViewsOverTimeChart buckets={stats.monthlyBuckets} />
          </Panel>
        )}
        <Panel title="Upload rhythm">
          <UploadRhythm cadence={stats.cadence} />
        </Panel>
      </div>

      <Panel title="Duration mix">
        <DurationMix buckets={stats.durationBuckets} />
      </Panel>

      <SagasPreview
        channelId={channelId}
        videos={videos}
        onNavigateToSagas={onNavigateToSagas}
      />
    </div>
  );
}
