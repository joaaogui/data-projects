"use client";

import type { VideoData } from "@/types/youtube";
import { createContext, use } from "react";

/** Stable lookups and actions shared by the detail panel and the episode strip. */
export interface TimelineNav {
  videoById: ReadonlyMap<string, VideoData>;
  /** Select a video and scroll the map to it. */
  reveal: (videoId: string) => void;
}

export const TimelineNavContext = createContext<TimelineNav | null>(null);

export function useTimelineNav(): TimelineNav {
  const nav = use(TimelineNavContext);
  if (!nav) throw new Error("useTimelineNav must be used inside TimelineView");
  return nav;
}
