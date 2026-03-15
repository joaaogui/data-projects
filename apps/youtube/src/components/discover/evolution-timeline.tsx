"use client";

import { useDiscoverEvolution } from "@/hooks/use-discover";
import { Button } from "@data-projects/ui";
import { AlertCircle, History, Loader2, Sparkles } from "lucide-react";

const ERA_COLORS = [
  "border-sky-500/60 bg-sky-500/5",
  "border-violet-500/60 bg-violet-500/5",
  "border-emerald-500/60 bg-emerald-500/5",
  "border-amber-500/60 bg-amber-500/5",
  "border-rose-500/60 bg-rose-500/5",
  "border-cyan-500/60 bg-cyan-500/5",
];

const DOT_COLORS = [
  "bg-sky-500",
  "bg-violet-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

export function EvolutionTimeline({ channelId }: Readonly<{ channelId: string }>) {
  const { data, generate, isLoading, error } = useDiscoverEvolution(channelId);

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <History className="h-4 w-4 text-sky-500" />
        <h3 className="text-sm font-semibold">Creator Evolution</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        How this creator&apos;s content has changed over time.
      </p>

      {!data && !isLoading && !error && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            AI will analyze all videos to map out how this creator evolved
          </p>
          <Button size="sm" onClick={() => generate()} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Generate Evolution
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Analyzing content evolution&hellip;</span>
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
        <div className="space-y-4">
          {data.summary && (
            <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-primary/30 pl-3">
              {data.summary}
            </p>
          )}

          <div className="relative pl-6">
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border/60" />

            {data.eras.map((era, i) => (
              <div key={era.period} className="relative pb-5 last:pb-0">
                <div className={`absolute left-[-15px] top-2 h-3 w-3 rounded-full ring-2 ring-card ${DOT_COLORS[i % DOT_COLORS.length]}`} />
                <div className={`rounded-xl border-l-2 p-3.5 ${ERA_COLORS[i % ERA_COLORS.length]}`}>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h4 className="text-sm font-semibold">{era.period}</h4>
                    <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                      {era.startDate} &rarr; {era.endDate}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">
                    {era.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {era.videoCount} videos
                    </span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className="text-[10px] text-muted-foreground italic">
                      {era.style}
                    </span>
                  </div>

                  {era.topics.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {era.topics.map((topic) => (
                        <span
                          key={topic}
                          className="text-[9px] rounded-full bg-foreground/5 border border-border/30 px-2 py-0.5 text-muted-foreground"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
