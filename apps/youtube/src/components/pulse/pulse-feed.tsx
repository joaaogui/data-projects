"use client";

import type {
  BreakoutFeedItem,
  HiatusFeedItem,
  NewVideosFeedItem,
  PulseFeedItem,
  ScoreAlertFeedItem,
} from "@/hooks/use-pulse";
import { formatCompact } from "@/lib/format";
import {
  Clock,
  Flame,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Video,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type PulseFeedProps = Readonly<{
  items: PulseFeedItem[];
}>;

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function NewVideosCard({ item }: Readonly<{ item: NewVideosFeedItem }>) {
  return (
    <Link
      href={`/channel/${item.channelId}`}
      className="group block rounded-xl border border-border/40 bg-card/60 p-4 hover:bg-muted/30 hover:border-primary/20 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-sky-500/10 p-2 shrink-0">
          <Video className="h-4 w-4 text-sky-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
              {item.channelTitle}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(item.timestamp)}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            {item.count} new {item.count === 1 ? "video" : "videos"} since your last visit
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
            <Image
              src={item.topVideo.thumbnail}
              alt={item.topVideo.title}
              width={64}
              height={36}
              className="rounded object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{item.topVideo.title}</p>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                <span className="font-mono font-bold text-foreground">
                  {item.topVideo.score.toFixed(0)}
                </span>
                <span>{formatCompact(item.topVideo.views)} views</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ScoreAlertCard({ item }: Readonly<{ item: ScoreAlertFeedItem }>) {
  const isUp = item.direction === "up";
  return (
    <Link
      href={`/channel/${item.channelId}`}
      className="group block rounded-xl border border-border/40 bg-card/60 p-4 hover:bg-muted/30 hover:border-primary/20 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className={`rounded-lg p-2 shrink-0 ${isUp ? "bg-emerald-500/10" : "bg-amber-500/10"}`}>
          {isUp ? (
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          ) : (
            <TrendingDown className="h-4 w-4 text-amber-500" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
              {item.channelTitle}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(item.timestamp)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Last 5 videos averaging{" "}
            <span className={`font-semibold ${isUp ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              {item.recentAvg}
            </span>
            {" "}vs channel baseline of {item.avgScore} ({isUp ? "+" : "-"}{item.delta} points)
          </p>
        </div>
      </div>
    </Link>
  );
}

function BreakoutCard({ item }: Readonly<{ item: BreakoutFeedItem }>) {
  return (
    <Link
      href={`/channel/${item.channelId}`}
      className="group block rounded-xl border border-border/40 bg-card/60 p-4 hover:bg-muted/30 hover:border-primary/20 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-orange-500/10 p-2 shrink-0">
          <Flame className="h-4 w-4 text-orange-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
              {item.channelTitle}
            </span>
            <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(item.timestamp)}</span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">
            Breakout video scoring <span className="font-bold text-foreground">{item.video.score.toFixed(0)}</span> — well above the channel avg of {item.channelAvg}
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-2">
            <Image
              src={item.video.thumbnail}
              alt={item.video.title}
              width={64}
              height={36}
              className="rounded object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-medium truncate">{item.video.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {formatCompact(item.video.views)} views
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function HiatusCard({ item }: Readonly<{ item: HiatusFeedItem }>) {
  return (
    <Link
      href={`/channel/${item.channelId}`}
      className="group block rounded-xl border border-border/40 bg-card/60 p-4 hover:bg-muted/30 hover:border-primary/20 transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-violet-500/10 p-2 shrink-0">
          <Clock className="h-4 w-4 text-violet-500" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-semibold text-sm group-hover:text-primary transition-colors truncate">
              {item.channelTitle}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            No uploads in <span className="font-semibold text-foreground">{item.daysSinceUpload} days</span>
          </p>
        </div>
      </div>
    </Link>
  );
}

export function PulseFeed({ items }: PulseFeedProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center">
        <div className="flex justify-center mb-3">
          <div className="rounded-full bg-muted/60 p-3">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <h3 className="font-semibold text-sm mb-1">All caught up</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          No new activity from your tracked channels. Check back later or track more channels to build your feed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const key = `${item.type}-${item.channelId}-${i}`;
        switch (item.type) {
          case "new_videos":
            return <NewVideosCard key={key} item={item} />;
          case "score_alert":
            return <ScoreAlertCard key={key} item={item} />;
          case "breakout":
            return <BreakoutCard key={key} item={item} />;
          case "hiatus":
            return <HiatusCard key={key} item={item} />;
        }
      })}
    </div>
  );
}
