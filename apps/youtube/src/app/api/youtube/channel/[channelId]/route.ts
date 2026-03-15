import { dbRowsToVideoData } from "@/lib/video-mapper";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { CHANNEL_FRESHNESS_MS } from "@/lib/constants";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { validateChannelId } from "@/lib/validation";
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

const log = createTaggedLogger("channel-videos");

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const GET = withErrorHandling("channel-videos", async (request, { params }) => {
  const { channelId: rawChannelId } = await params;
  log.info({ channelId: rawChannelId }, "Request received");

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(
    `yt-channel:${clientIp}`,
    RATE_LIMITS.channel
  );

  if (!rateLimitResult.success) {
    log.warn({ clientIp }, "Rate limit hit");
    return rateLimitExceededResponse(
      rateLimitResult,
      "Too many requests. Please try again later.",
      corsHeaders
    );
  }

  const validation = validateChannelId(rawChannelId);
  if (!validation.valid) {
    log.warn({ channelId: rawChannelId, error: validation.error }, "Validation failure");
    return Response.json(
      { error: validation.error },
      { status: 400, headers: corsHeaders }
    );
  }

  const channelId = validation.sanitized ?? rawChannelId;
  const { searchParams } = new URL(request.url);
  const compact = searchParams.get("fields") === "compact";

  const dbRows = await db.select().from(videos).where(eq(videos.channelId, channelId));
  log.info({ count: dbRows.length }, "DB query result");

  if (dbRows.length === 0) {
    log.info({ source: "none", fresh: false, videoCount: 0 }, "Response");
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
  const isFresh = Date.now() - oldestFetch.getTime() < CHANNEL_FRESHNESS_MS;

  const videoData = dbRowsToVideoData(dbRows);
  const responseVideos = compact
    ? videoData.map(({ description, ...rest }) => rest)
    : videoData;

  log.info({ source: "database", fresh: isFresh, videoCount: responseVideos.length }, "Response");
  return Response.json(
    { videos: responseVideos, source: "database", fresh: isFresh, fetchedAt: oldestFetch.toISOString() },
    {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" }
      ),
    }
  );
});
