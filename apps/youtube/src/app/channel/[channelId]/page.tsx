"use client";

import { AccountSpacer } from "@/components/account-spacer";
import { ChannelOverview } from "@/components/channel-overview";
import { CommandPalette } from "@/components/command-palette";
import { ChannelNav, type ChannelTab } from "@/components/channel-nav";
import { ErrorBoundary } from "@/components/error-boundary";
import { FirstSyncFlow } from "@/components/first-sync-flow";
import { saveRecentChannel } from "@/components/recent-channels";
import { SearchChannel } from "@/components/search-channel";
import { useIsSignedIn } from "@/components/session-context";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { TrackChannelButton } from "@/components/track-channel-button";
import { TranscriptSearchOverlay } from "@/components/transcript-search-overlay";
import { YouTubeIcon } from "@/components/youtube-icon";
import { ChannelProvider, useChannel } from "@/hooks/use-channel-context";
import { useChannelStats } from "@/hooks/use-channel-stats";
import { Button, Navbar, Skeleton, Tooltip, TooltipContent, TooltipTrigger } from "@data-projects/ui";
import { AlertCircle, ArrowLeft, BarChart3, Calendar, Check, Eye, Loader2, Minus, Share2, ThumbsUp, TrendingDown, TrendingUp } from "lucide-react";
import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

function TabLoading() {
  return (
    <div role="status" className="flex min-h-40 items-center justify-center">
      <span className="text-sm text-muted-foreground">Loading view…</span>
    </div>
  );
}

const VideosTable = dynamic(
  () => import("@/components/videos").then((module) => module.VideosTable),
  { loading: TabLoading }
);
const TimelineView = dynamic(
  () =>
    import("@/components/timeline-view").then(
      (module) => module.TimelineView
    ),
  { loading: TabLoading }
);
const SagasView = dynamic(
  () => import("@/components/sagas").then((module) => module.SagasView),
  { loading: TabLoading }
);
const DiscoverView = dynamic(
  () => import("@/components/discover").then((module) => module.DiscoverView),
  { loading: TabLoading }
);

function YouTubeLogo() {
  return <YouTubeIcon className="h-8 w-8 sm:h-10 sm:w-10 text-foreground" />;
}

function KpiPill({ label, value, icon }: Readonly<{ label: string; value: string; icon: React.ReactNode }>) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5"
      aria-label={`${label}: ${value}`}
    >
      {icon}
      <div className="flex flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground leading-none">{label}</span>
        <span className="text-sm font-bold font-mono tabular-nums leading-tight">{value}</span>
      </div>
    </div>
  );
}

