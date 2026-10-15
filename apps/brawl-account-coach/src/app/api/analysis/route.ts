import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { MissingAiConfigurationError } from "@/lib/ai-provider";
import {
  ANALYSIS_CACHE_TAG,
  generateAccountAnalysis,
  getCachedAccountAnalysis,
} from "@/lib/analyze-account";
import {
  BrawlStarsApiError,
  BrawlStarsNetworkError,
  MissingConfigurationError,
  PLAYER_TAG,
} from "@/lib/brawl-stars";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const analysisRateLimit = createRateLimiter({
  limit: 10,
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

function upstreamStatus(error: BrawlStarsApiError): number {
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsRefresh = url.searchParams.get("refresh") === "1";
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
    const result = wantsRefresh
      ? await generateAccountAnalysis(PLAYER_TAG)
      : await getCachedAccountAnalysis();

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

    if (error instanceof BrawlStarsApiError) {
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
          status: upstreamStatus(error),
          headers:
            error.code === "UPSTREAM_RATE_LIMITED"
              ? { ...headers, "Retry-After": "300" }
              : headers,
        },
      );
    }

    if (error instanceof BrawlStarsNetworkError) {
      console.error("[brawl-account-coach] upstream network request failed", {
        errorType: error.name,
      });
      return NextResponse.json(
        {
          error: {
            code: "UPSTREAM_UNAVAILABLE",
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
