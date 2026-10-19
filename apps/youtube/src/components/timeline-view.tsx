"use client";

import { useChannelSagas } from "@/hooks/use-channel-sagas";
import { buildSeriesIndex } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import dayjs from "dayjs";
import { useMemo } from "react";
import { renderWindow } from "./timeline/map-layout";
import { MapDetail } from "./timeline/map-detail";
import { MapOverview } from "./timeline/map-overview";
import { MapToolbar } from "./timeline/map-toolbar";
import { SERIES_KIND_LABEL } from "./timeline/series-colors";
import { StoryMap } from "./timeline/story-map";
import { TimelineNavContext, type TimelineNav } from "./timeline/timeline-nav-context";
import { useMapViewport } from "./timeline/use-map-viewport";
import { useStoryMap } from "./timeline/use-story-map";

interface TimelineViewProps {
  channelId: string;
  videos: VideoData[];
  initialVideoId?: string | null;
}

export function TimelineView({ channelId, videos, initialVideoId }: Readonly<TimelineViewProps>) {
  const { sagas, isLoadingSagas } = useChannelSagas(channelId, videos);
  const seriesIndex = useMemo(() => buildSeriesIndex(videos, sagas), [videos, sagas]);
  const videoById = useMemo(
    () => new Map(videos.map((video) => [video.videoId, video])),
    [videos]
  );
  const viewport = useMapViewport();
  const map = useStoryMap({ videos, seriesIndex, initialVideoId, ready: !isLoadingSagas, viewport });
  const { reveal } = map;
  const nav = useMemo<TimelineNav>(() => ({ videoById, reveal }), [videoById, reveal]);

  const { layout, selected } = map;
  if (videos.length === 0 || !layout) return null;

  const { left, top, width } = viewport.viewport;
  const { from, to, anchor } = renderWindow(left, width, layout.scale.width);
  const storyCount = seriesIndex.series.length;
  const first = layout.nodes[0].video.publishedAt;
  const last = layout.nodes[layout.nodes.length - 1].video.publishedAt;
  const position = selected?.seriesId ? seriesIndex.byVideo.get(selected.video.videoId) ?? null : null;
  let bandNote: string | null = null;
  if (storyCount === 0) bandNote = isLoadingSagas ? "Detecting continuations…" : "No continuations detected";

  return (
    <TimelineNavContext value={nav}>
      <div className="flex h-full min-h-[32rem] flex-col gap-3">
        <MapToolbar
          summary={
            <>
              <span className="font-medium tabular-nums text-foreground">{videos.length.toLocaleString()}</span> videos
              · {dayjs(first).format("MMM YYYY")} – {dayjs(last).format("MMM YYYY")} ·{" "}
              <span className="font-medium tabular-nums text-foreground">{storyCount.toLocaleString()}</span> stories
            </>
          }
          query={map.query}
          onQueryChange={map.setQuery}
          matchCount={map.matchCount}
          matchPosition={map.matchPosition}
          onJumpToMatch={map.jumpToMatch}
          zoom={map.zoom}
          onZoomChange={map.changeZoom}
          onJumpToLatest={map.jumpToLatest}
        />
        <MapOverview layout={layout} viewport={viewport.viewport} onScrollTo={(x) => viewport.scrollTo(x, top, false)} />

        <div className="flex min-h-0 flex-1 flex-col gap-3 xl:flex-row">
          <StoryMap
            layout={layout}
            from={from}
            to={to}
            anchor={anchor}
            mapRef={viewport.ref}
            element={viewport.element}
            label={`Story map: ${videos.length} videos and ${storyCount} stories over time. Left and Right arrows move between episodes, Escape clears the selection.`}
            selectedId={selected?.video.videoId ?? null}
            selectedSeriesId={selected?.seriesId ?? null}
            matches={map.matches}
            byVideo={seriesIndex.byVideo}
            bandNote={bandNote}
            focusRequest={map.focusRequest}
            onSelect={map.select}
            onStep={map.step}
            onClear={map.clear}
          />
          <MapDetail
            video={selected?.video ?? null}
            position={position}
            onReveal={reveal}
            className="max-h-[45%] xl:max-h-none xl:w-96"
          />
        </div>

        <p className="sr-only" aria-live="polite">
          {selected &&
            (position
              ? `Selected ${selected.video.title}, part ${position.index + 1} of ${position.total} of ${SERIES_KIND_LABEL[position.series.kind]} "${position.series.name}", ${dayjs(position.series.firstPublishedAt).format("MMM D, YYYY")} to ${dayjs(position.series.lastPublishedAt).format("MMM D, YYYY")}.`
              : `Selected ${selected.video.title}, not part of a story.`)}
        </p>
      </div>
    </TimelineNavContext>
  );
}
