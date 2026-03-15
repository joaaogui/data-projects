"use client";

import { formatCompact } from "@/lib/format";
import type { VideoData } from "@/types/youtube";
import { Zap } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getMostCommonTopics(videos: VideoData[]): Set<string> {
  const freq = new Map<string, number>();
  for (const v of videos) {
    for (const t of v.topics ?? []) {
      freq.set(t, (freq.get(t) ?? 0) + 1);
    }
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  return new Set(sorted.slice(0, 5).map(([t]) => t));
}

interface ViralVideo extends VideoData {
  breakoutFactor: number;
  unusualTopics: string[];
}

function findViralMoments(videos: VideoData[]): ViralVideo[] {
  if (videos.length < 5) return [];

  const medianViews = median(videos.map((v) => v.views));
  if (medianViews === 0) return [];

  const commonTopics = getMostCommonTopics(videos);

  return videos
    .filter((v) => v.views > medianViews * 3)
    .map((v) => {
      const breakoutFactor = v.views / medianViews;
      const unusualTopics = (v.topics ?? []).filter(
        (t) => !commonTopics.has(t),
      );
      return { ...v, breakoutFactor, unusualTopics };
    })
    .sort((a, b) => b.breakoutFactor - a.breakoutFactor)
    .slice(0, 10);
}

function getBreakoutContext(
  video: ViralVideo,
  avgDuration: number,
): string | null {
  if (video.unusualTopics.length > 0) {
    return `Unique topic: ${video.unusualTopics[0]}`;
  }
  if (video.duration > avgDuration * 2) return "Much longer than usual";
  if (video.duration < avgDuration * 0.3) return "Much shorter than usual";
  return null;
}

export function ViralMoments({ videos }: Readonly<{ videos: VideoData[] }>) {
  const { viralVideos, avgDuration } = useMemo(() => {
    const avg =
      videos.length > 0
        ? videos.reduce((s, v) => s + v.duration, 0) / videos.length
        : 0;
    return { viralVideos: findViralMoments(videos), avgDuration: avg };
  }, [videos]);

  if (viralVideos.length === 0) {
    return (
      <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-4 w-4 text-amber-500" />
          <h3 className="text-sm font-semibold">Viral Moments</h3>
        </div>
        <p className="text-xs text-muted-foreground text-center py-6">
          No breakout videos detected for this channel.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Zap className="h-4 w-4 text-amber-500" />
        <h3 className="text-sm font-semibold">Viral Moments</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Videos that massively outperformed the channel&apos;s baseline.
      </p>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {viralVideos.map((video) => {
          const context = getBreakoutContext(video, avgDuration);
          return (
            <a
              key={video.videoId}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group shrink-0 w-48 snap-start"
            >
              <div className="relative aspect-video rounded-xl overflow-hidden bg-muted">
                <Image
                  src={video.thumbnail}
                  alt=""
                  fill
                  sizes="192px"
                  className="object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute top-1.5 left-1.5 flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5">
                  <Zap className="h-3 w-3 text-white" />
                  <span className="text-[10px] font-bold text-white">
                    {video.breakoutFactor.toFixed(0)}x
                  </span>
                </div>
              </div>
              <div className="mt-2 px-0.5">
                <p className="text-xs font-medium line-clamp-2 leading-tight">
                  {video.title}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {formatCompact(video.views)} views
                </p>
                {context && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                    {context}
                  </p>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
