import { searchChannel } from "@/lib/youtube-server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { validateSearchQuery } from "@/lib/validation";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";

const log = createTaggedLogger("search");

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const GET = withErrorHandling("search", async (request, { params }) => {
  const { query } = await params;
  const decodedQuery = decodeURIComponent(query);
  log.info({ query: decodedQuery }, "Request received");

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(
    `yt-search:${clientIp}`,
    RATE_LIMITS.search
  );

  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(
      rateLimitResult,
      "Too many requests. Please try again later.",
      corsHeaders
    );
  }

  const validation = validateSearchQuery(decodedQuery);
  if (!validation.valid) {
    return Response.json(
      { error: validation.error },
      { status: 400, headers: corsHeaders }
    );
  }

  const apiStart = Date.now();
  const channelInfo = await searchChannel(validation.sanitized!);
  const apiMs = Date.now() - apiStart;
  log.info({ apiMs, channelId: channelInfo?.channelId ?? null }, "API call completed");

  return Response.json(channelInfo, {
    headers: mergeHeaders(
      corsHeaders,
      withRateLimitHeaders(rateLimitResult),
      { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" }
    ),
  });
});
