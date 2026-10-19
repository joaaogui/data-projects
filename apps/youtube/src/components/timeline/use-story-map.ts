"use client";

import type { SeriesIndex } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { indexToX, xToIndex, type Density } from "./map-layout";
import { buildMapLayout, matchVideoIds, neighborId, scrollTargetFor } from "./map-model";
import type { MapViewportApi } from "./use-map-viewport";

type ScrollIntent =
  | { kind: "latest"; smooth: boolean }
  | { kind: "index"; index: number }
  | { kind: "video"; videoId: string; smooth: boolean };
type ScrollRequest = ScrollIntent & { nonce: number };

interface Options {
  videos: VideoData[];
  seriesIndex: SeriesIndex;
  initialVideoId?: string | null;
  /** False while sagas load: stories are not final yet. */
  ready: boolean;
  viewport: MapViewportApi;
}

/** Density, selection, search and every scroll the map performs (deep link, density, jumps). */
export function useStoryMap({ videos, seriesIndex, initialVideoId, ready, viewport }: Options) {
  const { element, scrollTo } = viewport;
  const [density, setDensity] = useState<Density>("cards");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest>({ kind: "latest", smooth: false, nonce: 0 });
  const [focusRequest, setFocusRequest] = useState<{ videoId: string; nonce: number } | null>(null);

  const layout = useMemo(() => buildMapLayout(videos, seriesIndex, density), [videos, seriesIndex, density]);
  const matches = useMemo(() => matchVideoIds(videos, query, seriesIndex.byVideo), [videos, query, seriesIndex.byVideo]);
  const matchList = useMemo(
    () => (matches && layout ? layout.nodes.filter((n) => matches.has(n.video.videoId)) : []),
    [matches, layout]
  );

  const requestScroll = useCallback(
    (intent: ScrollIntent) => setScrollRequest((prev) => ({ ...intent, nonce: prev.nonce + 1 })),
    []
  );

  // Applied after commit, so a density change and its scroll land on the new layout together.
  const appliedNonce = useRef(-1);
  useEffect(() => {
    if (!element || !layout || appliedNonce.current === scrollRequest.nonce) return;
    appliedNonce.current = scrollRequest.nonce;
    const view = { left: element.scrollLeft, top: element.scrollTop, width: element.clientWidth, height: element.clientHeight };
    if (scrollRequest.kind === "latest") {
      scrollTo(layout.width - view.width, null, scrollRequest.smooth);
    } else if (scrollRequest.kind === "index") {
      scrollTo(indexToX(scrollRequest.index, layout.spec.pitch) - view.width / 2, null, false);
    } else {
      const node = layout.byId.get(scrollRequest.videoId);
      if (!node) return;
      const target = scrollTargetFor(layout, node, view);
      scrollTo(target.left, target.top, scrollRequest.smooth);
    }
  }, [scrollRequest, layout, element, scrollTo]);

  const reveal = useCallback(
    (videoId: string) => {
      setSelectedId(videoId);
      requestScroll({ kind: "video", videoId, smooth: true });
    },
    [requestScroll]
  );

  // Deep link: waits for `ready` and runs at most once per distinct id, so
  // background refetches (new `videos` identity) never re-scroll the user.
  const handledDeepLinkId = useRef<string | null>(null);
  const revealDeepLink = useEffectEvent((videoId: string) => {
    setDensity("cards");
    setSelectedId(videoId);
    requestScroll({ kind: "video", videoId, smooth: false });
  });
  useEffect(() => {
    if (!initialVideoId || !ready) return;
    if (handledDeepLinkId.current === initialVideoId) return;
    if (!videos.some((video) => video.videoId === initialVideoId)) return;
    handledDeepLinkId.current = initialVideoId;
    revealDeepLink(initialVideoId);
  }, [initialVideoId, videos, ready]);

  /** Keeps the video at the center of the view centered across the density change. */
  const changeDensity = (next: Density) => {
    if (next === density) return;
    if (element && layout) {
      requestScroll({ kind: "index", index: xToIndex(element.scrollLeft + element.clientWidth / 2, layout.spec.pitch) });
    }
    setDensity(next);
  };

  const step = (direction: -1 | 1, fromId: string, byEpisode: boolean) => {
    if (!layout) return;
    const target = neighborId(layout, seriesIndex.byVideo, fromId, direction, byEpisode);
    if (!target) return;
    reveal(target);
    setFocusRequest((prev) => ({ videoId: target, nonce: (prev?.nonce ?? 0) + 1 }));
  };

  const jumpToMatch = (direction: -1 | 1) => {
    const n = matchList.length;
    if (n === 0) return;
    const current = matchList.findIndex((node) => node.video.videoId === selectedId);
    let next = (current + direction + n) % n;
    if (current < 0) {
      // Nothing matched is selected: continue from the video at the map's center.
      const center = element ? element.scrollLeft + element.clientWidth / 2 : 0;
      const after = matchList.findIndex((node) => node.x > center);
      const firstAfter = after < 0 ? n : after;
      next = direction > 0 ? firstAfter % n : (firstAfter - 1 + n) % n;
    }
    reveal(matchList[next].video.videoId);
  };

  const selected = selectedId ? layout?.byId.get(selectedId) ?? null : null;
  const matchPosition = selected && matches?.has(selected.video.videoId) ? matchList.indexOf(selected) + 1 : 0;

  return {
    layout,
    density,
    changeDensity,
    selected,
    select: setSelectedId,
    clear: () => setSelectedId(null),
    reveal,
    step,
    focusRequest,
    query,
    setQuery,
    matches,
    matchCount: matchList.length,
    matchPosition,
    jumpToMatch,
    jumpToLatest: () => requestScroll({ kind: "latest", smooth: true }),
  };
}

export type StoryMapModel = ReturnType<typeof useStoryMap>;
