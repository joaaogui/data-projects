"use client";

import type { SeriesIndex } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import { createContext, use } from "react";

/**
 * Stable lookups and actions shared by rows, the series strip and the chain.
 * Expansion/highlight state is deliberately NOT here (it is passed as props) so
 * toggling one row does not re-render every consumer.
 */
export interface TimelineNav {
  seriesIndex: SeriesIndex;
  videoById: ReadonlyMap<string, VideoData>;
  /** Reveal (batch + year), scroll to, expand and briefly highlight a video in Timeline mode. */
  reveal: (videoId: string) => void;
  toggle: (videoId: string) => void;
}

export const TimelineNavContext = createContext<TimelineNav | null>(null);

export function useTimelineNav(): TimelineNav {
  const nav = use(TimelineNavContext);
  if (!nav) throw new Error("useTimelineNav must be used inside TimelineView");
  return nav;
}
