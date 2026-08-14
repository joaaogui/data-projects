"use client";

import { useChannel } from "@/hooks/use-channel-context";
import type { VideoData } from "@/types/youtube";
import { useState } from "react";
import { ChannelDna } from "./channel-dna";
import { ChannelTrivia } from "./channel-trivia";
import { EvolutionTimeline } from "./evolution-timeline";
import { HiddenGems } from "./hidden-gems";
import { RabbitHole } from "./rabbit-hole";
import { SimilarVideos } from "./similar-videos";
import { StarterPack } from "./starter-pack";
import { ViralMoments } from "./viral-moments";

interface DiscoverViewProps {
  channelId: string;
  videos: VideoData[];
}

type WatchLens = "gems" | "viral" | "liked";
type Insight = "trivia" | "evolution" | "dna";

/**
 * Zones, not a wall of panels. Everything here answers one of three questions
 * -- what should I watch, what is this channel like, who else should I follow --
 * and each zone shows a single answer at a time so the AI-backed ones stop
 * competing as a row of empty "Generate" buttons.
 */
function Zone<T extends string>({
  label,
  options,
  value,
  onChange,
  children,
}: Readonly<{
  label: string;
  options?: { id: T; label: string }[];
  value?: T;
  onChange?: (id: T) => void;
  children: React.ReactNode;
}>) {
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </h2>
        {options && (
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            {options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onChange?.(opt.id)}
                aria-pressed={value === opt.id}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  value === opt.id
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

export function DiscoverView({ channelId, videos }: Readonly<DiscoverViewProps>) {
  const { accountData } = useChannel();
  const [lens, setLens] = useState<WatchLens>("gems");
  const [insight, setInsight] = useState<Insight>("trivia");

  return (
    <div className="h-full space-y-6 overflow-y-auto p-1">
      <Zone label="Start here">
        <StarterPack channelId={channelId} videos={videos} />
      </Zone>

      <Zone
        label="What to watch"
        value={lens}
        onChange={setLens}
        options={[
          { id: "gems", label: "Hidden gems" },
          { id: "viral", label: "Viral moments" },
          { id: "liked", label: "If you liked…" },
        ]}
      >
        {lens === "gems" && <HiddenGems videos={videos} />}
        {lens === "viral" && <ViralMoments videos={videos} />}
        {lens === "liked" && (
          <SimilarVideos videos={videos} likedVideoIds={accountData.likedVideoIds} />
        )}
      </Zone>

      <Zone
        label="Understand the channel"
        value={insight}
        onChange={setInsight}
        options={[
          { id: "trivia", label: "Trivia" },
          { id: "evolution", label: "Evolution" },
          { id: "dna", label: "DNA" },
        ]}
      >
        {insight === "trivia" && <ChannelTrivia videos={videos} />}
        {insight === "evolution" && <EvolutionTimeline channelId={channelId} />}
        {insight === "dna" && <ChannelDna channelId={channelId} />}
      </Zone>

      <Zone label="Beyond this channel">
        <RabbitHole channelId={channelId} />
      </Zone>
    </div>
  );
}
