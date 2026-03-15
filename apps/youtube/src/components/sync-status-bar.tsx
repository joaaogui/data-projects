"use client";

import { useEffect, useState } from "react";
import { Button } from "@data-projects/ui";
import { Loader2, CheckCircle2, XCircle, Square, Terminal, ChevronDown, ChevronUp } from "lucide-react";
import { SyncLogPanel } from "@/components/sync-log-panel";
import type { SyncJobState } from "@/hooks/use-sync";
import type { FetchProgress, SyncLogEntry } from "@/types/youtube";

function formatSyncPhase(type: string, progress: FetchProgress): string {
  if (type === "transcripts") {
    if (progress.total && progress.total > 0) {
      const pct = Math.round((progress.fetched / progress.total) * 100);
      return `Transcribing: ${progress.fetched.toLocaleString()} of ${progress.total.toLocaleString()} videos (${pct}%)`;
    }
    return `Transcribing: ${progress.fetched.toLocaleString()} videos...`;
  }

  switch (progress.phase) {
    case "saving":
      return `Saving: ${progress.fetched?.toLocaleString()} of ${progress.total?.toLocaleString()} videos`;
    case "playlist":
      return `Discovering videos... found ${progress.fetched?.toLocaleString()}`;
    case "details":
      return `Fetching details: ${progress.fetched?.toLocaleString()} of ${progress.total?.toLocaleString()}`;
    case "init":
    case "queued":
      return "Starting...";
    default:
      return "Processing...";
  }
}

