import { searchChannels } from "@/lib/youtube-server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateSearchQuery, getSafeErrorMessage } from "@/lib/validation";
import {
  corsHeaders,
  createCache,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

type ChannelSuggestion = {
  channelId: string;
  channelTitle: string;
  thumbnails?: {
    default?: { url?: string };
  };
  videoCount?: number;
};

const cache = createCache<ChannelSuggestion[]>({
  ttlMs: 60 * 60 * 1000,
  maxSize: 1000,
});

function getCacheKey(query: string) {
  return `yt-suggest:${query.toLowerCase().trim()}`;
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

    const cacheKey = getCacheKey(q);
    const cached = cache.get(cacheKey);
    if (cached) {
      return Response.json(cached, {
        headers: mergeHeaders(
          corsHeaders,
          withRateLimitHeaders(rateLimitResult),
          { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" }
        ),
      });
    }

    const channels = await searchChannels(q, 8, true);
    const suggestions: ChannelSuggestion[] = channels.map((c) => ({
      channelId: c.channelId,
      channelTitle: c.channelTitle,
      thumbnails: c.thumbnails,
      videoCount: c.videoCount,
    }));

    cache.set(cacheKey, suggestions);

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
