"use client";

import { useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, Skeleton, Button, Navbar } from "@data-projects/ui";
import { VideosTable } from "@/components/videos-table";
import { SearchChannel } from "@/components/search-channel";
import { ChannelDashboard } from "@/components/channel-dashboard";
import { saveRecentChannel } from "@/components/recent-channels";
import { useChannelInfo } from "@/hooks/use-channel-info";
import { useChannelVideos } from "@/hooks/use-channel-videos";
import { CHANNEL_PREFIX } from "@/services/channel";
import { ExternalLink, RefreshCw, AlertCircle, ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

function YouTubeIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

function YouTubeLogo() {
  return <YouTubeIcon className="h-8 w-8 sm:h-10 sm:w-10 text-primary" />;
}

export default function ChannelPage() {
  const params = useParams();
  const channelId = params.channelId as string;
  const queryClient = useQueryClient();

  const {
    data: channelInfo,
    isLoading: isLoadingChannel,
    error: channelError,
  } = useChannelInfo(channelId);

  const {
    data: videos,
    isLoading: isLoadingVideos,
    isFetching: isFetchingVideos,
  } = useChannelVideos(channelId);

  useEffect(() => {
    if (channelInfo) {
      saveRecentChannel({
        channelId,
        channelTitle: channelInfo.channelTitle,
        thumbnail: channelInfo.thumbnails.default.url,
        visitedAt: Date.now(),
      });
    }
  }, [channelId, channelInfo]);

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["channel-videos", channelId] });
  }, [channelId, queryClient]);

  if (channelError) {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Navbar
          homeLink={<Link href="/" />}
          logo={<YouTubeLogo />}
          appName="YouTube Analyzer"
          search={<SearchChannel compact />}
          themeIconClassName="text-primary"
        />
        <main className="flex-1 min-h-0 container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
            <div className="rounded-full bg-destructive/10 p-4 mb-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Channel Not Found</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              We couldn&apos;t find this YouTube channel. Please try a different search.
            </p>
            <Button asChild>
              <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Navbar
        homeLink={<Link href="/" />}
        logo={<YouTubeLogo />}
        appName="YouTube Analyzer"
        search={<SearchChannel initialValue={channelInfo?.channelTitle} compact />}
        themeIconClassName="text-primary"
      />

      <main className="flex-1 min-h-0 container mx-auto px-4 py-6 flex flex-col overflow-hidden">
        {isLoadingChannel && (
          <Card className="mb-4 flex-shrink-0">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 sm:h-12 sm:w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {channelInfo && (
          <Card className="mb-4 overflow-hidden flex-shrink-0">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-3">
                <Image
                  src={channelInfo.thumbnails.default.url}
                  alt={channelInfo.channelTitle}
                  width={64}
                  height={64}
                  className="h-10 w-10 sm:h-12 sm:w-12 rounded-full ring-2 ring-border transition-all shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-semibold truncate">
                      {channelInfo.channelTitle}
                    </h2>
                    <a
                      href={`${CHANNEL_PREFIX}${channelId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                      title="Open in YouTube"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  {videos && (
                    <p className="text-sm text-muted-foreground">{videos.length} videos analyzed</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={isLoadingVideos || isFetchingVideos}
                  title="Refresh data"
                  className="shrink-0"
                >
                  <RefreshCw className={`h-4 w-4 ${(isLoadingVideos || isFetchingVideos) ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {(isLoadingVideos || isFetchingVideos) && !videos && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-16">
            <div className="relative">
              <YouTubeIcon className="h-12 w-12 text-primary animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Loading videos...</p>
              <p className="text-xs text-muted-foreground">Fetching data from YouTube API</p>
            </div>
          </div>
        )}

        {videos && videos.length > 0 && (
          <>
            <ChannelDashboard videos={videos} />
            <div className="flex-1 min-h-0">
              <VideosTable data={videos} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
