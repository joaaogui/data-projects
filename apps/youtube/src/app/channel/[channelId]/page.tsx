"use client";

import { ChannelDashboard } from "@/components/channel-dashboard";
import { ChannelHeader } from "@/components/channel-header";
import { ChannelTabs } from "@/components/channel-tabs";
import { ErrorBoundary } from "@/components/error-boundary";
import { saveRecentChannel } from "@/components/recent-channels";
import { SagasView } from "@/components/sagas";
import { SearchChannel } from "@/components/search-channel";
import { SyncStatusBar } from "@/components/sync-status-bar";
import { TimelineView } from "@/components/timeline-view";
import { VideosTable } from "@/components/videos";
import { YouTubeIcon } from "@/components/youtube-icon";
import { ChannelProvider, useChannel } from "@/hooks/use-channel-context";
import { Button, Navbar, Skeleton } from "@data-projects/ui";
import { AlertCircle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

function YouTubeLogo() {
  return <YouTubeIcon className="h-8 w-8 sm:h-10 sm:w-10 text-foreground" />;
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
    isTranscriptSyncing,
    isSyncing,
    handleRefresh,
    accountData,
  } = useChannel();

  const autoSyncTriggered = useRef(false);

  const searchParams = useSearchParams();
  const router = useRouter();

  const activeTab = (searchParams.get("tab") as "videos" | "timeline" | "sagas") || "videos";

  const setActiveTab = useCallback((tab: "videos" | "timeline" | "sagas") => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "videos") {
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
  }, []);

  useEffect(() => {
    if (channelInfo) {
      saveRecentChannel({ channelId, channelTitle: channelInfo.channelTitle, thumbnail: channelInfo.thumbnails.default.url, visitedAt: Date.now() });
    }
  }, [channelId, channelInfo]);

  useEffect(() => {
    if (autoSyncTriggered.current) return;
    if (isLoadingVideos || isFetchingVideos) return;
    if (source === "none" && !isVideoSyncing) {
      autoSyncTriggered.current = true;
      syncVideos();
    }
  }, [source, isLoadingVideos, isFetchingVideos, isVideoSyncing, syncVideos]);

  const isInitialLoading = isLoadingVideos || (source === "none" && isVideoSyncing);

  if (channelError) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Navbar homeLink={<Link href="/" />} logo={<YouTubeLogo />} appName="YouTube Analyzer" search={<SearchChannel compact />} themeIconClassName="text-primary" />
        <main className="flex-1 min-h-0 container mx-auto px-4 py-8">
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
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar homeLink={<Link href="/" />} logo={<YouTubeLogo />} appName="YouTube Analyzer" search={<SearchChannel initialValue={channelInfo?.channelTitle} compact />} themeIconClassName="text-primary" />
      <main className="flex-1 min-h-0 container mx-auto px-4 py-6 flex flex-col overflow-hidden">
        <ErrorBoundary>
          <ChannelHeader
            channelId={channelId}
            channelInfo={channelInfo}
            isLoadingChannel={isLoadingChannel}
            videos={videos}
            isVideoSyncing={isVideoSyncing}
            isTranscriptSyncing={isTranscriptSyncing}
            isLoadingVideos={isLoadingVideos}
            isFetchingVideos={isFetchingVideos}
            onSyncVideos={syncVideos}
            onSyncTranscripts={syncTranscripts}
            onRefresh={handleRefresh}
            fresh={fresh}
            fetchedAt={fetchedAt}
            accountData={accountData}
          />
        </ErrorBoundary>
        <SyncStatusBar videoSync={videoSync} transcriptSync={transcriptSync} videoLogs={videoLogs} transcriptLogs={transcriptLogs} isSyncing={isSyncing} onCancel={cancelSync} />

        {isInitialLoading && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-16 animate-fade-up">
            <div className="relative"><YouTubeIcon className="h-12 w-12 text-foreground/60 animate-pulse" /></div>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isVideoSyncing ? "Syncing videos from YouTube..." : "Loading videos..."}
              </p>
              <p className="text-xs text-muted-foreground">
                {videoSync?.progress?.phase === "saving"
                  ? `Saving video ${videoSync.progress.fetched.toLocaleString()} of ${videoSync.progress.total?.toLocaleString()}`
                  : "This may take a moment for channels with many videos"}
              </p>
              {videoSync?.progress?.total && videoSync.progress.phase === "saving" && (
                <div className="w-48 mx-auto mt-2">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary transition-all duration-300 animate-progress-stripe" style={{ width: `${Math.min(100, (videoSync.progress.fetched / videoSync.progress.total) * 100)}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="mt-6 space-y-2 max-w-4xl mx-auto w-full">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-border/30 p-3" style={{ animationDelay: `${i * 80}ms` }}>
                  <Skeleton className="w-20 h-11 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-12 rounded-lg" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        )}

        {!isInitialLoading && videos?.length === 0 && !isVideoSyncing && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-16 animate-scale-in">
            <div className="rounded-full bg-muted p-4"><AlertCircle className="h-8 w-8 text-muted-foreground" /></div>
            <p className="text-sm font-medium">No public videos found</p>
            <p className="text-xs text-muted-foreground">This channel has no publicly available videos to analyze.</p>
          </div>
        )}

        {videos && videos.length > 0 && (
          <>
            <ErrorBoundary>
              <ChannelDashboard videos={videos} />
            </ErrorBoundary>
            <ChannelTabs activeTab={activeTab} onTabChange={setActiveTab} counts={{ videos: videos.length }} />
            <div className="flex-1 min-h-0">
              <ErrorBoundary>
                {activeTab === "videos" && <VideosTable data={videos} onOpenTimeline={handleOpenTimeline} />}
                {activeTab === "timeline" && <TimelineView videos={videos} initialVideoId={timelineVideoId} />}
                {activeTab === "sagas" && <SagasView channelId={channelId} videos={videos} />}
              </ErrorBoundary>
            </div>
          </>
        )}
      </main>
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
