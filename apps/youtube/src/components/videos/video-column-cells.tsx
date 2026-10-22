"use client";

import { useChannel } from "@/hooks/use-channel-context";
import { formatCompact, formatNumber, formatSigned, getAgeLabel, getEfficiencyColor, getEngagementColor, getScoreColorClass } from "@/lib/format";
import { formatDuration, getScoreLabel } from "@/lib/scoring";
import type { ScoreComponents, VideoData } from "@/types/youtube";
import {
  Skeleton,
  SortButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@data-projects/ui";
import dayjs from "dayjs";
import { FolderOpen, Heart } from "lucide-react";
import Image from "next/image";
import { createContext, useContext } from "react";
import { METRIC_CONFIGS, METRIC_TYPES, getNormalizedWeight, type MetricWeights } from "../metric-icon";

const METRIC_TO_COMPONENT: Record<string, keyof ScoreComponents> = {
  views: "reachScore",
  engagement: "engagementScore",
  momentum: "momentumScore",
  efficiency: "efficiencyScore",
  community: "communityScore",
};

// ---------------------------------------------------------------------------
// Weights context — used by ScoreCell to read scoring weights without closure
// ---------------------------------------------------------------------------

const WeightsContext = createContext<MetricWeights>({
  views: 30,
  engagement: 25,
  momentum: 20,
  efficiency: 15,
  community: 10,
});

export const WeightsProvider = WeightsContext.Provider;

function useWeights() {
  return useContext(WeightsContext);
}

// ---------------------------------------------------------------------------
// Channel catalog baseline stats context — provides cross-row comparisons
// ---------------------------------------------------------------------------

export interface VideoCatalogStats {
  totalVideos: number;
  medianViews: number;
  avgViews: number;
  totalViews: number;
  avgDuration: number;
  avgScore: number;
  avgEngagement: number;
  viewRankById: Map<string, number>;
  scoreRankById: Map<string, number>;
}

const DEFAULT_CATALOG_STATS: VideoCatalogStats = {
  totalVideos: 0,
  medianViews: 0,
  avgViews: 0,
  totalViews: 0,
  avgDuration: 0,
  avgScore: 0,
  avgEngagement: 0,
  viewRankById: new Map(),
  scoreRankById: new Map(),
};

export const VideoCatalogStatsContext = createContext<VideoCatalogStats>(DEFAULT_CATALOG_STATS);
export const VideoCatalogStatsProvider = VideoCatalogStatsContext.Provider;

function useVideoCatalogStats() {
  return useContext(VideoCatalogStatsContext);
}

function formatExactHMS(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Shared column-header type narrowed to what we actually use
// ---------------------------------------------------------------------------

interface ColCtx {
  getIsSorted: () => false | "asc" | "desc";
  toggleSorting: (desc: boolean) => void;
}

interface RowCtx {
  original: VideoData;
}

// ---------------------------------------------------------------------------
// Header components
// ---------------------------------------------------------------------------

export function LikedHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      <Heart className="h-3.5 w-3.5" />
    </SortButton>
  );
}

export function ScoreHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      Score
    </SortButton>
  );
}

export function DurationHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      Duration
    </SortButton>
  );
}

export function AgeHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      Age
    </SortButton>
  );
}

export function ViewsHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      Views
    </SortButton>
  );
}

export function EngagementHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Engagement
          </SortButton>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>Weighted engagements per 1K views</p>
        <p className="text-muted-foreground text-xs mt-1">Comments weighted 5x more than likes</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ViewsPerDayHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      Views/Day
    </SortButton>
  );
}

export function ViewsPerHourHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Views/Hour
          </SortButton>
        </span>
      </TooltipTrigger>
      <TooltipContent>Average views per hour since upload</TooltipContent>
    </Tooltip>
  );
}

export function ViewsPerDurHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Views/Dur
          </SortButton>
        </span>
      </TooltipTrigger>
      <TooltipContent>Views per minute of video duration</TooltipContent>
    </Tooltip>
  );
}

export function LikesHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      Likes
    </SortButton>
  );
}

export function CommentsHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
      Comments
    </SortButton>
  );
}

