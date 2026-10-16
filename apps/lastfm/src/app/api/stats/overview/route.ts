import { getOverviewStats } from "@/lib/analytics/overview";
import { withErrorHandling } from "@data-projects/shared/route-handler";
import {
  checkRateLimit,
  getClientIp,
  mergeHeaders,
  RATE_LIMIT_PRESETS,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";

export const maxDuration = 60;

export const GET = withErrorHandling("stats-overview", async (request) => {
  const rateLimit = checkRateLimit(
    `stats-overview:${getClientIp(request)}`,
    RATE_LIMIT_PRESETS.search,
  );
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit);
  }

  const stats = await getOverviewStats();
  return Response.json(stats, {
    headers: mergeHeaders(withRateLimitHeaders(rateLimit), {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    }),
  });
});
