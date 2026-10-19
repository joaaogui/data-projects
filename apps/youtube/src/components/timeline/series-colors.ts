import type { SeriesKind } from "@/lib/series";

/**
 * Mid-lightness hues that stay legible on both the light and dark themes.
 * Color is only an accent: every place that uses it also carries the series
 * name / "Part n/m" as text.
 */
const SERIES_PALETTE = [
  "hsl(212 80% 55%)",
  "hsl(152 60% 42%)",
  "hsl(32 90% 52%)",
  "hsl(280 60% 60%)",
  "hsl(350 75% 58%)",
  "hsl(188 75% 42%)",
  "hsl(48 90% 48%)",
  "hsl(250 65% 62%)",
] as const;

/** Stable 32-bit FNV-1a hash so a series keeps its color across renders and sessions. */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function seriesColor(seriesId: string): string {
  return SERIES_PALETTE[hashString(seriesId) % SERIES_PALETTE.length];
}

export const SERIES_KIND_LABEL: Record<SeriesKind, string> = {
  playlist: "Playlist",
  "ai-detected": "AI detected",
  manual: "Manual",
  title: "From titles",
};
