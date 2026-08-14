export function formatCompact(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString("en-US");
}

export function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

export function getAgeLabel(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days >= 365) {
    const years = days / 365;
    return `${years.toFixed(1)}y`;
  }
  return `${formatNumber(days)}d`;
}

/*
 * Performance is encoded as weight rather than hue: the strongest results get
 * the accent, everything below it fades through the greyscale ramp. This keeps
 * a table of scores scannable without turning it into a rainbow.
 */
export function getEngagementColor(rate: number): string {
  if (rate >= 60) return "text-data";
  if (rate >= 40) return "text-foreground";
  if (rate >= 20) return "text-muted-foreground";
  return "text-muted-foreground/70";
}

export function getEfficiencyColor(viewsPerContentMin: number): string {
  if (viewsPerContentMin >= 100000) return "text-data";
  if (viewsPerContentMin >= 50000) return "text-foreground";
  if (viewsPerContentMin >= 10000) return "text-muted-foreground";
  return "text-muted-foreground/70";
}

export function getScoreColorClass(score: number): string {
  if (score >= 70) return "bg-data/10 text-data";
  if (score >= 55) return "bg-foreground/[0.08] text-foreground";
  if (score >= 40) return "bg-muted text-muted-foreground";
  if (score >= 25) return "bg-muted/60 text-muted-foreground/80";
  return "bg-muted/40 text-muted-foreground/60";
}

export function getScoreBorderClass(score: number): string {
  if (score >= 70) return "border-l-data/70";
  if (score >= 55) return "border-l-foreground/40";
  if (score >= 40) return "border-l-foreground/25";
  if (score >= 25) return "border-l-foreground/15";
  return "border-l-foreground/[0.08]";
}
