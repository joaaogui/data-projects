export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface RateLimiter {
  check(identifier: string, now?: number): RateLimitDecision;
}

interface BoundedRateLimitEntry {
  count: number;
  resetAt: number;
}

const MAX_TRACKED_CLIENTS = 10_000;

const rateLimitStore = new Map<string, BoundedRateLimitEntry>();

function evictIfAtCapacity(
  entries: Map<string, BoundedRateLimitEntry>,
  now: number,
) {
  if (entries.size < MAX_TRACKED_CLIENTS) {
    return;
  }

  for (const [identifier, entry] of entries) {
    if (now >= entry.resetAt) {
      entries.delete(identifier);
    }
  }

  if (entries.size >= MAX_TRACKED_CLIENTS) {
    const oldestIdentifier = entries.keys().next().value as
      | string
      | undefined;
    if (oldestIdentifier) {
      entries.delete(oldestIdentifier);
    }
  }
}

export const RATE_LIMIT_PRESETS = {
  search: { maxRequests: 30, windowMs: 60 * 1000 },
  suggest: { maxRequests: 60, windowMs: 60 * 1000 },
  preview: { maxRequests: 60, windowMs: 60 * 1000 },
  aiQuery: { maxRequests: 10, windowMs: 60 * 1000 },
} as const;

export function createRateLimiter({
  limit,
  windowMs,
}: RateLimiterOptions): RateLimiter {
  if (!Number.isInteger(limit) || limit < 1 || windowMs < 1) {
    throw new Error("Rate limiter requires a positive limit and window");
  }

  const entries = new Map<string, BoundedRateLimitEntry>();

  return {
    check(identifier: string, now = Date.now()): RateLimitDecision {
      const key = identifier.trim() || "anonymous";
      const existing = entries.get(key);

      if (!existing || now >= existing.resetAt) {
        evictIfAtCapacity(entries, now);
        const resetAt = now + windowMs;
        entries.set(key, { count: 1, resetAt });
        return {
          success: true,
          remaining: limit - 1,
          resetAt,
        };
      }

      if (existing.count >= limit) {
        return {
          success: false,
          remaining: 0,
          resetAt: existing.resetAt,
          retryAfter: Math.max(
            1,
            Math.ceil((existing.resetAt - now) / 1_000),
          ),
        };
      }

      existing.count += 1;
      return {
        success: true,
        remaining: limit - existing.count,
        resetAt: existing.resetAt,
      };
    },
  };
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier.trim() || "anonymous";
  const entry = rateLimitStore.get(key);

  if (!entry || now >= entry.resetAt) {
    evictIfAtCapacity(rateLimitStore, now);
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, {
      count: 1,
      resetAt: resetTime,
    });

    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetAt,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
    };
  }

  entry.count += 1;

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetAt,
  };
}

function firstAddress(value: string | null): string | null {
  const address = value?.split(",")[0]?.trim();
  return address || null;
}

export function getClientIp(request: Request): string {
  return (
    firstAddress(request.headers.get("x-forwarded-for")) ??
    firstAddress(request.headers.get("x-real-ip")) ??
    "anonymous"
  );
}

export function createRateLimitConfig(
  maxRequests: number,
  windowMs: number = 60 * 1000
): RateLimitConfig {
  return { maxRequests, windowMs };
}
