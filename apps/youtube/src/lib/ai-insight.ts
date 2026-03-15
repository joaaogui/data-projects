import type { VideoData } from "@/types/youtube";
import { formatDuration } from "./scoring";
import { median } from "./utils";

export function compressVideoContext(videos: VideoData[]): string {
  if (videos.length === 0) return "No videos available.";

  const allViews = videos.map((v) => v.views);
  const totalViews = allViews.reduce((a, b) => a + b, 0);
  const avgViews = Math.round(totalViews / videos.length);
  const medViews = Math.round(median(allViews));

  const byAge = [...videos].sort((a, b) => a.days - b.days);
  const newest = byAge[0];
  const oldest = byAge.at(-1) ?? byAge[0];

  const lines: string[] = [
    `Total: ${videos.length} videos | Newest: ${newest.days}d ago | Oldest: ${oldest.days}d ago`,
    `Views — Total: ${totalViews.toLocaleString()} | Avg: ${avgViews.toLocaleString()} | Median: ${medViews.toLocaleString()}`,
    "",
    "ID\tTitle\tViews\tLikes\tComments\tDaysOld\tDuration\tScore\tEngagement/1K",
  ];

  for (const v of videos) {
    const title = v.title.length > 80 ? v.title.slice(0, 77) + "..." : v.title;
    lines.push(
      [
        v.videoId,
        title,
        v.views,
        v.likes,
        v.comments,
        v.days,
        formatDuration(v.duration),
        v.score,
        v.rates.engagementRate.toFixed(1),
      ].join("\t")
    );
  }

  return lines.join("\n");
}

export function generateSuggestions(videos: VideoData[]): string[] {
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

  const shuffled = pool.toSorted(() => Math.random() - 0.5);
  return shuffled.slice(0, 4);
}
