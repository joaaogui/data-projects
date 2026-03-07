"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

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
  } catch {}
}

export function RecentChannels() {
  const [channels, setChannels] = useState<RecentChannel[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as RecentChannel[];
      setChannels(stored.slice(0, MAX_RECENT));
    } catch {}
  }, []);

  if (channels.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Recently analyzed
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {channels.map((ch) => (
          <Link
            key={ch.channelId}
            href={`/channel/${ch.channelId}`}
            className="flex items-center gap-2 rounded-full bg-card/80 border border-border/50 px-3 py-1.5 text-sm font-medium hover:bg-muted/60 transition-colors"
          >
            {ch.thumbnail ? (
              <Image
                src={ch.thumbnail}
                alt={ch.channelTitle}
                width={20}
                height={20}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <div className="h-5 w-5 rounded-full bg-muted" />
            )}
            <span className="max-w-[120px] truncate">{ch.channelTitle}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