function TrendIcon({ value }: Readonly<{ value: number }>) {
  if (value > 2) return <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />;
  if (value < -2) return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

function ChannelPageContent() {
  const {
    channelId,
    channelInfo,
    channelError,
    videos,
    source,
    fresh,
    fetchedAt,
    isLoadingChannel,
    isLoadingVideos,
    isFetchingVideos,
    videoSync,
    transcriptSync,
    videoLogs,
    transcriptLogs,
    syncVideos,
    syncTranscripts,
    cancelSync,
    isVideoSyncing,
    isSyncing,
    handleRefresh,
  } = useChannel();

  const stats = useChannelStats(videos);

  const isSignedIn = useIsSignedIn();
  const [hydrated, setHydrated] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "loading" | "done">("idle");
  useEffect(() => setHydrated(true), []);

  const autoSyncTriggered = useRef(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  const activeTab = (searchParams.get("tab") as ChannelTab) || "overview";

  const setActiveTab = useCallback((tab: ChannelTab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.replace(`?${query}`, { scroll: false });
  }, [searchParams, router]);

  const [timelineVideoId, setTimelineVideoId] = useState<string | null>(null);

  const handleOpenTimeline = useCallback((videoId: string) => {
    setTimelineVideoId(videoId);
    setActiveTab("timeline");
  }, [setActiveTab]);

  const handleNavigateToVideo = useCallback((_videoId: string) => {
    setActiveTab("videos");
  }, [setActiveTab]);

  const handleNavigateToSagas = useCallback(() => {
    setActiveTab("sagas");
  }, [setActiveTab]);

  const handleShareReport = useCallback(async () => {
    if (shareState === "loading") return;
    setShareState("loading");
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to share");
      }
      const { reportId } = await res.json();
      const url = `${globalThis.location.origin}/report/${reportId}`;
      await navigator.clipboard.writeText(url);
      setShareState("done");
      setTimeout(() => setShareState("idle"), 3000);
    } catch {
      setShareState("idle");
    }
  }, [channelId, shareState]);

  useEffect(() => {
    if (channelInfo) {
      saveRecentChannel({ channelId, channelTitle: channelInfo.channelTitle, thumbnail: channelInfo.thumbnails.default.url, visitedAt: Date.now() });
    }
  }, [channelId, channelInfo]);

  const [showFeatureTips, setShowFeatureTips] = useState(false);
  const [transcriptSearchOpen, setTranscriptSearchOpen] = useState(false);

  useEffect(() => {
    function handleOpenTranscriptSearch() {
      setTranscriptSearchOpen(true);
    }
    document.addEventListener("open-transcript-search", handleOpenTranscriptSearch);
    return () => document.removeEventListener("open-transcript-search", handleOpenTranscriptSearch);
  }, []);

  const handleTranscriptVideoSelect = useCallback((videoId: string) => {
    setActiveTab("videos");
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("select-video", { detail: videoId }));
    }, 100);
  }, [setActiveTab]);

  useEffect(() => {
    if (globalThis.window === undefined) return;
    if (!localStorage.getItem("youtube-feature-tips-seen")) {
      setShowFeatureTips(true);
    }
  }, []);

  const dismissFeatureTips = useCallback(() => {
    setShowFeatureTips(false);
    localStorage.setItem("youtube-feature-tips-seen", "1");
  }, []);

  const isFirstSync = source === "none" && !isVideoSyncing && !autoSyncTriggered.current;
  const isInitialLoading = !hydrated || isLoadingVideos;
  const showFirstSyncFlow = isFirstSync || (source === "none" && isVideoSyncing) || (videoSync?.status === "completed" && videos?.length === 0) || (videoSync?.status === "failed" && (!videos || videos.length === 0));
  const hasVideos = videos && videos.length > 0;

  const handleSyncReady = useCallback(() => {
    autoSyncTriggered.current = true;
  }, []);

  if (channelError) {
    return (
      <div className="h-dvh flex flex-col overflow-hidden">
        <Navbar homeLink={<Link href="/" />} logo={<YouTubeLogo />} fullWidth search={<SearchChannel compact />} themeIconClassName="text-muted-foreground" actions={<AccountSpacer />} />
        <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center animate-scale-in">
            <div className="rounded-full bg-destructive/10 p-4 mb-4"><AlertCircle className="h-8 w-8 text-destructive" /></div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Channel Not Found</h2>
            <p className="text-muted-foreground mb-6 max-w-md">We couldn&apos;t find this YouTube channel. Please try a different search.</p>
            <Button asChild><Link href="/"><ArrowLeft className="mr-2 h-4 w-4" />Back to Home</Link></Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <Navbar homeLink={<Link href="/" />} logo={<YouTubeLogo />} fullWidth search={<SearchChannel initialValue={hydrated ? channelInfo?.channelTitle : undefined} compact />} themeIconClassName="text-muted-foreground" actions={<AccountSpacer />} />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 flex flex-col overflow-hidden" role="main" aria-label={channelInfo ? `Channel analysis for ${channelInfo.channelTitle}` : "Channel analysis"}>
          {/* Condensed header with KPI strip */}
          {channelInfo && (
            <div className="channel-header-shell shrink-0 border-b border-border px-3 py-3 sm:px-6">
              <div className="channel-header-layout flex flex-col gap-3 md:flex-row md:items-center">
                <div className="channel-identity-row flex min-w-0 items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0">
                    <Image
                      src={channelInfo.thumbnails.default.url}
                      alt={channelInfo.channelTitle}
                      fill
                      sizes="40px"
                      className="rounded-full object-cover ring-1 ring-border/50"
                    />
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-base font-bold tracking-tight sm:text-lg">
                      {channelInfo.channelTitle}
                    </h1>
                    {hasVideos && fetchedAt && (
                      <p className="text-xs text-muted-foreground">
                        {videos.length} videos analyzed
                        {fresh === false && (
                          <button
                            onClick={handleRefresh}
                            className="ml-1.5 text-primary hover:underline"
                            disabled={isLoadingVideos || isFetchingVideos}
                          >
                            Refresh
                          </button>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="ml-auto flex shrink-0 items-center gap-0.5 border-l border-border pl-2">
                    <TrackChannelButton channelId={channelId} />
                    {isSignedIn && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 rounded-lg p-0"
                            onClick={handleShareReport}
                            disabled={shareState === "loading"}
                            aria-label="Share channel report"
                          >
                            {shareState === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            {shareState === "done" && <Check className="h-3.5 w-3.5 text-muted-foreground" />}
                            {shareState === "idle" && <Share2 className="h-3.5 w-3.5" />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {shareState === "done" ? "Link copied!" : "Share report"}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-lg p-0"
                          asChild
                        >
                          <Link
                            href={`/compare?channels=${channelId}`}
                            aria-label="Compare with another channel"
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Compare with another channel</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {stats && (
                  <div className="channel-kpi-strip -mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] md:mx-0 md:ml-auto md:gap-2 md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden">
                    <KpiPill
                      label="Views"
                      value={stats.totalViewsFormatted}
                      icon={<Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                    />
                    <KpiPill
                      label="Avg Score"
                      value={stats.avgScore.toFixed(1)}
                      icon={<TrendIcon value={stats.scoreTrend} />}
                    />
                    <KpiPill
                      label="Engagement"
                      value={`${stats.avgEngagement.toFixed(1)}/1K`}
                      icon={<ThumbsUp className="h-3.5 w-3.5 text-muted-foreground" />}
                    />
                    <KpiPill
                      label="Cadence"
                      value={stats.cadenceLabel}
                      icon={<Calendar className="h-3.5 w-3.5 text-muted-foreground" />}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {!channelInfo && isLoadingChannel && (
            <div className="shrink-0 border-b border-border px-4 sm:px-6 py-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </div>
          )}

          {hasVideos && (
            <ChannelNav
              activeTab={activeTab}
              onTabChange={setActiveTab}
              isSyncing={isSyncing}
              videoSync={videoSync}
              transcriptSync={transcriptSync}
              onSyncVideos={syncVideos}
              onSyncTranscripts={syncTranscripts}
              videoCount={videos?.length ?? 0}
            />
          )}

          <SyncStatusBar videoSync={videoSync} transcriptSync={transcriptSync} videoLogs={videoLogs} transcriptLogs={transcriptLogs} isSyncing={isSyncing} onCancel={cancelSync} />

          {showFeatureTips && hasVideos && !isInitialLoading && isSignedIn && (
            <div className="shrink-0 px-4 sm:px-6 pt-3 animate-fade-down">
              <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-xs">
                <span className="text-muted-foreground flex-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="flex items-center gap-1.5">
                    <kbd className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
                    <span>Command palette</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">⌘J</kbd>
                    <span>Ask AI</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Share2 className="h-3 w-3" />
                    <span>Share report</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BarChart3 className="h-3 w-3" />
                    <span>Compare channels</span>
                  </span>
                </span>
                <button onClick={dismissFeatureTips} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" aria-label="Dismiss tips">
                  <span className="text-[10px] font-medium">Got it</span>
                </button>
              </div>
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 pb-6 sm:px-6 sm:py-4 sm:pb-4">
            {isInitialLoading && !showFirstSyncFlow && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-center min-h-[40vh]"
              >
                <div className="animate-pulse text-muted-foreground">Loading...</div>
              </div>
            )}

            {showFirstSyncFlow && (
              <FirstSyncFlow
                channelInfo={channelInfo}
                isLoadingChannel={isLoadingChannel}
                videoSync={videoSync}
                isVideoSyncing={isVideoSyncing}
                onSyncVideos={syncVideos}
                onCancelSync={cancelSync}
                onReady={handleSyncReady}
              />
            )}

            {!isInitialLoading && !showFirstSyncFlow && hasVideos && (
              <div id={`tabpanel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`} className="h-full">
                <ErrorBoundary>
                  {activeTab === "overview" && (
                    <ChannelOverview
                      videos={videos}
                      channelId={channelId}
                      onNavigateToVideo={handleNavigateToVideo}
                      onNavigateToSagas={handleNavigateToSagas}
                    />
                  )}
                  {activeTab === "videos" && <VideosTable data={videos} onOpenTimeline={handleOpenTimeline} />}
                  {activeTab === "timeline" && <TimelineView videos={videos} initialVideoId={timelineVideoId} />}
                  {activeTab === "sagas" && <SagasView channelId={channelId} videos={videos} />}
                  {activeTab === "discover" && <DiscoverView channelId={channelId} videos={videos} />}
                </ErrorBoundary>
              </div>
            )}

            {!isInitialLoading && !showFirstSyncFlow && !hasVideos && !isVideoSyncing && (
              <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center animate-scale-in">
                <div className="rounded-full bg-muted p-4"><AlertCircle className="h-8 w-8 text-muted-foreground" /></div>
                <p className="text-sm font-medium">No public videos found</p>
                <p className="text-xs text-muted-foreground">This channel has no publicly available videos to analyze.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <CommandPalette
        onNavigate={setActiveTab}
        onSyncVideos={syncVideos}
        onSyncTranscripts={() => syncTranscripts()}
        onShareReport={handleShareReport}
        channelId={channelId}
        isSignedIn={isSignedIn}
      />

      {isSignedIn && (
        <TranscriptSearchOverlay
          channelId={channelId}
          open={transcriptSearchOpen}
          onClose={() => setTranscriptSearchOpen(false)}
          onSelectVideo={handleTranscriptVideoSelect}
        />
      )}
    </div>
  );
}

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.channelId as string;

  return (
    <ChannelProvider channelId={channelId}>
      <Suspense fallback={null}>
        <ChannelPageContent />
      </Suspense>
    </ChannelProvider>
  );
}
