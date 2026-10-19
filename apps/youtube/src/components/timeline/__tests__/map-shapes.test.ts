import { describe, expect, it } from "vitest";
import { bucketWeeks, dotRadius, threadPath } from "../map-shapes";

const utc = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d);

describe("dotRadius", () => {
  it("scales views logarithmically between the bounds", () => {
    expect(dotRadius(100, 100, 1_000_000, 2, 6)).toBe(2);
    expect(dotRadius(1_000_000, 100, 1_000_000, 2, 6)).toBe(6);
    expect(dotRadius(10_000, 100, 1_000_000, 2, 6)).toBeCloseTo(4);
  });

  it("uses the midpoint when every video has the same views", () => {
    expect(dotRadius(5, 5, 5, 2, 6)).toBe(4);
  });
});

describe("threadPath", () => {
  it("draws straight segments on one row and curves between rows", () => {
    expect(threadPath([])).toBe("");
    expect(threadPath([{ x: 0, y: 10 }, { x: 40, y: 10 }])).toBe("M0 10 L40 10");
    expect(threadPath([{ x: 0, y: 10 }, { x: 40, y: 30 }])).toBe("M0 10 C20 10 20 30 40 30");
  });
});

describe("bucketWeeks", () => {
  it("counts uploads per week, keeping empty weeks", () => {
    const buckets = bucketWeeks(
      [
        { time: utc(2023, 1, 1), score: 40, inThread: true },
        { time: utc(2023, 1, 3), score: 60, inThread: false },
        { time: utc(2023, 1, 20), score: 80, inThread: true },
      ],
      utc(2023, 1, 1),
      utc(2023, 1, 20)
    );
    expect(buckets.map((b) => b.count)).toEqual([2, 0, 1]);
    expect(buckets[0]).toMatchObject({ avgScore: 50, threadShare: 0.5 });
    expect(buckets[1]).toMatchObject({ avgScore: 0, threadShare: 0 });
  });

  it("returns nothing for no uploads", () => {
    expect(bucketWeeks([], 0, 0)).toEqual([]);
  });
});
