import { getChannelById } from "@/lib/youtube-server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { getSafeErrorMessage } from "@/lib/validation";
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
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `yt-info:${clientIp}`,
      RATE_LIMITS.search
    );

    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(
        rateLimitResult,
        "Too many requests. Please try again later.",
        corsHeaders
      );
    }

    const { channelId } = await params;

    if (!channelId || channelId.length < 10) {
      return Response.json(
        { error: "Invalid channel ID" },
        { status: 400, headers: corsHeaders }
      );
    }

    const channelInfo = await getChannelById(channelId);

    return Response.json(channelInfo, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" }
      ),
    });
  } catch (error) {
    console.error("Channel info error:", error);
    return Response.json(
      { error: getSafeErrorMessage(error, "Failed to fetch channel info") },
      { status: 500, headers: corsHeaders }
    );
  }
}



