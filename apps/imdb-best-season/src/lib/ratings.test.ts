import { describe, expect, it } from "vitest";
import {
  MAX_SEASONS,
  SEASON_FETCH_BATCH,
  calculateMean,
  calculateMedian,
  computeSeasonStats,
  mapInBatches,
  seasonNumbersUpTo,
} from "./ratings";

describe("calculateMedian", () => {
  it("returns 0 for empty input", () => {
    expect(calculateMedian([])).toBe(0);
  });

  it("returns the sole value", () => {
    expect(calculateMedian([7.5])).toBe(7.5);
  });

  it("returns the middle value for odd counts", () => {
    expect(calculateMedian([1, 9, 5])).toBe(5);
  });

  it("averages the two middle values for even counts", () => {
    expect(calculateMedian([1, 2, 3, 4])).toBe(2.5);
  });

  it("does not mutate the input", () => {
    const values = [3, 1, 2];
    calculateMedian(values);
    expect(values).toEqual([3, 1, 2]);
  });
});

describe("mapInBatches", () => {
  it("maps all items preserving order", async () => {
    const result = await mapInBatches([1, 2, 3, 4, 5], 2, async (n) => n * 10);
    expect(result).toEqual([10, 20, 30, 40, 50]);
  });

  it("never runs more than batchSize concurrent mappers", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapInBatches([1, 2, 3, 4, 5, 6, 7], SEASON_FETCH_BATCH, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return true;
    });
    expect(peak).toBeLessThanOrEqual(SEASON_FETCH_BATCH);
  });
});

describe("seasonNumbersUpTo", () => {
  it("returns an empty list for non-positive totals", () => {
    expect(seasonNumbersUpTo(0)).toEqual([]);
    expect(seasonNumbersUpTo(-3)).toEqual([]);
  });

  it("returns 1..n for small shows", () => {
    expect(seasonNumbersUpTo(3)).toEqual([1, 2, 3]);
  });

  it(`caps at ${MAX_SEASONS} seasons`, () => {
    const seasons = seasonNumbersUpTo(MAX_SEASONS + 25);
    expect(seasons).toHaveLength(MAX_SEASONS);
    expect(seasons.at(-1)).toBe(MAX_SEASONS);
  });
});

describe("SEASON_FETCH_BATCH", () => {
  it("is capped at 5 concurrent season fetches", () => {
    expect(SEASON_FETCH_BATCH).toBe(5);
  });
});

describe("calculateMean & computeSeasonStats", () => {
  it("computes mean, medians, range, best/worst episode, and premiere-to-finale delta", () => {
    expect(calculateMean([])).toBe(0);
    expect(calculateMean([8, 9, 10])).toBe(9);

    const stats = computeSeasonStats(
      {
        rating: 8.5,
        episodes: [
          {
            episode: 1,
            title: "Pilot",
            rating: 8.0,
            imdbRating: 8.2,
            tmdbRating: 7.8,
          },
          {
            episode: 2,
            title: "Midpoint",
            rating: 7.5,
            imdbRating: 7.6,
            tmdbRating: 7.4,
          },
          {
            episode: 3,
            title: "Finale",
            rating: 9.5,
            imdbRating: 9.6,
            tmdbRating: 9.4,
          },
        ],
      },
      8.0
    );

    expect(stats.rating).toBe(8.5);
    expect(stats.meanRating).toBeCloseTo(8.333, 2);
    expect(stats.imdbMedian).toBe(8.2);
    expect(stats.tmdbMedian).toBe(7.8);
    expect(stats.minRating).toBe(7.5);
    expect(stats.maxRating).toBe(9.5);
    expect(stats.deltaFromShowMedian).toBeCloseTo(0.5, 2);
    expect(stats.highRatedCount).toBe(2);
    expect(stats.bestEpisode).toEqual({
      episode: 3,
      title: "Finale",
      rating: 9.5,
    });
    expect(stats.worstEpisode).toEqual({
      episode: 2,
      title: "Midpoint",
      rating: 7.5,
    });
    expect(stats.premiereToFinaleDelta).toBeCloseTo(1.5, 2);
  });
});

