"use client";

import { useChannelSagas } from "@/hooks/use-channel-sagas";
import { buildSeriesIndex } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import dayjs from "dayjs";
import { useMemo } from "react";
import { SeriesList } from "./timeline/series-list";
import { TimelineFeed } from "./timeline/timeline-feed";
import { TimelineNavContext, type TimelineNav } from "./timeline/timeline-nav-context";
import { TIMELINE_PANEL_ID, TimelineToolbar } from "./timeline/timeline-toolbar";
import { useTimelineFeed } from "./timeline/use-timeline-feed";

interface TimelineViewProps {
  channelId: string;
  videos: VideoData[];
  initialVideoId?: string | null;
}

function formatSpanLabel(videos: VideoData[]): string {
  let min = Infinity;
  let max = -Infinity;
  for (const video of videos) {
    const time = new Date(video.publishedAt).getTime();
    if (time < min) min = time;
    if (time > max) max = time;
  }
  return `${dayjs(min).format("MMM YYYY")} – ${dayjs(max).format("MMM YYYY")}`;
}

export function TimelineView({ channelId, videos, initialVideoId }: Readonly<TimelineViewProps>) {
  const { sagas, isLoadingSagas } = useChannelSagas(channelId, videos);
  const seriesIndex = useMemo(() => buildSeriesIndex(videos, sagas), [videos, sagas]);
  const videoById = useMemo(
    () => new Map(videos.map((video) => [video.videoId, video])),
    [videos]
  );

  const feed = useTimelineFeed({
    videos,
    seriesIndex,
    initialVideoId,
    ready: !isLoadingSagas,
  });
  const { reveal, toggle } = feed;
  const nav = useMemo<TimelineNav>(
    () => ({ seriesIndex, videoById, reveal, toggle }),
    [seriesIndex, videoById, reveal, toggle]
  );

  const span = useMemo(
    () => (videos.length > 0 ? formatSpanLabel(videos) : ""),
    [videos]
  );

  if (videos.length === 0) return null;

  const seriesCount = seriesIndex.series.length;
  const standaloneCount = videos.length - seriesIndex.byVideo.size;

  const summary =
    feed.mode === "series" ? (
      <>
        <span className="font-medium tabular-nums text-foreground">{seriesCount}</span> series ·{" "}
        {seriesIndex.byVideo.size.toLocaleString()} videos · {span}
      </>
    ) : (
      <>
        <span className="font-medium tabular-nums text-foreground">{feed.filtered.length}</span>
        {feed.filtered.length !== videos.length && ` of ${videos.length}`} videos · {span}
      </>
    );

  return (
    <TimelineNavContext value={nav}>
      <div className="flex h-full flex-col gap-3">
        <TimelineToolbar
          summary={summary}
          query={feed.query}
          onQueryChange={feed.setQuery}
          mode={feed.mode}
          onModeChange={feed.setMode}
          seriesCount={seriesCount}
          newestFirst={feed.newestFirst}
          onToggleSort={feed.toggleSort}
          onlySeries={feed.onlySeries}
          onToggleOnlySeries={() => feed.setOnlySeries((value) => !value)}
        />

        <div
          id={TIMELINE_PANEL_ID}
          role="tabpanel"
          className="flex min-h-0 flex-1 flex-col gap-3"
        >
          {feed.mode === "series" ? (
            <SeriesList
              series={seriesIndex.series}
              videoById={videoById}
              query={feed.query}
              newestFirst={feed.newestFirst}
              expandedId={feed.expandedId}
              standaloneCount={standaloneCount}
              onShowTimeline={() => feed.setMode("timeline")}
            />
          ) : (
            <TimelineFeed feed={feed} />
          )}
        </div>
      </div>
    </TimelineNavContext>
  );
}
