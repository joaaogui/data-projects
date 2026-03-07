"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  DataTable,
  SortButton,
  type ColumnDef,
  type FilterFn,
  type VisibilityState,
  Button,
  Input,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@data-projects/ui";
import { ExternalLink, SlidersHorizontal, Search, X, Columns3, Check, Download } from "lucide-react";
import type { VideoData } from "@/types/youtube";
import { formatDuration } from "@/lib/scoring";
import { DEFAULT_WEIGHTS, METRIC_TYPES, type MetricWeights } from "./metric-icon";
import { WeightsEditor } from "./weights-editor";
import { QuickFilters, getFilterPredicate, type QuickFilterId } from "./quick-filters";
import { ScoreRing } from "./score-ring";
import { AIQueryPanel } from "./ai-query-chat";
import { VideoDetailPanel } from "./video-detail-panel";
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

function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return formatNumber(num);
}

interface VideosTableProps {
  data: VideoData[];
}

const WEIGHTS_STORAGE_KEY = "youtube-metric-weights";
const COLUMNS_STORAGE_KEY = "youtube-column-visibility";

const DEFAULT_HIDDEN_COLUMNS: VisibilityState = {
  viewsPerDay: false,
  viewsPerHour: false,
  viewsPerContentMin: false,
  likes: false,
  comments: false,
};

const COLUMN_LABELS: Record<string, string> = {
  title: "Title",
  score: "Score",
  duration: "Duration",
  days: "Age",
  views: "Views",
  engagement: "Engagement",
  viewsPerDay: "Views/Day",
  viewsPerHour: "Views/Hour",
  viewsPerContentMin: "Views/Dur",
  likes: "Likes",
  comments: "Comments",
};

const TOGGLEABLE_COLUMNS = [
  "duration", "days", "views", "engagement",
  "viewsPerDay", "viewsPerHour", "viewsPerContentMin",
  "likes", "comments",
];

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

function loadColumnsFromStorage(): VisibilityState {
  if (typeof window === "undefined") return { ...DEFAULT_HIDDEN_COLUMNS };
  try {
    const stored = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { ...DEFAULT_HIDDEN_COLUMNS };
}

function saveColumnsToStorage(visibility: VisibilityState): void {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(visibility));
  } catch {}
}

const globalFilterFn: FilterFn<VideoData> = (row, _columnId, filterValue: string) => {
  const search = filterValue.toLowerCase();
  const title = row.original.title.toLowerCase();
  return title.includes(search);
};

