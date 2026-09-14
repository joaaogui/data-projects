import { NextResponse } from "next/server";
import {
  checkRateLimit,
  createRateLimitConfig,
  getClientIp,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";

import { MissingAiConfigurationError } from "@/lib/ai-provider";
import { getCachedDeckAnalysis } from "@/lib/analyze-deck";
import { MissingConfigurationError } from "@/lib/clash-royale";

export const runtime = "nodejs";
export const maxDuration = 60;

const analysisRateLimit = createRateLimitConfig(12, 5 * 60 * 1000);

export async function GET(request: Request) {
  const rateLimit = checkRateLimit(
    `clash-deck-advisor:${getClientIp(request)}`,
    analysisRateLimit,
  );

  if (!rateLimit.success) {
    return rateLimitExceededResponse(
      rateLimit,
      "Too many analysis requests. Try again in a few minutes.",
      { "Cache-Control": "no-store" },
    );
  }

  try {
    const result = await getCachedDeckAnalysis();

    return NextResponse.json(result, {
      headers: withRateLimitHeaders(rateLimit, {
        "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=60",
      }),
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