export function EngPerMinHeader({ column }: Readonly<{ column: ColCtx }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>
          <SortButton sorted={column.getIsSorted()} onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            Eng/Min
          </SortButton>
        </span>
      </TooltipTrigger>
      <TooltipContent>Engagements per minute of video duration</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------
// Cell components
// ---------------------------------------------------------------------------

export function LikedCell({ row }: Readonly<{ row: RowCtx }>) {
  const { accountData } = useChannel();
  if (accountData.isLoading) return <Skeleton className="h-3.5 w-3.5 rounded-full" />;
  const isLiked = accountData.likedVideoIds.has(row.original.videoId);
  const playlists = accountData.playlistMap.get(row.original.videoId);
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-destructive text-destructive" : "text-muted-foreground/20"}`} />
        </TooltipTrigger>
        <TooltipContent>{isLiked ? "You liked this video" : "Not liked"}</TooltipContent>
      </Tooltip>
      {playlists && (
        <Tooltip>
          <TooltipTrigger asChild>
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          </TooltipTrigger>
          <TooltipContent>In your playlists: {playlists.join(", ")}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function TitleCell({ row }: Readonly<{ row: RowCtx }>) {
  const topics = row.original.topics?.filter(Boolean) ?? [];
  return (
    <div className="flex items-center gap-3 min-w-[280px] group/title cursor-pointer hover:shadow-md">
      <div className="relative w-20 aspect-video shrink-0">
        <Image
          src={row.original.thumbnail}
          alt={row.original.title}
          fill
          sizes="80px"
          className="rounded object-cover transition-transform duration-200 group-hover/title:scale-110"
        />
      </div>
      <div className="min-w-0 flex-1">
        <span className="line-clamp-2 group-hover/title:text-primary transition-colors cursor-pointer">
          {row.original.title}
        </span>
        {topics.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {topics.slice(0, 2).map((topic) => (
                  <span
                    key={topic}
                    className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    {topic}
                  </span>
                ))}
                {topics.length > 2 && (
                  <span className="text-[10px] text-muted-foreground/70">
                    +{topics.length - 2}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Topics: {topics.join(", ")}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function ScoreCell({ row }: Readonly<{ row: RowCtx }>) {
  const weights = useWeights();
  const { totalVideos, avgScore, scoreRankById } = useVideoCatalogStats();
  const video = row.original;
  const score = video.score;
  const scoreRank = scoreRankById.get(video.videoId);
  const label = getScoreLabel(score);
  const bgClass = getScoreColorClass(score) + (score >= 80 ? " relative overflow-hidden" : "");
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={`inline-flex flex-col items-center rounded-md px-2 py-1 cursor-help ${bgClass}`} aria-label={`Score: ${score.toFixed(0)} - ${label.label}`}>
          <span className="text-sm font-bold tabular-nums">{score.toFixed(0)}</span>
          <span className="text-[10px] font-medium leading-none">{label.label}</span>
          {score >= 80 && <div className="absolute inset-0 animate-shimmer rounded-md" />}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="min-w-[180px]">
        <p className="font-semibold mb-1.5">Score Breakdown</p>
        {totalVideos > 0 && (
          <div className="mb-2 pb-2 border-b border-border/60 space-y-0.5 text-xs">
            {scoreRank !== undefined && (
              <p className="font-medium tabular-nums">
                #{scoreRank} of {totalVideos}
              </p>
            )}
            <p className="text-muted-foreground tabular-nums">
              {formatSigned(Math.round(video.score - avgScore))} vs channel avg {Math.round(avgScore)}
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          {METRIC_TYPES.map((type) => {
            const config = METRIC_CONFIGS[type];
            const componentKey = METRIC_TO_COMPONENT[type];
            const value = video.scoreComponents[componentKey] ?? 0;
            const weight = getNormalizedWeight(weights, type);
            return (
              <div key={type} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">{config.label} ({weight}%)</span>
                <span className="font-medium tabular-nums">{value.toFixed(0)}</span>
              </div>
            );
          })}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function DurationCell({ row }: Readonly<{ row: RowCtx }>) {
  const { avgDuration } = useVideoCatalogStats();
  const video = row.original;
  const deltaSec = Math.round(video.duration - avgDuration);
  const deltaSign = deltaSec > 0 ? "+" : deltaSec < 0 ? "−" : "";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="tabular-nums font-medium cursor-help">{formatDuration(video.duration)}</span>
      </TooltipTrigger>
      <TooltipContent className="space-y-1">
        <p className="font-medium tabular-nums">{formatExactHMS(video.duration)}</p>
        {avgDuration > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {deltaSign}{formatDuration(Math.abs(deltaSec))} vs channel avg ({formatDuration(Math.round(avgDuration))})
          </p>
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatNumber(video.rates?.viewsPerContentMin ?? 0)} views per minute
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function AgeCell({ row }: Readonly<{ row: RowCtx }>) {
  const video = row.original;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="tabular-nums text-muted-foreground cursor-help">{getAgeLabel(video.days)}</span>
      </TooltipTrigger>
      <TooltipContent className="space-y-1">
        <p className="font-medium">{dayjs(video.publishedAt).format("ddd, MMM D, YYYY • HH:mm")}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {video.days} days ago &middot; {formatNumber(video.rates?.viewsPerDay ?? 0)} views/day
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ViewsCell({ row }: Readonly<{ row: RowCtx }>) {
  const { totalVideos, medianViews, totalViews, viewRankById } = useVideoCatalogStats();
  const video = row.original;
  const viewRank = viewRankById.get(video.videoId);
  const percentile = viewRank && totalVideos > 0
    ? Math.max(1, Math.ceil((viewRank / totalVideos) * 100))
    : null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="tabular-nums font-medium cursor-help">{formatCompact(video.views)}</span>
      </TooltipTrigger>
      <TooltipContent className="space-y-1">
        <p className="font-medium tabular-nums">{video.views.toLocaleString("en-US")} views</p>
        {medianViews > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {(video.views / medianViews).toFixed(1)}× channel median ({formatCompact(medianViews)})
          </p>
        )}
        {viewRank !== undefined && percentile !== null && (
          <p className="text-xs text-muted-foreground tabular-nums">
            Ranked #{viewRank} of {totalVideos} (Top {percentile}%)
          </p>
        )}
        {totalViews > 0 && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {((video.views / totalViews) * 100).toFixed(2)}% of channel&apos;s total views
          </p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function EngagementCell({ row }: Readonly<{ row: RowCtx }>) {
  const rate = row.original.rates?.engagementRate ?? 0;
  const color = getEngagementColor(rate);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col cursor-help">
          <span className={`tabular-nums font-medium ${color}`}>
            {rate.toFixed(1)}<span className="text-xs opacity-70 font-normal">/1K</span>
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatCompact(row.original.likes)} likes &middot; {formatCompact(row.original.comments)} comments
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>Weighted engagements per 1K views</p>
        <p className="text-muted-foreground text-xs mt-1">(likes + comments &times; 5) / views &times; 1000</p>
        <div className="text-muted-foreground text-xs mt-2 space-y-0.5">
          <p>Like rate: {row.original.rates?.likeRate?.toFixed(1) ?? "-"}/1K views</p>
          <p>Comment rate: {row.original.rates?.commentRate?.toFixed(2) ?? "-"}/1K views</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function ViewsPerDayCell({ row }: Readonly<{ row: RowCtx }>) {
  return <span className="tabular-nums">{formatNumber(row.original.rates?.viewsPerDay ?? 0)}</span>;
}

export function ViewsPerHourCell({ row }: Readonly<{ row: RowCtx }>) {
  return <span className="tabular-nums">{formatNumber(Math.round(row.original.rates?.viewsPerHour ?? 0))}</span>;
}

export function ViewsPerDurCell({ row }: Readonly<{ row: RowCtx }>) {
  const vpcm = row.original.rates?.viewsPerContentMin ?? 0;
  const color = getEfficiencyColor(vpcm);
  return <span className={`tabular-nums font-medium ${color}`}>{formatNumber(vpcm)}</span>;
}

export function LikesCell({ row }: Readonly<{ row: RowCtx }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col cursor-help">
          <span className="tabular-nums">{formatCompact(row.original.likes)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.original.rates?.likeRate?.toFixed(1) ?? "-"}<span className="opacity-70">/1K</span>
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{row.original.likes.toLocaleString("en-US")} likes</TooltipContent>
    </Tooltip>
  );
}

export function CommentsCell({ row }: Readonly<{ row: RowCtx }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col cursor-help">
          <span className="tabular-nums">{formatCompact(row.original.comments)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.original.rates?.commentRate?.toFixed(2) ?? "-"}<span className="opacity-70">/1K</span>
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{row.original.comments.toLocaleString("en-US")} comments</TooltipContent>
    </Tooltip>
  );
}

export function EngPerMinCell({ row }: Readonly<{ row: RowCtx }>) {
  return <span className="tabular-nums font-medium">{(row.original.rates?.engagementPerMinute ?? 0).toFixed(1)}</span>;
}

export { METRIC_TO_COMPONENT };
