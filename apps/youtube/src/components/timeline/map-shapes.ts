import { startOfUtcDay, WEEK_MS } from "./map-layout";

/** Radius by views on a log scale, between rMin and rMax. */
export function dotRadius(views: number, minViews: number, maxViews: number, rMin: number, rMax: number): number {
  const lo = Math.log10(Math.max(1, minViews));
  const hi = Math.log10(Math.max(1, maxViews));
  if (hi <= lo) return (rMin + rMax) / 2;
  const f = (Math.log10(Math.max(1, views)) - lo) / (hi - lo);
  return rMin + Math.min(1, Math.max(0, f)) * (rMax - rMin);
}

export interface Point {
  x: number;
  y: number;
}

/** Smooth path through points: horizontal-tangent cubic between each pair. */
export function threadPath(points: readonly Point[]): string {
  if (points.length === 0) return "";
  const r = (n: number) => Math.round(n * 10) / 10;
  let d = `M${r(points[0].x)} ${r(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const mx = r((a.x + b.x) / 2);
    d += a.y === b.y ? ` L${r(b.x)} ${r(b.y)}` : ` C${mx} ${r(a.y)} ${mx} ${r(b.y)} ${r(b.x)} ${r(b.y)}`;
  }
  return d;
}

export interface OverviewItem {
  time: number;
  score: number;
  inThread: boolean;
}

export interface OverviewBucket {
  start: number;
  count: number;
  avgScore: number;
  threadShare: number;
}

/** Upload counts per 7-day bucket from the first upload's day; empty weeks are kept. */
export function bucketWeeks(items: readonly OverviewItem[], minTime: number, maxTime: number): OverviewBucket[] {
  if (items.length === 0 || maxTime < minTime) return [];
  const origin = startOfUtcDay(minTime);
  const n = Math.floor((maxTime - origin) / WEEK_MS) + 1;
  const sums = Array.from({ length: n }, () => ({ count: 0, score: 0, thread: 0 }));
  for (const item of items) {
    const i = Math.floor((item.time - origin) / WEEK_MS);
    if (i < 0 || i >= n) continue;
    sums[i].count += 1;
    sums[i].score += item.score;
    if (item.inThread) sums[i].thread += 1;
  }
  return sums.map((s, i) => ({
    start: origin + i * WEEK_MS,
    count: s.count,
    avgScore: s.count ? s.score / s.count : 0,
    threadShare: s.count ? s.thread / s.count : 0,
  }));
}
