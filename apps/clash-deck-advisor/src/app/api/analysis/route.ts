import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { MissingAiConfigurationError } from "@/lib/ai-provider";
import {
  ANALYSIS_CACHE_TAG,
  generateDeckAnalysis,
  getCachedDeckAnalysis,
} from "@/lib/analyze-deck";
import { MissingConfigurationError } from "@/lib/clash-royale";
import type { AnalysisMode } from "@/lib/engine-context";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const analysisRateLimit = createRateLimiter({
  limit: 12,
  windowMs: 5 * 60 * 1000,
});

/**
 * Refreshes bypass the cache and spend model calls, so they get a tighter
 * budget than ordinary page loads.
 */
const refreshRateLimit = createRateLimiter({
  limit: 4,
  windowMs: 10 * 60 * 1000,
});

function parseMode(value: string | null): AnalysisMode {
  return value === "best" ? "best" : "improve";
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

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = parseMode(url.searchParams.get("mode"));
  const wantsRefresh = url.searchParams.get("refresh") === "1";
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

  try {
    // A refresh skips the cache outright. revalidateTag only marks the entry
    // stale, which is not enough to guarantee the caller sees a new analysis
    // within this same request.
    const result = wantsRefresh
      ? await generateDeckAnalysis(mode)
      : await getCachedDeckAnalysis(mode);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": wantsRefresh
          ? "no-store"
          : "public, s-maxage=1800, stale-while-revalidate=60",
        "X-RateLimit-Remaining": String(rateLimit.remaining),
        "X-RateLimit-Reset": String(rateLimit.resetAt),
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
        { status: 503 },
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
      { status: 500 },
    );
  }
}
