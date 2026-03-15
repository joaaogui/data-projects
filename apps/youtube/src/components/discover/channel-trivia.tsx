"use client";

import { formatCompact } from "@/lib/format";
import type { VideoData } from "@/types/youtube";
import {
  Calendar,
  Clock,
  Flame,
  MessageSquare,
  Pause,
  PenLine,
  ThumbsUp,
  Trophy,
} from "lucide-react";
import { useMemo } from "react";

interface TriviaFact {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  color: string;
}

function formatDurationHuman(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function truncateTitle(title: string, max = 50): string {
  return title.length > max ? title.slice(0, max - 3) + "..." : title;
}

function findLongestHiatus(sorted: VideoData[]): TriviaFact | null {
  let maxGap = 0;
  let gapStart = "";
  let gapEnd = "";
  for (let i = 1; i < sorted.length; i++) {
    const diff =
      new Date(sorted[i].publishedAt).getTime() -
      new Date(sorted[i - 1].publishedAt).getTime();
    if (diff > maxGap) {
      maxGap = diff;
      gapStart = sorted[i - 1].publishedAt;
      gapEnd = sorted[i].publishedAt;
    }
  }
  if (maxGap === 0) return null;
  const days = Math.round(maxGap / (1000 * 60 * 60 * 24));
  return {
    icon: <Pause className="h-4 w-4" />,
    label: "Longest hiatus",
    value: `${days} days`,
    detail: `${new Date(gapStart).toLocaleDateString("en-US", { month: "short", year: "numeric" })} to ${new Date(gapEnd).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
    color: "text-orange-500",
  };
}

function findMostProlificMonth(videos: VideoData[]): TriviaFact | null {
  const monthCounts = new Map<string, number>();
  for (const v of videos) {
    const key = new Date(v.publishedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const topMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!topMonth) return null;
  return {
    icon: <Flame className="h-4 w-4" />,
    label: "Most prolific month",
    value: `${topMonth[1]} uploads`,
    detail: topMonth[0],
    color: "text-amber-500",
  };
}

function computeTrivia(videos: VideoData[]): TriviaFact[] {
  if (videos.length < 3) return [];

  const facts: TriviaFact[] = [];
  const sorted = [...videos].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );
  const byDuration = [...videos].sort((a, b) => b.duration - a.duration);

  facts.push({
    icon: <Clock className="h-4 w-4" />,
    label: "Longest video",
    value: formatDurationHuman(byDuration[0].duration),
    detail: truncateTitle(byDuration[0].title),
    color: "text-sky-500",
  });

  const shortest = byDuration.at(-1)!;
  if (shortest.duration !== byDuration[0].duration) {
    facts.push({
      icon: <Clock className="h-4 w-4" />,
      label: "Shortest video",
      value: formatDurationHuman(shortest.duration),
      detail: truncateTitle(shortest.title),
      color: "text-indigo-500",
    });
  }

  const mostCommented = [...videos].sort((a, b) => b.comments - a.comments)[0];
  facts.push({
    icon: <MessageSquare className="h-4 w-4" />,
    label: "Most discussed",
    value: `${formatCompact(mostCommented.comments)} comments`,
    detail: truncateTitle(mostCommented.title),
    color: "text-emerald-500",
  });

  const bestLikeRatio = [...videos]
    .filter((v) => v.views > 0)
    .sort((a, b) => b.likes / b.views - a.likes / a.views)[0];
  if (bestLikeRatio) {
    const ratio = ((bestLikeRatio.likes / bestLikeRatio.views) * 100).toFixed(1);
    facts.push({
      icon: <ThumbsUp className="h-4 w-4" />,
      label: "Most loved",
      value: `${ratio}% like rate`,
      detail: truncateTitle(bestLikeRatio.title),
      color: "text-rose-500",
    });
  }

  const hiatus = findLongestHiatus(sorted);
  if (hiatus) facts.push(hiatus);

  const prolific = findMostProlificMonth(videos);
  if (prolific) facts.push(prolific);

  const totalSeconds = videos.reduce((s, v) => s + v.duration, 0);
  const totalHours = Math.round(totalSeconds / 3600);
  facts.push({
    icon: <Trophy className="h-4 w-4" />,
    label: "Total runtime",
    value: totalHours >= 24 ? `${(totalHours / 24).toFixed(1)} days` : `${totalHours}h`,
    detail: "If you watched everything back-to-back",
    color: "text-teal-500",
  });

  const avgTitleLen = Math.round(videos.reduce((s, v) => s + v.title.length, 0) / videos.length);
  const longestTitle = [...videos].sort((a, b) => b.title.length - a.title.length)[0];
  facts.push({
    icon: <PenLine className="h-4 w-4" />,
    label: "Avg title length",
    value: `${avgTitleLen} chars`,
    detail: `Longest: "${truncateTitle(longestTitle.title, 40)}"`,
    color: "text-purple-500",
  });

  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  for (const v of videos) {
    dayCounts[new Date(v.publishedAt).getDay()]++;
  }
  const bestDayIdx = dayCounts.indexOf(Math.max(...dayCounts));
  facts.push({
    icon: <Calendar className="h-4 w-4" />,
    label: "Favorite upload day",
    value: dayNames[bestDayIdx],
    detail: `${dayCounts[bestDayIdx]} videos published on ${dayNames[bestDayIdx]}s`,
    color: "text-cyan-500",
  });

  return facts;
}

export function ChannelTrivia({ videos }: Readonly<{ videos: VideoData[] }>) {
  const facts = useMemo(() => computeTrivia(videos), [videos]);

  if (facts.length === 0) {
    return null;
  }

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
      <h3 className="text-sm font-semibold mb-4">Channel Trivia</h3>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex items-start gap-3 rounded-xl border border-border/30 p-3"
          >
            <div className={`shrink-0 mt-0.5 ${fact.color}`}>{fact.icon}</div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {fact.label}
              </p>
              <p className="text-sm font-bold tabular-nums leading-tight mt-0.5">
                {fact.value}
              </p>
              {fact.detail && (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                  {fact.detail}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
