import { getEvolutionStats } from "@/lib/analytics/evolution";
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

export const GET = withErrorHandling("stats-evolution", async (request) => {
  const rateLimit = checkRateLimit(
    `stats-evolution:${getClientIp(request)}`,
    RATE_LIMIT_PRESETS.search,
  );
  if (!rateLimit.success) {
    return rateLimitExceededResponse(rateLimit);
  }

  const stats = await getEvolutionStats();
  return Response.json(stats, {
    headers: mergeHeaders(withRateLimitHeaders(rateLimit), {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
    }),
  });
});
