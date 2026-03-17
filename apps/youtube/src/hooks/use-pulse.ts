"use client";

import { useQuery } from "@tanstack/react-query";

export interface PulseChannel {
  channelId: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  totalViewCount: number | null;
  videoCount: number | null;
  label: string | null;
  pinned: number;
  lastVisitedAt: string | null;
  fetchedAt: string | null;
}

export interface NewVideosFeedItem {
  type: "new_videos";
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  count: number;
  topVideo: { id: string; title: string; score: number; views: number; thumbnail: string };
  timestamp: string;
}

export interface ScoreAlertFeedItem {
  type: "score_alert";
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  avgScore: number;
  recentAvg: number;
  direction: "up" | "down";
  delta: number;
  timestamp: string;
}

export interface BreakoutFeedItem {
  type: "breakout";
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  video: { id: string; title: string; score: number; views: number; thumbnail: string };
  channelAvg: number;
  timestamp: string;
}

export interface HiatusFeedItem {
  type: "hiatus";
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  daysSinceUpload: number;
  timestamp: string;
}

export type PulseFeedItem = NewVideosFeedItem | ScoreAlertFeedItem | BreakoutFeedItem | HiatusFeedItem;

export interface PulseSummary {
  totalTracked: number;
  totalNewVideos: number;
  avgScoreAcrossChannels: number;
  alerts: number;
}

export interface PulseData {
  channels: PulseChannel[];
  feed: PulseFeedItem[];
  summary: PulseSummary | null;
}

export function usePulse(enabled = true) {
  return useQuery<PulseData>({
    queryKey: ["pulse"],
    queryFn: async () => {
      const res = await fetch("/api/pulse");
      if (!res.ok) throw new Error("Failed to fetch pulse data");
      return res.json();
    },
    staleTime: 5 * 60_000,
    enabled,
  });
}
