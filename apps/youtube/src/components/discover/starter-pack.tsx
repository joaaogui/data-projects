"use client";

import { useDiscoverStarterPack } from "@/hooks/use-discover";
import { formatCompact, getScoreColorClass } from "@/lib/format";
import type { VideoData } from "@/types/youtube";
import { Button } from "@data-projects/ui";
import { AlertCircle, Loader2, Play, Sparkles } from "lucide-react";
import Image from "next/image";
import { useMemo } from "react";

const CATEGORY_STYLES: Record<string, { label: string; className: string }> = {
  signature: { label: "Signature", className: "bg-violet-500/90 text-white" },
  best: { label: "Best Work", className: "bg-emerald-500/90 text-white" },
  gem: { label: "Hidden Gem", className: "bg-amber-500/90 text-white" },
  recent: { label: "Recent", className: "bg-sky-500/90 text-white" },
  classic: { label: "Classic", className: "bg-rose-500/90 text-white" },
};

export function StarterPack({
  channelId,
  videos,
}: Readonly<{ channelId: string; videos: VideoData[] }>) {
  const { data, generate, isLoading, error } = useDiscoverStarterPack(channelId);

  const videoMap = useMemo(
    () => new Map(videos.map((v) => [v.videoId, v])),
    [videos],
  );

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Play className="h-4 w-4 text-emerald-500" />
        <h3 className="text-sm font-semibold">Starter Pack</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        New to this channel? Here&apos;s where to start.
      </p>

      {!data && !isLoading && !error && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Play className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            AI will curate 5-7 essential videos for a first-time viewer
          </p>
          <Button size="sm" onClick={() => generate()} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Generate Starter Pack
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Curating the best videos&hellip;</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
          <Button size="sm" variant="ghost" onClick={() => generate()} className="ml-auto shrink-0 text-xs">
            Retry
          </Button>
        </div>
      )}

      {data && (
        <div className="space-y-3">
          {data.intro && (
            <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-emerald-500/30 pl-3">
              {data.intro}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {data.picks.map((pick, _) => {
              const video = videoMap.get(pick.videoId);
              if (!video) return null;

              const catStyle = CATEGORY_STYLES[pick.category] ?? CATEGORY_STYLES.signature;

              return (
                <a
                  key={pick.videoId}
                  href={video.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border border-border/30 overflow-hidden hover:border-border/60 transition-colors"
                >
                  <div className="relative aspect-video bg-muted">
                    <Image
                      src={video.thumbnail}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform group-hover:scale-105"
                    />
                    <div className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${catStyle.className}`}>
                      {catStyle.label}
                    </div>
                    <div className="absolute bottom-2 right-2 flex items-center gap-1">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${getScoreColorClass(video.score)}`}
                      >
                        {video.score.toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium line-clamp-2 leading-tight mb-1">
                      {video.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mb-2">
                      {formatCompact(video.views)} views
                    </p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {pick.reason}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
