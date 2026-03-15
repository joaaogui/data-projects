"use client";

import { useDiscoverRabbitHole } from "@/hooks/use-discover";
import { Button } from "@data-projects/ui";
import { AlertCircle, ExternalLink, Loader2, Network, Sparkles } from "lucide-react";

const FREQUENCY_COLORS = [
  "border-l-emerald-500/60",
  "border-l-sky-500/60",
  "border-l-violet-500/60",
  "border-l-amber-500/60",
  "border-l-rose-500/60",
];

export function RabbitHole({ channelId }: Readonly<{ channelId: string }>) {
  const { data, generate, isLoading, error } = useDiscoverRabbitHole(channelId);

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Network className="h-4 w-4 text-rose-500" />
        <h3 className="text-sm font-semibold">Rabbit Hole</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Other creators mentioned, referenced, or collaborated with.
      </p>

      {!data && !isLoading && !error && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Network className="h-6 w-6 text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            AI will scan descriptions and transcripts to find creator connections
          </p>
          <Button size="sm" onClick={() => generate()} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Find Connections
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Scanning for connections&hellip;</span>
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

      {data?.mentions.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-6">
          No creator connections found for this channel.
        </p>
      )}

      {(data?.mentions.length ?? 0) > 0 && data && (
        <div className="space-y-2">
          {data.mentions.map((mention, i) => (
            <div
              key={mention.name}
              className={`rounded-xl border border-border/30 border-l-2 p-3 ${FREQUENCY_COLORS[i % FREQUENCY_COLORS.length]}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold truncate">
                    {mention.name}
                  </span>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(mention.name)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Search on YouTube"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                  {mention.frequency} {mention.frequency === 1 ? "mention" : "mentions"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {mention.context}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
