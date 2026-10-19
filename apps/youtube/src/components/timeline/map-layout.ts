/**
 * Pure geometry for the story map: time scale, axis ticks, lane packing,
 * row stacking, visible-range slicing and the overview histogram. All dates
 * are handled in UTC so the math is deterministic.
 */

export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;
/** Horizontal room before the first / after the last upload (cards are centered on x). */
export const EDGE_PAD = 140;

export type Zoom = "week" | "month" | "quarter" | "year";
export const ZOOMS: readonly Zoom[] = ["week", "month", "quarter", "year"];

export interface ZoomSpec {
  label: string;
  pxPerDay: number;
  node: "card" | "dot";
  /** Card width, or the largest dot diameter. */
  nodeWidth: number;
  rowHeight: number;
  /** Horizontal space kept free after a thread's start for its label. */
  labelReserve: number;
  threadRows: number;
  bandRows: number;
}

export const ZOOM_SPECS: Record<Zoom, ZoomSpec> = {
  week: { label: "Week", pxPerDay: 140, node: "card", nodeWidth: 112, rowHeight: 100, labelReserve: 220, threadRows: 3, bandRows: 3 },
  month: { label: "Month", pxPerDay: 36, node: "card", nodeWidth: 72, rowHeight: 48, labelReserve: 200, threadRows: 3, bandRows: 4 },
  quarter: { label: "Quarter", pxPerDay: 10, node: "dot", nodeWidth: 12, rowHeight: 16, labelReserve: 130, threadRows: 2, bandRows: 4 },
  year: { label: "Year", pxPerDay: 2.5, node: "dot", nodeWidth: 10, rowHeight: 12, labelReserve: 0, threadRows: 2, bandRows: 6 },
};

/** Month is 36 px/day and a card ~100 px wide, so uploads closer than ~3 days overlap there. */
export const WEEK_ZOOM_MAX_MEDIAN_GAP_DAYS = 2.5;
const CADENCE_SAMPLE = 200;

/** Week for channels whose recent median upload gap is under the threshold, Month otherwise. */
export function pickInitialZoom(videos: readonly { publishedAt: string }[]): Zoom {
  const times = videos
    .map((video) => Date.parse(video.publishedAt))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .slice(-CADENCE_SAMPLE);
  if (times.length < 2) return "month";
  const gaps = times.slice(1).map((t, i) => (t - times[i]) / DAY_MS).sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
  return median < WEEK_ZOOM_MAX_MEDIAN_GAP_DAYS ? "week" : "month";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const startOfUtcDay = (t: number) => Math.floor(t / DAY_MS) * DAY_MS;

function utcMonthStart(t: number, addMonths = 0): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + addMonths, 1);
}

function utcYearStart(t: number, addYears = 0): number {
  return Date.UTC(new Date(t).getUTCFullYear() + addYears, 0, 1);
}

export interface TimeScale {
  origin: number;
  pxPerDay: number;
  width: number;
}

export function createScale(minTime: number, maxTime: number, pxPerDay: number): TimeScale {
  const origin = startOfUtcDay(minTime);
  const days = (startOfUtcDay(maxTime) - origin) / DAY_MS + 1;
  return { origin, pxPerDay, width: Math.ceil(EDGE_PAD * 2 + days * pxPerDay) };
}

export const timeToX = (s: TimeScale, t: number) => EDGE_PAD + ((t - s.origin) / DAY_MS) * s.pxPerDay;
export const xToTime = (s: TimeScale, x: number) => s.origin + ((x - EDGE_PAD) / s.pxPerDay) * DAY_MS;

export interface Tick {
  time: number;
  label: string;
}

export interface Period extends Tick {
  end: number;
}

const MAX_TICKS = 2000;

