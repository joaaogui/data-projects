import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/scoring", () => ({
  calculateVideoScore: vi.fn(() => ({
    score: 65,
    components: {
      reachScore: 70,
      engagementScore: 60,
      momentumScore: 55,
      efficiencyScore: 50,
      communityScore: 45,
    },
    rates: {
      likeRate: 40,
      commentRate: 4,
      engagementRate: 25,
      viewsPerDay: 200,
      viewsPerHour: 8,
      viewsPerContentMin: 2000,
      engagementPerMinute: 50,
    },
  })),
  scoreVideoBatch: vi.fn((metrics: unknown[]) =>
    metrics.map(() => ({
      score: 72,
      components: {
        reachScore: 80,
        engagementScore: 70,
        momentumScore: 65,
        efficiencyScore: 60,
        communityScore: 55,
      },
      rates: {
        likeRate: 45,
        commentRate: 5,
        engagementRate: 30,
        viewsPerDay: 300,
        viewsPerHour: 12,
        viewsPerContentMin: 3000,
        engagementPerMinute: 60,
      },
    })),
  ),
}));

import { dbRowToVideoData, dbRowsToVideoData } from "@/lib/video-mapper";
import { calculateVideoScore, scoreVideoBatch } from "@/lib/scoring";

function createVideoRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vid_abc123",
    channelId: "ch_xyz",
    title: "Test Video",
    publishedAt: new Date("2025-01-01T00:00:00Z"),
    duration: 600,
    views: 50000,
    likes: 2000,
    comments: 300,
    favorites: 10,
    score: 0,
    scoreComponents: null,
    rates: null,
    url: "https://youtube.com/watch?v=vid_abc123",
    thumbnail: "https://i.ytimg.com/vi/vid_abc123/default.jpg",
    description: "A test video",
    fetchedAt: new Date("2025-03-01T00:00:00Z"),
    ...overrides,
  };
}

describe("dbRowToVideoData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps a DB row to VideoData with scoring", () => {
    const row = createVideoRow();
    const result = dbRowToVideoData(row as never);

    expect(result.videoId).toBe("vid_abc123");
    expect(result.title).toBe("Test Video");
    expect(result.publishedAt).toBe("2025-01-01T00:00:00.000Z");
    expect(result.url).toBe("https://youtube.com/watch?v=vid_abc123");
    expect(result.thumbnail).toBe("https://i.ytimg.com/vi/vid_abc123/default.jpg");
    expect(result.views).toBe(50000);
    expect(result.likes).toBe(2000);
    expect(result.comments).toBe(300);
    expect(result.favorites).toBe(10);
    expect(result.duration).toBe(600);
  });

  it("calls calculateVideoScore with correct metrics", () => {
    const row = createVideoRow();
    dbRowToVideoData(row as never);

    expect(calculateVideoScore).toHaveBeenCalledWith(
      expect.objectContaining({
        views: 50000,
        likes: 2000,
        comments: 300,
        duration: 600,
      }),
    );
  });

  it("attaches score and components from calculateVideoScore", () => {
    const row = createVideoRow();
    const result = dbRowToVideoData(row as never);

    expect(result.score).toBe(65);
    expect(result.scoreComponents.reachScore).toBe(70);
    expect(result.rates.likeRate).toBe(40);
  });

  it("computes days as diff between fetchedAt and publishedAt", () => {
    const row = createVideoRow({
      publishedAt: new Date("2025-02-01T00:00:00Z"),
      fetchedAt: new Date("2025-03-01T00:00:00Z"),
    });
    dbRowToVideoData(row as never);

    const call = vi.mocked(calculateVideoScore).mock.calls[0][0];
    expect(call.days).toBe(28);
  });

  it("enforces minimum 1 day", () => {
    const now = new Date();
    const row = createVideoRow({
      publishedAt: now,
      fetchedAt: now,
    });
    dbRowToVideoData(row as never);

    const call = vi.mocked(calculateVideoScore).mock.calls[0][0];
    expect(call.days).toBeGreaterThanOrEqual(1);
  });

  it("handles null description as empty string", () => {
    const row = createVideoRow({ description: null });
    const result = dbRowToVideoData(row as never);
    expect(result.description).toBe("");
  });
});

describe("dbRowsToVideoData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array for empty input", () => {
    expect(dbRowsToVideoData([])).toEqual([]);
  });

  it("maps multiple rows using scoreVideoBatch", () => {
    const rows = [
      createVideoRow({ id: "v1", title: "Video 1" }),
      createVideoRow({ id: "v2", title: "Video 2" }),
    ];
    const results = dbRowsToVideoData(rows as never[]);

    expect(results).toHaveLength(2);
    expect(scoreVideoBatch).toHaveBeenCalledTimes(1);
    expect(results[0].videoId).toBe("v1");
    expect(results[1].videoId).toBe("v2");
  });

  it("attaches batch scores to each video", () => {
    const rows = [createVideoRow()];
    const results = dbRowsToVideoData(rows as never[]);

    expect(results[0].score).toBe(72);
    expect(results[0].scoreComponents.reachScore).toBe(80);
    expect(results[0].rates.viewsPerDay).toBe(300);
  });
});
