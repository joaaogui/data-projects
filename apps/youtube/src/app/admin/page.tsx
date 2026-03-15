"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Skeleton,
} from "@data-projects/ui";
import {
  RefreshCw,
  Trash2,
  Database,
  Film,
  FileText,
  BookOpen,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  BarChart3,
  Activity,
  Radio,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import { useAdminData } from "@/hooks/use-admin-data";
import { StatCard, HealthBar } from "@/components/admin/stat-card";
import { ChannelTable } from "@/components/admin/channel-table";
import { SyncJobsTable } from "@/components/admin/sync-jobs-table";
import { Toasts, type ToastItem, type ConfirmState } from "@/components/admin/shared";
import type { CleanupAction } from "@/types/admin";

dayjs.extend(relativeTime);

type Tab = "overview" | "channels" | "sync-jobs";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "channels", label: "Channels", icon: Database },
  { id: "sync-jobs", label: "Sync Jobs", icon: Activity },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmState>({
    open: false,
    title: "",
    description: "",
    destructive: false,
    onConfirm: () => {},
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const {
    stats,
    jobs,
    loadingStats,
    loadingJobs,
    statsError,
    lastRefreshed,
    refetch,
    cleanup,
    bulk,
    sync,
    cancel,
  } = useAdminData(autoRefresh);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, variant: ToastItem["variant"] = "info") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(dismissToast, 4000, id);
  }, [dismissToast]);

  const requestConfirm = useCallback(
    (title: string, description: string, destructive: boolean, onConfirm: () => void) => {
      setConfirmDialog({ open: true, title, description, destructive, onConfirm });
    },
    [],
  );

  const closeConfirm = useCallback(() => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
  }, []);

  const handleCleanup = useCallback(
    async (action: CleanupAction, channelId?: string) => {
      const key = `${action}-${channelId ?? "all"}`;
      setActionLoading(key);
      try {
        const result = await cleanup.mutateAsync({ action, channelId });
        addToast(`Deleted ${result.deleted} rows`, "success");
      } catch {
        addToast("Cleanup failed", "error");
      } finally {
        setActionLoading(null);
        closeConfirm();
      }
    },
    [cleanup, addToast, closeConfirm],
  );

  const handleChannelCleanup = useCallback(
    (action: CleanupAction, channelId: string, label: string) => {
      const name = stats?.channels.find((c) => c.id === channelId)?.title ?? channelId;
      requestConfirm(
        label,
        `This will ${label.toLowerCase()} for "${name}". This action cannot be undone.`,
        action === "delete-channel" || action === "delete-videos",
        () => handleCleanup(action, channelId),
      );
    },
    [stats, requestConfirm, handleCleanup],
  );

  const handleGlobalCleanup = useCallback(
    (action: CleanupAction, label: string) => {
      requestConfirm(
        label,
        `This will ${label.toLowerCase()} globally. This action cannot be undone.`,
        true,
        () => handleCleanup(action),
      );
    },
    [requestConfirm, handleCleanup],
  );

  const handleTriggerSync = useCallback(
    async (channelId: string, type: "videos" | "transcripts") => {
      try {
        const result = await sync.mutateAsync({ channelId, type });
        if (result.error) {
          addToast(result.error, "error");
        } else {
          addToast(`Started ${type} sync`, "info");
        }
      } catch {
        addToast(`Failed to start ${type} sync`, "error");
      }
    },
    [sync, addToast],
  );

  const handleBulkSync = useCallback(
    async (type: "videos" | "transcripts", channelIds: string[]) => {
      try {
        const result = await bulk.mutateAsync({
          action: type === "videos" ? "sync-videos" : "sync-transcripts",
          channelIds,
        });
        addToast(`Started ${type} sync for ${result.started} channel(s)`, "info");
      } catch {
        addToast(`Failed to start bulk ${type} sync`, "error");
      }
    },
    [bulk, addToast],
  );

  const handleBulkCleanup = useCallback(
    async (action: CleanupAction, channelIds: string[]) => {
      try {
        const result = await bulk.mutateAsync({ action, channelIds });
        addToast(`Deleted ${result.deleted} rows across ${channelIds.length} channel(s)`, "success");
      } catch {
        addToast("Bulk cleanup failed", "error");
      }
    },
    [bulk, addToast],
  );

  const handleCancelJob = useCallback(
    async (jobId: string) => {
      try {
        await cancel.mutateAsync(jobId);
        addToast("Sync cancelled", "info");
      } catch {
        addToast("Failed to cancel", "error");
      }
    },
    [cancel, addToast],
  );

  const runningJobCount = useMemo(
    () => jobs.filter((j) => j.status === "running" || j.status === "pending").length,
    [jobs],
  );

  const healthStats = useMemo(() => {
    if (!stats) return null;
    const goodTranscripts = stats.global.transcripts - stats.global.transcriptsNoContent;
    const withSagas = stats.channels.filter(
      (c) => Number(c.playlist_sagas) + Number(c.ai_sagas) > 0,
    ).length;

    return {
      transcriptCoverage: { value: stats.global.transcripts, max: stats.global.videos },
      contentRate: { value: goodTranscripts, max: stats.global.transcripts },
      sagaCoverage: { value: withSagas, max: stats.global.channels },
    };
  }, [stats]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />Home
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Database health, sync management & cleanup
                {lastRefreshed && (
                  <span className="ml-2 text-xs">
                    &middot; updated {dayjs(lastRefreshed).fromNow()}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className={autoRefresh ? "border-primary/50" : ""}
              onClick={() => setAutoRefresh((v) => !v)}
            >
              <Radio className={`h-3.5 w-3.5 mr-1.5 ${autoRefresh ? "text-primary animate-pulse" : ""}`} />
              {autoRefresh ? "Auto" : "Auto-refresh"}
            </Button>
            <Button variant="outline" size="sm" onClick={refetch} disabled={loadingStats}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loadingStats ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="flex border-b border-border">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab(id)}
            >
              <Icon className="h-4 w-4" />
              {label}
              {id === "channels" && stats && (
                <span className="ml-0.5 text-xs text-muted-foreground">({stats.global.channels})</span>
              )}
              {id === "sync-jobs" && runningJobCount > 0 && (
                <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-500/10 px-1.5 text-xs font-medium text-blue-600 dark:text-blue-400">
                  {runningJobCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === "overview" && statsError && (
          <Card className="border-destructive">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <p className="font-medium">Failed to load stats</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {statsError instanceof Error ? statsError.message : "Unknown error"}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={refetch} className="mt-4">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {activeTab === "overview" && !stats && loadingStats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {["ch", "vid", "tr", "sg", "sj", "sug", "mt", "et"].map((key) => (
                <Card key={key}>
                  <CardContent className="p-5">
                    <Skeleton className="h-4 w-20 mb-3" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {activeTab === "overview" && stats && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatCard label="Channels" value={stats.global.channels} icon={Database} />
              <StatCard label="Videos" value={stats.global.videos} icon={Film} />
              <StatCard label="Transcripts" value={stats.global.transcripts} icon={FileText} />
              <StatCard label="Sagas" value={stats.global.sagas} icon={BookOpen} />
              <StatCard label="Sync Jobs" value={stats.global.syncJobs} icon={Activity} />
              <StatCard label="Cached Suggestions" value={stats.global.suggestions} icon={Sparkles} />
              <StatCard
                label="Missing Transcripts"
                value={stats.global.videosWithoutTranscripts}
                icon={AlertTriangle}
                variant={stats.global.videosWithoutTranscripts > 0 ? "warning" : "default"}
              />
              <StatCard
                label="Empty Transcripts"
                value={stats.global.transcriptsNoContent}
                icon={AlertTriangle}
                variant={stats.global.transcriptsNoContent > 0 ? "warning" : "default"}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {healthStats && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Data Health</CardTitle>
                    <CardDescription>Coverage and completeness metrics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <HealthBar label="Transcript Coverage" value={healthStats.transcriptCoverage.value} max={healthStats.transcriptCoverage.max} />
                    <HealthBar label="Content Rate" value={healthStats.contentRate.value} max={healthStats.contentRate.max} />
                    <HealthBar label="Saga Coverage (channels)" value={healthStats.sagaCoverage.value} max={healthStats.sagaCoverage.max} />
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Global Actions</CardTitle>
                  <CardDescription>Bulk cleanup operations</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { action: "delete-null-transcripts" as const, label: "Clear empty transcripts" },
                      { action: "delete-suggestion-cache" as const, label: "Clear suggestion cache" },
                      { action: "delete-ai-sagas" as const, label: "Delete all AI sagas" },
                      { action: "delete-completed-sync-jobs" as const, label: "Clear finished sync jobs" },
                      { action: "delete-transcripts" as const, label: "Delete all transcripts" },
                      { action: "delete-sagas" as const, label: "Delete all sagas" },
                    ]).map(({ action, label }) => (
                      <Button
                        key={action}
                        variant="outline"
                        size="sm"
                        className="justify-start"
                        disabled={actionLoading === `${action}-all`}
                        onClick={() => handleGlobalCleanup(action, label)}
                      >
                        {actionLoading === `${action}-all` ? (
                          <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                        )}
                        {label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "channels" && (
          <ChannelTable
            channels={stats?.channels ?? []}
            loading={!stats && loadingStats}
            actionLoading={actionLoading}
            onChannelCleanup={handleChannelCleanup}
            onTriggerSync={handleTriggerSync}
            onBulkSync={handleBulkSync}
            onBulkCleanup={handleBulkCleanup}
            onRequestConfirm={requestConfirm}
          />
        )}

        {activeTab === "sync-jobs" && (
          <SyncJobsTable
            jobs={jobs}
            loading={loadingJobs}
            runningJobCount={runningJobCount}
            onClearFinished={() => handleGlobalCleanup("delete-completed-sync-jobs", "Clear finished sync jobs")}
            onCancelJob={handleCancelJob}
          />
        )}
      </div>

      <Dialog open={confirmDialog.open} onOpenChange={(open) => !open && closeConfirm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmDialog.title}</DialogTitle>
            <DialogDescription>{confirmDialog.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={closeConfirm} disabled={!!actionLoading}>Cancel</Button>
            <Button
              variant={confirmDialog.destructive ? "destructive" : "default"}
              onClick={confirmDialog.onConfirm}
              disabled={!!actionLoading}
            >
              {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toasts items={toasts} onDismiss={dismissToast} />
    </div>
  );
}
