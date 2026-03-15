import type { VideoData } from "@/types/youtube";

let idCounter = 0;

export function createMockVideo(overrides: Partial<VideoData> = {}): VideoData {
  idCounter++;
  const id = `video_${idCounter}`;
  return {
    videoId: id,
    title: `Test Video ${idCounter}`,
    publishedAt: new Date(Date.now() - idCounter * 86400000).toISOString(),
    duration: 600,
    views: 10000,
    likes: 500,
    comments: 50,
    favorites: 0,
    score: 50,
    scoreComponents: {
      reachScore: 50,
      engagementScore: 50,
      momentumScore: 50,
      efficiencyScore: 50,
      communityScore: 50,
    },
    rates: {
      likeRate: 50,
      commentRate: 5,
      engagementRate: 30,
      viewsPerDay: 100,
      viewsPerHour: 4,
      viewsPerContentMin: 1000,
      engagementPerMinute: 55,
    },
    url: `https://youtube.com/watch?v=${id}`,
    thumbnail: `https://i.ytimg.com/vi/${id}/default.jpg`,
    description: "Test description",
    days: idCounter,
    ...overrides,
  };
}

export function createMockChannel(
  overrides: Partial<{ id: string; title: string; thumbnailUrl: string }> = {},
) {
  idCounter++;
  return {
    id: overrides.id ?? `channel_${idCounter}`,
    title: overrides.title ?? `Test Channel ${idCounter}`,
    thumbnailUrl:
      overrides.thumbnailUrl ?? `https://yt3.ggpht.com/test_${idCounter}`,
  };
}

export function resetIdCounter() {
  idCounter = 0;
}
