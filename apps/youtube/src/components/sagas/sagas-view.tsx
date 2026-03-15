"use client";

import { SyncLogPanel } from "@/components/sync-log-panel";
import { useChannelSagas, type AnalysisProgress } from "@/hooks/use-channel-sagas";
import { useSagaStorage } from "@/hooks/use-saga-storage";
import { formatDuration } from "@/lib/scoring";
import type { Saga, SyncLogEntry, VideoData } from "@/types/youtube";
import { Button, Skeleton } from "@data-projects/ui";
import dayjs from "dayjs";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  Film,
  FolderInput,
  List,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
  Terminal,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { SagaCard, SagaCardSkeleton } from "./saga-card";
import { SagaDetailView } from "./saga-detail-view";
import { UncategorizedSection } from "./uncategorized-section";

interface SagasViewProps {
  channelId: string;
  videos: VideoData[];
}

type GridItem =
  | { type: "saga"; saga: Saga }
  | { type: "gap"; videos: VideoData[]; leftSaga: Saga | null; rightSaga: Saga | null };

function buildGridItems(
  sortedSagas: Saga[],
  uncategorizedVideoIds: string[],
  allVideos: VideoData[],
): GridItem[] {
  if (sortedSagas.length === 0) return [];
  if (uncategorizedVideoIds.length === 0) {
    return sortedSagas.map((saga) => ({ type: "saga" as const, saga }));
  }

  const uncatSet = new Set(uncategorizedVideoIds);
  const uncatVideos = allVideos
    .filter((v) => uncatSet.has(v.videoId))
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  const items: GridItem[] = [];

  const beforeFirst = uncatVideos.filter(
    (v) => v.publishedAt < sortedSagas[0].dateRange.first
  );
  if (beforeFirst.length > 0) {
    items.push({ type: "gap", videos: beforeFirst, leftSaga: null, rightSaga: sortedSagas[0] });
  }

  for (let i = 0; i < sortedSagas.length; i++) {
    items.push({ type: "saga", saga: sortedSagas[i] });

    const current = sortedSagas[i];
    const next = sortedSagas[i + 1] ?? null;

    const gapStart = current.dateRange.last;
    const gapEnd = next ? next.dateRange.first : "\uffff";

    const gapVideos = uncatVideos.filter(
      (v) => v.publishedAt >= gapStart && v.publishedAt <= gapEnd
    );

    if (gapVideos.length > 0) {
      items.push({ type: "gap", videos: gapVideos, leftSaga: current, rightSaga: next });
    }
  }

  return items;
}

