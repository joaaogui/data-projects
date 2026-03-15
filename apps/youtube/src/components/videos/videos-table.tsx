"use client";

import { useChannel } from "@/hooks/use-channel-context";
import { formatCompact, formatNumber, getAgeLabel, getEfficiencyColor, getEngagementColor, getScoreBorderClass, getScoreColorClass } from "@/lib/format";
import { formatDuration, getScoreLabel, recalculateWithWeights } from "@/lib/scoring";
import type { ScoreComponents, VideoData } from "@/types/youtube";
import {
  Button,
  DataTable,
  Skeleton,
  SortButton,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type ColumnDef,
  type FilterFn,
  type VisibilityState,
} from "@data-projects/ui";
import { FolderOpen, Heart, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { METRIC_CONFIGS, METRIC_TYPES, getNormalizedWeight, type MetricWeights } from "../metric-icon";
import { QuickFilters, getFilterPredicate, type QuickFilterId } from "../quick-filters";
import { VideoDetailPanel } from "../video-detail-panel";
import {
  ESSENTIAL_COLUMNS,
  FilterBar,
  loadColumnsFromStorage,
  loadTableModeFromStorage,
  loadWeightsFromStorage,
  saveColumnsToStorage,
  saveTableModeToStorage,
  saveWeightsToStorage,
  type TableMode,
} from "./filter-bar";

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = globalThis.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

function recalculateScore(video: VideoData, weights: MetricWeights): number {
  if (!video.scoreComponents) return video.score;
  return recalculateWithWeights(video.scoreComponents, weights);
}

type MobileSortField = "score" | "views" | "days" | "engagement";

function VideoCard({
  video,
  isSelected,
  isHighlighted,
  hasHighlights,
  onClick,
}: Readonly<{
  video: VideoData;
  isSelected: boolean;
  isHighlighted: boolean;
  hasHighlights: boolean;
  onClick: () => void;
}>) {
  const score = video.score;
  const bgClass = getScoreColorClass(score);
  const borderClass = getScoreBorderClass(score);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 rounded-xl border p-2.5 transition-all duration-150 border-l-2 ${borderClass} ${isSelected
        ? "bg-primary/8 !border-l-primary border-l-[3px] shadow-sm"
        : "border-border/30 hover:bg-muted/30"
        } ${hasHighlights
          ? isHighlighted
            ? "ring-1 ring-primary/30 bg-primary/5 shadow-sm shadow-primary/10"
            : "opacity-40"
          : ""
        }`}
    >
      <div className="relative w-24 aspect-video flex-shrink-0">
        <Image
          src={video.thumbnail}
          alt={video.title}
          fill
          sizes="96px"
          className="rounded-lg object-cover"
        />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <p className="text-sm font-medium line-clamp-2 leading-snug">{video.title}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${bgClass}`}>
            {score.toFixed(0)}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">{formatCompact(video.views)} views</span>
          <span className="text-xs text-muted-foreground tabular-nums">{getAgeLabel(video.days)}</span>
        </div>
      </div>
    </button>
  );
}

