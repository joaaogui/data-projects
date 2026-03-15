"use client";

import { useChannel } from "@/hooks/use-channel-context";
import { formatCompact } from "@/lib/format";
import { formatDuration } from "@/lib/scoring";
import type { ScoreComponents, VideoData } from "@/types/youtube";
import { Button } from "@data-projects/ui";
import dayjs from "dayjs";
import { Calendar, ChevronLeft, ChevronRight, ExternalLink, Eye, FolderOpen, Heart, MessageSquare, Star, ThumbsUp, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { METRIC_CONFIGS, METRIC_TYPES, getNormalizedWeight, type MetricWeights } from "./metric-icon";
import { ScoreRing } from "./score-ring";

interface VideoDetailPanelProps {
  video: VideoData;
  allVideos: VideoData[];
  weights: MetricWeights;
  onClose: () => void;
  onSelectVideo: (videoId: string) => void;
  onOpenTimeline?: (videoId: string) => void;
}

const METRIC_TO_COMPONENT: Record<string, keyof ScoreComponents> = {
  views: "reachScore",
  engagement: "engagementScore",
  momentum: "momentumScore",
  efficiency: "efficiencyScore",
  community: "communityScore",
};

const METRIC_BAR_COLORS: Record<string, { text: string; bg: string }> = {
  views: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-600 dark:bg-emerald-400" },
  engagement: { text: "text-sky-600 dark:text-sky-400", bg: "bg-sky-600 dark:bg-sky-400" },
  momentum: { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-600 dark:bg-amber-400" },
  efficiency: { text: "text-orange-600 dark:text-orange-400", bg: "bg-orange-600 dark:bg-orange-400" },
  community: { text: "text-violet-600 dark:text-violet-400", bg: "bg-violet-600 dark:bg-violet-400" },
};

function MetricBar({ label, value, metricType, index = 0 }: Readonly<{ label: string; value: number; metricType: string; index?: number }>) {
  const colors = METRIC_BAR_COLORS[metricType] ?? { text: "text-muted-foreground", bg: "bg-muted-foreground" };
  const fill = Math.min(value, 100) / 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-semibold tabular-nums ${colors.text}`}>{value.toFixed(0)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
        <div
          className={`h-full w-full rounded-full animate-bar-fill ${colors.bg}`}
          style={{ '--fill': fill, animationDelay: `${index * 80}ms`, opacity: 0.85 } as React.CSSProperties}
        />
      </div>
    </div>
  );
}

export function VideoDetailPanel({
  video,
  allVideos,
  weights,
  onClose,
  onSelectVideo,
  onOpenTimeline,
}: Readonly<VideoDetailPanelProps>) {
  const { accountData } = useChannel();
  const [descExpanded, setDescExpanded] = useState(false);
  const [direction, setDirection] = useState<'left' | 'right' | null>(null);
  const [transcript, setTranscript] = useState<{ fullText: string | null; excerpt: string | null; language: string | null } | null>(null);
  const [transcriptExpanded, setTranscriptExpanded] = useState(false);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const isLiked = accountData.likedVideoIds.has(video.videoId);

  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => modalRef.current?.focus(), 50);
    return () => {
      clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, []);
  const playlists = accountData.playlistMap.get(video.videoId);

  const currentIndex = useMemo(() => {
    return allVideos.findIndex((v) => v.videoId === video.videoId);
  }, [allVideos, video.videoId]);

  const prevVideo = currentIndex > 0 ? allVideos[currentIndex - 1] : null;
  const nextVideo = currentIndex < allVideos.length - 1 ? allVideos[currentIndex + 1] : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && prevVideo) {
        e.preventDefault();
        onSelectVideo(prevVideo.videoId);
      } else if (e.key === "ArrowRight" && nextVideo) {
        e.preventDefault();
        onSelectVideo(nextVideo.videoId);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [prevVideo, nextVideo, onSelectVideo, onClose]);

  useEffect(() => {
    setTranscript(null);
    setTranscriptExpanded(false);
    setTranscriptLoading(false);
  }, [video.videoId]);

  const loadTranscript = useCallback(async () => {
    if (transcript || transcriptLoading) return;
    setTranscriptLoading(true);
    try {
      const res = await fetch(`/api/transcripts/${video.videoId}`);
      if (res.ok) {
        const data = await res.json();
        setTranscript(data.transcript);
      }
    } catch {
      // silently fail
    } finally {
      setTranscriptLoading(false);
    }
  }, [video.videoId, transcript, transcriptLoading]);

  const publishDate = dayjs(video.publishedAt).format("MMM D, YYYY");
  const hasDescription = video.description && video.description.trim().length > 0;

  let animationClass = 'animate-fade-up';
  if (direction === 'right') animationClass = 'animate-slide-right';
  else if (direction === 'left') animationClass = 'animate-slide-left';

  let transcriptLabel = 'Show transcript';
  if (transcriptLoading) transcriptLabel = 'Loading transcript...';
  else if (transcriptExpanded) transcriptLabel = 'Hide transcript';

  return (
    <dialog open ref={modalRef} tabIndex={-1} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 outline-none max-w-none max-h-none" aria-modal="true" aria-label={`Video details: ${video.title}`}>
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity duration-300 cursor-default" aria-label="Close" onClick={onClose} />

      <div className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] rounded-t-3xl sm:rounded-3xl border border-border/50 bg-card shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-[0.97] duration-300">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border/20 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {currentIndex + 1} / {allVideos.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg" disabled={!prevVideo} onClick={() => { setDirection('left'); if (prevVideo) onSelectVideo(prevVideo.videoId); }} title="Previous video (←)" aria-label="Previous video">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-lg" disabled={!nextVideo} onClick={() => { setDirection('right'); if (nextVideo) onSelectVideo(nextVideo.videoId); }} title="Next video (→)" aria-label="Next video">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-border/30 mx-1" />
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 rounded-lg" aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div key={video.videoId} className={`flex-1 overflow-y-auto ${animationClass}`}>
          <div className="flex flex-col sm:flex-row">
            <div className="sm:w-[300px] shrink-0">
              <div className="relative aspect-video w-full">
                <Image
                  src={video.thumbnail.replace("default", "hqdefault")}
                  alt={video.title}
                  fill
                  sizes="(min-width: 640px) 300px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-black/40 via-transparent to-transparent" />
                <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-sm text-white text-xs px-2 py-0.5 rounded-md font-medium tabular-nums">
                  {formatDuration(video.duration)}
                </div>
              </div>
            </div>

            <div className="flex-1 p-4 sm:p-5 space-y-4">
              <div>
                <h3 className="font-semibold text-sm leading-snug">{video.title}</h3>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{publishDate}</span>
                  <span className="text-border/50">&middot;</span>
                  <span>{video.days === 0 ? "Today" : `${video.days}d ago`}</span>
                </div>
              </div>

              {(isLiked || playlists) && (
                <div className="flex flex-wrap gap-1.5">
                  {isLiked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-500">
                      <Heart className="h-3 w-3 fill-current" />
                      Liked
                    </span>
                  )}
                  {playlists?.map((name) => (
                    <span key={name} className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-500">
                      <FolderOpen className="h-3 w-3" />
                      {name}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-start gap-3 sm:gap-4">
                <ScoreRing score={video.score} scoreComponents={video.scoreComponents} weights={weights} size={64} />
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 flex-1">
                  <div className="rounded-xl bg-linear-to-br from-sky-500/5 to-sky-500/10 p-2.5 text-center ring-1 ring-sky-500/10">
                    <Eye className="h-3.5 w-3.5 mx-auto mb-0.5 text-sky-500" />
                    <p className="text-sm font-semibold tabular-nums">{formatCompact(video.views)}</p>
                    <p className="text-[10px] text-muted-foreground">views</p>
                  </div>
                  <div className="rounded-xl bg-linear-to-br from-emerald-500/5 to-emerald-500/10 p-2.5 text-center ring-1 ring-emerald-500/10">
                    <ThumbsUp className="h-3.5 w-3.5 mx-auto mb-0.5 text-emerald-500" />
                    <p className="text-sm font-semibold tabular-nums">{formatCompact(video.likes)}</p>
                    <p className="text-[10px] text-muted-foreground">likes</p>
                  </div>
                  <div className="rounded-xl bg-linear-to-br from-violet-500/5 to-violet-500/10 p-2.5 text-center ring-1 ring-violet-500/10">
                    <MessageSquare className="h-3.5 w-3.5 mx-auto mb-0.5 text-violet-500" />
                    <p className="text-sm font-semibold tabular-nums">{formatCompact(video.comments)}</p>
                    <p className="text-[10px] text-muted-foreground">comments</p>
                  </div>
                  <div className="rounded-xl bg-linear-to-br from-amber-500/5 to-amber-500/10 p-2.5 text-center ring-1 ring-amber-500/10">
                    <Star className="h-3.5 w-3.5 mx-auto mb-0.5 text-amber-500" />
                    <p className="text-sm font-semibold tabular-nums">{formatCompact(video.favorites)}</p>
                    <p className="text-[10px] text-muted-foreground">favorites</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-5 pb-4 space-y-2.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Performance Breakdown</p>
            {METRIC_TYPES.map((type, i) => {
              const config = METRIC_CONFIGS[type];
              const componentKey = METRIC_TO_COMPONENT[type];
              const value = video.scoreComponents[componentKey] ?? 0;
              const weight = getNormalizedWeight(weights, type);
              return (
                <MetricBar key={type} label={`${config.label} (${weight}%)`} value={value} metricType={type} index={i} />
              );
            })}
          </div>

          <div className="px-4 sm:px-5 pb-5 space-y-3">
            {onOpenTimeline && (
              <Button variant="outline" size="sm" className="text-xs rounded-xl" onClick={() => onOpenTimeline(video.videoId)}>
                <Calendar className="h-3.5 w-3.5 mr-1.5" />
                Open in Timeline
              </Button>
            )}

            {hasDescription && (
              <div>
                <button
                  onClick={() => setDescExpanded((e) => !e)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {descExpanded ? "Hide description" : "Show description"}
                </button>
                {descExpanded && (
                  <div className="animate-fade-up">
                    <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">
                      {video.description}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div>
              <button
                onClick={() => {
                  if (!transcriptExpanded) loadTranscript();
                  setTranscriptExpanded((e) => !e);
                }}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {transcriptLabel}
                {transcript?.language && (
                  <span className="text-[10px] bg-muted rounded px-1 py-0.5 ml-1">{transcript.language}</span>
                )}
              </button>
              {transcriptExpanded && transcript?.fullText && (
                <div className="animate-fade-up">
                  <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line leading-relaxed max-h-[300px] overflow-y-auto">
                    {transcript.fullText}
                  </p>
                </div>
              )}
              {transcriptExpanded && !transcriptLoading && !transcript?.fullText && (
                <p className="text-xs text-muted-foreground/60 mt-2 italic">No transcript available for this video.</p>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5 py-3.5 border-t border-border/20 bg-muted/10">
          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-red-600 hover:bg-red-700 text-white py-2.5 text-sm font-semibold active:scale-[0.98] transition-all shadow-sm shadow-red-600/20"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            Watch on YouTube
            <ExternalLink className="h-3.5 w-3.5 opacity-60" />
          </a>
        </div>
      </div>
    </dialog>
  );
}
