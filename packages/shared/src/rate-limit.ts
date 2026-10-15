interface LegacyRateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, LegacyRateLimitEntry>();

const CLEANUP_INTERVAL = 60 * 1000;
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

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

  function makeRoom(now: number) {
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

  return {
    check(identifier: string, now = Date.now()): RateLimitDecision {
      const key = identifier.trim() || "anonymous";
      const existing = entries.get(key);

      if (!existing || now >= existing.resetAt) {
        makeRoom(now);
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
  cleanupExpiredEntries();

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });

    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime: now + config.windowMs,
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    };
  }

  entry.count++;

  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
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
