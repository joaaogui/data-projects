import { db } from "@/db";
import { transcripts, videos } from "@/db/schema";
import { getModel } from "@/lib/ai-providers";
import { auth } from "@/lib/auth";
import { createTaggedLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/route-handler";
import type { SagaSuggestion } from "@/types/youtube";
import {
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  corsHeaders as sharedCorsHeaders,
  withRateLimitHeaders,
} from "@data-projects/shared";
import { generateText } from "ai";
import { inArray } from "drizzle-orm";

const log = createTaggedLogger("saga-suggest");

const corsHeaders = mergeHeaders(sharedCorsHeaders, {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const SUGGEST_PROMPT = `You are given a list of uncategorized YouTube videos and a list of existing sagas (story arcs).
For each uncategorized video, determine if it clearly belongs to one of the existing sagas based on its title and transcript.

Rules:
1. Only suggest a match if the video is CLEARLY about the same specific story/event as the saga.
2. Shared characters alone are NOT enough — the video must be about the same PLOT or CONFLICT.
3. If unsure, mark confidence as "low". If clearly related, use "high". Use "medium" for likely but not certain matches.
4. If the video doesn't belong to any saga, do NOT include it in the output.
5. Each video can only be assigned to ONE saga.

Output ONLY valid JSON (no markdown fences):
{
  "suggestions": [
    { "videoId": "abc123", "sagaName": "Exact Saga Name", "confidence": "high" }
  ]
}`;

interface SuggestRequest {
  videoIds: string[];
  sagas: Array<{ id: string; name: string }>;
}

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const POST = withErrorHandling("saga-suggest:POST", async (request) => {
  const session = await auth();
  if (!session) {
    log.warn("auth failed");
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders }
    );
  }
  log.info({ user: session.user?.email ?? "unknown" }, "authenticated");

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(
    `saga-suggest:${clientIp}`,
    RATE_LIMITS.search
  );

  if (!rateLimitResult.success) {
    log.warn({ clientIp }, "rate limited");
    return rateLimitExceededResponse(
      rateLimitResult,
      "Too many requests. Please try again later.",
      corsHeaders
    );
  }

  const body = (await request.json()) as SuggestRequest;
  const { videoIds, sagas: existingSagas } = body;
  log.info({ videoIdCount: videoIds?.length ?? 0, sagaCount: existingSagas?.length ?? 0 }, "input");

  if (!Array.isArray(videoIds) || videoIds.length === 0 || !Array.isArray(existingSagas)) {
    return Response.json(
      { error: "videoIds and sagas arrays are required" },
      { status: 400, headers: corsHeaders }
    );
  }

  const videoRows = await db
    .select({ id: videos.id, title: videos.title })
    .from(videos)
    .where(inArray(videos.id, videoIds));
  log.debug({ found: videoRows.length, requested: videoIds.length }, "queried videos");

  const transcriptRows = await db
    .select({ videoId: transcripts.videoId, excerpt: transcripts.excerpt, fullText: transcripts.fullText })
    .from(transcripts)
    .where(inArray(transcripts.videoId, videoIds));
  log.debug({ transcriptCount: transcriptRows.length }, "queried transcripts");

  const transcriptMap = new Map<string, string>();
  for (const row of transcriptRows) {
    const text = row.fullText ?? row.excerpt;
    if (text) transcriptMap.set(row.videoId, text.slice(0, 500));
  }

  const sagaList = existingSagas.map((s) => `- "${s.name}" (id: ${s.id})`).join("\n");

  const BATCH_SIZE = 10;
  const allSuggestions: SagaSuggestion[] = [];
  const videoIdSet = new Set(videoIds);
  const assignedVideoIds = new Set<string>();
  const totalBatches = Math.ceil(videoRows.length / BATCH_SIZE);

  const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

  log.info({ videoCount: videoRows.length, totalBatches }, "processing batches");

  for (let i = 0; i < videoRows.length; i += BATCH_SIZE) {
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const batch = videoRows.slice(i, i + BATCH_SIZE);
    log.debug({ batchNum, totalBatches, batchSize: batch.length }, "processing batch");

    const videoList = batch
      .map((v) => {
        const transcript = transcriptMap.get(v.id) ?? "(no transcript)";
        return `- videoId: "${v.id}" | title: "${v.title}" | transcript: ${transcript}`;
      })
      .join("\n");

    const prompt = `Existing sagas:\n${sagaList}\n\nUncategorized videos:\n${videoList}`;

    let model: ReturnType<typeof getModel>;
    try {
      model = getModel();
    } catch (modelErr) {
      log.error({ err: modelErr, batchNum }, "failed to get AI model");
      throw modelErr;
    }

    const startMs = Date.now();
    const { text: aiText } = await generateText({
      model,
      system: SUGGEST_PROMPT,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
      maxOutputTokens: 2000,
    });
    const elapsedMs = Date.now() - startMs;
    log.info({ batchNum, elapsedMs, responseLength: aiText.length }, "AI responded");

    const cleaned = aiText.replaceAll(/```(?:json)?\s*/g, "").replaceAll(/```\s*$/g, "");
    const jsonMatch = /\{[\s\S]*\}/.exec(cleaned);

    if (!jsonMatch) {
      log.warn({ batchNum }, "no JSON object found in AI response");
      continue;
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        suggestions?: Array<{
          videoId: string;
          sagaName: string;
          confidence: string;
        }>;
      };

      const rawSuggestions = parsed.suggestions ?? [];
      log.debug({ batchNum, suggestionCount: rawSuggestions.length }, "parsed suggestions");

      for (const s of rawSuggestions) {
        const saga = existingSagas.find((es) => es.name === s.sagaName);
        if (!saga) {
          log.debug({ batchNum, sagaName: s.sagaName }, "skipping — saga not found");
          continue;
        }
        if (!s.videoId || !videoIdSet.has(s.videoId)) {
          log.debug({ batchNum, videoId: s.videoId }, "skipping — videoId not in request set");
          continue;
        }

        const confidence = (["high", "medium", "low"].includes(s.confidence)
          ? s.confidence
          : "low") as SagaSuggestion["confidence"];

        if (assignedVideoIds.has(s.videoId)) {
          const existing = allSuggestions.find((x) => x.videoId === s.videoId);
          if (existing && (CONFIDENCE_RANK[confidence] ?? 0) > (CONFIDENCE_RANK[existing.confidence] ?? 0)) {
            existing.sagaId = saga.id;
            existing.sagaName = saga.name;
            existing.confidence = confidence;
          }
          continue;
        }

        assignedVideoIds.add(s.videoId);
        allSuggestions.push({
          videoId: s.videoId,
          sagaId: saga.id,
          sagaName: saga.name,
          confidence,
        });
      }
    } catch (parseErr) {
      log.error({ err: parseErr, batchNum, raw: jsonMatch[0].slice(0, 500) }, "JSON parse error");
    }
  }

  log.info({ suggestionCount: allSuggestions.length }, "POST complete");
  return Response.json(
    { suggestions: allSuggestions },
    { headers: mergeHeaders(corsHeaders, withRateLimitHeaders(rateLimitResult)) }
  );
});
