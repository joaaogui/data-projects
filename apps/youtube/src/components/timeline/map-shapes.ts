import { DAY_MS } from "./map-layout";

const WEEK_MS = 7 * DAY_MS;

/** Radius by views on a log scale, between rMin and rMax. */
export function dotRadius(views: number, minViews: number, maxViews: number, rMin: number, rMax: number): number {
  const lo = Math.log10(Math.max(1, minViews));
  const hi = Math.log10(Math.max(1, maxViews));
  if (hi <= lo) return (rMin + rMax) / 2;
  const f = (Math.log10(Math.max(1, views)) - lo) / (hi - lo);
  return rMin + Math.min(1, Math.max(0, f)) * (rMax - rMin);
}

export interface OverviewItem {
  time: number;
  score: number;
  inThread: boolean;
}

export interface OrdinalWeek {
  /** Index of the week's first video on the ordinal track. */
  startIndex: number;
  count: number;
  avgScore: number;
  threadShare: number;
}

/**
 * Consecutive videos grouped by UTC week (Monday start), as runs on the
 * ordinal track. `items` must be ascending; weeks without uploads have no run.
 */
export function ordinalWeeks(items: readonly OverviewItem[]): OrdinalWeek[] {
  const weeks: (OrdinalWeek & { key: number; scoreSum: number; threads: number })[] = [];
  items.forEach((item, index) => {
    // Jan 1 1970 was a Thursday: shift by 3 days so weeks start on Monday.
    const key = Math.floor((item.time + 3 * DAY_MS) / WEEK_MS);
    let week = weeks[weeks.length - 1];
    if (!week || week.key !== key) {
      week = { key, startIndex: index, count: 0, avgScore: 0, threadShare: 0, scoreSum: 0, threads: 0 };
      weeks.push(week);
    }
    week.count += 1;
    week.scoreSum += item.score;
    if (item.inThread) week.threads += 1;
  });
  return weeks.map((w) => ({
    startIndex: w.startIndex,
    count: w.count,
    avgScore: w.scoreSum / w.count,
    threadShare: w.threads / w.count,
  }));
}
