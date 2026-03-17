"use client";

import { useChannel } from "@/hooks/use-channel-context";
import { formatCompact, formatNumber, getAgeLabel, getEfficiencyColor, getEngagementColor, getScoreColorClass } from "@/lib/format";
import { formatDuration, getScoreLabel } from "@/lib/scoring";
import type { ScoreComponents, VideoData } from "@/types/youtube";
import {
  Skeleton,
  SortButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@data-projects/ui";
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
          <Heart className={`h-3.5 w-3.5 ${isLiked ? "fill-red-500 text-red-500" : "text-muted-foreground/20"}`} />
        </TooltipTrigger>
        <TooltipContent>{isLiked ? "You liked this video" : "Not liked"}</TooltipContent>
      </Tooltip>
      {playlists && (
        <Tooltip>
          <TooltipTrigger asChild>
            <FolderOpen className="h-3.5 w-3.5 text-blue-500" />
          </TooltipTrigger>
          <TooltipContent>In your playlists: {playlists.join(", ")}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function TitleCell({ row }: Readonly<{ row: RowCtx }>) {
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
      <span className="line-clamp-2 group-hover/title:text-primary transition-colors cursor-pointer">
        {row.original.title}
      </span>
    </div>
  );
}

export function ScoreCell({ row }: Readonly<{ row: RowCtx }>) {
  const weights = useWeights();
  const score = row.original.score;
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
      <TooltipContent side="left" className="min-w-[160px]">
        <p className="font-semibold mb-2">Score Breakdown</p>
        <div className="space-y-1.5">
          {METRIC_TYPES.map((type) => {
            const config = METRIC_CONFIGS[type];
            const componentKey = METRIC_TO_COMPONENT[type];
            const value = row.original.scoreComponents[componentKey] ?? 0;
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
  return <span className="tabular-nums font-medium">{formatDuration(row.original.duration)}</span>;
}

export function AgeCell({ row }: Readonly<{ row: RowCtx }>) {
  return <span className="tabular-nums text-muted-foreground">{getAgeLabel(row.original.days)}</span>;
}

export function ViewsCell({ row }: Readonly<{ row: RowCtx }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="tabular-nums font-medium cursor-help">{formatCompact(row.original.views)}</span>
      </TooltipTrigger>
      <TooltipContent>{row.original.views.toLocaleString("en-US")} views</TooltipContent>
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
