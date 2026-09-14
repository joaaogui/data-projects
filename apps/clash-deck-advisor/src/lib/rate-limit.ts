interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

export function createRateLimiter({ limit, windowMs }: RateLimiterOptions) {
  const entries = new Map<string, RateLimitEntry>();

  return {
    check(identifier: string, now = Date.now()): RateLimitResult {
      const existing = entries.get(identifier);

      if (!existing || now > existing.resetAt) {
        const resetAt = now + windowMs;
        entries.set(identifier, { count: 1, resetAt });
        return { success: true, remaining: limit - 1, resetAt };
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

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}
