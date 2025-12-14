export {
  checkRateLimit,
  getClientIp,
  createRateLimitConfig,
  type RateLimitConfig,
  type RateLimitResult,
} from "@data-projects/shared";

export const RATE_LIMITS = {
  search: { maxRequests: 30, windowMs: 60 * 1000 },
  suggest: { maxRequests: 60, windowMs: 60 * 1000 },
} as const;
