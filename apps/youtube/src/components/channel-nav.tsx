"use client";

import { useIsSignedIn } from "@/components/session-context";
import type { SyncJobState } from "@/hooks/use-sync";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@data-projects/ui";
import {
  Database,
  FileSearch,
  FileText,
  Loader2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";

export type ChannelTab = "overview" | "videos" | "timeline" | "sagas" | "discover";

const TABS: { id: ChannelTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "videos", label: "Videos" },
  { id: "timeline", label: "Timeline" },
  { id: "sagas", label: "Sagas" },
  { id: "discover", label: "Discover" },
];

interface ChannelNavProps {
  activeTab: ChannelTab;
  onTabChange: (tab: ChannelTab) => void;
  isSyncing: boolean;
  videoSync: SyncJobState | null;
  transcriptSync: SyncJobState | null;
  onSyncVideos: () => void;
  onSyncTranscripts: (options?: { retry?: boolean }) => void;
  videoCount: number;
}

export function ChannelNav({
  activeTab,
  onTabChange,
  isSyncing,
  videoSync,
  transcriptSync,
  onSyncVideos,
  onSyncTranscripts,
  videoCount,
}: Readonly<ChannelNavProps>) {
  const isSignedIn = useIsSignedIn();
  const isVideoSyncing = videoSync?.status === "running" || videoSync?.status === "pending";
  const isTranscriptSyncing = transcriptSync?.status === "running" || transcriptSync?.status === "pending";

  return (
    <nav
      className="shrink-0 border-b border-border bg-background"
      aria-label="Channel navigation"
    >
      <div className="flex items-center gap-2 px-3 sm:gap-4 sm:px-6">
        <div
          className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto [scrollbar-width:none] sm:gap-5 [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Channel views"
        >
          {TABS.map(({ id, label }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                id={`tab-${id}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${id}`}
                onClick={() => onTabChange(id)}
                className={`relative shrink-0 py-3 text-xs transition-colors sm:py-3.5 sm:text-sm ${
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
                {isActive && (
                  <span className="absolute inset-x-0 -bottom-px h-px bg-foreground" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-1 bg-background">
          {/* Transcript search reads stored transcripts, which is account-only. */}
          {isSignedIn && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              onClick={() =>
                document.dispatchEvent(new CustomEvent("open-transcript-search"))
              }
            >
              <FileSearch className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Transcripts</span>
            </Button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                aria-label="Sync options"
              >
                {isSyncing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline text-xs">
                  {isSyncing ? "Syncing" : "Sync"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-1">
              <SyncAction
                icon={Database}
                label="Sync Videos"
                description="Fetch all videos from YouTube"
                onClick={onSyncVideos}
                disabled={isVideoSyncing}
              />
              {isSignedIn && (
                <>
                  <SyncAction
                    icon={FileText}
                    label="Sync Transcripts"
                    description="Fetch and store video transcripts"
                    onClick={() => onSyncTranscripts()}
                    disabled={isTranscriptSyncing || videoCount === 0}
                  />
                  <div className="my-1 h-px bg-border" />
                  <SyncAction
                    icon={RotateCcw}
                    label="Retry Failed"
                    description="Re-fetch empty transcripts"
                    onClick={() => onSyncTranscripts({ retry: true })}
                    disabled={isTranscriptSyncing || videoCount === 0}
                  />
                </>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </nav>
  );
}

function SyncAction({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
}: Readonly<{
  icon: typeof Database;
  label: string;
  description: string;
  onClick: () => void;
  disabled: boolean;
}>) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-muted disabled:opacity-40"
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium leading-tight">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
