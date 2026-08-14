"use client";

import { useDiscoverDna } from "@/hooks/use-discover";
import { Button } from "@data-projects/ui";
import { AlertCircle, Loader2, MessageCircle, Quote, Sparkles } from "lucide-react";

const TRAIT_COLORS = [
  "bg-muted text-muted-foreground border-border",
  "bg-muted text-muted-foreground border-border",
  "bg-muted text-muted-foreground border-border",
  "bg-muted text-muted-foreground border-border",
  "bg-destructive/10 text-destructive border-destructive/30",
  "bg-muted text-muted-foreground border-border",
];

export function ChannelDna({ channelId }: Readonly<{ channelId: string }>) {
  const { data, generate, isLoading, error } = useDiscoverDna(channelId);

  return (
    <div className="bg-card border border-border rounded-lg p-4 sm:p-5">
      <p className="text-xs text-muted-foreground mb-4">
        Personality profile built from transcript analysis.
      </p>

      {!data && !isLoading && !error && (
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            AI will read transcript excerpts to build a personality fingerprint
          </p>
          <Button size="sm" onClick={() => generate()} className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Generate Profile
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Reading transcripts&hellip;</span>
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
            <p className="text-xs text-muted-foreground leading-relaxed">
              {data.summary}
            </p>
          )}

          {data.style && (
            <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
              <MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                {data.style}
              </p>
            </div>
          )}

          <div className="space-y-2.5">
            {data.traits.map((trait, i) => (
              <div
                key={trait.category}
                className={`rounded-xl border p-3 ${TRAIT_COLORS[i % TRAIT_COLORS.length]}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider font-semibold">
                    {trait.category}
                  </span>
                </div>
                <p className="text-xs font-medium mb-1.5">{trait.value}</p>
                {trait.examples.length > 0 && (
                  <div className="space-y-1">
                    {trait.examples.slice(0, 2).map((ex) => (
                      <p
                        key={ex}
                        className="text-[11px] opacity-80 italic line-clamp-2"
                      >
                        &ldquo;{ex}&rdquo;
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {data.catchphrases.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Quote className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Catchphrases
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.catchphrases.map((phrase) => (
                  <span
                    key={phrase}
                    className="text-xs rounded-full border border-border bg-muted/30 px-2.5 py-1 font-medium"
                  >
                    &ldquo;{phrase}&rdquo;
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
