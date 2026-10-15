import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { MissingAiConfigurationError } from "@/lib/ai-provider";
import {
  MAX_ANALYSIS_REQUEST_BYTES,
  parseAnalysisRequestBody,
  tooLarge,
  type AnalysisRequestRejection,
} from "@/lib/analysis-request";
import {
  ANALYSIS_CACHE_TAG,
  generateDeckAnalysis,
  getCachedDeckAnalysis,
  hasPersonalInput,
  type AnalysisInput,
} from "@/lib/analyze-deck";
import {
  ClashRoyaleApiError,
  ClashRoyaleNetworkError,
  MissingConfigurationError,
} from "@/lib/clash-royale";
import type { AnalysisMode } from "@/lib/engine-context";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { playerFeedbackInputSchema } from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

const analysisRateLimit = createRateLimiter({
  limit: 20,
  windowMs: 5 * 60 * 1000,
});

/**
 * Refreshes bypass the cache and spend model calls, so they get a tighter
 * budget than ordinary page loads.
 */
const refreshRateLimit = createRateLimiter({
  limit: 8,
  windowMs: 10 * 60 * 1000,
});

function parseMode(value: unknown): AnalysisMode {
  return value === "best" ? "best" : "improve";
}

function parseCommaList(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function rateLimited(retryAfter: number, resetAt: number, message: string) {
  return NextResponse.json(
    { error: { code: "RATE_LIMITED", message } },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(resetAt),
      },
    },
  );
}

function upstreamStatus(error: ClashRoyaleApiError): number {
  if (error.code === "PLAYER_NOT_FOUND") {
    return 404;
  }
  if (error.code === "UPSTREAM_RATE_LIMITED") {
    return 429;
  }
  if (
    error.code === "AUTHORIZATION_FAILED" ||
    error.code === "UPSTREAM_MAINTENANCE" ||
    error.code === "UPSTREAM_UNAVAILABLE"
  ) {
    return 503;
  }
  return 502;
}

function invalidRequest(result: AnalysisRequestRejection) {
  console.warn("[clash-deck-advisor] rejected analysis request", {
    code: result.code,
    issues: result.issues,
  });
  return NextResponse.json(
    { error: { code: result.code, message: result.message } },
    { status: result.status, headers: { "Cache-Control": "no-store" } },
  );
}

async function handleAnalysisRequest(
  request: Request,
  options: {
    mode: AnalysisMode;
    wantsRefresh: boolean;
    input: AnalysisInput;
  },
) {
  const { mode, wantsRefresh, input } = options;
  const clientIp = getClientIp(request);

  const rateLimit = analysisRateLimit.check(clientIp);
  if (!rateLimit.success) {
    return rateLimited(
      rateLimit.retryAfter ?? 60,
      rateLimit.resetAt,
      "Too many analysis requests. Try again in a few minutes.",
    );
  }

  if (wantsRefresh) {
    const refreshLimit = refreshRateLimit.check(clientIp);
    if (!refreshLimit.success) {
      return rateLimited(
        refreshLimit.retryAfter ?? 60,
        refreshLimit.resetAt,
        "Too many refreshes. A fresh analysis is available every few minutes.",
      );
    }
    revalidateTag(ANALYSIS_CACHE_TAG, { expire: 0 });
  }

  const rateHeaders = {
    "X-RateLimit-Remaining": String(rateLimit.remaining),
    "X-RateLimit-Reset": String(rateLimit.resetAt),
  };

  const bypassCache = wantsRefresh || hasPersonalInput(input);

  try {
    const result = bypassCache
      ? await generateDeckAnalysis(mode, input)
      : await getCachedDeckAnalysis(mode, input);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": bypassCache
          ? "no-store"
          : "public, s-maxage=1800, stale-while-revalidate=60",
        "X-Analysis-Cache": bypassCache ? "refreshed" : "cached",
        ...rateHeaders,
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
              "The advisor is not configured yet. Add the required server environment variables.",
          },
        },
        { status: 503, headers: rateHeaders },
      );
    }

    if (error instanceof ClashRoyaleApiError) {
      console.error("[clash-deck-advisor] upstream API request failed", {
        mode,
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
          status: upstreamStatus(error),
          headers:
            error.code === "UPSTREAM_RATE_LIMITED"
              ? { ...rateHeaders, "Retry-After": "300" }
              : rateHeaders,
        },
      );
    }

    if (error instanceof ClashRoyaleNetworkError) {
      console.error("[clash-deck-advisor] upstream network request failed", {
        mode,
        errorType: error.name,
      });
      return NextResponse.json(
        {
          error: {
            code: "UPSTREAM_UNAVAILABLE",
            message: error.publicMessage,
          },
        },
        { status: 503, headers: rateHeaders },
      );
    }

    console.error("[clash-deck-advisor] analysis request failed", {
      mode,
      errorType: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "unknown",
    });

    return NextResponse.json(
      {
        error: {
          code: "ANALYSIS_FAILED",
          message:
            "The live deck analysis could not be completed. Try again shortly.",
        },
      },
      { status: 500, headers: rateHeaders },
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = parseMode(url.searchParams.get("mode"));
  const wantsRefresh = url.searchParams.get("refresh") === "1";
  const lockedCards = parseCommaList(url.searchParams.get("locked"));
  const excludedCards = parseCommaList(url.searchParams.get("excluded"));

  const feedback =
    lockedCards.length > 0 || excludedCards.length > 0
      ? playerFeedbackInputSchema.parse({
          lockedCards,
          excludedCards,
          suggestionHistory: [],
        })
      : undefined;

  return handleAnalysisRequest(request, {
    mode,
    wantsRefresh,
    input: { feedback },
  });
}

/** The browser posts its saved suggestions, card rules, and battle history here. */
export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_ANALYSIS_REQUEST_BYTES) {
    return invalidRequest(tooLarge());
  }

  const parsed = parseAnalysisRequestBody(await request.text());
  if (!parsed.ok) {
    return invalidRequest(parsed);
  }

  const { mode, refresh, feedback, battleHistory } = parsed.value;
  return handleAnalysisRequest(request, {
    mode,
    wantsRefresh: refresh,
    input: { feedback, battleHistory },
  });
}