function ProgressBar({ progress, logs }: Readonly<{ progress: AnalysisProgress; logs: SyncLogEntry[] }>) {
  const [showLogs, setShowLogs] = useState(false);

  if (progress.phase !== "analyzing") return null;

  const pct = progress.totalBatches > 0
    ? Math.min(100, (progress.currentBatch / progress.totalBatches) * 100)
    : 0;

  return (
    <div className="shrink-0">
      <div className={`${showLogs ? "rounded-t-2xl" : "rounded-2xl"} border border-border/50 bg-card p-3 space-y-2`}>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Analyzing stories... Batch {progress.currentBatch} of {progress.totalBatches}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-medium tabular-nums">
              {Math.round(pct)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
              onClick={() => setShowLogs((v) => !v)}
              aria-expanded={showLogs}
              aria-label="Toggle sync logs"
            >
              <Terminal className="h-3 w-3 mr-1" />
              <span className="text-xs">Logs</span>
              {showLogs ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
            </Button>
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 animate-progress-stripe"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      {showLogs && <SyncLogPanel logs={logs} isActive={true} />}
    </div>
  );
}

function GapCard({
  videos,
  leftSaga,
  rightSaga,
  channelId,
}: Readonly<{
  videos: VideoData[];
  leftSaga: Saga | null;
  rightSaga: Saga | null;
  channelId: string;
}>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { assignVideos } = useSagaStorage(channelId);

  const dateRange = useMemo(() => {
    const dates = videos.map((v) => v.publishedAt).sort((a, b) => a.localeCompare(b));
    const first = dayjs(dates[0]).format("MMM YYYY");
    const last = dayjs(dates.at(-1)).format("MMM YYYY");
    return first === last ? first : `${first} – ${last}`;
  }, [videos]);

  const handleAssign = useCallback(
    async (
      sagaId: string,
      videoId: string,
      neighborContext: { leftSaga?: { id: string; name: string }; rightSaga?: { id: string; name: string } },
    ) => {
      setIsSubmitting(true);
      try {
        await assignVideos(sagaId, [videoId], neighborContext);
      } finally {
        setIsSubmitting(false);
      }
    },
    [assignVideos]
  );

  const ctx = useMemo(() => ({
    ...(leftSaga && { leftSaga: { id: leftSaga.id, name: leftSaga.name } }),
    ...(rightSaga && { rightSaga: { id: rightSaga.id, name: rightSaga.name } }),
  }), [leftSaga, rightSaga]);

  return (
    <div className="rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/20 p-4 space-y-2">
      <h3 className="text-xs font-semibold flex items-center gap-1.5">
        <FolderInput className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="tabular-nums">{videos.length}</span> uncategorized
        <span className="font-normal text-muted-foreground">({dateRange})</span>
      </h3>

      <div className="space-y-0.5 max-h-[280px] overflow-y-auto">
        {videos.map((video) => (
          <div key={video.videoId} className="flex items-center gap-3 py-1.5">
            {leftSaga && (
              <button
                disabled={isSubmitting}
                onClick={() => handleAssign(leftSaga.id, video.videoId, ctx)}
                className="shrink-0 h-6 w-6 rounded-md border border-border/50 bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors flex items-center justify-center disabled:opacity-50"
                title={`Add to "${leftSaga.name}"`}
                aria-label={`Add to ${leftSaga.name}`}
              >
                <ChevronUp className="h-3.5 w-3.5 -rotate-90" />
              </button>
            )}

            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="relative shrink-0 w-[80px] aspect-video">
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  fill
                  sizes="80px"
                  className="rounded object-cover"
                />
                <span className="absolute bottom-0 right-0 bg-black/80 text-white text-[8px] px-0.5 rounded tabular-nums">
                  {formatDuration(video.duration)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium leading-snug line-clamp-1">{video.title}</p>
                <p className="text-[10px] text-muted-foreground">{dayjs(video.publishedAt).format("MMM D, YYYY")}</p>
              </div>
            </div>

            {rightSaga && (
              <button
                disabled={isSubmitting}
                onClick={() => handleAssign(rightSaga.id, video.videoId, ctx)}
                className="shrink-0 h-6 w-6 rounded-md border border-border/50 bg-card hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors flex items-center justify-center disabled:opacity-50"
                title={`Add to "${rightSaga.name}"`}
                aria-label={`Add to ${rightSaga.name}`}
              >
                <ChevronUp className="h-3.5 w-3.5 rotate-90" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SagasView({ channelId, videos }: Readonly<SagasViewProps>) {
  const {
    sagas,
    uncategorizedVideoIds,
    isLoadingSagas,
    progress,
    sagaLogs,
    startAnalysis,
    resetAndReanalyze,
    startIncrementalAnalysis,
    stopAnalysis,
  } = useChannelSagas(channelId, videos);

  const [selectedSaga, setSelectedSaga] = useState<Saga | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "views" | "runtime" | "videos">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const isActive = progress.phase === "analyzing";
  const hasResults = sagas.some((s) => s.source === "ai-detected");
  const hasUncategorized = uncategorizedVideoIds.length > 0;
  const displaySagas = sagas;

  const sagaStats = useMemo(() => {
    const videoMap = new Map(videos.map((v) => [v.videoId, v]));
    const stats = new Map<string, { totalViews: number; totalRuntime: number }>();
    for (const saga of displaySagas) {
      let totalViews = 0;
      let totalRuntime = 0;
      for (const id of saga.videoIds) {
        const v = videoMap.get(id);
        if (v) {
          totalViews += v.views;
          totalRuntime += v.duration;
        }
      }
      stats.set(saga.id, { totalViews, totalRuntime });
    }
    return stats;
  }, [displaySagas, videos]);

  const sortedSagas = useMemo(() => {
    if (displaySagas.length <= 1) return displaySagas;
    return [...displaySagas].sort((a, b) => {
      let cmp = 0;
      switch (sortBy) {
        case "views":
          cmp = (sagaStats.get(a.id)?.totalViews ?? 0) - (sagaStats.get(b.id)?.totalViews ?? 0);
          break;
        case "runtime":
          cmp = (sagaStats.get(a.id)?.totalRuntime ?? 0) - (sagaStats.get(b.id)?.totalRuntime ?? 0);
          break;
        case "videos":
          cmp = a.videoCount - b.videoCount;
          break;
        case "date":
        default:
          cmp = a.dateRange.first.localeCompare(b.dateRange.first);
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [displaySagas, sortBy, sortDir, sagaStats]);

  const gridItems = useMemo(() => {
    if (sortBy !== "date" || !hasUncategorized) {
      return sortedSagas.map((saga): GridItem => ({ type: "saga", saga }));
    }
    return buildGridItems(sortedSagas, uncategorizedVideoIds, videos);
  }, [sortedSagas, sortBy, hasUncategorized, uncategorizedVideoIds, videos]);

  if (selectedSaga) {
    return (
      <SagaDetailView
        saga={selectedSaga}
        videos={videos}
        onBack={() => setSelectedSaga(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <List className="h-4 w-4" />
          {isLoadingSagas ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <span>
              <span className="font-medium text-foreground tabular-nums">{displaySagas.length}</span>{" "}
              {displaySagas.length === 1 ? "saga" : "sagas"} found
              {uncategorizedVideoIds.length > 0 && (
                <span>
                  {" "}&middot; <span className="tabular-nums">{uncategorizedVideoIds.length}</span> uncategorized
                </span>
              )}
            </span>
          )}
        </div>

        {isLoadingSagas ? (
          <Skeleton className="h-8 w-32 rounded-md" />
        ) : (
          <div className="flex items-center gap-2">
            {isActive && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={stopAnalysis}
              >
                <Square className="h-3 w-3 mr-1.5" />
                Stop
              </Button>
            )}
            {hasResults && hasUncategorized && !isActive && (
              <Button
                variant="default"
                size="sm"
                className="h-8"
                onClick={startIncrementalAnalysis}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1.5 hover:rotate-12 transition-transform duration-200" />
                Analyze Uncategorized ({uncategorizedVideoIds.length})
              </Button>
            )}
            <Button
              variant={hasResults ? "outline" : "default"}
              size="sm"
              className="h-8"
              disabled={isActive}
              onClick={startAnalysis}
            >
              {isActive ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1.5 hover:rotate-12 transition-transform duration-200" />
              )}
              {isActive && "Analyzing..."}
              {!isActive && hasResults && "Refresh Analysis"}
              {!isActive && !hasResults && "Analyze Stories"}
            </Button>
            {hasResults && !isActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-muted-foreground"
                onClick={() => setShowResetConfirm(true)}
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                Reset
              </Button>
            )}
          </div>
        )}
      </div>

      <ProgressBar progress={progress} logs={sagaLogs} />

      {progress.phase === "error" && progress.error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {progress.error}
        </div>
      )}

      {isLoadingSagas && (
        <>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-4 w-8" />
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-7 w-16 rounded-md" />
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }, (_, i) => (
              <SagaCardSkeleton key={i} />
            ))}
          </div>
        </>
      )}

      {displaySagas.length === 0 && !isLoadingSagas && !isActive && progress.phase !== "done" && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="rounded-full bg-muted p-4">
            <List className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">No sagas found yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Click &quot;Analyze Stories&quot; to transcribe videos and identify story arcs using AI.
            </p>
          </div>
        </div>
      )}

      {gridItems.length > 0 && (
        <>
          {displaySagas.length > 1 && (
            <fieldset className="flex items-center gap-1.5 border-0 p-0 m-0" aria-label="Sort options">
              <span className="text-xs text-muted-foreground mr-0.5">Sort</span>
              {([
                { field: "date", label: "Date", icon: Calendar },
                { field: "views", label: "Views", icon: Eye },
                { field: "runtime", label: "Runtime", icon: Clock },
                { field: "videos", label: "Videos", icon: Film },
              ] as const).map(({ field, label, icon: Icon }) => {
                const isCurrent = sortBy === field;
                return (
                  <button
                    key={field}
                    aria-pressed={isCurrent}
                    onClick={() => {
                      if (isCurrent) {
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      } else {
                        setSortBy(field);
                        setSortDir(field === "date" ? "asc" : "desc");
                      }
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${isCurrent
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                    {isCurrent && (
                      sortDir === "desc"
                        ? <ArrowDown className="h-3 w-3" />
                        : <ArrowUp className="h-3 w-3" />
                    )}
                  </button>
                );
              })}
            </fieldset>
          )}
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 transition-opacity duration-300 ${isLoadingSagas ? "opacity-50" : ""}`}>
            {gridItems.map((item) =>
              item.type === "saga" ? (
                <SagaCard
                  key={item.saga.id}
                  saga={item.saga}
                  videos={videos}
                  onClick={() => setSelectedSaga(item.saga)}
                />
              ) : (
                <GapCard
                  key={`gap-${item.leftSaga?.id ?? "start"}-${item.rightSaga?.id ?? "end"}`}
                  videos={item.videos}
                  leftSaga={item.leftSaga}
                  rightSaga={item.rightSaga}
                  channelId={channelId}
                />
              )
            )}
          </div>
        </>
      )}

      {!isLoadingSagas && displaySagas.length === 0 && uncategorizedVideoIds.length > 0 && (
        <UncategorizedSection
          channelId={channelId}
          videos={videos}
          uncategorizedVideoIds={uncategorizedVideoIds}
          sagas={sagas}
        />
      )}

      <ConfirmDialog
        open={showResetConfirm}
        title="Reset & Re-analyze"
        description="This will delete all AI-detected sagas and start the analysis from scratch. Manual and playlist sagas will be preserved. This cannot be undone."
        onConfirm={() => {
          setShowResetConfirm(false);
          resetAndReanalyze();
        }}
        onCancel={() => setShowResetConfirm(false)}
      />
    </div>
  );
}
