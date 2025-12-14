import type { OMDBSearchItem, OMDBSearchResponse } from "@/types/omdb";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateTitle, getSafeErrorMessage } from "@/lib/validation";
import { getFromCache, setInCache, getSuggestCacheKey } from "@/lib/cache";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";

const OMDB_BASE_URL = "https://www.omdbapi.com";

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

async function fetchFromOMDB(params: string): Promise<Response> {
  const apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OMDB API key not configured. Get your free key at https://www.omdbapi.com/apikey.aspx"
    );
  }
  return fetch(`${OMDB_BASE_URL}/?${params}&apikey=${apiKey}`);
}

async function suggestSeries(query: string): Promise<OMDBSearchItem[]> {
  const cacheKey = getSuggestCacheKey(query);
  const cached = getFromCache<OMDBSearchItem[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchFromOMDB(
    `s=${encodeURIComponent(query)}&type=series&page=1`
  );
  const data = (await response.json()) as OMDBSearchResponse;

  if (data.Error) {
    if (data.Error.toLowerCase().includes("not found")) {
      setInCache(cacheKey, []);
      return [];
    }
    throw new Error(data.Error);
  }

  const items = (data.Search || []).filter((item) => item.Type === "series");
  setInCache(cacheKey, items);
  return items;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ query: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `suggest:${clientIp}`,
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

    const validation = validateTitle(query);
    if (!validation.valid) {
      return Response.json(
        { error: validation.error },
        { status: 400, headers: corsHeaders }
      );
    }

    const results = await suggestSeries(validation.sanitized!);

    return Response.json(results, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" }
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
