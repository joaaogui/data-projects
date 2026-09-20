export const MAX_SEASONS = 40;
export const SEASON_FETCH_BATCH = 5;

export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    results.push(...(await Promise.all(batch.map(mapper))));
  }
  return results;
}

/** Season numbers to fetch, capped at {@link MAX_SEASONS}. */
export function seasonNumbersUpTo(totalSeasons: number): number[] {
  const seasonsToFetch = Math.min(Math.max(totalSeasons, 0), MAX_SEASONS);
  return seasonsToFetch > 0
    ? Array.from({ length: seasonsToFetch }, (_, index) => index + 1)
    : [];
}
