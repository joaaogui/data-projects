import { db } from "@/db";
import { videos } from "@/db/schema";
import { CHANNEL_FRESHNESS_MS } from "@/lib/constants";
import { createTaggedLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/route-handler";
import { validateChannelId } from "@/lib/validation";
import { dbRowsToVideoData } from "@/lib/video-mapper";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";
import { eq } from "drizzle-orm";

const log = createTaggedLogger("channel-videos");
const catalogColumns = {
  id: videos.id,
  title: videos.title,
  publishedAt: videos.publishedAt,
  duration: videos.duration,
  views: videos.views,
  likes: videos.likes,
  comments: videos.comments,
  favorites: videos.favorites,
  url: videos.url,
  thumbnail: videos.thumbnail,
  topics: videos.topics,
  fetchedAt: videos.fetchedAt,
};

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

  const dbRows = compact
    ? await db
        .select(catalogColumns)
        .from(videos)
        .where(eq(videos.channelId, channelId))
    : await db
        .select({ ...catalogColumns, description: videos.description })
        .from(videos)
        .where(eq(videos.channelId, channelId));
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

  const responseVideos = dbRowsToVideoData(dbRows, !compact);

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
