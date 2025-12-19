import { fetchChannelVideos } from "@/lib/youtube-server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateChannelId, getSafeErrorMessage } from "@/lib/validation";
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
      `yt-channel:${clientIp}`,
      RATE_LIMITS.channel
    );

    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(
        rateLimitResult,
        "Too many requests. Please try again later.",
        corsHeaders
      );
    }

    const { channelId } = await params;

    const validation = validateChannelId(channelId);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Channel API] Fetching videos for channel: ${validation.sanitized}`);
    const videos = await fetchChannelVideos(validation.sanitized!);
    console.log(`[Channel API] Found ${videos.length} videos`);

    return Response.json(videos, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" }
      ),
    });
  } catch (error) {
    console.error("Fetch videos error:", error);
    return Response.json(
      {
        error: getSafeErrorMessage(error, "Failed to fetch channel videos"),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
