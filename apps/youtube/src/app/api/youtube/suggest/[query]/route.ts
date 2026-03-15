import { searchChannels } from "@/lib/youtube-server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateSearchQuery, getSafeErrorMessage } from "@/lib/validation";
import { db } from "@/db";
import { suggestionCache } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ChannelSuggestion } from "@/types/youtube";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";

const CACHE_TTL_MS = 60 * 60 * 1000;

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ query: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `yt-suggest:${clientIp}`,
      RATE_LIMITS.suggest
    );

    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(
        rateLimitResult,
        "Too many requests. Please try again later.",
        corsHeaders
      );
    }

    const { query } = await params;
    const decodedQuery = decodeURIComponent(query);

    const validation = validateSearchQuery(decodedQuery);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    const q = validation.sanitized!;
    if (q.length < 2) {
      return Response.json([], { headers: corsHeaders });
    }

    const cacheKey = q.toLowerCase().trim();
    const cached = await db
      .select()
      .from(suggestionCache)
      .where(eq(suggestionCache.query, cacheKey))
      .limit(1);

    if (cached.length > 0) {
      const age = Date.now() - cached[0].fetchedAt.getTime();
      if (age < CACHE_TTL_MS) {
        return Response.json(cached[0].results, {
          headers: mergeHeaders(
            corsHeaders,
            withRateLimitHeaders(rateLimitResult),
            { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" }
          ),
        });
      }
    }

    const channels = await searchChannels(q, 8, true);
    const suggestions: ChannelSuggestion[] = channels.map((c) => ({
      channelId: c.channelId,
      channelTitle: c.channelTitle,
      thumbnails: c.thumbnails,
      videoCount: c.videoCount,
    }));

    db.insert(suggestionCache)
      .values({ query: cacheKey, results: suggestions, fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: suggestionCache.query,
        set: { results: suggestions, fetchedAt: new Date() },
      })
      .catch((err) => console.warn("[Suggest] Cache write failed:", err));

    return Response.json(suggestions, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" }
      ),
    });
  } catch (error) {
    console.error("Suggest error:", error);
    return Response.json(
      { error: getSafeErrorMessage(error, "Failed to fetch suggestions") },
      { status: 500, headers: corsHeaders }
    );
  }
}
