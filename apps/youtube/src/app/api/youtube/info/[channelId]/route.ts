import { db } from "@/db";
import { channels } from "@/db/schema";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { getSafeErrorMessage, validateChannelId } from "@/lib/validation";
import { getChannelById } from "@/lib/youtube-server";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";
import { eq } from "drizzle-orm";

const TAG = "[Channel Info]";

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    console.log(`${TAG} Request received channelId=${channelId}`);

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

    const validation = validateChannelId(channelId);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders },
      );
    }

    const cached = await db.select().from(channels).where(eq(channels.id, channelId)).limit(1);

    if (cached.length > 0) {
      console.log(`${TAG} Cache hit channelId=${channelId}`);
      const ch = cached[0];
      return Response.json(
        {
          channelId: ch.id,
          channelTitle: ch.title,
          thumbnails: { default: { url: ch.thumbnailUrl ?? "" } },
        },
        {
          headers: mergeHeaders(
            corsHeaders,
            withRateLimitHeaders(rateLimitResult),
            { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" }
          ),
        }
      );
    }

    console.log(`${TAG} Cache miss channelId=${channelId} calling API`);
    const channelInfo = await getChannelById(channelId);

    await db
      .insert(channels)
      .values({
        id: channelInfo.channelId,
        title: channelInfo.channelTitle,
        thumbnailUrl: channelInfo.thumbnails.default.url,
        fetchedAt: new Date(),
      })
      .onConflictDoNothing();

    return Response.json(channelInfo, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" }
      ),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`${TAG} Error: ${errMsg}`);
    if (errStack) console.error(`${TAG} Stack: ${errStack}`);
    return Response.json(
      { error: getSafeErrorMessage(error, "Failed to fetch channel info") },
      { status: 500, headers: corsHeaders }
    );
  }
}
