import { describe, expect, it } from "vitest";
import {
  MAX_SEASONS,
  SEASON_FETCH_BATCH,
  calculateMedian,
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

