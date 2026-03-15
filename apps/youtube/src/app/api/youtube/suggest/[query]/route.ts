import { db } from "@/db";
import { channels, suggestionCache } from "@/db/schema";
import { createTaggedLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/route-handler";
import { validateSearchQuery } from "@/lib/validation";
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
const log = createTaggedLogger("suggest");

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const GET = withErrorHandling("suggest", async (request, { params }) => {
  const { query } = await params;
  const decodedQuery = decodeURIComponent(query);
  log.info({ query: decodedQuery }, "Request received");

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
      log.info({ query: cacheKey, ageMs: age }, "Cache hit");
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

  log.info({ query: cacheKey }, "Cache miss");
  const apiStart = Date.now();
  const apiChannels = await searchChannels(q, 8, true);
  const apiMs = Date.now() - apiStart;
  const apiSuggestions: ChannelSuggestion[] = apiChannels.map((c) => ({
    channelId: c.channelId,
    channelTitle: c.channelTitle,
    thumbnails: c.thumbnails,
    videoCount: c.videoCount,
  }));

  log.info({ apiMs, resultCount: apiSuggestions.length }, "API call completed");
  db.insert(suggestionCache)
    .values({ query: cacheKey, results: apiSuggestions, fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: suggestionCache.query,
      set: { results: apiSuggestions, fetchedAt: new Date() },
    })
    .catch((err) => {
      log.warn({ err }, "Cache write failed");
    });

  const merged = mergeWithStored(storedSuggestions, apiSuggestions, storedIds);
  return Response.json(merged, {
    headers: mergeHeaders(
      corsHeaders,
      withRateLimitHeaders(rateLimitResult),
      { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" }
    ),
  });
});

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
