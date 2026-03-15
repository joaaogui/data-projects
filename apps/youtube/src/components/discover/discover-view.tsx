"use client";

import { useChannel } from "@/hooks/use-channel-context";
import type { VideoData } from "@/types/youtube";
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

export function DiscoverView({ channelId, videos }: Readonly<DiscoverViewProps>) {
  const { accountData } = useChannel();

  return (
    <div className="h-full overflow-y-auto space-y-4 p-1">
      <StarterPack channelId={channelId} videos={videos} />
      <HiddenGems videos={videos} />
      <ViralMoments videos={videos} />
      <ChannelTrivia videos={videos} />
      <EvolutionTimeline channelId={channelId} />
      <ChannelDna channelId={channelId} />
      <SimilarVideos videos={videos} likedVideoIds={accountData.likedVideoIds} />
      <RabbitHole channelId={channelId} />
    </div>
  );
}
