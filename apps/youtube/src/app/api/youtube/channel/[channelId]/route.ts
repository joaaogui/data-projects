import { dbRowsToVideoData } from "@/lib/video-mapper";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { CHANNEL_FRESHNESS_MS } from "@/lib/constants";
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
const TAG = "[Channel Videos]";

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId: rawChannelId } = await params;
    console.log(`${TAG} Request received channelId=${rawChannelId}`);

    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `yt-channel:${clientIp}`,
      RATE_LIMITS.channel
    );

    if (!rateLimitResult.success) {
      console.warn(`${TAG} Rate limit hit clientIp=${clientIp}`);
      return rateLimitExceededResponse(
        rateLimitResult,
        "Too many requests. Please try again later.",
        corsHeaders
      );
    }

    const validation = validateChannelId(rawChannelId);
    if (!validation.valid) {
      console.warn(`${TAG} Validation failure channelId=${rawChannelId} error=${validation.error}`);
      return Response.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    const channelId = validation.sanitized ?? rawChannelId;
    const { searchParams } = new URL(request.url);
    const compact = searchParams.get("fields") === "compact";

    const dbRows = await db.select().from(videos).where(eq(videos.channelId, channelId));
    console.log(`${TAG} DB query result count=${dbRows.length}`);

    if (dbRows.length === 0) {
      console.log(`${TAG} Response source=none fresh=false videoCount=0`);
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

    console.log(`${TAG} Response source=database fresh=${isFresh} videoCount=${responseVideos.length}`);
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
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`${TAG} Error: ${errMsg}`);
    if (errStack) console.error(`${TAG} Stack: ${errStack}`);
    return Response.json(
      {
        error: getSafeErrorMessage(error, "Failed to fetch channel videos"),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
