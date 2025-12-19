"use client";

import { useState, useMemo, useEffect } from "react";
import {
  DataTable,
  SortButton,
  type ColumnDef,
  type FilterFn,
  Button,
  Input,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@data-projects/ui";
import { ExternalLink, SlidersHorizontal, Search, X } from "lucide-react";
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
  
  const { reachScore, engagementScore, consistencyScore, communityScore } = video.scoreComponents;
  
  const score = 
    (reachScore ?? 0) * (weights.views / total) +
    (engagementScore ?? 0) * (weights.engagement / total) +
    (consistencyScore ?? 0) * (weights.consistency / total) +
    (communityScore ?? 0) * (weights.community / total);
  
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
      }}
      className="text-sm"
    />
  );
}

function getEfficiencyColor(viewsPerContentMin: number): string {
  if (viewsPerContentMin >= 100000) return "text-emerald-500";
  if (viewsPerContentMin >= 50000) return "text-green-500";
  if (viewsPerContentMin >= 10000) return "text-yellow-500";
  return "text-muted-foreground";
}

function getAgeLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days >= 365) {
    const years = days / 365;
    return `${years.toFixed(1)}y`;
  }
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

const WEIGHTS_STORAGE_KEY = "youtube-metric-weights";

function loadWeightsFromStorage(): MetricWeights {
  if (typeof window === "undefined") return { ...DEFAULT_WEIGHTS };
  try {
    const stored = localStorage.getItem(WEIGHTS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_WEIGHTS, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_WEIGHTS };
}

function saveWeightsToStorage(weights: MetricWeights): void {
  try {
    localStorage.setItem(WEIGHTS_STORAGE_KEY, JSON.stringify(weights));
  } catch {}
}

const globalFilterFn: FilterFn<VideoData> = (row, _columnId, filterValue: string) => {
  const search = filterValue.toLowerCase();
  const title = row.original.title.toLowerCase();
  return title.includes(search);
};

export function VideosTable({ data }: Readonly<VideosTableProps>) {
  const [weights, setWeights] = useState<MetricWeights>({ ...DEFAULT_WEIGHTS });
  const [isHydrated, setIsHydrated] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    setWeights(loadWeightsFromStorage());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      saveWeightsToStorage(weights);
    }
  }, [weights, isHydrated]);

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
        <span className="tabular-nums font-medium">{formatDuration(row.original.duration)}</span>
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
      id: "viewsPerHour",
      accessorFn: (row) => row.rates?.viewsPerHour ?? 0,
      header: ({ column }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <SortButton
                sorted={column.getIsSorted()}
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              >
                Views/Hour
              </SortButton>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Average views per hour since upload</p>
          </TooltipContent>
        </Tooltip>
      ),
      cell: ({ row }) => {
        const vph = row.original.rates?.viewsPerHour ?? 0;
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="tabular-nums cursor-help">
                {formatNumber(Math.round(vph))}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Average views per hour since upload</p>
              <p className="text-muted-foreground text-xs mt-1">views / days / 24</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "viewsPerContentMin",
      accessorFn: (row) => row.rates?.viewsPerContentMin ?? 0,
      header: ({ column }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <SortButton
                sorted={column.getIsSorted()}
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              >
                Views/Dur
              </SortButton>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Views per minute of video duration</p>
            <p className="text-muted-foreground text-xs mt-1">Min 1 minute for shorts</p>
          </TooltipContent>
        </Tooltip>
      ),
      cell: ({ row }) => {
        const vpcm = row.original.rates?.viewsPerContentMin ?? 0;
        const color = getEfficiencyColor(vpcm);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`tabular-nums font-medium cursor-help ${color}`}>
                {formatNumber(vpcm)}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Views per minute of video duration</p>
              <p className="text-muted-foreground text-xs mt-1">views / max(duration, 1 min)</p>
            </TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      accessorKey: "likes",
      header: ({ column }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <SortButton
                sorted={column.getIsSorted()}
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              >
                Likes
              </SortButton>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total likes and rate per 1K views</p>
          </TooltipContent>
        </Tooltip>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="tabular-nums">{formatNumber(row.original.likes)}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground tabular-nums cursor-help">
                {row.original.rates?.likeRate?.toFixed(1) ?? '-'}<span className="text-xs opacity-70">/1K</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Likes per 1,000 views</p>
            </TooltipContent>
          </Tooltip>
        </div>
      ),
    },
    {
      accessorKey: "comments",
      header: ({ column }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <SortButton
                sorted={column.getIsSorted()}
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              >
                Comments
              </SortButton>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Total comments and rate per 1K views</p>
          </TooltipContent>
        </Tooltip>
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="tabular-nums">{formatNumber(row.original.comments)}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground tabular-nums cursor-help">
                {row.original.rates?.commentRate?.toFixed(2) ?? '-'}<span className="text-xs opacity-70">/1K</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Comments per 1,000 views</p>
            </TooltipContent>
          </Tooltip>
        </div>
      ),
    },
    {
      id: "engagement",
      accessorFn: (row) => row.rates.engagementRate,
      header: ({ column }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <SortButton
                sorted={column.getIsSorted()}
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              >
                Engagement
              </SortButton>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Weighted engagements per 1K views</p>
            <p className="text-muted-foreground text-xs mt-1">Comments weighted 5x more than likes</p>
          </TooltipContent>
        </Tooltip>
      ),
      cell: ({ row }) => {
        const rate = row.original.rates?.engagementRate ?? 0;
        const color = getEngagementColor(rate);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`tabular-nums font-medium cursor-help ${color}`}>
                {rate.toFixed(1)}<span className="text-xs opacity-70 font-normal">/1K</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>Weighted engagements per 1K views</p>
              <p className="text-muted-foreground text-xs mt-1">(likes + comments * 5) / views</p>
              <p className="text-muted-foreground text-xs">Comments weighted 5x more than likes</p>
            </TooltipContent>
          </Tooltip>
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
  const avgViewsPerContentMin = processedData.length > 0
    ? processedData.reduce((sum, v) => sum + (v.rates?.viewsPerContentMin || 0), 0) / processedData.length
    : 0;

  const isDefaultWeights = METRIC_TYPES.every(
    t => weights[t] === DEFAULT_WEIGHTS[t]
  );

  return (
    <div className="flex flex-col h-full gap-3 sm:gap-4">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm flex-shrink-0">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search videos..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="h-7 sm:h-8 pl-8 pr-8 text-xs sm:text-sm bg-muted/50 border-transparent focus:border-border"
          />
          {searchFilter && (
            <button
              onClick={() => setSearchFilter("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 sm:px-3 sm:py-1.5">
          <span className="text-muted-foreground hidden sm:inline">Avg score:</span>
          <span className="text-muted-foreground sm:hidden">Score</span>
          <span className="font-semibold">{avgScore.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2 py-1 sm:px-3 sm:py-1.5">
          <span className="text-muted-foreground hidden sm:inline">Avg engagement:</span>
          <span className="text-muted-foreground sm:hidden">Eng</span>
          <span className="font-semibold">{avgEngagement.toFixed(1)}<span className="text-xs opacity-70 font-normal">/1K</span></span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg bg-muted/50 px-3 py-1.5">
          <span className="text-muted-foreground">Avg views/dur:</span>
          <span className="font-semibold">{formatNumber(Math.round(avgViewsPerContentMin))}</span>
        </div>
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
          /1K = per 1,000 views
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <DataTable
          columns={columns}
          data={processedData}
          defaultSorting={[{ id: "score", desc: true }]}
          globalFilter={searchFilter}
          onGlobalFilterChange={setSearchFilter}
          globalFilterFn={globalFilterFn}
          pagination={{
            pageSize: 25,
            showInfo: true,
            itemName: "videos",
          }}
          emptyMessage={searchFilter ? "No videos match your search." : "No videos found."}
        />
      </div>
    </div>
  );
}
