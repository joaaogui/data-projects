"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, Skeleton, Button, Navbar } from "@data-projects/ui";
import { VideosTable } from "@/components/videos-table";
import { SearchChannel } from "@/components/search-channel";
import { AIQueryChat } from "@/components/ai-query-chat";
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
          <Card className="mb-6 flex-shrink-0">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {channelInfo && (
          <Card className="mb-6 overflow-hidden flex-shrink-0">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <Image
                    src={channelInfo.thumbnails.default.url}
                    alt={channelInfo.channelTitle}
                    width={64}
                    height={64}
                    className="h-10 w-10 sm:h-16 sm:w-16 rounded-full ring-2 ring-border transition-all shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base sm:text-xl font-semibold truncate">
                        {channelInfo.channelTitle}
                      </h2>
                      <a
                        href={`${CHANNEL_PREFIX}${channelId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary transition-colors shrink-0"
                        title="Open in YouTube"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                    {videos ? (
                      <p className="text-sm sm:text-base text-muted-foreground">
                        {videos.length} videos found
                      </p>
                    ) : (
                      <p className="text-sm sm:text-base text-muted-foreground">Loading videos...</p>
                    )}
                  </div>
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
          <div className="space-y-2 flex-shrink-0">
            {[1, 2, 3, 4, 5].map((n) => (
              <Skeleton key={`skeleton-${n}`} className="h-16 w-full" />
            ))}
          </div>
        )}

        {videos && videos.length > 0 && (
          <div className="flex-1 min-h-0">
            <VideosTable data={videos} />
          </div>
        )}
      </main>

      {videos && videos.length > 0 && <AIQueryChat videos={videos} />}
    </div>
  );
}
