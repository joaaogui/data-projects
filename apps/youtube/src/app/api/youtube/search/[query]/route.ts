import { searchChannel } from "@/lib/youtube-server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateSearchQuery, getSafeErrorMessage } from "@/lib/validation";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ query: string }> }
) {
  try {
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

    const { query } = await params;
    const decodedQuery = decodeURIComponent(query);

    const validation = validateSearchQuery(decodedQuery);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    const channelInfo = await searchChannel(validation.sanitized!);

    return Response.json(channelInfo, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" }
      ),
    });
  } catch (error) {
    console.error("Search error:", error);
    return Response.json(
      { error: getSafeErrorMessage(error, "Failed to search channel") },
      { status: 500, headers: corsHeaders }
    );
  }
}
