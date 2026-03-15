"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export interface RecentChannel {
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  visitedAt: number;
}

const STORAGE_KEY = "youtube-recent-channels";
const MAX_RECENT = 6;

export function saveRecentChannel(channel: RecentChannel): void {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as RecentChannel[];
    const filtered = stored.filter((c) => c.channelId !== channel.channelId);
    filtered.unshift({ ...channel, visitedAt: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered.slice(0, MAX_RECENT)));
  } catch { /* localStorage unavailable */ }
}

export function RecentChannels() {
  const [channels, setChannels] = useState<RecentChannel[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as RecentChannel[];
      setChannels(stored.slice(0, MAX_RECENT));
    } catch { /* localStorage unavailable */ }
  }, []);

  if (channels.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 justify-center">
        <div className="h-px w-8 bg-border/50" />
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Recently analyzed
        </p>
        <div className="h-px w-8 bg-border/50" />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {channels.map((ch) => (
          <Link
            key={ch.channelId}
            href={`/channel/${ch.channelId}`}
            className="group flex items-center gap-2.5 rounded-full bg-card/80 border border-border/50 px-3.5 py-2 text-sm font-medium hover:bg-muted/60 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/20 transition-all duration-200"
          >
            {ch.thumbnail ? (
              <Image
                src={ch.thumbnail}
                alt={ch.channelTitle}
                width={24}
                height={24}
                sizes="24px"
                className="h-6 w-6 rounded-full object-cover ring-1 ring-border/30 group-hover:ring-primary/30 transition-all"
              />
            ) : (
              <div className="h-6 w-6 rounded-full bg-muted ring-1 ring-border/30" />
            )}
            <span className="max-w-[120px] truncate group-hover:text-primary transition-colors">{ch.channelTitle}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
