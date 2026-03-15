import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import {
  type AnalyzeResponse,
  type VideoInput,
  analyzeBatchFromDb,
  MAX_VIDEOS_PER_BATCH,
} from "@/lib/saga-ai";
import {
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  corsHeaders as sharedCorsHeaders,
  withRateLimitHeaders,
} from "@data-projects/shared";

interface AnalyzeRequest {
  videos: VideoInput[];
  overlapContext?: string;
  knownSagaNames?: string[];
}

const corsHeaders = mergeHeaders(sharedCorsHeaders, {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders }
    );
  }

  try {
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `saga-analyze:${clientIp}`,
      RATE_LIMITS.search
    );

    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(
        rateLimitResult,
        "Too many requests. Please try again later.",
        corsHeaders
      );
    }

    const body = (await request.json()) as AnalyzeRequest;
    const { videos, overlapContext, knownSagaNames } = body;

    if (!Array.isArray(videos) || videos.length === 0) {
      return Response.json(
        { error: "videos array is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    if (videos.length > MAX_VIDEOS_PER_BATCH) {
      return Response.json(
        { error: `Maximum ${MAX_VIDEOS_PER_BATCH} videos per batch` },
        { status: 400, headers: corsHeaders }
      );
    }

    let result: AnalyzeResponse;
    try {
      result = await analyzeBatchFromDb(videos, overlapContext, knownSagaNames);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI provider error";
      console.error("[Saga Analyze] AI error:", message);
      return Response.json(
        { error: message },
        { status: 503, headers: corsHeaders }
      );
    }

    return Response.json(result, {
      headers: mergeHeaders(corsHeaders, withRateLimitHeaders(rateLimitResult)),
    });
  } catch (error) {
    console.error("Saga analyze error:", error);
    return Response.json(
      { error: "Failed to analyze sagas" },
      { status: 500, headers: corsHeaders }
    );
  }
}
