import { describe, expect, it } from "vitest";

import { createRateLimiter, getClientIp } from "./rate-limit";

describe("createRateLimiter", () => {
  it("blocks requests beyond an IP's configured window limit", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });

    expect(limiter.check("203.0.113.10", 1_000)).toMatchObject({
      success: true,
      remaining: 1,
    });
    expect(limiter.check("203.0.113.10", 1_100)).toMatchObject({
      success: true,
      remaining: 0,
    });
    expect(limiter.check("203.0.113.10", 1_200)).toMatchObject({
      success: false,
      remaining: 0,
      retryAfter: 1,
    });
  });

  it("resets the request count at the next window boundary", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.check("203.0.113.10", 1_000).success).toBe(true);
    expect(limiter.check("203.0.113.10", 2_000).success).toBe(true);
  });

  it("keeps independent counters per client IP", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.check("203.0.113.10", 1_000).success).toBe(true);
    expect(limiter.check("198.51.100.4", 1_100).success).toBe(true);
    expect(limiter.check("203.0.113.10", 1_200).success).toBe(false);
  });
});

describe("getClientIp", () => {
  it("uses the first address forwarded by the platform", () => {
    const request = new Request("https://example.invalid/api/analysis", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 198.51.100.4",
        "x-real-ip": "192.0.2.5",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });

  it("falls back safely when no client address is available", () => {
    const request = new Request("https://example.invalid/api/analysis");

    expect(getClientIp(request)).toBe("anonymous");
  });
});
