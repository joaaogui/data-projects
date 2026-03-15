import { db } from "@/db";
import { transcripts, videos } from "@/db/schema";
import { getModel } from "@/lib/ai-providers";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
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

export async function POST(request: Request) {
  const tag = "[Saga Suggest]";
  console.log(`${tag} POST request received`);

  const session = await auth();
  if (!session) {
    console.warn(`${tag} Rejected: not authenticated`);
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders }
    );
  }
  console.log(`${tag} Authenticated as ${session.user?.email ?? "unknown"}`);

  try {
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `saga-suggest:${clientIp}`,
      RATE_LIMITS.search
    );

    if (!rateLimitResult.success) {
      console.warn(`${tag} Rate limited (ip: ${clientIp})`);
      return rateLimitExceededResponse(
        rateLimitResult,
        "Too many requests. Please try again later.",
        corsHeaders
      );
    }

    const body = (await request.json()) as SuggestRequest;
    const { videoIds, sagas: existingSagas } = body;
    console.log(`${tag} Input: ${videoIds?.length ?? 0} videoIds, ${existingSagas?.length ?? 0} sagas`);

    if (!Array.isArray(videoIds) || videoIds.length === 0 || !Array.isArray(existingSagas)) {
      console.warn(`${tag} Bad request — videoIds: ${JSON.stringify(videoIds)?.slice(0, 200)}, sagas: ${JSON.stringify(existingSagas)?.slice(0, 200)}`);
      return Response.json(
        { error: "videoIds and sagas arrays are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`${tag} Querying DB for videos...`);
    const videoRows = await db
      .select({ id: videos.id, title: videos.title })
      .from(videos)
      .where(inArray(videos.id, videoIds));
    console.log(`${tag} Found ${videoRows.length}/${videoIds.length} videos in DB`);

    console.log(`${tag} Querying DB for transcripts...`);
    const transcriptRows = await db
      .select({ videoId: transcripts.videoId, excerpt: transcripts.excerpt, fullText: transcripts.fullText })
      .from(transcripts)
      .where(inArray(transcripts.videoId, videoIds));
    console.log(`${tag} Found ${transcriptRows.length} transcripts`);

    const transcriptMap = new Map<string, string>();
    for (const row of transcriptRows) {
      const text = row.fullText ?? row.excerpt;
      if (text) transcriptMap.set(row.videoId, text.slice(0, 500));
    }
    console.log(`${tag} ${transcriptMap.size} videos have transcript text`);

    const sagaList = existingSagas.map((s) => `- "${s.name}" (id: ${s.id})`).join("\n");

    const BATCH_SIZE = 10;
    const allSuggestions: SagaSuggestion[] = [];
    const videoIdSet = new Set(videoIds);
    const assignedVideoIds = new Set<string>();
    const totalBatches = Math.ceil(videoRows.length / BATCH_SIZE);

    const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

    console.log(`${tag} Processing ${videoRows.length} videos in ${totalBatches} batch(es)`);

    for (let i = 0; i < videoRows.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const batch = videoRows.slice(i, i + BATCH_SIZE);
      console.log(`${tag} Batch ${batchNum}/${totalBatches}: ${batch.length} videos`);

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
        console.log(`${tag} Batch ${batchNum}: AI model resolved, calling generateText...`);
      } catch (modelErr) {
        console.error(`${tag} Batch ${batchNum}: Failed to get AI model:`, modelErr);
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
      console.log(`${tag} Batch ${batchNum}: AI responded in ${elapsedMs}ms (${aiText.length} chars)`);
      console.log(`${tag} Batch ${batchNum}: Raw AI response: ${aiText.slice(0, 500)}`);

      const cleaned = aiText.replaceAll(/```(?:json)?\s*/g, "").replaceAll(/```\s*$/g, "");
      const jsonMatch = /\{[\s\S]*\}/.exec(cleaned);

      if (!jsonMatch) {
        console.warn(`${tag} Batch ${batchNum}: No JSON object found in AI response`);
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
        console.log(`${tag} Batch ${batchNum}: Parsed ${rawSuggestions.length} suggestion(s) from AI`);

        for (const s of rawSuggestions) {
          const saga = existingSagas.find((es) => es.name === s.sagaName);
          if (!saga) {
            console.log(`${tag} Batch ${batchNum}: Skipping — saga name "${s.sagaName}" not found in existing sagas`);
            continue;
          }
          if (!s.videoId || !videoIdSet.has(s.videoId)) {
            console.log(`${tag} Batch ${batchNum}: Skipping — videoId "${s.videoId}" not in request set`);
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
        console.error(`${tag} Batch ${batchNum}: JSON parse error:`, parseErr);
        console.error(`${tag} Batch ${batchNum}: Attempted to parse: ${jsonMatch[0].slice(0, 500)}`);
      }
    }

    console.log(`${tag} Done — returning ${allSuggestions.length} suggestion(s)`);
    return Response.json(
      { suggestions: allSuggestions },
      { headers: mergeHeaders(corsHeaders, withRateLimitHeaders(rateLimitResult)) }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`${tag} Unhandled error: ${errMsg}`);
    if (errStack) console.error(`${tag} Stack: ${errStack}`);
    return Response.json(
      { error: `Failed to generate suggestions: ${errMsg}` },
      { status: 500, headers: corsHeaders }
    );
  }
}
