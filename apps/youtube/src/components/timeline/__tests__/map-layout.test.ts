import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  DENSITY_SPECS,
  EDGE_PAD,
  gapMarks,
  indexToX,
  packRows,
  periodMarks,
  renderWindow,
  trackWidth,
  visibleRange,
  xToIndex,
} from "../map-layout";

const utc = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m - 1, d, h);

describe("ordinal track", () => {
  it("places videos at a fixed pitch regardless of dates", () => {
    expect(indexToX(0, 124)).toBe(EDGE_PAD + 62);
    expect(indexToX(3, 124) - indexToX(2, 124)).toBe(124);
    expect(trackWidth(10, 8)).toBe(EDGE_PAD * 2 + 80);
  });

  it("round-trips index and x, including fractional centers", () => {
    expect(xToIndex(indexToX(7, 56), 56)).toBe(7);
    expect(xToIndex(indexToX(7.5, 8), 8)).toBe(7.5);
  });

  it("orders the densities from widest to densest", () => {
    const { cards, thumbs, dots } = DENSITY_SPECS;
    expect(cards.pitch).toBeGreaterThan(thumbs.pitch);
    expect(thumbs.pitch).toBeGreaterThan(dots.pitch);
    for (const spec of [cards, thumbs, dots]) expect(spec.nodeWidth).toBeLessThan(spec.pitch);
  });
});

describe("visibleRange", () => {
  it("returns the indexes whose slot intersects the window", () => {
    const pitch = 100;
    expect(visibleRange(50, pitch, 0, EDGE_PAD + 250)).toEqual([0, 3]);
    expect(visibleRange(50, pitch, EDGE_PAD + 1000, EDGE_PAD + 1050)).toEqual([10, 11]);
  });

  it("clamps to the track", () => {
    expect(visibleRange(5, 100, -500, 1e6)).toEqual([0, 5]);
    expect(visibleRange(5, 100, 1e6, 2e6)).toEqual([5, 5]);
    expect(visibleRange(0, 100, 0, 1000)).toEqual([0, 0]);
  });
});

describe("renderWindow", () => {
  it("quantizes and always covers the viewport with a buffer", () => {
    for (const left of [0, 333, 640, 5000, 12_345]) {
      const w = renderWindow(left, 1280, 1e6);
      expect(w.from).toBeLessThanOrEqual(Math.max(0, left - 1280));
      expect(w.to).toBeGreaterThanOrEqual(left + 1280 + 640);
      expect(w.anchor).toBeLessThanOrEqual(left);
    }
    expect(renderWindow(100, 1280, 1e6)).toEqual(renderWindow(600, 1280, 1e6));
  });

  it("clamps to the content", () => {
    expect(renderWindow(3000, 1280, 4000)).toMatchObject({ from: 1280, to: 4000 });
    expect(renderWindow(0, 1280, 1000)).toMatchObject({ from: 0, to: 1000 });
  });
});

describe("periodMarks", () => {
  const times = [utc(2023, 4, 29), utc(2023, 4, 30), utc(2023, 5, 1), utc(2023, 5, 20), utc(2024, 1, 2)];

  it("marks the first video of each month with its end index", () => {
    expect(periodMarks(times, "month")).toEqual([
      { index: 0, endIndex: 2, label: "Apr 2023" },
      { index: 2, endIndex: 4, label: "May 2023" },
      { index: 4, endIndex: 5, label: "Jan 2024" },
    ]);
  });

  it("marks years and handles no videos", () => {
    expect(periodMarks(times, "year").map((m) => [m.index, m.label])).toEqual([
      [0, "2023"],
      [4, "2024"],
    ]);
    expect(periodMarks([], "month")).toEqual([]);
  });
});

describe("gapMarks", () => {
  it("flags breaks longer than a week with their rounded length", () => {
    const times = [0, DAY_MS, 8 * DAY_MS, 21 * DAY_MS, 21 * DAY_MS];
    expect(gapMarks(times)).toEqual([{ index: 3, days: 13 }]);
    expect(gapMarks(times, 6)).toEqual([
      { index: 2, days: 7 },
      { index: 3, days: 13 },
    ]);
  });
});

describe("packRows", () => {
  it("stacks interleaved intervals and reuses freed rows", () => {
    const { rows, count } = packRows(
      [
        { id: "a", start: 0, end: 100 },
        { id: "b", start: 50, end: 150 },
        { id: "c", start: 110, end: 200 },
        { id: "d", start: 105, end: 120 },
      ],
      10,
      4
    );
    expect([rows.get("a"), rows.get("b"), rows.get("d"), rows.get("c")]).toEqual([0, 1, 2, 0]);
    expect(count).toBe(3);
  });

  it("caps the rows and reuses the earliest-freed one", () => {
    const intervals = ["a", "b", "c"].map((id, i) => ({ id, start: i, end: 100 + i }));
    const { rows, count } = packRows(intervals, 0, 2);
    expect(count).toBe(2);
    expect(rows.get("c")).toBe(0);
  });

  it("handles no intervals", () => {
    expect(packRows([], 10, 4)).toEqual({ rows: new Map(), count: 0 });
  });
});
