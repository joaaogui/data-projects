import { describe, expect, it } from "vitest";
import { dotRadius, ordinalWeeks } from "../map-shapes";

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

describe("ordinalWeeks", () => {
  it("groups consecutive videos by Monday-start week as runs on the track", () => {
    const weeks = ordinalWeeks([
      { time: utc(2023, 5, 7), score: 40, inThread: true }, // Sunday
      { time: utc(2023, 5, 8), score: 60, inThread: false }, // Monday: new week
      { time: utc(2023, 5, 9), score: 80, inThread: true },
      { time: utc(2023, 5, 30), score: 50, inThread: false }, // empty weeks skipped
    ]);
    expect(weeks.map((w) => [w.startIndex, w.count])).toEqual([
      [0, 1],
      [1, 2],
      [3, 1],
    ]);
    expect(weeks[1]).toMatchObject({ avgScore: 70, threadShare: 0.5 });
  });

  it("returns nothing for no uploads", () => {
    expect(ordinalWeeks([])).toEqual([]);
  });
});
