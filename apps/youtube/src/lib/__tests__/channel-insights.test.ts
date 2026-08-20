import { computeChannelFingerprint } from "@/lib/channel-insights";
import type { VideoData } from "@/types/youtube";
import { describe, expect, it } from "vitest";

function video(
  index: number,
  overrides: Partial<VideoData> = {}
): VideoData {
  return {
    videoId: `video-${index}`,
    title: `Video ${index}`,
    publishedAt: `2020-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
    days: 1,
    duration: 600,
    views: 100,
    likes: 10,
    comments: 2,
    favorites: 0,
    score: 50,
    scoreComponents: {
      engagementScore: 50,
      reachScore: 50,
      momentumScore: 50,
      efficiencyScore: 50,
      communityScore: 50,
    },
    rates: {
      likeRate: 10,
      commentRate: 2,
      engagementRate: 20,
      viewsPerDay: 100,
      viewsPerHour: 4,
      viewsPerContentMin: 10,
      engagementPerMinute: 2,
    },
    url: `https://example.com/video-${index}`,
    thumbnail: `https://example.com/video-${index}.jpg`,
    description: "",
    ...overrides,
  };
}

describe("computeChannelFingerprint", () => {
  it("returns null for an empty catalog", () => {
    expect(computeChannelFingerprint([])).toBeNull();
  });

  it("uses medians and top-decile concentration", () => {
    const videos = [10, 20, 30, 40, 100].map((views, index) =>
      video(index, {
        views,
        score: [20, 40, 60, 80, 90][index],
      })
    );

    const result = computeChannelFingerprint(videos)!;
    expect(result.medianViews).toBe(30);
    expect(result.viewsSkew).toBeCloseTo(4 / 3);
    expect(result.topTenViewShare).toBe(50);
    expect(result.hitRate).toBe(40);
  });

  it("requires a meaningful sample for best format and year", () => {
    const videos = Array.from({ length: 12 }, (_, index) => {
      const recent = index >= 6;
      return video(index, {
        publishedAt: `${recent ? 2021 : 2020}-03-01T00:00:00.000Z`,
        duration: recent ? 900 : 180,
        score: recent ? 72 : 48,
      });
    });

    const result = computeChannelFingerprint(videos)!;
    expect(result.bestDuration).toMatchObject({
      label: "10-20m",
      avgScore: 72,
      count: 6,
    });
    expect(result.bestYear).toMatchObject({
      year: "2021",
      avgScore: 72,
      count: 6,
    });
  });

  it("labels a stable catalog as consistent", () => {
    const videos = Array.from({ length: 10 }, (_, index) =>
      video(index, { score: 60 + (index % 3) })
    );

    const result = computeChannelFingerprint(videos)!;
    expect(result.consistency).toBe("Consistent");
    expect(result.scoreStdDev).toBeLessThan(12);
  });
});
