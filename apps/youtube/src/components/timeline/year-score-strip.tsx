"use client";

import type { VideoData } from "@/types/youtube";
import { useMemo } from "react";

const MAX_SCORE_BARS = 120;

/**
 * One bar per video in publication order: at a glance it shows whether a year
 * was consistent or erratic, which a single average can't convey.
 */
export function YearScoreStrip({ videos }: Readonly<{ videos: VideoData[] }>) {
  const chronological = useMemo(
    () =>
      [...videos].sort(
        (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
      ),
    [videos]
  );
  const sampleStep = Math.max(1, Math.ceil(chronological.length / MAX_SCORE_BARS));
  const sampled = chronological.filter(
    (_, index) => index % sampleStep === 0 || index === chronological.length - 1
  );

  return (
    <div
      className="flex h-8 flex-1 items-end gap-px overflow-hidden"
      aria-hidden
      title={`Scores in publication order${
        sampleStep > 1 ? `, sampled every ${sampleStep} videos` : ""
      }`}
    >
      {sampled.map((v) => (
        <div
          key={v.videoId}
          className={`w-1 shrink-0 rounded-[1px] ${v.score >= 70 ? "bg-data" : "bg-foreground/30"}`}
          style={{ height: `${Math.max(v.score, 6)}%` }}
        />
      ))}
    </div>
  );
}
