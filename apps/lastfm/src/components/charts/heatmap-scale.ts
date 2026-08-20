/**
 * Shared intensity ramp for the hand-rolled heatmaps. Listening counts are
 * heavily skewed -- a handful of cells dwarf the rest -- so a linear ramp would
 * render almost everything as the palest step. Rank-free square-root scaling
 * keeps the low end readable while preserving ordering.
 */
export function intensity(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.sqrt(value / max);
}

/** Opacity floor so a cell with a single play is still distinguishable from empty. */
export function cellStyle(value: number, max: number): React.CSSProperties {
  if (value <= 0) return { backgroundColor: "hsl(var(--muted))" };
  const alpha = 0.12 + intensity(value, max) * 0.88;
  return { backgroundColor: `hsl(var(--data) / ${alpha.toFixed(3)})` };
}

export const LEGEND_STEPS = [0, 0.25, 0.5, 0.75, 1] as const;
