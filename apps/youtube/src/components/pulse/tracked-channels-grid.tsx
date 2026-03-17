"use client";

import type { PulseChannel } from "@/hooks/use-pulse";
import { formatCompact } from "@/lib/format";
import { Bookmark, Eye, Film, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export function TrackedChannelsGrid({ channels }: Readonly<{ channels: PulseChannel[] }>) {
  if (channels.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/40 p-8 text-center">
        <div className="flex justify-center mb-3">
          <div className="rounded-full bg-muted/60 p-3">
            <Bookmark className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
        <h3 className="font-semibold text-sm mb-1">No tracked channels yet</h3>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Visit any channel and click the bookmark icon to start tracking it.
          You&apos;ll see updates and insights here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {channels.map((ch) => (
        <Link
          key={ch.channelId}
          href={`/channel/${ch.channelId}`}
          className="group rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 hover:bg-muted/30 hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-start gap-3">
            <div className="relative h-10 w-10 shrink-0">
              {ch.thumbnailUrl ? (
                <Image
                  src={ch.thumbnailUrl}
                  alt={ch.channelTitle ?? ""}
                  fill
                  sizes="40px"
                  className="rounded-full object-cover ring-1 ring-border/30 group-hover:ring-primary/40 transition-all"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted ring-1 ring-border/30" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                {ch.channelTitle ?? ch.channelId}
              </p>
              {ch.label && (
                <p className="text-[10px] text-primary/70 font-medium truncate">{ch.label}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                {ch.subscriberCount != null && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {formatCompact(ch.subscriberCount)}
                  </span>
                )}
                {ch.videoCount != null && (
                  <span className="flex items-center gap-1">
                    <Film className="h-3 w-3" />
                    {ch.videoCount}
                  </span>
                )}
                {ch.totalViewCount != null && (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {formatCompact(ch.totalViewCount)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
