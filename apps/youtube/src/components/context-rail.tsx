"use client";

import type { SyncJobState } from "@/hooks/use-sync";
import { CHANNEL_PREFIX } from "@/services/channel-client";
import { Button, Popover, PopoverContent, PopoverTrigger } from "@data-projects/ui";
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Database,
  FileText,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  RotateCcw,
  TableProperties,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

export type RailTab = "overview" | "videos" | "timeline" | "sagas";

const STORAGE_KEY = "youtube-rail-collapsed";

const NAV_ITEMS: { id: RailTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "videos", label: "Videos", icon: TableProperties },
  { id: "timeline", label: "Timeline", icon: Calendar },
  { id: "sagas", label: "Sagas", icon: BookOpen },
];

interface ContextRailProps {
  channelInfo: { channelTitle: string; thumbnails: { default: { url: string } } } | undefined;
  channelId: string;
  activeTab: RailTab;
  onTabChange: (tab: RailTab) => void;
  isSyncing: boolean;
  videoSync: SyncJobState | null;
  transcriptSync: SyncJobState | null;
  onSyncVideos: () => void;
  onSyncTranscripts: (options?: { retry?: boolean }) => void;
  videoCount: number;
}

export function ContextRail({
  channelInfo,
  channelId,
  activeTab,
  onTabChange,
  isSyncing,
  videoSync,
  transcriptSync,
  onSyncVideos,
  onSyncTranscripts,
  videoCount,
}: Readonly<ContextRailProps>) {
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "true");
    setMounted(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const isVideoSyncing = videoSync?.status === "running" || videoSync?.status === "pending";
  const isTranscriptSyncing = transcriptSync?.status === "running" || transcriptSync?.status === "pending";

  if (!mounted) return null;

  return (
    <>
      {/* Desktop rail */}
      <nav
        className="hidden md:flex h-full flex-col bg-card border-r border-border/40 transition-[width] duration-200 ease-in-out shrink-0"
        style={{ width: collapsed ? 56 : 220 }}
        aria-label="Channel navigation"
      >
        {/* Channel identity */}
        {channelInfo && (
          <a
            href={`${CHANNEL_PREFIX}${channelId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-4 hover:bg-muted/40 transition-colors"
            title={channelInfo.channelTitle}
          >
            <div className="relative h-8 w-8 shrink-0">
              <Image
                src={channelInfo.thumbnails.default.url}
                alt={channelInfo.channelTitle}
                fill
                sizes="32px"
                className="rounded-full object-cover ring-1 ring-border/50"
              />
            </div>
            {!collapsed && (
              <span className="text-sm font-medium truncate">{channelInfo.channelTitle}</span>
            )}
          </a>
        )}

        <div className="h-px bg-border/30 mx-3" />

        {/* Navigation items */}
        <div className="flex-1 flex flex-col gap-0.5 px-2 py-2" role="tablist" aria-label="Channel views">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                id={`tab-${id}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${id}`}
                onClick={() => onTabChange(id)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
                title={collapsed ? label : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && label}
              </button>
            );
          })}
        </div>

        {/* Sync indicator */}
        <div className="px-2 py-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`w-full justify-start gap-2.5 rounded-lg px-3 ${collapsed ? "justify-center px-0" : ""}`}
                title={collapsed ? "Sync options" : undefined}
              >
                <span className="relative shrink-0">
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {!isSyncing && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-card" />
                  )}
                </span>
                {!collapsed && (
                  <span className="text-sm text-muted-foreground">{isSyncing ? "Syncing…" : "Sync"}</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent side="right" align="end" className="w-56 p-1.5 rounded-xl">
              <button
                onClick={onSyncVideos}
                disabled={isVideoSyncing}
                aria-label="Sync videos from YouTube"
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left disabled:opacity-50"
              >
                <div className="rounded-lg bg-sky-500/10 p-1.5">
                  <Database className="h-3.5 w-3.5 text-sky-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Sync Videos</p>
                  <p className="text-xs text-muted-foreground">Fetch all videos from YouTube</p>
                </div>
              </button>
              <button
                onClick={() => onSyncTranscripts()}
                disabled={isTranscriptSyncing || videoCount === 0}
                aria-label="Sync video transcripts"
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left disabled:opacity-50"
              >
                <div className="rounded-lg bg-emerald-500/10 p-1.5">
                  <FileText className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Sync Transcripts</p>
                  <p className="text-xs text-muted-foreground">Fetch and store video transcripts</p>
                </div>
              </button>
              <div className="my-1 h-px bg-border/30" />
              <button
                onClick={() => onSyncTranscripts({ retry: true })}
                disabled={isTranscriptSyncing || videoCount === 0}
                aria-label="Retry failed transcript downloads"
                className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left disabled:opacity-50"
              >
                <div className="rounded-lg bg-amber-500/10 p-1.5">
                  <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Retry Failed</p>
                  <p className="text-xs text-muted-foreground">Re-fetch empty transcripts</p>
                </div>
              </button>
            </PopoverContent>
          </Popover>
        </div>

        <div className="h-px bg-border/30 mx-3" />

        {/* Collapse toggle */}
        <button
          onClick={toggleCollapsed}
          className="flex items-center justify-center gap-2 px-3 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      </nav>

      {/* Mobile bottom bar */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-sm border-t border-border/40"
        aria-label="Channel views"
      >
        <div className="flex items-center justify-around px-2 py-1.5" role="tablist">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                role="tab"
                id={`mobile-tab-${id}`}
                aria-selected={isActive}
                aria-controls={`tabpanel-${id}`}
                onClick={() => onTabChange(id)}
                className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground active:scale-95"
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? "text-primary" : ""}`} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
