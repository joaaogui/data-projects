import { getTemporalStats } from "@/lib/analytics/temporal";
import { withErrorHandling } from "@/lib/route-handler";
import {
  checkRateLimit,
  getClientIp,
  mergeHeaders,
  RATE_LIMIT_PRESETS,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";

export const maxDuration = 60;

export const GET = withErrorHandling("stats-temporal", async (request) => {
  const rateLimit = checkRateLimit(
    `stats-temporal:${getClientIp(request)}`,
    RATE_LIMIT_PRESETS.search,
  );
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit);
  }

  const stats = await getTemporalStats();
  return Response.json(stats, {
    headers: mergeHeaders(withRateLimitHeaders(rateLimit), {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    }),
  });
});