function SyncBar({
  state,
  label,
  variant,
  logs,
  onCancel,
}: Readonly<{
  state: SyncJobState;
  label: string;
  variant: "video" | "transcript";
  logs: SyncLogEntry[];
  onCancel?: () => void;
}>) {
  const [showLogs, setShowLogs] = useState(false);
  const progress = state.progress;
  const pct = progress?.total && progress.total > 0
    ? Math.min(100, (progress.fetched / progress.total) * 100)
    : 0;

  const borderClass = variant === "video" ? "border-primary/20 bg-primary/5" : "border-blue-500/20 bg-blue-500/5";
  const spinnerClass = variant === "video" ? "text-primary" : "text-blue-500";
  const barClass = variant === "video" ? "bg-primary" : "bg-blue-500";
  const isActive = state.status === "running" || state.status === "pending";

  return (
    <div>
      <div className={`flex items-center gap-3 ${showLogs ? "rounded-t-2xl" : "rounded-2xl"} border ${borderClass} px-4 py-2.5`}>
        <Loader2 className={`h-4 w-4 animate-spin ${spinnerClass} shrink-0`} />
        <div className="flex-1 min-w-0" aria-live="polite">
          <p className="text-sm font-medium">{label}</p>
          {progress && (
            <p className="text-xs text-muted-foreground">
              {formatSyncPhase(state.type, progress)}
            </p>
          )}
        </div>
        {progress?.total && progress.total > 0 && (
          <div className="w-24 shrink-0">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${barClass} transition-all duration-300 animate-progress-stripe`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => setShowLogs((v) => !v)}
        >
          <Terminal className="h-3 w-3 mr-1" />
          Logs
          {showLogs ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
        </Button>
        {onCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-destructive shrink-0"
            onClick={onCancel}
          >
            <Square className="h-3 w-3 mr-1" />
            Stop
          </Button>
        )}
      </div>
      {showLogs && <SyncLogPanel logs={logs} isActive={isActive} />}
    </div>
  );
}

function CompletedLogViewer({ logs, label }: Readonly<{ logs: SyncLogEntry[]; label: string }>) {
  const [showLogs, setShowLogs] = useState(false);

  if (logs.length === 0) return null;

  return (
    <div>
      <div className={`flex items-center gap-2 ${showLogs ? "rounded-t-2xl" : "rounded-2xl"} border border-emerald-500/20 bg-emerald-500/5 px-4 py-2 text-sm`}>
        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        <span className="flex-1">{label}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => setShowLogs((v) => !v)}
        >
          <Terminal className="h-3 w-3 mr-1" />
          Logs
          {showLogs ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
        </Button>
      </div>
      {showLogs && <SyncLogPanel logs={logs} isActive={false} />}
    </div>
  );
}

function FailedLogViewer({ logs, label }: Readonly<{ logs: SyncLogEntry[]; label: string }>) {
  const [showLogs, setShowLogs] = useState(false);

  return (
    <div>
      <div className={`flex items-center gap-2 ${showLogs ? "rounded-t-2xl" : "rounded-2xl"} border border-destructive/20 bg-destructive/5 px-4 py-2 text-sm`}>
        <XCircle className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-destructive text-sm flex-1">{label}</span>
        {logs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground shrink-0"
            onClick={() => setShowLogs((v) => !v)}
          >
            <Terminal className="h-3 w-3 mr-1" />
            Logs
            {showLogs ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
          </Button>
        )}
      </div>
      {showLogs && <SyncLogPanel logs={logs} isActive={false} />}
    </div>
  );
}

export interface SyncStatusBarProps {
  videoSync: SyncJobState | null;
  transcriptSync: SyncJobState | null;
  videoLogs: SyncLogEntry[];
  transcriptLogs: SyncLogEntry[];
  isSyncing: boolean;
  onCancel?: (type: "videos" | "transcripts") => void;
}

export function SyncStatusBar({ videoSync, transcriptSync, videoLogs, transcriptLogs, isSyncing, onCancel }: Readonly<SyncStatusBarProps>) {
  const [dismissedVideo, setDismissedVideo] = useState(false);
  const [dismissedTranscript, setDismissedTranscript] = useState(false);

  useEffect(() => {
    if (!isSyncing && videoSync?.status === "completed") {
      const timer = setTimeout(() => setDismissedVideo(true), 8000);
      return () => clearTimeout(timer);
    }
    if (isSyncing) setDismissedVideo(false);
  }, [isSyncing, videoSync?.status]);

  useEffect(() => {
    if (!isSyncing && transcriptSync?.status === "completed") {
      const timer = setTimeout(() => setDismissedTranscript(true), 8000);
      return () => clearTimeout(timer);
    }
    if (isSyncing) setDismissedTranscript(false);
  }, [isSyncing, transcriptSync?.status]);

  return (
    <>
      {isSyncing && (
        <div className="mb-3 flex-shrink-0 space-y-2 animate-fade-down">
          {videoSync && (videoSync.status === "running" || videoSync.status === "pending") && (
            <SyncBar
              state={videoSync}
              label="Syncing videos to database..."
              variant="video"
              logs={videoLogs}
              onCancel={onCancel ? () => onCancel("videos") : undefined}
            />
          )}
          {transcriptSync && (transcriptSync.status === "running" || transcriptSync.status === "pending") && (
            <SyncBar
              state={transcriptSync}
              label="Fetching transcripts..."
              variant="transcript"
              logs={transcriptLogs}
              onCancel={onCancel ? () => onCancel("transcripts") : undefined}
            />
          )}
        </div>
      )}

      {!isSyncing && (
        <div className="mb-3 flex-shrink-0 space-y-2">
          {videoSync?.status === "completed" && !dismissedVideo && (
            <div className="transition-opacity duration-500">
              <CompletedLogViewer
                logs={videoLogs}
                label={`Videos synced to database.${transcriptSync?.status === "completed" ? " Transcripts saved." : ""}`}
              />
            </div>
          )}
          {transcriptSync?.status === "completed" && videoSync?.status !== "completed" && !dismissedTranscript && (
            <div className="transition-opacity duration-500">
              <CompletedLogViewer logs={transcriptLogs} label="Transcripts saved." />
            </div>
          )}

          {videoSync?.status === "failed" && !dismissedVideo && (
            <FailedLogViewer
              logs={videoLogs}
              label={videoSync.error ?? "Video sync failed"}
            />
          )}
          {transcriptSync?.status === "failed" && !dismissedTranscript && (
            <FailedLogViewer
              logs={transcriptLogs}
              label={transcriptSync.error ?? "Transcript sync failed"}
            />
          )}
        </div>
      )}
    </>
  );
}
