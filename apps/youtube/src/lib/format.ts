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

export function getEngagementColor(rate: number): string {
  if (rate >= 60) return "text-emerald-600 dark:text-emerald-400";
  if (rate >= 40) return "text-teal-600 dark:text-teal-400";
  if (rate >= 20) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function getEfficiencyColor(viewsPerContentMin: number): string {
  if (viewsPerContentMin >= 100000) return "text-emerald-600 dark:text-emerald-400";
  if (viewsPerContentMin >= 50000) return "text-teal-600 dark:text-teal-400";
  if (viewsPerContentMin >= 10000) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function getScoreColorClass(score: number): string {
  if (score >= 70) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (score >= 55) return "bg-teal-500/15 text-teal-600 dark:text-teal-400";
  if (score >= 40) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  if (score >= 25) return "bg-orange-500/15 text-orange-600 dark:text-orange-400";
  return "bg-red-500/15 text-red-600 dark:text-red-400";
}

export function getScoreBorderClass(score: number): string {
  if (score >= 70) return "border-l-emerald-500/60";
  if (score >= 55) return "border-l-teal-500/50";
  if (score >= 40) return "border-l-amber-500/40";
  if (score >= 25) return "border-l-orange-500/30";
  return "border-l-red-500/20";
}
