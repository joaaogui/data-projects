"use client";

import { useChannel } from "@/hooks/use-channel-context";
import { formatCompact, getAgeLabel, getScoreBorderClass, getScoreColorClass } from "@/lib/format";
import { recalculateWithWeights } from "@/lib/scoring";
import type { VideoData } from "@/types/youtube";
import {
  Button,
  DataTable,
  type ColumnDef,
  type FilterFn,
  type VisibilityState,
} from "@data-projects/ui";
import { X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MetricWeights } from "../metric-icon";
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
import {
  AgeCell,
  AgeHeader,
  CommentsCell,
  CommentsHeader,
  DurationCell,
  DurationHeader,
  EngPerMinCell,
  EngPerMinHeader,
  EngagementCell,
  EngagementHeader,
  LikedCell,
  LikedHeader,
  LikesCell,
  LikesHeader,
  ScoreCell,
  ScoreHeader,
  TitleCell,
  ViewsCell,
  ViewsHeader,
  ViewsPerDayCell,
  ViewsPerDayHeader,
  ViewsPerDurCell,
  ViewsPerDurHeader,
  ViewsPerHourCell,
  ViewsPerHourHeader,
  WeightsProvider,
} from "./video-column-cells";

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

  let highlightClass = '';
  if (hasHighlights) {
    highlightClass = isHighlighted
      ? "ring-1 ring-primary/30 bg-primary/5 shadow-sm shadow-primary/10"
      : "opacity-40";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 rounded-xl border p-2.5 transition-all duration-150 border-l-2 ${borderClass} ${isSelected
        ? "bg-primary/8 border-l-primary! border-l-[3px] shadow-sm"
        : "border-border/30 hover:bg-muted/30"
        } ${highlightClass}`}
    >
      <div className="relative w-24 aspect-video shrink-0">
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
      <div className="flex items-center gap-1.5 text-xs shrink-0">
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
    if (globalThis.window === undefined) return;
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

  const exportCsvRef = useRef(handleExportCsv);
  exportCsvRef.current = handleExportCsv;

  useEffect(() => {
    const onExport = () => exportCsvRef.current();
    const onFocusSearch = () => searchInputRef.current?.focus();
    const onSelectVideo = (e: Event) => {
      const videoId = (e as CustomEvent<string>).detail;
      if (videoId) setSelectedVideoId(videoId);
    };
    document.addEventListener("export-csv", onExport);
    document.addEventListener("focus-search", onFocusSearch);
    document.addEventListener("select-video", onSelectVideo);
    return () => {
      document.removeEventListener("export-csv", onExport);
      document.removeEventListener("focus-search", onFocusSearch);
      document.removeEventListener("select-video", onSelectVideo);
    };
  }, []);

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
      header: LikedHeader,
      enableHiding: false,
      size: 40,
      cell: LikedCell,
    } satisfies ColumnDef<VideoData>,
    { accessorKey: "title", header: "Title", enableHiding: false, cell: TitleCell },
    { accessorKey: "score", enableHiding: false, header: ScoreHeader, cell: ScoreCell },
    { accessorKey: "duration", header: DurationHeader, cell: DurationCell },
    { accessorKey: "days", header: AgeHeader, cell: AgeCell },
    { accessorKey: "views", header: ViewsHeader, cell: ViewsCell },
    { id: "engagement", accessorFn: (row) => row.rates.engagementRate, header: EngagementHeader, cell: EngagementCell },
    { id: "viewsPerDay", accessorFn: (row) => row.rates?.viewsPerDay ?? 0, header: ViewsPerDayHeader, cell: ViewsPerDayCell },
    { id: "viewsPerHour", accessorFn: (row) => row.rates?.viewsPerHour ?? 0, header: ViewsPerHourHeader, cell: ViewsPerHourCell },
    { id: "viewsPerContentMin", accessorFn: (row) => row.rates?.viewsPerContentMin ?? 0, header: ViewsPerDurHeader, cell: ViewsPerDurCell },
    { accessorKey: "likes", header: LikesHeader, cell: LikesCell },
    { accessorKey: "comments", header: CommentsHeader, cell: CommentsCell },
    { id: "engPerMin", accessorFn: (row) => row.rates?.engagementPerMinute ?? 0, header: EngPerMinHeader, cell: EngPerMinCell },
  ], [accountData]);

  return (
    <div className="flex flex-col h-full gap-3 sm:gap-4">
      {showOnboarding && (
        <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm shrink-0 animate-fade-down">
          <span className="flex-1 text-muted-foreground">
            <strong className="text-foreground">Scores rank each video relative to the channel.</strong> Higher score = outperforms peers in views, engagement, and momentum.
          </span>
          <Button variant="ghost" size="sm" onClick={dismissOnboarding} className="h-7 w-7 p-0 shrink-0">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2 sm:gap-3 shrink-0">
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
        <div className="animate-fade-up" style={{ animationDelay: '50ms' }}>
          <QuickFilters videos={data} activeFilters={activeFilters} onToggle={handleFilterToggle} />
        </div>
      </div>

      <WeightsProvider value={weights}>
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
                let color = "hsl(240 4% 30% / 0.15)";
                if (score >= 80) color = "hsl(160 50% 50% / 0.3)";
                else if (score >= 40) color = "hsl(172 48% 45% / 0.2)";
                return { "--row-score-color": color } as React.CSSProperties;
              }}
              rowClassName={(row) => {
                const classes: string[] = ["border-l-2 hover:border-l-[3px]", "transition-all duration-150", "hover:bg-muted/30", "row-score-glow"];
                const score = row.original.score;
                classes.push(getScoreBorderClass(score));

                if (selectedVideoId === row.original.videoId) {
                  classes.push("bg-primary/8 border-l-primary! border-l-[3px] shadow-sm");
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
      </WeightsProvider>
      {selectedVideo && createPortal(
        <VideoDetailPanel
          video={selectedVideo}
          allVideos={processedData}
          weights={weights}
          onClose={() => setSelectedVideoId(null)}
          onSelectVideo={setSelectedVideoId}
          onOpenTimeline={onOpenTimeline}
        />,
        document.body
      )}
    </div>
  );
}
