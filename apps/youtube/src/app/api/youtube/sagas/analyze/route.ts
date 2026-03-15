import { auth } from "@/lib/auth";
import { createTaggedLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/route-handler";
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

const log = createTaggedLogger("saga-analyze");

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

export const POST = withErrorHandling("saga-analyze:POST", async (request) => {
  const session = await auth();
  if (!session) {
    log.warn("auth failed");
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders }
    );
  }

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
  log.info({
    videoCount: Array.isArray(videos) ? videos.length : 0,
    knownSagaNamesCount: knownSagaNames?.length ?? 0,
    overlapContextLength: overlapContext?.length ?? 0,
  }, "POST");

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
    log.error({ err }, "AI call failed");
    return Response.json(
      { error: message },
      { status: 503, headers: corsHeaders }
    );
  }
  const aiMs = Date.now() - aiStart;
  log.info({ aiMs, segmentCount: result.segments?.length ?? 0 }, "AI call completed");

  return Response.json(result, {
    headers: mergeHeaders(corsHeaders, withRateLimitHeaders(rateLimitResult)),
  });
});
