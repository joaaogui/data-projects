import { dbRowsToVideoData } from "@/lib/video-mapper";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateChannelId, getSafeErrorMessage } from "@/lib/validation";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";
import { db } from "@/db";
import { videos } from "@/db/schema";
import { eq } from "drizzle-orm";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

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

    const { channelId: rawChannelId } = await params;

    const validation = validateChannelId(rawChannelId);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    const channelId = validation.sanitized ?? rawChannelId;
    const dbRows = await db.select().from(videos).where(eq(videos.channelId, channelId));

    if (dbRows.length === 0) {
      return Response.json(
        { videos: [], source: "none", fresh: false, fetchedAt: null },
        {
          headers: mergeHeaders(
            corsHeaders,
            withRateLimitHeaders(rateLimitResult)
          ),
        }
      );
    }

    const oldestFetchMs = dbRows.reduce(
      (min, r) => Math.min(min, r.fetchedAt.getTime()),
      dbRows[0].fetchedAt.getTime()
    );
    const oldestFetch = new Date(oldestFetchMs);
    const isFresh = Date.now() - oldestFetch.getTime() < SIX_HOURS_MS;

    const videoData = dbRowsToVideoData(dbRows);

    return Response.json(
      { videos: videoData, source: "database", fresh: isFresh, fetchedAt: oldestFetch.toISOString() },
      {
        headers: mergeHeaders(
          corsHeaders,
          withRateLimitHeaders(rateLimitResult),
          { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" }
        ),
      }
    );
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
