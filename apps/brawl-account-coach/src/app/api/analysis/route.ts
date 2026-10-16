import { createRateLimiter, getClientIp } from "@data-projects/shared";
import { MissingAiConfigurationError } from "@data-projects/shared/ai-provider";
import {
  MissingConfigurationError,
  SupercellApiError,
  SupercellNetworkError,
  supercellUpstreamStatus,
} from "@data-projects/shared/supercell";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import {
  ANALYSIS_CACHE_TAG,
  getAccountAnalysisWithPreferences,
} from "@/lib/analyze-account";
import { playerPreferencesSchema, type PlayerPreferences } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const analysisRateLimit = createRateLimiter({
  limit: 15,
  windowMs: 5 * 60 * 1_000,
});

const refreshRateLimiter = createRateLimiter({
  limit: 4,
  windowMs: 10 * 60_000,
});

function rateLimitHeaders(remaining: number, resetAt: number) {
  return {
    "Cache-Control": "private, no-store",
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1_000)),
  };
}

function parseListParam(searchParams: URLSearchParams, keys: string[]): string[] {
  const values: string[] = [];
  for (const key of keys) {
    for (const raw of searchParams.getAll(key)) {
      for (const item of raw.split(",")) {
        const trimmed = item.trim();
        if (trimmed.length > 0) {
          values.push(trimmed);
        }
      }
    }
  }
  return values;
}

function parseQueryPreferences(searchParams: URLSearchParams): PlayerPreferences {
  const parsed = playerPreferencesSchema.safeParse({
    pinnedBrawlers: parseListParam(searchParams, ["pinnedBrawlers", "pinned"]),
    excludedBrawlers: parseListParam(searchParams, [
      "excludedBrawlers",
      "excluded",
    ]),
  });
  return parsed.success
    ? parsed.data
    : { pinnedBrawlers: [], excludedBrawlers: [] };
}

async function handleAnalysisRequest(
  request: Request,
  options: { refresh: boolean; preferences: PlayerPreferences },
) {
  const { refresh: wantsRefresh, preferences } = options;
  const clientIp = getClientIp(request);

  const rateLimit = analysisRateLimit.check(clientIp);
  const headers = rateLimitHeaders(rateLimit.remaining, rateLimit.resetAt);

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many analysis requests. Try again in a few minutes.",
        },
      },
      {
        status: 429,
        headers: {
          ...headers,
          "Retry-After": String(rateLimit.retryAfter ?? 60),
        },
      },
    );
  }

  if (wantsRefresh) {
    const refreshLimit = refreshRateLimiter.check(clientIp);
    if (!refreshLimit.success) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message:
              "Too many refreshes. A fresh dossier is available every few minutes.",
          },
        },
        {
          status: 429,
          headers: {
            ...rateLimitHeaders(refreshLimit.remaining, refreshLimit.resetAt),
            "Retry-After": String(refreshLimit.retryAfter ?? 60),
          },
        },
      );
    }
    revalidateTag(ANALYSIS_CACHE_TAG, { expire: 0 });
  }

  try {
    const result = await getAccountAnalysisWithPreferences({
      refresh: wantsRefresh,
      preferences,
    });

    return NextResponse.json(result, {
      headers: {
        ...headers,
        "X-Analysis-Cache": wantsRefresh ? "refreshed" : "cached",
        "X-Analysis-Cache-Seconds": "1800",
      },
    });
  } catch (error) {
    if (
      error instanceof MissingConfigurationError ||
      error instanceof MissingAiConfigurationError
    ) {
      return NextResponse.json(
        {
          error: {
            code: "CONFIGURATION_MISSING",
            message:
              "The coach is not configured yet. Add the required server environment variables.",
          },
        },
        { status: 503, headers },
      );
    }

    if (error instanceof SupercellApiError) {
      console.error("[brawl-account-coach] upstream API request failed", {
        errorType: error.name,
        status: error.status,
        code: error.code,
      });
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.publicMessage,
          },
        },
        {
          status: supercellUpstreamStatus(error),
          headers:
            error.code === "UPSTREAM_RATE_LIMITED"
              ? { ...headers, "Retry-After": "300" }
              : headers,
        },
      );
    }

    if (error instanceof SupercellNetworkError) {
      console.error("[brawl-account-coach] upstream network request failed", {
        errorType: error.name,
      });
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.publicMessage,
          },
        },
        { status: 503, headers },
      );
    }

    console.error("[brawl-account-coach] analysis request failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return NextResponse.json(
      {
        error: {
          code: "ANALYSIS_FAILED",
          message:
            "The account analysis could not be completed. Try again shortly.",
        },
      },
      { status: 502, headers },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsRefresh = url.searchParams.get("refresh") === "1";
  const preferences = parseQueryPreferences(url.searchParams);
  return handleAnalysisRequest(request, {
    refresh: wantsRefresh,
    preferences,
  });
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  let body: {
    refresh?: unknown;
    pinnedBrawlers?: unknown;
    excludedBrawlers?: unknown;
  } = {};
  try {
    const parsedBody = (await request.json()) as unknown;
    if (parsedBody && typeof parsedBody === "object") {
      body = parsedBody as typeof body;
    }
  } catch {
    // Fallback to empty body if invalid JSON.
  }

  const wantsRefresh =
    body.refresh === true ||
    body.refresh === "1" ||
    url.searchParams.get("refresh") === "1";
  const parsedPrefs = playerPreferencesSchema.safeParse({
    pinnedBrawlers: body.pinnedBrawlers ?? [],
    excludedBrawlers: body.excludedBrawlers ?? [],
  });
  const preferences = parsedPrefs.success
    ? parsedPrefs.data
    : parseQueryPreferences(url.searchParams);

  return handleAnalysisRequest(request, {
    refresh: wantsRefresh,
    preferences,
  });
}
