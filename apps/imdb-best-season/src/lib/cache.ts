import { createCache } from "@data-projects/shared";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;

const cache = createCache<unknown>({ ttlMs: DEFAULT_TTL_MS, maxSize: MAX_CACHE_SIZE });

export function getFromCache<T>(key: string): T | null {
  return (cache.get(key) as T | null) ?? null;
}

export function setInCache<T>(key: string, data: T): void {
  cache.set(key, data as unknown);
}

export function getTitleCacheKey(title: string): string {
  return `title:${title.toLowerCase().trim()}`;
}

export function getSeasonCacheKey(imdbId: string, season: number): string {
  return `season:${imdbId}:${season}`;
}

export function getSuggestCacheKey(query: string): string {
  return `suggest:${query.toLowerCase().trim()}`;
}

export function getTmdbIdCacheKey(imdbId: string): string {
  return `tmdb-id:${imdbId}`;
}

export function getTmdbSeasonCacheKey(tmdbId: number, season: number): string {
  return `tmdb-season:${tmdbId}:${season}`;
}

export function clearCache(): void {
  cache.clear();
}

export function getCacheStats(): { size: number; maxSize: number } {
  const stats = cache.stats();
  return {
    size: stats.size,
    maxSize: stats.maxSize,
  };
}
