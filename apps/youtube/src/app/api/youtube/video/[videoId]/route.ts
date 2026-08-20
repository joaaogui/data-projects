import { db } from "@/db";
import { videos } from "@/db/schema";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/route-handler";
import { validateVideoId } from "@/lib/validation";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";
import { eq } from "drizzle-orm";

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const GET = withErrorHandling(
  "video-detail",
  async (request, { params }) => {
    const { videoId: rawVideoId } = await params;
    const validation = validateVideoId(rawVideoId);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    const rateLimit = checkRateLimit(
      `yt-video:${getClientIp(request)}`,
      RATE_LIMITS.channel
    );
    if (!rateLimit.success) {
      return rateLimitExceededResponse(rateLimit, undefined, corsHeaders);
    }

    const [video] = await db
      .select({
        videoId: videos.id,
        description: videos.description,
      })
      .from(videos)
      .where(eq(videos.id, validation.sanitized!))
      .limit(1);

    if (!video) {
      return Response.json(
        { error: "Video not found" },
        { status: 404, headers: corsHeaders }
      );
    }

    return Response.json(video, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimit),
        {
          "Cache-Control":
            "public, s-maxage=3600, stale-while-revalidate=86400",
        }
      ),
    });
  }
);
