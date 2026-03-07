"use client";

import { useMemo, useState } from "react";
import { Button } from "@data-projects/ui";
import { X, ExternalLink, ChevronLeft, ChevronRight, Calendar, Eye, ThumbsUp, MessageSquare } from "lucide-react";
import Image from "next/image";
import dayjs from "dayjs";
import type { VideoData, ScoreComponents } from "@/types/youtube";
import { formatDuration } from "@/lib/scoring";
import { ScoreRing } from "./score-ring";
import { METRIC_CONFIGS, METRIC_TYPES, getNormalizedWeight, type MetricWeights } from "./metric-icon";

interface VideoDetailPanelProps {
  video: VideoData;
  allVideos: VideoData[];
  weights: MetricWeights;
  onClose: () => void;
  onSelectVideo: (videoId: string) => void;
}

const formatNumber = (num: number) => num.toLocaleString("en-US");
const formatCompact = (num: number): string => {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString("en-US");
};

const METRIC_TO_COMPONENT: Record<string, keyof ScoreComponents> = {
  views: "reachScore",
  engagement: "engagementScore",
  consistency: "consistencyScore",
  community: "communityScore",
};

function MetricBar({ label, value, color }: Readonly<{ label: string; value: number; color: string }>) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={`font-medium tabular-nums ${color}`}>{value.toFixed(0)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color.replace("text-", "bg-")}`}
          style={{ width: `${Math.min(value, 100)}%` }}
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
}: Readonly<VideoDetailPanelProps>) {
  const [descExpanded, setDescExpanded] = useState(false);

  const chronological = useMemo(() => {
    const sorted = [...allVideos].sort(
      (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
    );
    const idx = sorted.findIndex((v) => v.videoId === video.videoId);
    return { sorted, index: idx };
  }, [allVideos, video.videoId]);

  const prev = chronological.index > 0 ? chronological.sorted[chronological.index - 1] : null;
  const next = chronological.index < chronological.sorted.length - 1 ? chronological.sorted[chronological.index + 1] : null;

  const publishDate = dayjs(video.publishedAt).format("MMM D, YYYY");
  const hasDescription = video.description && video.description.trim().length > 0;

  return (
    <div className="w-[380px] flex-shrink-0 border-l border-border/50 bg-card/80 backdrop-blur-sm flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Video Details</span>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative aspect-video w-full">
          <Image
            src={video.thumbnail.replace("default", "hqdefault")}
            alt={video.title}
            fill
            className="object-cover"
          />
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded font-medium tabular-nums">
            {formatDuration(video.duration)}
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-sm leading-snug">{video.title}</h3>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{publishDate}</span>
              <span className="text-border">|</span>
              <span>{video.days === 0 ? "Today" : `${video.days}d ago`}</span>
            </div>
          </div>

          <div className="flex items-center justify-center py-2">
            <ScoreRing score={video.score} scoreComponents={video.scoreComponents} weights={weights} size={72} />
          </div>

          <div className="space-y-2.5">
            {METRIC_TYPES.map((type) => {
              const config = METRIC_CONFIGS[type];
              const componentKey = METRIC_TO_COMPONENT[type];
              const value = video.scoreComponents[componentKey] ?? 0;
              const weight = getNormalizedWeight(weights, type);
              return (
                <MetricBar
                  key={type}
                  label={`${config.label} (${weight}%)`}
                  value={value}
                  color={config.color}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-muted/50 p-2.5 text-center">
              <Eye className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-semibold tabular-nums">{formatCompact(video.views)}</p>
              <p className="text-[10px] text-muted-foreground">views</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2.5 text-center">
              <ThumbsUp className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-semibold tabular-nums">{formatCompact(video.likes)}</p>
              <p className="text-[10px] text-muted-foreground">likes</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-2.5 text-center">
              <MessageSquare className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
              <p className="text-sm font-semibold tabular-nums">{formatCompact(video.comments)}</p>
              <p className="text-[10px] text-muted-foreground">comments</p>
            </div>
          </div>

          <div className="rounded-lg border border-border/50 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Video {chronological.index + 1} of {chronological.sorted.length} chronologically
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-1 text-xs"
                disabled={!prev}
                onClick={() => prev && onSelectVideo(prev.videoId)}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Older
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-1 text-xs"
                disabled={!next}
                onClick={() => next && onSelectVideo(next.videoId)}
              >
                Newer
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>

          {hasDescription && (
            <div>
              <button
                onClick={() => setDescExpanded((e) => !e)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {descExpanded ? "Hide description" : "Show description"}
              </button>
              {descExpanded && (
                <p className="text-xs text-muted-foreground mt-2 whitespace-pre-line leading-relaxed">
                  {video.description}
                </p>
              )}
            </div>
          )}

          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-lg bg-primary text-primary-foreground py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Watch on YouTube
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
