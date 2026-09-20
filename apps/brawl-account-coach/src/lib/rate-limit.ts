interface RateLimiterOptions {
  limit: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

const MAX_TRACKED_CLIENTS = 10_000;

export function createRateLimiter({ limit, windowMs }: RateLimiterOptions) {
  if (!Number.isInteger(limit) || limit < 1 || windowMs < 1) {
    throw new Error("Rate limiter requires a positive limit and window");
  }

  const entries = new Map<string, RateLimitEntry>();

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
    check(identifier: string, now = Date.now()): RateLimitResult {
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
