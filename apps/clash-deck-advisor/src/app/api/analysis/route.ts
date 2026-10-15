import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { MissingAiConfigurationError } from "@/lib/ai-provider";
import {
  ANALYSIS_CACHE_TAG,
  generateDeckAnalysis,
  getCachedDeckAnalysis,
} from "@/lib/analyze-deck";
import {
  ClashRoyaleApiError,
  ClashRoyaleNetworkError,
  MissingConfigurationError,
} from "@/lib/clash-royale";
import type { AnalysisMode } from "@/lib/engine-context";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { playerFeedbackInputSchema } from "@/lib/schemas";
import type { PlayerFeedbackInput } from "@/lib/types";

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

async function handleAnalysisRequest(
  request: Request,
  options: {
    mode: AnalysisMode;
    wantsRefresh: boolean;
    feedback?: PlayerFeedbackInput;
  },
) {
  const { mode, wantsRefresh, feedback } = options;
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

  const hasCustomConstraints =
    Boolean(feedback?.lockedCards.length) ||
    Boolean(feedback?.excludedCards.length);

  try {
    const result =
      wantsRefresh || hasCustomConstraints
        ? await generateDeckAnalysis(mode, feedback)
        : await getCachedDeckAnalysis(mode, feedback);

    return NextResponse.json(result, {
      headers: {
        "Cache-Control":
          wantsRefresh || hasCustomConstraints
            ? "no-store"
            : "public, s-maxage=1800, stale-while-revalidate=60",
        "X-Analysis-Cache":
          wantsRefresh || hasCustomConstraints ? "refreshed" : "cached",
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

  return handleAnalysisRequest(request, { mode, wantsRefresh, feedback });
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const mode = parseMode(body.mode);
  const wantsRefresh = body.refresh === true || body.refresh === "1";
  const parsedFeedback = playerFeedbackInputSchema.safeParse(body.feedback);
  const feedback = parsedFeedback.success ? parsedFeedback.data : undefined;

  return handleAnalysisRequest(request, { mode, wantsRefresh, feedback });
}
