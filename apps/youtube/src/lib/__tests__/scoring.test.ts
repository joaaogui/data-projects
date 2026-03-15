import { describe, it, expect } from "vitest";
import {
  parseISO8601Duration,
  formatDuration,
  calculateVideoScore,
  scoreVideoBatch,
  recalculateWithWeights,
  getScoreLabel,
  type VideoMetrics,
  type ScoringResult,
} from "../scoring";

describe("parseISO8601Duration", () => {
  it("parses standard duration PT1H2M3S → 3723", () => {
    expect(parseISO8601Duration("PT1H2M3S")).toBe(3723);
  });

  it("parses minutes only PT15M → 900", () => {
    expect(parseISO8601Duration("PT15M")).toBe(900);
  });

  it("parses seconds only PT30S → 30", () => {
    expect(parseISO8601Duration("PT30S")).toBe(30);
  });

  it("parses hours only PT2H → 7200", () => {
    expect(parseISO8601Duration("PT2H")).toBe(7200);
  });

  it("returns 0 for invalid/empty string", () => {
    expect(parseISO8601Duration("")).toBe(0);
    expect(parseISO8601Duration("invalid")).toBe(0);
    expect(parseISO8601Duration("P1D")).toBe(0); // days not supported
  });
});

describe("formatDuration", () => {
  it("formats seconds only: 45 → 45s", () => {
    expect(formatDuration(45)).toBe("45s");
  });

  it("formats minutes and seconds: 125 → 2:05", () => {
    expect(formatDuration(125)).toBe("2:05");
  });

  it("formats hours: 3661 → 1:01:01", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});

describe("calculateVideoScore", () => {
  it("a video with zero views should score near 0", () => {
    const result = calculateVideoScore({
      views: 0,
      likes: 0,
      comments: 0,
      days: 1,
      duration: 300,
    });
    expect(result.score).toBeLessThan(5);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it("a video with high views/engagement should score higher", () => {
    const lowResult = calculateVideoScore({
      views: 100,
      likes: 5,
      comments: 2,
      days: 7,
      duration: 600,
    });
    const highResult = calculateVideoScore({
      views: 1_000_000,
      likes: 50_000,
      comments: 10_000,
      days: 7,
      duration: 600,
    });
    expect(highResult.score).toBeGreaterThan(lowResult.score);
  });

  it("score should be between 0 and 100", () => {
    const result = calculateVideoScore({
      views: 100_000,
      likes: 5000,
      comments: 500,
      days: 14,
      duration: 300,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });
});

describe("scoreVideoBatch", () => {
  it("empty array returns empty array", () => {
    expect(scoreVideoBatch([])).toEqual([]);
  });

  it("single video falls back to calculateVideoScore", () => {
    const metrics: VideoMetrics = {
      views: 1000,
      likes: 50,
      comments: 10,
      days: 5,
      duration: 300,
    };
    const single = scoreVideoBatch([metrics]);
    const direct = calculateVideoScore(metrics);
    expect(single).toHaveLength(1);
    expect(single[0].score).toBe(direct.score);
    expect(single[0].components).toEqual(direct.components);
  });

  it("batch of diverse videos: highest-viewed should have highest reachScore", () => {
    const metrics: VideoMetrics[] = [
      { views: 100, likes: 10, comments: 2, days: 7, duration: 300 },
      { views: 10_000, likes: 500, comments: 50, days: 7, duration: 300 },
      { views: 1_000_000, likes: 20_000, comments: 2000, days: 7, duration: 300 },
    ];
    const results = scoreVideoBatch(metrics);
    expect(results[2].components.reachScore).toBeGreaterThan(results[1].components.reachScore);
    expect(results[1].components.reachScore).toBeGreaterThan(results[0].components.reachScore);
  });

  it("all scores should be between 0 and 100", () => {
    const metrics: VideoMetrics[] = [
      { views: 100, likes: 5, comments: 1, days: 1, duration: 60 },
      { views: 50_000, likes: 2000, comments: 200, days: 14, duration: 600 },
    ];
    const results = scoreVideoBatch(metrics);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
      expect(r.components.engagementScore).toBeGreaterThanOrEqual(0);
      expect(r.components.engagementScore).toBeLessThanOrEqual(100);
      expect(r.components.reachScore).toBeGreaterThanOrEqual(0);
      expect(r.components.reachScore).toBeLessThanOrEqual(100);
      expect(r.components.momentumScore).toBeGreaterThanOrEqual(0);
      expect(r.components.momentumScore).toBeLessThanOrEqual(100);
      expect(r.components.efficiencyScore).toBeGreaterThanOrEqual(0);
      expect(r.components.efficiencyScore).toBeLessThanOrEqual(100);
      expect(r.components.communityScore).toBeGreaterThanOrEqual(0);
      expect(r.components.communityScore).toBeLessThanOrEqual(100);
    }
  });

  it("components (engagementScore, reachScore, etc.) should all be numbers", () => {
    const metrics: VideoMetrics[] = [
      { views: 1000, likes: 50, comments: 5, days: 3, duration: 180 },
    ];
    const [result] = scoreVideoBatch(metrics);
    expect(typeof result.components.engagementScore).toBe("number");
    expect(typeof result.components.reachScore).toBe("number");
    expect(typeof result.components.momentumScore).toBe("number");
    expect(typeof result.components.efficiencyScore).toBe("number");
    expect(typeof result.components.communityScore).toBe("number");
  });
});

describe("recalculateWithWeights", () => {
  const components: ScoringResult["components"] = {
    reachScore: 60,
    engagementScore: 50,
    momentumScore: 40,
    efficiencyScore: 70,
    communityScore: 30,
  };

  const defaultWeights = {
    views: 0.3,
    engagement: 0.25,
    momentum: 0.2,
    efficiency: 0.15,
    community: 0.1,
  };

  it("default weights should produce the same score", () => {
    const result = calculateVideoScore({
      views: 5000,
      likes: 200,
      comments: 30,
      days: 7,
      duration: 300,
    });
    const recalc = recalculateWithWeights(result.components, defaultWeights);
    expect(recalc).toBe(result.score);
  });

  it("setting one weight to 100% and others to 0 should return that component's score", () => {
    expect(recalculateWithWeights(components, { views: 1, engagement: 0, momentum: 0, efficiency: 0, community: 0 }))
      .toBe(components.reachScore);
    expect(recalculateWithWeights(components, { views: 0, engagement: 1, momentum: 0, efficiency: 0, community: 0 }))
      .toBe(components.engagementScore);
    expect(recalculateWithWeights(components, { views: 0, engagement: 0, momentum: 1, efficiency: 0, community: 0 }))
      .toBe(components.momentumScore);
    expect(recalculateWithWeights(components, { views: 0, engagement: 0, momentum: 0, efficiency: 1, community: 0 }))
      .toBe(components.efficiencyScore);
    expect(recalculateWithWeights(components, { views: 0, engagement: 0, momentum: 0, efficiency: 0, community: 1 }))
      .toBe(components.communityScore);
  });

  it("all-zero weights should return 0", () => {
    expect(recalculateWithWeights(components, { views: 0, engagement: 0, momentum: 0, efficiency: 0, community: 0 }))
      .toBe(0);
  });
});

describe("getScoreLabel", () => {
  it("score 80 with no context → Excellent", () => {
    const label = getScoreLabel(80);
    expect(label.label).toBe("Excellent");
  });

  it("score 30 with no context → Fair", () => {
    const label = getScoreLabel(30);
    expect(label.label).toBe("Fair");
  });

  it("with allScores context, should use adaptive percentile labels", () => {
    const allScores = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const topScore = 95;
    const label = getScoreLabel(topScore, allScores);
    expect(label.label).toBe("Excellent");
    expect(label.color).toBeDefined();
    expect(label.description).toBeDefined();
  });

  it("adaptive context: score in bottom 25% gets Low", () => {
    const allScores = [10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
    const lowScore = 12;
    const label = getScoreLabel(lowScore, allScores);
    expect(label.label).toBe("Low");
  });
});
