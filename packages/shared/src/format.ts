const numberFormatter = new Intl.NumberFormat("en-US");

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return numberFormatter.format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return numberFormatter.format(value);
}

export function formatSigned(value: number): string {
  if (value > 0) {
    return `+${numberFormatter.format(value)}`;
  }
  if (value < 0) {
    return `−${numberFormatter.format(Math.abs(value))}`;
  }
  return "0";
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