function ColumnVisibilityToggle({
  visibility,
  onChange,
}: Readonly<{
  visibility: VisibilityState;
  onChange: (visibility: VisibilityState) => void;
}>) {
  const hiddenCount = TOGGLEABLE_COLUMNS.filter(id => visibility[id] === false).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2">
          <Columns3 className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">Columns</span>
          {hiddenCount > 0 && (
            <span className="ml-1 text-xs text-muted-foreground">
              ({TOGGLEABLE_COLUMNS.length - hiddenCount}/{TOGGLEABLE_COLUMNS.length})
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1.5">
        <div className="flex flex-col">
          {TOGGLEABLE_COLUMNS.map((id) => {
            const isVisible = visibility[id] !== false;
            return (
              <button
                key={id}
                onClick={() => onChange({ ...visibility, [id]: !isVisible })}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors text-left"
              >
                <span className="w-4 h-4 flex items-center justify-center">
                  {isVisible && <Check className="h-3.5 w-3.5 text-primary" />}
                </span>
                {COLUMN_LABELS[id] ?? id}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function VideosTable({ data }: Readonly<VideosTableProps>) {
  const [weights, setWeights] = useState<MetricWeights>({ ...DEFAULT_WEIGHTS });
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({ ...DEFAULT_HIDDEN_COLUMNS });
  const [isHydrated, setIsHydrated] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<QuickFilterId>>(new Set());
  const [highlightedVideoIds, setHighlightedVideoIds] = useState<Set<string>>(new Set());
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleHighlight = useCallback((ids: Set<string>) => {
    setHighlightedVideoIds(ids);
  }, []);

  useEffect(() => {
    setWeights(loadWeightsFromStorage());
    setColumnVisibility(loadColumnsFromStorage());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      saveWeightsToStorage(weights);
    }
  }, [weights, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      saveColumnsToStorage(columnVisibility);
    }
  }, [columnVisibility, isHydrated]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "Escape") {
        if (selectedVideoId) {
          setSelectedVideoId(null);
        } else if (document.activeElement === searchInputRef.current) {
          searchInputRef.current?.blur();
          setSearchFilter("");
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selectedVideoId]);

  const handleFilterToggle = useCallback((id: QuickFilterId) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (id === "all") {
        return new Set();
      }
      next.delete("all");
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const processedData = useMemo(() => {
    const scored = data.map(video => ({
      ...video,
      score: recalculateScore(video, weights),
    }));

    const predicate = getFilterPredicate(activeFilters);
    return predicate ? scored.filter(predicate) : scored;
  }, [data, weights, activeFilters]);

  const handleExportCsv = useCallback(() => {
    const headers = ["Title", "Score", "Views", "Likes", "Comments", "Duration (s)", "Days Old", "Engagement/1K", "URL"];
    const rows = processedData.map((v) => [
      `"${v.title.replaceAll('"', '""')}"`,
      v.score.toFixed(1),
      v.views,
      v.likes,
      v.comments,
      v.duration,
      v.days,
      v.rates?.engagementRate?.toFixed(1) ?? "",
      v.url,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "youtube-videos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [processedData]);

  const selectedVideo = useMemo(
    () => (selectedVideoId ? processedData.find((v) => v.videoId === selectedVideoId) ?? null : null),
    [selectedVideoId, processedData]
  );

  const columns: ColumnDef<VideoData>[] = useMemo(() => [
    {
      accessorKey: "title",
      header: "Title",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-3 min-w-[280px] group/title">
          <Image
            src={row.original.thumbnail}
            alt={row.original.title}
            width={80}
            height={45}
            className="rounded object-cover flex-shrink-0 transition-transform duration-200 group-hover/title:scale-110"
          />
          <a
            href={row.original.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary hover:underline line-clamp-2 flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.title}
            <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-50" />
          </a>
        </div>
      ),
    },
    {
      accessorKey: "score",
      enableHiding: false,
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Score
        </SortButton>
      ),
      cell: ({ row }) => (
        <ScoreRing
          score={row.original.score}
          scoreComponents={row.original.scoreComponents}
          weights={weights}
        />
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
      },
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
          <span className="tabular-nums">
            {formatNumber(Math.round(vph))}
          </span>
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
          </TooltipContent>
        </Tooltip>
      ),
      cell: ({ row }) => {
        const vpcm = row.original.rates?.viewsPerContentMin ?? 0;
        const color = getEfficiencyColor(vpcm);
        return (
          <span className={`tabular-nums font-medium ${color}`}>
            {formatNumber(vpcm)}
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
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.original.rates?.likeRate?.toFixed(1) ?? '-'}<span className="opacity-70">/1K</span>
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
          <span className="text-xs text-muted-foreground tabular-nums">
            {row.original.rates?.commentRate?.toFixed(2) ?? '-'}<span className="opacity-70">/1K</span>
          </span>
        </div>
      ),
    },
  ], [weights]);

  const isDefaultWeights = METRIC_TYPES.every(
    t => weights[t] === DEFAULT_WEIGHTS[t]
  );

  return (
    <div className="flex flex-col h-full gap-3 sm:gap-4">
      <div className="flex flex-col gap-2 sm:gap-3 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder='Search videos... ( / )'
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
          <div className="flex items-center gap-1 ml-auto">
          <ColumnVisibilityToggle
            visibility={columnVisibility}
            onChange={setColumnVisibility}
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2">
                <SlidersHorizontal className="h-3.5 w-3.5 sm:mr-1.5" />
                <span className="hidden sm:inline">Weights</span>
                {!isDefaultWeights && (
                  <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="p-3">
              <WeightsEditor weights={weights} onChange={setWeights} />
            </PopoverContent>
          </Popover>
          <AIQueryPanel videos={data} onHighlight={handleHighlight} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export as CSV</TooltipContent>
          </Tooltip>
          </div>
        </div>
        <QuickFilters videos={data} activeFilters={activeFilters} onToggle={handleFilterToggle} />
      </div>

      <div className="flex-1 min-h-0 flex gap-0">
        <div className="flex-1 min-w-0">
          <DataTable
            columns={columns}
            data={processedData}
            defaultSorting={[{ id: "score", desc: true }]}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={setColumnVisibility}
            globalFilter={searchFilter}
            onGlobalFilterChange={setSearchFilter}
            globalFilterFn={globalFilterFn}
            pagination={{
              pageSize: 25,
              showInfo: true,
              itemName: "videos",
            }}
            emptyMessage={searchFilter ? "No videos match your search." : "No videos found."}
            rowClassName={(row) => {
              const classes: string[] = ["border-l-2"];
              const score = row.original.score;
              if (score >= 70) classes.push("border-l-emerald-500/60");
              else if (score >= 55) classes.push("border-l-green-500/50");
              else if (score >= 40) classes.push("border-l-yellow-500/40");
              else if (score >= 25) classes.push("border-l-orange-500/30");
              else classes.push("border-l-red-500/20");

              if (selectedVideoId === row.original.videoId) {
                classes.push("bg-primary/10 !border-l-primary");
              }
              if (highlightedVideoIds.size > 0) {
                classes.push(
                  highlightedVideoIds.has(row.original.videoId)
                    ? "ring-1 ring-primary/40 bg-primary/5"
                    : "opacity-40"
                );
              }
              return classes.join(" ");
            }}
            onRowClick={(row) => setSelectedVideoId(
              selectedVideoId === row.original.videoId ? null : row.original.videoId
            )}
          />
        </div>
        {selectedVideo && (
          <VideoDetailPanel
            video={selectedVideo}
            allVideos={processedData}
            weights={weights}
            onClose={() => setSelectedVideoId(null)}
            onSelectVideo={setSelectedVideoId}
          />
        )}
      </div>
    </div>
  );
}
