"use client";

import type { AccountDataResult } from "@/hooks/use-account-data";
import { CHANNEL_PREFIX } from "@/services/channel-client";
import type { ChannelInfo, VideoData } from "@/types/youtube";
import { Button, Card, CardContent, Popover, PopoverContent, PopoverTrigger, Skeleton } from "@data-projects/ui";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Bell, ChevronDown, Clock, Database, ExternalLink, FileText, Loader2, RefreshCw, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

dayjs.extend(relativeTime);

export interface ChannelHeaderProps {
  channelId: string;
  channelInfo: ChannelInfo | undefined;
  isLoadingChannel: boolean;
  videos: VideoData[] | null;
  isVideoSyncing: boolean;
  isTranscriptSyncing: boolean;
  isLoadingVideos: boolean;
  isFetchingVideos: boolean;
  onSyncVideos: () => void;
  onSyncTranscripts: (options?: { retry?: boolean }) => void;
  onRefresh: () => void;
  fresh?: boolean | null;
  fetchedAt?: string | null;
  accountData?: AccountDataResult;
}

export function ChannelHeader({
  channelId,
  channelInfo,
  isLoadingChannel,
  videos,
  isVideoSyncing,
  isTranscriptSyncing,
  isLoadingVideos,
  isFetchingVideos,
  onSyncVideos,
  onSyncTranscripts,
  onRefresh,
  fresh,
  fetchedAt,
  accountData,
}: Readonly<ChannelHeaderProps>) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (isLoadingChannel || !mounted) {
    return (
      <Card className="mb-4 flex-shrink-0 rounded-2xl animate-fade-down overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14 sm:h-16 sm:w-16 rounded-full" />
            <div className="space-y-2.5">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!channelInfo) return null;

  return (
    <Card className="mb-4 overflow-hidden flex-shrink-0 rounded-2xl border-border/50 animate-fade-down relative">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/[0.03] via-transparent to-primary/[0.02]" />
      <CardContent className="p-4 sm:p-5 relative">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="relative group shrink-0 h-12 w-12 sm:h-16 sm:w-16">
              <Image
                src={channelInfo.thumbnails.default.url}
                alt={channelInfo.channelTitle}
                fill
                sizes="(min-width: 640px) 64px, 48px"
                className="rounded-full object-cover ring-2 ring-primary/20 group-hover:ring-primary/40 transition-all duration-300"
              />
              <div className="absolute -inset-1 rounded-full bg-primary/10 blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-10" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <h2 className="text-base sm:text-xl font-bold tracking-tight truncate">
                  {channelInfo.channelTitle}
                </h2>
                <a
                  href={`${CHANNEL_PREFIX}${channelId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground/60 hover:text-primary transition-colors shrink-0"
                  title="Open in YouTube"
                  aria-label="Open channel on YouTube"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {accountData?.isSubscribed && (
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-medium text-primary">
                    <Bell className="h-2.5 w-2.5" />
                    Subscribed
                  </span>
                )}
              </div>
              {videos && videos.length > 0 && (
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-0.5">
                  <span className="font-medium text-foreground/70">{videos.length} videos</span>
                  <span className="text-border hidden sm:inline">analyzed</span>
                  {fetchedAt && (
                    <>
                      <span className="text-muted-foreground/30">&middot;</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground/50" />
                        {dayjs(fetchedAt).fromNow()}
                        {fresh === false && (
                          <button
                            onClick={onRefresh}
                            className="text-primary hover:underline text-xs ml-1"
                            disabled={isVideoSyncing}
                          >
                            Refresh
                          </button>
                        )}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" disabled={isVideoSyncing || isTranscriptSyncing} className="rounded-xl">
                  {(isVideoSyncing || isTranscriptSyncing) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Sync</span>
                  <ChevronDown className="h-3 w-3 ml-0.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1.5 rounded-xl">
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
                  disabled={isTranscriptSyncing || !videos?.length}
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
                  disabled={isTranscriptSyncing || !videos?.length}
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
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoadingVideos || isFetchingVideos}
              title="Refresh from cache"
              aria-label="Refresh data"
              className="rounded-xl"
            >
              <RefreshCw className={`h-4 w-4 transition-transform ${(isLoadingVideos || isFetchingVideos) ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
