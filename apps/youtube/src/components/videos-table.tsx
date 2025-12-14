"use client";

import { useState, useMemo } from "react";
import {
  DataTable,
  SortButton,
  type ColumnDef,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@data-projects/ui";
import { ExternalLink, SlidersHorizontal, Zap } from "lucide-react";
import type { VideoData } from "@/types/youtube";
import { getScoreLabel, formatDuration } from "@/lib/scoring";
import { MetricIconsRow, DEFAULT_WEIGHTS, METRIC_TYPES, type MetricWeights } from "./metric-icon";
import { WeightsEditor } from "./weights-editor";
import Image from "next/image";

const formatNumber = (num: number) => num.toLocaleString("en-US");

function recalculateScore(video: VideoData, weights: MetricWeights): number {
  if (!video.scoreComponents) return video.score;
  
  const total = METRIC_TYPES.reduce((sum, t) => sum + weights[t], 0);
  if (total === 0) return 0;
  
  const { reachScore, engagementScore, consistencyScore, communityScore, efficiencyScore } = video.scoreComponents;
  
  const score = 
    (reachScore ?? 0) * (weights.views / total) +
    (engagementScore ?? 0) * (weights.engagement / total) +
    (consistencyScore ?? 0) * (weights.consistency / total) +
    (communityScore ?? 0) * (weights.community / total) +
    (efficiencyScore ?? 0) * (weights.efficiency / total);
  
  return Math.round(score * 10) / 10;
}

function ScoreBadge({ score }: Readonly<{ score: number }>) {
  const { label, color } = getScoreLabel(score);
  
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-lg font-bold tabular-nums ${color}`}>
        {score.toFixed(1)}
      </span>
      <span className={`text-xs font-medium ${color}`}>
        {label}
      </span>
    </div>
  );
}

function ScoreBreakdown({ video, weights }: Readonly<{ video: VideoData; weights: MetricWeights }>) {
  const { scoreComponents } = video;
  
  if (!scoreComponents) {
    return null;
  }
  
  return (
    <MetricIconsRow 
      weights={weights}
      values={{
        views: scoreComponents.reachScore,
        engagement: scoreComponents.engagementScore,
        consistency: scoreComponents.consistencyScore,
        community: scoreComponents.communityScore,
        efficiency: scoreComponents.efficiencyScore,
      }}
      className="text-sm"
    />
  );
}

function ShortsBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold rounded bg-red-500/15 text-red-500 border border-red-500/20">
      <Zap className="h-2.5 w-2.5" />
      SHORT
    </span>
  );
}

function getEfficiencyColor(viewsPerMin: number): string {
  if (viewsPerMin >= 100000) return "text-emerald-500";
  if (viewsPerMin >= 50000) return "text-green-500";
  if (viewsPerMin >= 10000) return "text-yellow-500";
  return "text-muted-foreground";
}

function getAgeLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${formatNumber(days)}d`;
}

function getEngagementColor(rate: number): string {
  if (rate >= 60) return "text-emerald-500";
  if (rate >= 40) return "text-green-500";
  if (rate >= 20) return "text-yellow-500";
  return "text-muted-foreground";
}

interface VideosTableProps {
  data: VideoData[];
}

export function VideosTable({ data }: Readonly<VideosTableProps>) {
  const [weights, setWeights] = useState<MetricWeights>({ ...DEFAULT_WEIGHTS });

  const processedData = useMemo(() => {
    return data.map(video => ({
      ...video,
      score: recalculateScore(video, weights),
    }));
  }, [data, weights]);

  const columns: ColumnDef<VideoData>[] = useMemo(() => [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <div className="flex items-center gap-3 min-w-[280px]">
          <Image
            src={row.original.thumbnail}
            alt={row.original.title}
            width={80}
            height={45}
            className="rounded object-cover flex-shrink-0"
          />
          <a
            href={row.original.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary hover:underline line-clamp-2 flex items-center gap-1"
          >
            {row.original.title}
            <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
          </a>
        </div>
      ),
    },
    {
      accessorKey: "score",
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Score
        </SortButton>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col items-center gap-1">
          <ScoreBadge score={row.original.score} />
          <ScoreBreakdown video={row.original} weights={weights} />
        </div>
      ),
    },
    {
      accessorKey: "duration",
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Duration
        </SortButton>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col items-start gap-1">
          <span className="tabular-nums font-medium">{formatDuration(row.original.duration)}</span>
          {row.original.isShort && <ShortsBadge />}
        </div>
      ),
    },
    {
      accessorKey: "days",
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Age
        </SortButton>
      ),
      cell: ({ row }) => {
        const label = getAgeLabel(row.original.days);
        return <span className="tabular-nums text-muted-foreground">{label}</span>;
      },
    },
    {
      accessorKey: "views",
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Views
        </SortButton>
      ),
      cell: ({ row }) => (
        <span className="tabular-nums font-medium">{formatNumber(row.original.views)}</span>
      ),
    },
    {
      id: "viewsPerDay",
      accessorFn: (row) => row.rates?.viewsPerDay ?? 0,
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Views/Day
        </SortButton>
      ),
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNumber(row.original.rates?.viewsPerDay ?? 0)}</span>
      ),
    },
    {
      id: "viewsPerMinute",
      accessorFn: (row) => row.rates?.viewsPerMinute ?? 0,
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Views/Min
        </SortButton>
      ),
      cell: ({ row }) => {
        const vpm = row.original.rates?.viewsPerMinute ?? 0;
        const color = getEfficiencyColor(vpm);
        return (
          <span className={`tabular-nums font-medium ${color}`}>
            {formatNumber(vpm)}
          </span>
        );
      },
    },
    {
      accessorKey: "likes",
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Likes
        </SortButton>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="tabular-nums">{formatNumber(row.original.likes)}</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {row.original.rates?.likeRate?.toFixed(1) ?? '-'}‰
          </span>
        </div>
      ),
    },
    {
      accessorKey: "comments",
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Comments
        </SortButton>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="tabular-nums">{formatNumber(row.original.comments)}</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {row.original.rates?.commentRate?.toFixed(2) ?? '-'}‰
          </span>
        </div>
      ),
    },
    {
      id: "engagement",
      accessorFn: (row) => row.rates.engagementRate,
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Engagement
        </SortButton>
      ),
      cell: ({ row }) => {
        const rate = row.original.rates?.engagementRate ?? 0;
        const color = getEngagementColor(rate);
        return (
          <span className={`tabular-nums font-medium ${color}`}>
            {rate.toFixed(1)}‰
          </span>
        );
      },
    },
  ], [weights]);

  const avgScore = processedData.length > 0 
    ? processedData.reduce((sum, v) => sum + (v.score || 0), 0) / processedData.length 
    : 0;
  const avgEngagement = processedData.length > 0
    ? processedData.reduce((sum, v) => sum + (v.rates?.engagementRate || 0), 0) / processedData.length
    : 0;
  const shortsCount = processedData.filter(v => v.isShort).length;
  const avgViewsPerMin = processedData.length > 0
    ? processedData.reduce((sum, v) => sum + (v.rates?.viewsPerMinute || 0), 0) / processedData.length
    : 0;

  const isDefaultWeights = METRIC_TYPES.every(
    t => weights[t] === DEFAULT_WEIGHTS[t]
  );

  return (
    <div className="flex flex-col h-full gap-3 sm:gap-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm flex-shrink-0">
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 sm:px-3 sm:py-1.5">
          <span className="text-muted-foreground hidden sm:inline">Avg score:</span>
          <span className="text-muted-foreground sm:hidden">Score</span>
          <span className="font-semibold">{avgScore.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 sm:px-3 sm:py-1.5">
          <span className="text-muted-foreground hidden sm:inline">Avg engagement:</span>
          <span className="text-muted-foreground sm:hidden">Eng</span>
          <span className="font-semibold">{avgEngagement.toFixed(1)}‰</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5">
          <span className="text-muted-foreground">Avg views/min:</span>
          <span className="font-semibold">{formatNumber(Math.round(avgViewsPerMin))}</span>
        </div>
        {shortsCount > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-2 py-1 sm:px-3 sm:py-1.5">
            <Zap className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-red-500" />
            <span className="text-muted-foreground hidden sm:inline">Shorts:</span>
            <span className="font-semibold text-red-500">{shortsCount}</span>
          </div>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 sm:h-7 px-1.5 sm:px-2 ml-auto">
              <SlidersHorizontal className="h-3 w-3 sm:h-3.5 sm:w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Adjust</span>
              {!isDefaultWeights && (
                <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="p-3">
            <WeightsEditor weights={weights} onChange={setWeights} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="hidden sm:flex flex-wrap items-center gap-4 text-sm text-muted-foreground flex-shrink-0">
        <MetricIconsRow weights={weights} showLabel showWeight />
        <div className="ml-auto text-muted-foreground">
          ‰ = per 1,000 views
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={processedData}
          defaultSorting={[{ id: "score", desc: true }]}
          pagination={{
            pageSize: 25,
            showInfo: true,
            itemName: "videos",
          }}
          emptyMessage="No videos found."
        />
      </div>
    </div>
  );
}
