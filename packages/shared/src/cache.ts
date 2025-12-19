export interface CacheOptions {
  ttlMs?: number;
  maxSize?: number;
  now?: () => number;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  ttlMs: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export function createCache<T>(options: CacheOptions = {}) {
  const ttlMs = options.ttlMs ?? 24 * 60 * 60 * 1000;
  const maxSize = options.maxSize ?? 1000;
  const now = options.now ?? (() => Date.now());

  const store = new Map<string, CacheEntry<T>>();

  function get(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (now() - entry.timestamp > ttlMs) {
      store.delete(key);
      return null;
    }
    return entry.data;
  }

  function set(key: string, data: T): void {
    if (store.size >= maxSize) {
      const oldestKey = store.keys().next().value as string | undefined;
      if (oldestKey) store.delete(oldestKey);
    }
    store.set(key, { data, timestamp: now() });
  }

  function del(key: string): boolean {
    return store.delete(key);
  }

  function clear(): void {
    store.clear();
  }

  function stats(): CacheStats {
    return { size: store.size, maxSize, ttlMs };
  }

  return { get, set, delete: del, clear, stats } as const;
}