/** Minor axis ticks inside [from, to]: days, Mondays, months or quarters by zoom. */
export function axisTicks(zoom: Zoom, from: number, to: number): Tick[] {
  const ticks: Tick[] = [];
  const push = (time: number, label: string) => {
    if (time >= from && time <= to && ticks.length < MAX_TICKS) ticks.push({ time, label });
  };
  if (zoom === "week" || zoom === "month") {
    let t = startOfUtcDay(from);
    if (zoom === "month") t -= ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS;
    const step = zoom === "week" ? DAY_MS : WEEK_MS;
    for (; t <= to && ticks.length < MAX_TICKS; t += step) push(t, String(new Date(t).getUTCDate()));
    return ticks;
  }
  const step = zoom === "quarter" ? 1 : 3;
  let t = zoom === "quarter" ? utcMonthStart(from) : utcYearStart(from);
  for (; t <= to && ticks.length < MAX_TICKS; t = utcMonthStart(t, step)) {
    push(t, MONTHS[new Date(t).getUTCMonth()]);
  }
  return ticks;
}

/** Labelled spans above the ticks: months (Week/Month zoom) or years (Quarter/Year). */
export function axisPeriods(zoom: Zoom, from: number, to: number): Period[] {
  const byMonth = zoom === "week" || zoom === "month";
  const periods: Period[] = [];
  let t = byMonth ? utcMonthStart(from) : utcYearStart(from);
  while (t <= to && periods.length < MAX_TICKS) {
    const end = byMonth ? utcMonthStart(t, 1) : utcYearStart(t, 1);
    const d = new Date(t);
    const label = byMonth ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : String(d.getUTCFullYear());
    periods.push({ time: t, end, label });
    t = end;
  }
  return periods;
}

export interface Interval {
  id: string;
  start: number;
  end: number;
}

/** Greedy first-fit packing: each interval takes the lowest lane free `gap` before its start. */
export function packLanes(intervals: readonly Interval[], gap: number): { lanes: Map<string, number>; count: number } {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const interval of sorted) {
    let lane = laneEnds.findIndex((end) => end + gap <= interval.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = interval.end;
    lanes.set(interval.id, lane);
  }
  return { lanes, count: laneEnds.length };
}

/**
 * Row for each x (ascending) so nodes closer than `spacing` stack instead of
 * overlapping. Past `maxRows`, the row that frees up first is reused.
 */
export function stackRows(xs: readonly number[], spacing: number, maxRows: number): { rows: number[]; count: number } {
  const rowEnds: number[] = [];
  const rows = xs.map((x) => {
    let row = rowEnds.findIndex((end) => x - end >= spacing);
    if (row < 0 && rowEnds.length < maxRows) row = rowEnds.length;
    if (row < 0) row = rowEnds.indexOf(Math.min(...rowEnds));
    rowEnds[row] = x;
    return row;
  });
  return { rows, count: rowEnds.length };
}

/** First index whose value is >= `value` in an ascending array. */
export function lowerBound(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** First index whose value is > `value` in an ascending array. */
function upperBound(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** [lo, hi) of the xs inside [from, to], widened by `neighbors` so lines crossing the edge still draw. */
export function visibleSlice(xs: readonly number[], from: number, to: number, neighbors = 0): [number, number] {
  const lo = Math.max(0, lowerBound(xs, from) - neighbors);
  const hi = Math.min(xs.length, upperBound(xs, to) + neighbors);
  return [lo, Math.max(lo, hi)];
}

export interface RenderWindow {
  from: number;
  to: number;
  /** Chunk start (<= scrollLeft): stable while the user scrolls within one chunk. */
  anchor: number;
}

/**
 * The x range to render: quantized to half-viewport chunks so scrolling only
 * re-renders when a chunk boundary is crossed, plus one viewport of buffer per side.
 * Clamped to the content so a window that already covers it never changes.
 */
export function renderWindow(scrollLeft: number, viewportWidth: number, contentWidth: number): RenderWindow {
  const width = Math.max(viewportWidth, 320);
  const chunk = width / 2;
  const anchor = Math.floor(Math.max(0, scrollLeft) / chunk) * chunk;
  return {
    from: Math.max(0, anchor - width),
    to: Math.min(contentWidth, anchor + chunk + width * 2),
    anchor,
  };
}
