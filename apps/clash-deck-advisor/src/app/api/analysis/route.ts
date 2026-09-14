import { NextResponse } from "next/server";

import { MissingAiConfigurationError } from "@/lib/ai-provider";
import { getCachedDeckAnalysis } from "@/lib/analyze-deck";
import { MissingConfigurationError } from "@/lib/clash-royale";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const analysisRateLimit = createRateLimiter({
  limit: 12,
  windowMs: 5 * 60 * 1000,
});

export async function GET(request: Request) {
  const rateLimit = analysisRateLimit.check(getClientIp(request));

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
          "Cache-Control": "no-store",
          "Retry-After": String(rateLimit.retryAfter ?? 60),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(rateLimit.resetAt),
        },
      },
    );
  }

  try {
    const result = await getCachedDeckAnalysis();

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=60",
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
      errorType: error instanceof Error ? error.name : "UnknownError",
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
