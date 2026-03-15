"use client";

import { formatCompact, getScoreColorClass } from "@/lib/format";
import type { VideoData } from "@/types/youtube";
import { Gem } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface GemVideo extends VideoData {
  gemScore: number;
}

function findHiddenGems(videos: VideoData[]): GemVideo[] {
  if (videos.length < 5) return [];

  const viewsList = videos.map((v) => v.views);
  const engList = videos.map((v) => v.rates?.engagementRate ?? 0);

  const medianViews = median(viewsList);
  const medianEng = median(engList);

  if (medianViews === 0 || medianEng === 0) return [];

  const viewRanks = new Map<string, number>();
  const engRanks = new Map<string, number>();

  const byViews = [...videos].sort((a, b) => b.views - a.views);
  const byEng = [...videos].sort(
    (a, b) => (b.rates?.engagementRate ?? 0) - (a.rates?.engagementRate ?? 0),
  );

  byViews.forEach((v, i) => viewRanks.set(v.videoId, i + 1));
  byEng.forEach((v, i) => engRanks.set(v.videoId, i + 1));

  return videos
    .filter(
      (v) =>
        (v.rates?.engagementRate ?? 0) > medianEng * 1.5 &&
        v.views < medianViews * 0.7,
    )
    .map((v) => {
      const viewRank = viewRanks.get(v.videoId) ?? videos.length;
      const engRank = engRanks.get(v.videoId) ?? videos.length;
      return { ...v, gemScore: viewRank / Math.max(engRank, 1) };
    })
    .sort((a, b) => b.gemScore - a.gemScore)
    .slice(0, 8);
}

export function HiddenGems({ videos }: Readonly<{ videos: VideoData[] }>) {
  const gems = useMemo(() => findHiddenGems(videos), [videos]);

  if (gems.length === 0) {
    return (
      <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Gem className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold">Hidden Gems</h3>
        </div>
        <p className="text-xs text-muted-foreground text-center py-6">
          Not enough data to surface hidden gems yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Gem className="h-4 w-4 text-violet-500" />
        <h3 className="text-sm font-semibold">Hidden Gems</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        High engagement, low views &mdash; the stuff most people missed.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {gems.map((video) => (
          <a
            key={video.videoId}
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-3 rounded-xl p-2 -m-2 hover:bg-muted/60 transition-colors"
          >
            <div className="relative w-20 shrink-0 aspect-video rounded-lg overflow-hidden bg-muted">
              <Image
                src={video.thumbnail}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
              <div className="absolute top-1 right-1 flex items-center gap-0.5 rounded-full bg-violet-500/90 px-1.5 py-0.5">
                <Gem className="h-2.5 w-2.5 text-white" />
                <span className="text-[9px] font-bold text-white">
                  {video.gemScore.toFixed(1)}x
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium line-clamp-2 leading-tight group-hover:text-foreground">
                {video.title}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[11px] text-muted-foreground">
                  {formatCompact(video.views)} views
                </span>
                <span className="text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                  {(video.rates?.engagementRate ?? 0).toFixed(1)} eng/1K
                </span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${getScoreColorClass(video.score)}`}
                >
                  {video.score.toFixed(0)}
                </span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
