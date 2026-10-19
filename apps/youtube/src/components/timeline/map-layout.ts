/**
 * Pure geometry for the story map. The track is ORDINAL: x is a video's index
 * in upload order, so a daily and a weekly channel read the same way. Dates
 * are handled in UTC so the math is deterministic.
 */

export const DAY_MS = 86_400_000;
/** Room before the first / after the last video. */
export const EDGE_PAD = 80;
/** Consecutive uploads further apart than this get a break marker on the line. */
export const GAP_MARKER_MIN_DAYS = 7;

export type Density = "cards" | "thumbs" | "dots";
export const DENSITIES: readonly Density[] = ["cards", "thumbs", "dots"];

export interface DensitySpec {
  label: string;
  /** Horizontal distance between consecutive videos. */
  pitch: number;
  /** Card width, or the largest dot diameter. */
  nodeWidth: number;
  thumbHeight: number;
  /** Full node height, including the 3px story bar. */
  nodeHeight: number;
  title: boolean;
  dayLabels: boolean;
  /** Horizontal space kept after a bracket's start for its label when packing rows. */
  labelReserve: number;
}

export const DENSITY_SPECS: Record<Density, DensitySpec> = {
  cards: { label: "Cards", pitch: 124, nodeWidth: 112, thumbHeight: 63, nodeHeight: 92, title: true, dayLabels: true, labelReserve: 150 },
  thumbs: { label: "Thumbnails", pitch: 56, nodeWidth: 50, thumbHeight: 28, nodeHeight: 31, title: false, dayLabels: false, labelReserve: 140 },
  dots: { label: "Dots", pitch: 8, nodeWidth: 7, thumbHeight: 0, nodeHeight: 13, title: false, dayLabels: false, labelReserve: 0 },
};

/** Center x of the video at `index` (fractional indexes interpolate). */
export const indexToX = (index: number, pitch: number) => EDGE_PAD + index * pitch + pitch / 2;
export const xToIndex = (x: number, pitch: number) => (x - EDGE_PAD - pitch / 2) / pitch;
export const trackWidth = (count: number, pitch: number) => EDGE_PAD * 2 + count * pitch;

/** [lo, hi) of the video indexes whose slot intersects [from, to]. */
export function visibleRange(count: number, pitch: number, from: number, to: number): [number, number] {
  const lo = Math.min(count, Math.max(0, Math.floor((from - EDGE_PAD) / pitch)));
  const hi = Math.min(count, Math.ceil((to - EDGE_PAD) / pitch));
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface PeriodMark {
  /** First video of the period. */
  index: number;
  /** First video of the next period (exclusive end). */
  endIndex: number;
  label: string;
}

/** One mark per calendar month (or year) at its first video; `times` must be ascending. */
export function periodMarks(times: readonly number[], unit: "month" | "year"): PeriodMark[] {
  const marks: PeriodMark[] = [];
  let previous = "";
  times.forEach((time, index) => {
    const d = new Date(time);
    const key = unit === "month" ? `${d.getUTCFullYear()}-${d.getUTCMonth()}` : String(d.getUTCFullYear());
    if (key === previous) return;
    previous = key;
    const last = marks[marks.length - 1];
    if (last) last.endIndex = index;
    marks.push({
      index,
      endIndex: times.length,
      label: unit === "month" ? `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : String(d.getUTCFullYear()),
    });
  });
  return marks;
}

export interface GapMark {
  /** Index of the video after the break. */
  index: number;
  days: number;
}

/** Breaks between consecutive uploads more than `minDays` apart; `times` must be ascending. */
export function gapMarks(times: readonly number[], minDays = GAP_MARKER_MIN_DAYS): GapMark[] {
  const gaps: GapMark[] = [];
  for (let i = 1; i < times.length; i++) {
    const days = (times[i] - times[i - 1]) / DAY_MS;
    if (days > minDays) gaps.push({ index: i, days: Math.round(days) });
  }
  return gaps;
}

export interface Interval {
  id: string;
  start: number;
  end: number;
}

/**
 * Greedy first-fit row packing: each interval takes the lowest row free `gap`
 * before its start. Past `maxRows`, the row that frees up first is reused.
 */
export function packRows(intervals: readonly Interval[], gap: number, maxRows: number): { rows: Map<string, number>; count: number } {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const rowEnds: number[] = [];
  const rows = new Map<string, number>();
  for (const interval of sorted) {
    let row = rowEnds.findIndex((end) => end + gap <= interval.start);
    if (row < 0 && rowEnds.length < maxRows) row = rowEnds.length;
    if (row < 0) row = rowEnds.indexOf(Math.min(...rowEnds));
    rowEnds[row] = Math.max(rowEnds[row] ?? -Infinity, interval.end);
    rows.set(interval.id, row);
  }
  return { rows, count: rowEnds.length };
}