function MobileVideoList({
  data,
  searchFilter,
  highlightedVideoIds,
  selectedVideoId,
  onSelectVideo,
}: Readonly<{
  data: VideoData[];
  searchFilter: string;
  highlightedVideoIds: Set<string>;
  selectedVideoId: string | null;
  onSelectVideo: (id: string | null) => void;
}>) {
  const [sortField, setSortField] = useState<MobileSortField>("score");
  const [sortDesc, setSortDesc] = useState(true);
  const [visibleCount, setVisibleCount] = useState(25);

  const filteredData = useMemo(() => {
    if (!searchFilter) return data;
    const q = searchFilter.toLowerCase();
    return data.filter((v) => v.title.toLowerCase().includes(q));
  }, [data, searchFilter]);

  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "score": cmp = a.score - b.score; break;
        case "views": cmp = a.views - b.views; break;
        case "days": cmp = a.days - b.days; break;
        case "engagement": cmp = (a.rates?.engagementRate ?? 0) - (b.rates?.engagementRate ?? 0); break;
      }
      return sortDesc ? -cmp : cmp;
    });
  }, [filteredData, sortField, sortDesc]);

  const visibleData = sortedData.slice(0, visibleCount);
  const hasMore = visibleCount < sortedData.length;
  const visibleHighlightCount = filteredData.filter((v) => highlightedVideoIds.has(v.videoId)).length;

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
        <span className="text-muted-foreground mr-0.5">Sort</span>
        {([
          { field: "score" as const, label: "Score" },
          { field: "views" as const, label: "Views" },
          { field: "days" as const, label: "Age" },
          { field: "engagement" as const, label: "Eng." },
        ]).map(({ field, label }) => {
          const isCurrent = sortField === field;
          return (
            <button
              key={field}
              onClick={() => {
                if (isCurrent) setSortDesc((d) => !d);
                else { setSortField(field); setSortDesc(true); }
              }}
              className={`px-2 py-1 rounded-md font-medium transition-colors ${isCurrent ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
            >
              {label}{isCurrent && (sortDesc ? " \u2193" : " \u2191")}
            </button>
          );
        })}
        <span className="ml-auto text-muted-foreground tabular-nums">
          {filteredData.length}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {visibleData.map((video) => (
          <VideoCard
            key={video.videoId}
            video={video}
            isSelected={selectedVideoId === video.videoId}
            isHighlighted={highlightedVideoIds.has(video.videoId)}
            hasHighlights={highlightedVideoIds.size > 0 && visibleHighlightCount > 0}
            onClick={() => onSelectVideo(selectedVideoId === video.videoId ? null : video.videoId)}
          />
        ))}
        {visibleData.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {searchFilter ? "No videos match your search." : "No videos found."}
          </p>
        )}
        {hasMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVisibleCount((c) => c + 25)}
            className="w-full mt-1"
          >
            Show more ({sortedData.length - visibleCount} remaining)
          </Button>
        )}
      </div>
    </div>
  );
}

const METRIC_TO_COMPONENT: Record<string, keyof ScoreComponents> = {
  views: "reachScore",
  engagement: "engagementScore",
  momentum: "momentumScore",
  efficiency: "efficiencyScore",
  community: "communityScore",
};

interface VideosTableProps {
  data: VideoData[];
  onOpenTimeline?: (videoId: string) => void;
}

const globalFilterFn: FilterFn<VideoData> = (row, _columnId, filterValue: string) => {
  const search = filterValue.toLowerCase();
  const title = row.original.title.toLowerCase();
  return title.includes(search);
};

export function VideosTable({ data, onOpenTimeline }: Readonly<VideosTableProps>) {
  const { accountData } = useChannel();
  const isMobile = useIsMobile();
  const [weights, setWeights] = useState<MetricWeights>(() => loadWeightsFromStorage());
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => loadColumnsFromStorage());
  const [tableMode, setTableMode] = useState<TableMode>(() => loadTableModeFromStorage());
  const [isHydrated, setIsHydrated] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem("youtube-onboarding-dismissed");
    if (!dismissed) setShowOnboarding(true);
  }, []);

  const dismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem("youtube-onboarding-dismissed", "true");
  }, []);

  const [searchFilter, setSearchFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<QuickFilterId>>(new Set());
  const [highlightedVideoIds, setHighlightedVideoIds] = useState<Set<string>>(new Set());
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const firstInteractionFired = useRef(false);
  const mountTime = useRef(performance.now());

  const fireFirstInteraction = useCallback((action: string) => {
    if (firstInteractionFired.current) return;
    firstInteractionFired.current = true;
    import("@/lib/analytics").then(({ capture: c }) =>
      c("first_meaningful_interaction", {
        action,
        timeFromPageLoadMs: Math.round(performance.now() - mountTime.current),
      })
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchFilter(searchInput), 150);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleHighlight = useCallback((ids: Set<string>) => {
    setHighlightedVideoIds(ids);
  }, []);

  useEffect(() => {
    setWeights(loadWeightsFromStorage());
    setColumnVisibility(loadColumnsFromStorage());
    setTableMode(loadTableModeFromStorage());
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

  const handleTableModeChange = useCallback((mode: TableMode) => {
    setTableMode(mode);
    saveTableModeToStorage(mode);
  }, []);

  const effectiveColumnVisibility = useMemo(
    () => tableMode === "essential" ? { ...columnVisibility, ...ESSENTIAL_COLUMNS } : columnVisibility,
    [tableMode, columnVisibility]
  );

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
          setSearchInput("");
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
    const headers = [
      "Title", "Published", "Score",
      "Reach", "Engagement", "Momentum", "Efficiency", "Community",
      "Views", "Likes", "Comments", "Favorites",
      "Duration (s)", "Days Old",
      "Engagement/1K", "Eng/Min",
      "URL",
    ];
    const rows = processedData.map((v) => [
      `"${v.title.replaceAll('"', '""')}"`,
      v.publishedAt.slice(0, 10),
      v.score.toFixed(1),
      v.scoreComponents.reachScore.toFixed(0),
      v.scoreComponents.engagementScore.toFixed(0),
      v.scoreComponents.momentumScore.toFixed(0),
      v.scoreComponents.efficiencyScore.toFixed(0),
      v.scoreComponents.communityScore.toFixed(0),
      v.views,
      v.likes,
      v.comments,
      v.favorites,
      v.duration,
      v.days,
      v.rates?.engagementRate?.toFixed(1) ?? "",
      v.rates?.engagementPerMinute?.toFixed(1) ?? "",
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

  const visibleHighlightCount = useMemo(
    () => processedData.filter((v) => highlightedVideoIds.has(v.videoId)).length,
    [processedData, highlightedVideoIds]
  );

  const selectedVideo = useMemo(
    () => (selectedVideoId ? processedData.find((v) => v.videoId === selectedVideoId) ?? null : null),
    [selectedVideoId, processedData]
  );

  const columns: ColumnDef<VideoData>[] = useMemo(() => [
    {
      id: "liked",
      accessorFn: (row) => {
        const liked = accountData.likedVideoIds.has(row.videoId) ? 2 : 0;
        const inPlaylist = accountData.playlistMap.has(row.videoId) ? 1 : 0;
        return liked + inPlaylist;
      },
      header: ({ column }) => (
        <SortButton
          sorted={column.getIsSorted()}
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          <Heart className="h-3.5 w-3.5" />
        </SortButton>
      ),
      enableHiding: false,
      size: 40,
      cell: ({ row }: { row: { original: VideoData } }) => {
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
      },
    } satisfies ColumnDef<VideoData>,
    {
      accessorKey: "title",
      header: "Title",
      enableHiding: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-3 min-w-[280px] group/title cursor-pointer hover:shadow-md">
          <div className="relative w-20 aspect-video flex-shrink-0">
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
      cell: ({ row }) => {
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
      },
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
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="tabular-nums font-medium cursor-help">{formatCompact(row.original.views)}</span>
          </TooltipTrigger>
          <TooltipContent>{row.original.views.toLocaleString("en-US")} views</TooltipContent>
        </Tooltip>
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
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col cursor-help">
              <span className="tabular-nums">{formatCompact(row.original.likes)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {row.original.rates?.likeRate?.toFixed(1) ?? '-'}<span className="opacity-70">/1K</span>
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>{row.original.likes.toLocaleString("en-US")} likes</TooltipContent>
        </Tooltip>
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
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col cursor-help">
              <span className="tabular-nums">{formatCompact(row.original.comments)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {row.original.rates?.commentRate?.toFixed(2) ?? '-'}<span className="opacity-70">/1K</span>
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent>{row.original.comments.toLocaleString("en-US")} comments</TooltipContent>
        </Tooltip>
      ),
    },
    {
      id: "engPerMin",
      accessorFn: (row) => row.rates?.engagementPerMinute ?? 0,
      header: ({ column }) => (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <SortButton
                sorted={column.getIsSorted()}
                onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
              >
                Eng/Min
              </SortButton>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>Engagements per minute of video duration</p>
          </TooltipContent>
        </Tooltip>
      ),
      cell: ({ row }) => {
        const epm = row.original.rates?.engagementPerMinute ?? 0;
        return (
          <span className="tabular-nums font-medium">
            {epm.toFixed(1)}
          </span>
        );
      },
    },
  ], [weights, accountData]);

  return (
    <div className="flex flex-col h-full gap-3 sm:gap-4">
      {showOnboarding && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm flex-shrink-0 animate-fade-down">
          <span className="flex-1 text-muted-foreground">
            <strong className="text-foreground">Scores rank each video relative to the channel.</strong> Higher score = outperforms peers in views, engagement, and momentum.
          </span>
          <Button variant="ghost" size="sm" onClick={dismissOnboarding} className="h-7 w-7 p-0 shrink-0">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:gap-3 flex-shrink-0">
        <FilterBar
          searchInput={searchInput}
          onSearchInputChange={setSearchInput}
          searchInputRef={searchInputRef}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          weights={weights}
          onWeightsChange={setWeights}
          processedData={processedData}
          onHighlight={handleHighlight}
          onExportCsv={handleExportCsv}
          tableMode={tableMode}
          onTableModeChange={handleTableModeChange}
        />
        {(tableMode === "full" || activeFilters.size > 0) && (
          <div className="animate-fade-up" style={{ animationDelay: '50ms' }}>
            <QuickFilters videos={data} activeFilters={activeFilters} onToggle={handleFilterToggle} />
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {isMobile ? (
          <MobileVideoList
            data={processedData}
            searchFilter={searchFilter}
            highlightedVideoIds={highlightedVideoIds}
            selectedVideoId={selectedVideoId}
            onSelectVideo={(id) => {
              if (id) fireFirstInteraction('video_click');
              setSelectedVideoId(id);
            }}
          />
        ) : (
          <DataTable
            columns={columns}
            data={processedData}
            defaultSorting={[{ id: "score", desc: true }]}
            columnVisibility={effectiveColumnVisibility}
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
            rowStyle={(row) => {
              const score = row.original.score;
              const color = score >= 80
                ? "hsl(160 50% 50% / 0.3)"
                : score >= 40
                  ? "hsl(172 48% 45% / 0.2)"
                  : "hsl(240 4% 30% / 0.15)";
              return { "--row-score-color": color } as React.CSSProperties;
            }}
            rowClassName={(row) => {
              const classes: string[] = ["border-l-2 hover:border-l-[3px]", "transition-all duration-150", "hover:bg-muted/30", "row-score-glow"];
              const score = row.original.score;
              classes.push(getScoreBorderClass(score));

              if (selectedVideoId === row.original.videoId) {
                classes.push("bg-primary/8 !border-l-primary border-l-[3px] shadow-sm");
              }
              if (highlightedVideoIds.size > 0 && visibleHighlightCount > 0) {
                classes.push(
                  highlightedVideoIds.has(row.original.videoId)
                    ? "ring-1 ring-primary/30 bg-primary/5 shadow-sm shadow-primary/10"
                    : "opacity-40 transition-opacity duration-300"
                );
              }
              return classes.join(" ");
            }}
            onRowClick={(row) => {
              const id = selectedVideoId === row.original.videoId ? null : row.original.videoId;
              if (id) fireFirstInteraction('video_click');
              setSelectedVideoId(id);
            }}
          />
        )}
      </div>
      {selectedVideo && (
        <VideoDetailPanel
          video={selectedVideo}
          allVideos={processedData}
          weights={weights}
          onClose={() => setSelectedVideoId(null)}
          onSelectVideo={setSelectedVideoId}
          onOpenTimeline={onOpenTimeline}
        />
      )}
    </div>
  );
}
