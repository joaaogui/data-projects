import type { Saga, VideoData } from "@/types/youtube";
import { formatDuration } from "./scoring";
import { median } from "./utils";

function buildSagaMap(sagas: Saga[]): Map<string, string> {
  const sagaMap = new Map<string, string>();
  for (const saga of sagas) {
    for (const videoId of saga.videoIds) {
      sagaMap.set(videoId, saga.name);
    }
  }
  return sagaMap;
}

function buildSagaSummaryLines(sagas: Saga[], videos: VideoData[]): string[] {
  const lines: string[] = [];
  const sorted = [...sagas].sort((a, b) => b.videoCount - a.videoCount);
  for (const s of sorted) {
    const sagaVideos = videos.filter((v) => s.videoIds.includes(v.videoId));
    const sagaViews = sagaVideos.reduce((sum, v) => sum + v.views, 0);
    const avgEng = sagaVideos.length > 0
      ? (sagaVideos.reduce((sum, v) => sum + v.rates.engagementRate, 0) / sagaVideos.length).toFixed(1)
      : "0";
    const dateFirst = s.dateRange.first ? s.dateRange.first.slice(0, 10) : "?";
    const dateLast = s.dateRange.last ? s.dateRange.last.slice(0, 10) : "?";
    lines.push(
      `• "${s.name}" — ${s.videoCount} videos, ${sagaViews.toLocaleString()} total views, ${avgEng} avg eng/1K, ${dateFirst} to ${dateLast} [${s.source}]`
    );
  }
  return lines;
}

export function compressVideoContext(videos: VideoData[], sagas?: Saga[]): string {
  if (videos.length === 0) return "No videos available.";

  const allViews = videos.map((v) => v.views);
  const totalViews = allViews.reduce((a, b) => a + b, 0);
  const avgViews = Math.round(totalViews / videos.length);
  const medViews = Math.round(median(allViews));

  const byAge = [...videos].sort((a, b) => a.days - b.days);
  const newest = byAge[0];
  const oldest = byAge.at(-1) ?? byAge[0];

  const sagaMap = sagas && sagas.length > 0 ? buildSagaMap(sagas) : new Map<string, string>();

  const lines: string[] = [
    `Total: ${videos.length} videos | Newest: ${newest.days}d ago | Oldest: ${oldest.days}d ago`,
    `Views — Total: ${totalViews.toLocaleString()} | Avg: ${avgViews.toLocaleString()} | Median: ${medViews.toLocaleString()}`,
    "",
    "ID\tTitle\tPublished\tViews\tLikes\tComments\tDaysOld\tDuration\tScore\tReach\tEngagement\tMomentum\tEfficiency\tCommunity\tEng/1K\tEng/Min\tSaga",
  ];

  for (const v of videos) {
    const title = v.title.length > 80 ? v.title.slice(0, 77) + "..." : v.title;
    const published = v.publishedAt.slice(0, 10);
    const sc = v.scoreComponents;
    const saga = sagaMap.get(v.videoId) ?? "";
    lines.push(
      [
        v.videoId,
        title,
        published,
        v.views,
        v.likes,
        v.comments,
        v.days,
        formatDuration(v.duration),
        v.score.toFixed(0),
        sc.reachScore.toFixed(0),
        sc.engagementScore.toFixed(0),
        sc.momentumScore.toFixed(0),
        sc.efficiencyScore.toFixed(0),
        sc.communityScore.toFixed(0),
        v.rates.engagementRate.toFixed(1),
        v.rates.engagementPerMinute.toFixed(1),
        saga,
      ].join("\t")
    );
  }

  if (sagas && sagas.length > 0) {
    lines.push("", "## Sagas / Series", ...buildSagaSummaryLines(sagas, videos));
  }

  return lines.join("\n");
}

export function generateSuggestions(videos: VideoData[], sagas?: Saga[]): string[] {
  if (videos.length === 0) {
    return [
      "What are the most popular videos?",
      "How has the channel been performing?",
    ];
  }

  const pool: string[] = [];

  const byViews = [...videos].sort((a, b) => b.views - a.views);
  const topVideo = byViews[0];
  if (topVideo) {
    const shortTitle = topVideo.title.length > 40 ? topVideo.title.slice(0, 37) + "..." : topVideo.title;
    pool.push(`Why is "${shortTitle}" the top performer?`);
  }

  const byScore = [...videos].sort((a, b) => b.score - a.score);
  const topScored = byScore[0];
  if (topScored && topScored.videoId !== topVideo?.videoId) {
    const shortTitle = topScored.title.length > 40 ? topScored.title.slice(0, 37) + "..." : topScored.title;
    pool.push(`What makes "${shortTitle}" score so high?`);
  }

  pool.push(
    "What hidden gems have high engagement but low views?",
    "How do recent uploads compare to older content?",
    "What content pattern gets the best audience response?",
    "Which topics drive the most comments?",
    "What's the ideal video length for this channel?",
    "Are there any declining trends in performance?",
    "What type of content has the best engagement rate?",
    "Compare the top 5 vs bottom 5 performing videos",
  );

  if (sagas && sagas.length > 0) {
    const topSaga = [...sagas].sort((a, b) => b.videoCount - a.videoCount)[0];
    if (topSaga) {
      pool.push(`How does the "${topSaga.name}" saga perform compared to other content?`);
    }
    pool.push(
      "Which saga gets the best engagement?",
      "Compare the different sagas by performance",
    );
  }

  const shuffled = pool.toSorted(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
}
