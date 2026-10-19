"use client";

import type { SeriesIndex } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  filterVideos,
  groupByYear,
  VIDEO_BATCH_SIZE,
  videoDomId,
  yearDomId,
  yearOf,
  YEAR_BATCH_SIZE,
  type TimelineMode,
} from "./timeline-model";

const HIGHLIGHT_MS = 2500;

interface ScrollRequest {
  domId: string;
  block: ScrollLogicalPosition;
  smooth: boolean;
  nonce: number;
}

interface Options {
  videos: VideoData[];
  seriesIndex: SeriesIndex;
  initialVideoId?: string | null;
  /** False while sagas load: series chips/continuity lines change row heights above the target. */
  ready: boolean;
}

/**
 * Owns everything the Timeline feed needs: filters, mode, expansion, year/video
 * batching and the single `reveal(videoId)` path shared by the deep link and
 * every prev/next/strip jump.
 */
export function useTimelineFeed({ videos, seriesIndex, initialVideoId, ready }: Options) {
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [rawOnlySeries, setOnlySeries] = useState(false);
  const [rawMode, setMode] = useState<TimelineMode>("timeline");
  const [expandedId, setExpandedId] = useState<string | null>(initialVideoId ?? null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [visibleYearCount, setVisibleYearCount] = useState(YEAR_BATCH_SIZE);
  const [visibleVideosByYear, setVisibleVideosByYear] = useState<Record<string, number>>({});
  const [scrollRequest, setScrollRequest] = useState<ScrollRequest | null>(null);

  // Series can appear after sagas load (or vanish); never stay in a mode that has no data.
  const hasSeries = seriesIndex.series.length > 0;
  const mode: TimelineMode = hasSeries ? rawMode : "timeline";
  const onlySeries = hasSeries && rawOnlySeries;
  const filterActive = query.trim() !== "" || onlySeries;

  const filtered = useMemo(
    () => filterVideos(videos, query, onlySeries, seriesIndex.byVideo),
    [videos, query, onlySeries, seriesIndex.byVideo]
  );
  const groups = useMemo(() => groupByYear(filtered, newestFirst), [filtered, newestFirst]);
  const visibleGroups = filterActive ? groups : groups.slice(0, visibleYearCount);
  const hiddenGroups = groups.length - visibleGroups.length;
  const hiddenVideoCount = groups
    .slice(visibleGroups.length)
    .reduce((sum, group) => sum + group.videos.length, 0);

  const requestScroll = useCallback(
    (domId: string, block: ScrollLogicalPosition, smooth: boolean) =>
      setScrollRequest((prev) => ({ domId, block, smooth, nonce: (prev?.nonce ?? 0) + 1 })),
    []
  );

  // Scroll after commit so rows revealed in the same update already exist.
  useEffect(() => {
    if (!scrollRequest) return;
    const reduceMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(scrollRequest.domId)?.scrollIntoView({
      block: scrollRequest.block,
      behavior: scrollRequest.smooth && !reduceMotion ? "smooth" : "auto",
    });
  }, [scrollRequest]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = globalThis.setTimeout(() => setHighlightId(null), HIGHLIGHT_MS);
    return () => globalThis.clearTimeout(timer);
  }, [highlightId]);

  const reveal = useCallback(
    (videoId: string) => {
      const target = videos.find((video) => video.videoId === videoId);
      if (!target) return;

      // A neighbor hidden by the filter would never render: drop the filters first.
      const hidden = !filtered.some((video) => video.videoId === videoId);
      const targetGroups = hidden ? groupByYear(videos, newestFirst) : groups;
      if (hidden) {
        setQuery("");
        setOnlySeries(false);
      }

      const year = yearOf(target);
      const groupIndex = targetGroups.findIndex((group) => group.year === year);
      if (groupIndex >= 0) {
        const videoIndex = targetGroups[groupIndex].videos.findIndex(
          (video) => video.videoId === videoId
        );
        setVisibleYearCount((current) => Math.max(current, groupIndex + 1));
        setVisibleVideosByYear((current) => ({
          ...current,
          [year]: Math.max(current[year] ?? VIDEO_BATCH_SIZE, videoIndex + 1),
        }));
      }
      setMode("timeline");
      setExpandedId(videoId);
      setHighlightId(videoId);
      requestScroll(videoDomId(videoId), "center", false);
    },
    [videos, filtered, groups, newestFirst, requestScroll]
  );

  // Deep link: waits for `ready` (sagas loaded, so row heights are final) and runs
  // at most once per distinct id for the life of the component. Sort/filter changes
  // and background refetches (new `videos` identity) never re-scroll the user.
  const handledDeepLinkId = useRef<string | null>(null);
  const revealDeepLink = useEffectEvent((videoId: string) => reveal(videoId));
  useEffect(() => {
    if (!initialVideoId || !ready) return;
    if (handledDeepLinkId.current === initialVideoId) return;
    if (!videos.some((video) => video.videoId === initialVideoId)) return;
    handledDeepLinkId.current = initialVideoId;
    revealDeepLink(initialVideoId);
  }, [initialVideoId, videos, ready]);

  const toggle = useCallback(
    (videoId: string) => setExpandedId((current) => (current === videoId ? null : videoId)),
    []
  );

  const toggleSort = useCallback(() => {
    setNewestFirst((value) => !value);
    setVisibleYearCount(YEAR_BATCH_SIZE);
    setVisibleVideosByYear({});
  }, []);

  const jumpToYear = useCallback(
    (year: string) => {
      const groupIndex = groups.findIndex((group) => group.year === year);
      if (groupIndex < 0) return;
      setVisibleYearCount((current) => Math.max(current, groupIndex + 1));
      requestScroll(yearDomId(year), "start", true);
    },
    [groups, requestScroll]
  );

  const showMoreYears = useCallback(
    () => setVisibleYearCount((count) => Math.min(groups.length, count + YEAR_BATCH_SIZE)),
    [groups.length]
  );

  const showMoreVideos = useCallback(
    (year: string, total: number) =>
      setVisibleVideosByYear((current) => ({
        ...current,
        [year]: Math.min(total, (current[year] ?? VIDEO_BATCH_SIZE) + VIDEO_BATCH_SIZE),
      })),
    []
  );

  return {
    query,
    setQuery,
    newestFirst,
    toggleSort,
    onlySeries,
    setOnlySeries,
    mode,
    setMode,
    filterActive,
    filtered,
    groups,
    visibleGroups,
    hiddenGroups,
    hiddenVideoCount,
    visibleVideosByYear,
    expandedId,
    highlightId,
    toggle,
    reveal,
    jumpToYear,
    showMoreYears,
    showMoreVideos,
  };
}

export type TimelineFeedModel = ReturnType<typeof useTimelineFeed>;
