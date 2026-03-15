"use client";

import { useChannelSagas, type AnalysisProgress } from "@/hooks/use-channel-sagas";
import type { Saga, VideoData } from "@/types/youtube";
import { Button, Skeleton } from "@data-projects/ui";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Calendar,
  Clock,
  Eye,
  Film,
  List,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "./confirm-dialog";
import { SagaCard, SagaCardSkeleton } from "./saga-card";
import { SagaDetailView } from "./saga-detail-view";
import { UncategorizedSection } from "./uncategorized-section";

interface SagasViewProps {
  channelId: string;
  videos: VideoData[];
}

function ProgressBar({ progress }: Readonly<{ progress: AnalysisProgress }>) {
  const isActive = progress.phase === "transcribing" || progress.phase === "analyzing";
  if (!isActive && progress.phase !== "paused") return null;

  const pct = progress.videosTotal > 0
    ? Math.min(100, (progress.videosProcessed / progress.videosTotal) * 100)
    : 0;

  const phaseLabels: Record<string, string> = {
    transcribing: "Transcribing videos...",
    analyzing: "Analyzing stories...",
    paused: "Stopping after current batch...",
  };
  const phaseLabel = phaseLabels[progress.phase] ?? "Processing...";

  return (
    <div className="flex-shrink-0 rounded-2xl border border-border/50 bg-card p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {phaseLabel} Batch {progress.currentBatch} of {progress.totalBatches}
        </span>
        <span className="font-medium tabular-nums">
          {progress.videosProcessed.toLocaleString()} / {progress.videosTotal.toLocaleString()} videos
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 animate-progress-stripe"
          style={{ width: `${pct}%` }}
        />
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
    startAnalysis,
    resetAndReanalyze,
    startIncrementalAnalysis,
    stopAnalysis,
  } = useChannelSagas(channelId, videos);

  const [selectedSaga, setSelectedSaga] = useState<Saga | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [sortBy, setSortBy] = useState<"date" | "views" | "runtime" | "videos">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const isActive = progress.phase === "transcribing" || progress.phase === "analyzing";
  const hasResults = sagas.some((s) => s.source === "ai-detected");
  const hasUncategorized = uncategorizedVideoIds.length > 0;
  const displaySagas = useMemo(() => sagas.filter((s) => s.id !== "standalone"), [sagas]);

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
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3">
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
                  {" "}&middot; {uncategorizedVideoIds.length} uncategorized
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

      <ProgressBar progress={progress} />

      {progress.phase === "error" && progress.error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
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

      {displaySagas.length > 0 && (
        <>
          {displaySagas.length > 1 && (
            <div className="flex items-center gap-1.5">
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
            </div>
          )}
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 transition-opacity duration-300 ${isLoadingSagas ? "opacity-50" : ""}`}>
            {sortedSagas.map((saga) => (
              <SagaCard
                key={saga.id}
                saga={saga}
                videos={videos}
                onClick={() => setSelectedSaga(saga)}
              />
            ))}
          </div>
        </>
      )}

      {!isLoadingSagas && (
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
