import { db } from "@/db";
import { channels } from "@/db/schema";
import { createTaggedLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/route-handler";
import { validateChannelId } from "@/lib/validation";
import { getChannelById } from "@/lib/youtube-server";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";
import { eq } from "drizzle-orm";

const log = createTaggedLogger("channel-info");

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const GET = withErrorHandling("channel-info", async (request, { params }) => {
  const { channelId } = await params;
  log.info({ channelId }, "Request received");

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
    log.info({ channelId }, "Cache hit");
    const ch = cached[0];
    return Response.json(
      {
        channelId: ch.id,
        channelTitle: ch.title,
        thumbnails: { default: { url: ch.thumbnailUrl ?? "" } },
        subscriberCount: ch.subscriberCount ?? undefined,
        totalViewCount: ch.totalViewCount ?? undefined,
        videoCount: ch.videoCount ?? undefined,
        customUrl: ch.customUrl ?? undefined,
        description: ch.description ?? undefined,
        country: ch.country ?? undefined,
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

  log.info({ channelId }, "Cache miss, calling API");
  const channelInfo = await getChannelById(channelId);

  await db
    .insert(channels)
    .values({
      id: channelInfo.channelId,
      title: channelInfo.channelTitle,
      thumbnailUrl: channelInfo.thumbnails.default.url,
      subscriberCount: channelInfo.subscriberCount ?? null,
      totalViewCount: channelInfo.totalViewCount ?? null,
      videoCount: channelInfo.videoCount ?? null,
      customUrl: channelInfo.customUrl ?? null,
      description: channelInfo.description ?? null,
      country: channelInfo.country ?? null,
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
});
