export {
  checkRateLimit, createRateLimitConfig, getClientIp, type RateLimitConfig,
  type RateLimitResult
} from "@data-projects/shared";

export const RATE_LIMITS = {
  search: { maxRequests: 30, windowMs: 60 * 1000 },
  suggest: { maxRequests: 60, windowMs: 60 * 1000 },
  channel: { maxRequests: 20, windowMs: 60 * 1000 },
  aiQuery: { maxRequests: 10, windowMs: 60 * 1000 },
  admin: { maxRequests: 30, windowMs: 60 * 1000 },
} as const;
