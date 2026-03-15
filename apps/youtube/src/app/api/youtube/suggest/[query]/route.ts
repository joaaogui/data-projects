import { db } from "@/db";
import { channels, suggestionCache } from "@/db/schema";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { getSafeErrorMessage, validateSearchQuery } from "@/lib/validation";
import { searchChannels } from "@/lib/youtube-server";
import type { ChannelSuggestion } from "@/types/youtube";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";
import { eq, ilike } from "drizzle-orm";

const CACHE_TTL_MS = 60 * 60 * 1000;
const TAG = "[Suggest]";

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ query: string }> }
) {
  try {
    const { query } = await params;
    const decodedQuery = decodeURIComponent(query);
    console.log(`${TAG} Request received query=${decodedQuery}`);

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

    const storedChannels = await db
      .select()
      .from(channels)
      .where(ilike(channels.title, `%${cacheKey}%`))
      .limit(8);

    const storedSuggestions: ChannelSuggestion[] = storedChannels.map((c) => ({
      channelId: c.id,
      channelTitle: c.title,
      thumbnails: c.thumbnailUrl ? { default: { url: c.thumbnailUrl } } : undefined,
      isStored: true,
    }));
    const storedIds = new Set(storedSuggestions.map((s) => s.channelId));

    const cached = await db
      .select()
      .from(suggestionCache)
      .where(eq(suggestionCache.query, cacheKey))
      .limit(1);

    if (cached.length > 0) {
      const age = Date.now() - cached[0].fetchedAt.getTime();
      if (age < CACHE_TTL_MS) {
        console.log(`${TAG} Cache hit query=${cacheKey} ageMs=${age}`);
        const merged = mergeWithStored(storedSuggestions, cached[0].results, storedIds);
        return Response.json(merged, {
          headers: mergeHeaders(
            corsHeaders,
            withRateLimitHeaders(rateLimitResult),
            { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" }
          ),
        });
      }
    }

    console.log(`${TAG} Cache miss query=${cacheKey}`);
    const apiStart = Date.now();
    const apiChannels = await searchChannels(q, 8, true);
    const apiMs = Date.now() - apiStart;
    const apiSuggestions: ChannelSuggestion[] = apiChannels.map((c) => ({
      channelId: c.channelId,
      channelTitle: c.channelTitle,
      thumbnails: c.thumbnails,
      videoCount: c.videoCount,
    }));

    console.log(`${TAG} API call completed in ${apiMs}ms resultCount=${apiSuggestions.length}`);
    db.insert(suggestionCache)
      .values({ query: cacheKey, results: apiSuggestions, fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: suggestionCache.query,
        set: { results: apiSuggestions, fetchedAt: new Date() },
      })
      .catch((err) => {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`${TAG} Cache write failed: ${errMsg}`);
      });

    const merged = mergeWithStored(storedSuggestions, apiSuggestions, storedIds);
    return Response.json(merged, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" }
      ),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`${TAG} Error: ${errMsg}`);
    if (errStack) console.error(`${TAG} Stack: ${errStack}`);
    return Response.json(
      { error: getSafeErrorMessage(error, "Failed to fetch suggestions") },
      { status: 500, headers: corsHeaders }
    );
  }
}

function mergeWithStored(
  stored: ChannelSuggestion[],
  api: ChannelSuggestion[],
  storedIds: Set<string>
): ChannelSuggestion[] {
  const rest = api
    .filter((s) => !storedIds.has(s.channelId))
    .map((s) => ({ ...s, isStored: false }));
  return [...stored, ...rest].slice(0, 8);
}
