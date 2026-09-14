import { describe, expect, it } from "vitest";

import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("blocks requests beyond the configured window limit", () => {
    const limiter = createRateLimiter({ limit: 2, windowMs: 1_000 });

    expect(limiter.check("client", 1_000).success).toBe(true);
    expect(limiter.check("client", 1_100).success).toBe(true);
    expect(limiter.check("client", 1_200)).toMatchObject({
      success: false,
      remaining: 0,
      retryAfter: 1,
    });
  });

  it("resets the request count after the window expires", () => {
    const limiter = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(limiter.check("client", 1_000).success).toBe(true);
    expect(limiter.check("client", 2_001).success).toBe(true);
  });
});
