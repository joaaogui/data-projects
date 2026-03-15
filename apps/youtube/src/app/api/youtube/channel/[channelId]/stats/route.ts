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
import { eq, sql, count, sum, avg, min, max } from "drizzle-orm";

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

    const [stats] = await db
      .select({
        videoCount: count(),
        totalViews: sum(videos.views),
        avgScore: avg(videos.score),
        avgEngagementRate: sql<number>`avg((${videos.rates}->>'engagementRate')::real)`,
        firstPublishedAt: min(videos.publishedAt),
        lastPublishedAt: max(videos.publishedAt),
      })
      .from(videos)
      .where(eq(videos.channelId, channelId));

    if (stats.videoCount === 0) {
      return Response.json(
        { stats: null },
        {
          headers: mergeHeaders(
            corsHeaders,
            withRateLimitHeaders(rateLimitResult)
          ),
        }
      );
    }

    return Response.json(
      {
        stats: {
          videoCount: stats.videoCount,
          totalViews: Number(stats.totalViews),
          avgScore: stats.avgScore === null ? null : Number(stats.avgScore),
          avgEngagementRate:
            stats.avgEngagementRate === null
              ? null
              : Number(stats.avgEngagementRate),
          dateRange: {
            first: stats.firstPublishedAt?.toISOString() ?? null,
            last: stats.lastPublishedAt?.toISOString() ?? null,
          },
        },
      },
      {
        headers: mergeHeaders(
          corsHeaders,
          withRateLimitHeaders(rateLimitResult),
          {
            "Cache-Control":
              "public, s-maxage=300, stale-while-revalidate=3600",
          }
        ),
      }
    );
  } catch (error) {
    console.error("Fetch channel stats error:", error);
    return Response.json(
      {
        error: getSafeErrorMessage(error, "Failed to fetch channel stats"),
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
