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
    console.log(`[Saga Analyze] POST auth=failed`);
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders }
    );
  }
  console.log(`[Saga Analyze] POST auth=ok`);

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
    console.log(`[Saga Analyze] videoCount=${Array.isArray(videos) ? videos.length : 0} knownSagaNamesCount=${knownSagaNames?.length ?? 0} overlapContextLength=${overlapContext?.length ?? 0}`);

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
    const aiStart = Date.now();
    try {
      result = await analyzeBatchFromDb(videos, overlapContext, knownSagaNames);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI provider error";
      const errStack = err instanceof Error ? err.stack : undefined;
      console.error(`[Saga Analyze] AI Error: ${message}`);
      if (errStack) console.error(`[Saga Analyze] Stack: ${errStack}`);
      return Response.json(
        { error: message },
        { status: 503, headers: corsHeaders }
      );
    }
    const aiMs = Date.now() - aiStart;
    console.log(`[Saga Analyze] AI call completed in ${aiMs}ms segmentCount=${result.segments?.length ?? 0}`);

    return Response.json(result, {
      headers: mergeHeaders(corsHeaders, withRateLimitHeaders(rateLimitResult)),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`[Saga Analyze] Error: ${errMsg}`);
    if (errStack) console.error(`[Saga Analyze] Stack: ${errStack}`);
    return Response.json(
      { error: "Failed to analyze sagas" },
      { status: 500, headers: corsHeaders }
    );
  }
}
