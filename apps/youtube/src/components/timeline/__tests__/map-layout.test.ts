import { describe, expect, it } from "vitest";
import {
  axisPeriods,
  axisTicks,
  createScale,
  DAY_MS,
  EDGE_PAD,
  lowerBound,
  packLanes,
  pickInitialZoom,
  renderWindow,
  stackRows,
  timeToX,
  visibleSlice,
  xToTime,
  ZOOM_SPECS,
} from "../map-layout";

const utc = (y: number, m: number, d: number, h = 0) => Date.UTC(y, m - 1, d, h);

describe("time scale", () => {
  const scale = createScale(utc(2023, 5, 1, 15), utc(2023, 5, 11, 2), 36);

  it("starts at the first day with edge padding and spans whole days", () => {
    expect(scale.origin).toBe(utc(2023, 5, 1));
    expect(timeToX(scale, utc(2023, 5, 1))).toBe(EDGE_PAD);
    expect(timeToX(scale, utc(2023, 5, 2))).toBe(EDGE_PAD + 36);
    expect(scale.width).toBe(EDGE_PAD * 2 + 11 * 36);
  });

  it("round-trips x and time", () => {
    const t = utc(2023, 5, 7, 12);
    expect(xToTime(scale, timeToX(scale, t))).toBeCloseTo(t);
  });

  it("fits about five weeks of Month zoom in a 1280px viewport", () => {
    const days = 1280 / ZOOM_SPECS.month.pxPerDay;
    expect(days).toBeGreaterThanOrEqual(33);
    expect(days).toBeLessThanOrEqual(38);
  });
});

describe("axis", () => {
  it("ticks every day at Week zoom", () => {
    const ticks = axisTicks("week", utc(2023, 5, 30), utc(2023, 6, 2));
    expect(ticks.map((t) => t.label)).toEqual(["30", "31", "1", "2"]);
  });

  it("ticks Mondays at Month zoom", () => {
    const ticks = axisTicks("month", utc(2023, 5, 3), utc(2023, 5, 31));
    expect(ticks.map((t) => new Date(t.time).getUTCDay())).toEqual([1, 1, 1, 1]);
    expect(ticks.map((t) => t.label)).toEqual(["8", "15", "22", "29"]);
  });

  it("ticks months at Quarter zoom and quarters at Year zoom", () => {
    expect(axisTicks("quarter", utc(2023, 1, 15), utc(2023, 4, 2)).map((t) => t.label)).toEqual(["Feb", "Mar", "Apr"]);
    expect(axisTicks("year", utc(2022, 11, 1), utc(2023, 12, 31)).map((t) => t.label)).toEqual(["Jan", "Apr", "Jul", "Oct"]);
  });

  it("labels months or years as periods that cover the range", () => {
    const months = axisPeriods("month", utc(2023, 5, 20), utc(2023, 7, 3));
    expect(months.map((p) => p.label)).toEqual(["May 2023", "Jun 2023", "Jul 2023"]);
    expect(months[0].time).toBe(utc(2023, 5, 1));
    expect(months[0].end).toBe(months[1].time);
    expect(axisPeriods("year", utc(2022, 3, 1), utc(2023, 2, 1)).map((p) => p.label)).toEqual(["2022", "2023"]);
  });
});

describe("pickInitialZoom", () => {
  const uploads = (count: number, everyDays: number, start = utc(2024, 1, 1)) =>
    Array.from({ length: count }, (_, i) => ({ publishedAt: new Date(start + i * everyDays * DAY_MS).toISOString() }));

  it("picks Week for a daily channel and Month for a weekly one", () => {
    expect(pickInitialZoom(uploads(300, 1))).toBe("week");
    expect(pickInitialZoom(uploads(300, 7))).toBe("month");
  });

  it("decides from the most recent 200 uploads", () => {
    const dailyEra = uploads(500, 1, utc(2018, 1, 1));
    const weeklyEra = uploads(200, 7, utc(2021, 1, 1));
    expect(pickInitialZoom([...weeklyEra, ...dailyEra])).toBe("month");
  });

  it("falls back to Month with fewer than 2 dated videos", () => {
    expect(pickInitialZoom([])).toBe("month");
    expect(pickInitialZoom([{ publishedAt: "2024-01-01T00:00:00Z" }, { publishedAt: "not a date" }])).toBe("month");
  });
});

describe("packLanes", () => {
  it("stacks concurrent intervals and reuses freed lanes", () => {
    const { lanes, count } = packLanes(
      [
        { id: "a", start: 0, end: 100 },
        { id: "b", start: 50, end: 150 },
        { id: "c", start: 110, end: 200 },
        { id: "d", start: 105, end: 120 },
      ],
      10
    );
    expect(lanes.get("a")).toBe(0);
    expect(lanes.get("b")).toBe(1);
    expect(lanes.get("d")).toBe(2);
    expect(lanes.get("c")).toBe(0);
    expect(count).toBe(3);
  });

  it("handles no intervals", () => {
    expect(packLanes([], 10)).toEqual({ lanes: new Map(), count: 0 });
  });
});

describe("stackRows", () => {
  it("offsets nodes closer than the spacing", () => {
    expect(stackRows([0, 10, 20, 100], 50, 3)).toEqual({ rows: [0, 1, 2, 0], count: 3 });
  });

  it("reuses the earliest-freed row past the cap", () => {
    expect(stackRows([0, 10, 20], 50, 2).rows).toEqual([0, 1, 0]);
  });
});

describe("visible range", () => {
  const xs = [10, 20, 30, 40, 50];

  it("binary-searches the first index >= value", () => {
    expect(lowerBound(xs, 25)).toBe(2);
    expect(lowerBound(xs, 60)).toBe(5);
  });

  it("slices inclusive bounds and widens by neighbors", () => {
    expect(visibleSlice(xs, 20, 40)).toEqual([1, 4]);
    expect(visibleSlice(xs, 20, 40, 1)).toEqual([0, 5]);
    expect(visibleSlice(xs, 22, 28)).toEqual([2, 2]);
    expect(visibleSlice(xs, 22, 28, 1)).toEqual([1, 3]);
  });

  it("quantizes the render window and always covers the viewport", () => {
    for (const left of [0, 333, 640, 5000, 12_345]) {
      const w = renderWindow(left, 1280, 1e6);
      expect(w.from).toBeLessThanOrEqual(Math.max(0, left - 1280));
      expect(w.to).toBeGreaterThanOrEqual(left + 1280 + 640);
      expect(w.anchor).toBeLessThanOrEqual(left);
    }
    expect(renderWindow(100, 1280, 1e6)).toEqual(renderWindow(600, 1280, 1e6));
  });

  it("clamps the render window to the content", () => {
    expect(renderWindow(3000, 1280, 4000)).toMatchObject({ from: 1280, to: 4000 });
    expect(renderWindow(0, 1280, 1000)).toMatchObject({ from: 0, to: 1000 });
  });

  it("keeps Year zoom compact enough for a long channel", () => {
    const scale = createScale(utc(2020, 9, 1), utc(2026, 4, 1), ZOOM_SPECS.year.pxPerDay);
    expect(scale.width).toBeLessThan(6000);
    expect(scale.width).toBeGreaterThan((5 * 365 * DAY_MS * ZOOM_SPECS.year.pxPerDay) / DAY_MS);
  });
});
