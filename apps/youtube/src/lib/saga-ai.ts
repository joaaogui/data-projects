import { db } from "@/db";
import { transcripts } from "@/db/schema";
import { getModel } from "@/lib/ai-providers";
import { createTaggedLogger } from "@/lib/logger";
import { fetchTranscriptBatch } from "@/lib/transcript";
import { generateText } from "ai";
import { inArray } from "drizzle-orm";

const log = createTaggedLogger("saga-ai");

export const MAX_VIDEOS_PER_BATCH = 50;

const AD_PATTERNS = [
  /sorteio/i,
  /concorr(?:er|endo|a)/i,
  /centavo/i,
  /chance de (?:ganhar|concorrer)/i,
  /clicando (?:aqui|no link)/i,
  /link (?:na |da )?descri[çc][aã]o/i,
  /pr[eê]mio/i,
  /rifas?\b/i,
  /vale milh[oõ]es/i,
  /ganha(?:r|dor)/i,
  /(?:particip[ae]|compre?) (?:agora|j[aá]|hoje)/i,
  /\bR\$\s*\d/,
  /\d+\.?\d*\s*(?:mil|reais)\b/i,
  /\bmoto(?:cicleta)?\s+(?:start|honda|pop)\b/i,
  /\bcorolla\b/i,
  /\biphone\b/i,
  /\bgolfe?\b/i,
];

function stripAdContent(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+|(?<=\n)/);
  const cleaned = sentences.filter((s) => {
    const matchCount = AD_PATTERNS.reduce((n, p) => n + (p.test(s) ? 1 : 0), 0);
    return matchCount < 2;
  });
  return cleaned.join(" ").trim();
}

function prepareTranscript(fullText: string | null, excerpt: string | null): string {
  const raw = fullText ?? excerpt;
  if (!raw) return "";
  const cleaned = stripAdContent(raw);
  return cleaned.slice(0, 1200);
}

const SYSTEM_PROMPT = `You receive a chronological batch of consecutive YouTube videos with their opening transcripts.
Videos are ordered by publish date (oldest first within this batch).

Your task: identify contiguous groups of videos that are part of the same ongoing story/saga.
A saga is a continuous narrative — consecutive episodes of the same specific story told across multiple videos.

Rules:
1. Only group videos that are CONTIGUOUS (next to each other in the list) and share the same SPECIFIC ongoing narrative.
2. A saga must have at least 2 consecutive videos.
3. NAMING IS CRITICAL. Name each saga based on the CORE EVENT or CONFLICT, not character names.
   - GOOD names: "A Compra do Caminhão", "O Sequestro da Maria", "A Fuga do Hospital", "O Incêndio na Favela"
   - BAD names: "Luiz do Som e Dona Zaza", "Manetikin e Luiz", "Luiz do Som na Rua", "A História de Manetikin"
   - The name must describe WHAT HAPPENS, not WHO IS IN IT. Every video has the same characters — that's not distinctive.
4. EACH VIDEO BELONGS TO AT MOST ONE SAGA. Never assign the same video to multiple sagas.
5. Videos that are standalone (not part of any multi-episode story) should go in "standalone".
6. REUSING KNOWN NAMES: If "Known saga names" are provided, CHECK EACH ONE carefully. If the current batch contains videos about the same topic/event as a known saga, you MUST use that EXACT name. For example, if "A Compra do Caminhão" is a known name and the current videos are also about buying a truck, use "A Compra do Caminhão" — do NOT invent "A Busca Pelo Caminhão" or any variation.
7. Be conservative: if two adjacent videos have the same characters but different situations or conflicts, they are DIFFERENT sagas.
8. Read the transcripts carefully — look for the specific plot/conflict being discussed, not just who appears in it.
9. CRITICAL — IGNORE ALL ADVERTISEMENTS AND PROMOTIONS. Many videos contain recurring promotional segments about raffles ("sorteio", "rifa"), prizes ("prêmios"), sponsors, giveaways ("vale milhões"), or ticket sales ("centavos", "chance de ganhar", "concorrer"). These ads appear across MANY unrelated videos and are NOT story content. NEVER create a saga based on promotional/advertising content. NEVER use ad quotes as evidence. If the only thing connecting two videos is a promotional segment, they are NOT a saga. Focus ONLY on the actual narrative story being told in the video.
10. ASSIGNING SINGLE VIDEOS TO KNOWN SAGAS: If a video clearly belongs to a known saga (same story/event) but is NOT contiguous with other saga videos in this batch, add it to "assignToExisting" instead of "segments". This lets isolated videos rejoin their saga.

Output ONLY valid JSON (no markdown fences, no explanation):
{
  "segments": [
    {
      "name": "Saga Name",
      "indices": [1, 2, 3],
      "reasoning": "1-2 sentence explanation of WHY these videos form a saga",
      "evidence": { "1": "short transcript quote from video 1", "2": "short transcript quote from video 2" }
    }
  ],
  "assignToExisting": [
    { "index": 5, "sagaName": "Known Saga Name" }
  ],
  "standalone": [8],
  "continuingFromPrevious": "Saga Name or null",
  "continuingAtEnd": "Saga Name or null"
}

- "indices": 1-based video positions in the batch
- "reasoning": a short (1-2 sentence) explanation of the shared narrative that links these videos together.
- "evidence": a map from video index (as string) to a SHORT direct quote (max ~80 chars) from that video's transcript that justifies including it in this saga. Pick the most relevant sentence fragment that proves this video is part of the story. NEVER quote advertisements, raffles, or promotional content as evidence.
- "assignToExisting": single videos that belong to a known saga but aren't contiguous with other saga videos in this batch
- "continuingFromPrevious": saga name if video #1 continues a story from the previous batch
- "continuingAtEnd": saga name if the last video is mid-saga (story continues in older content)`;

export interface VideoInput {
  videoId: string;
  title: string;
  publishedAt: string;
}

export interface SegmentResult {
  name: string;
  videoIds: string[];
  reasoning?: string;
  videoEvidence?: Record<string, string>;
}

export interface AnalyzeResponse {
  segments: SegmentResult[];
  tailContext: string;
}

export function buildUserPrompt(
  videos: VideoInput[],
  transcriptMap: Map<string, string>,
  overlapContext?: string,
  knownSagaNames?: string[]
): string {
  const parts: string[] = [];

  if (knownSagaNames && knownSagaNames.length > 0) {
    parts.push(`Known saga names (reuse EXACTLY if the same story continues): ${knownSagaNames.join(", ")}`, "");
  }

  if (overlapContext) {
    parts.push(`Context from previous batch: ${overlapContext}`, "");
  }

  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    const transcript = transcriptMap.get(v.videoId) ?? "(no transcript available)";
    parts.push(`${i + 1}. [${v.title}] — ${transcript}`);
  }

  return parts.join("\n");
}

export async function callAI(prompt: string): Promise<string> {
  const { text } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: `Video batch:\n${prompt}` }],
    temperature: 0.1,
    maxOutputTokens: 3000,
  });

  return text.trim();
}

type RawSegment = { name: string; indices: number[]; reasoning?: string; evidence?: Record<string, string> };

type RawAssignment = { index: number; sagaName: string };

type RawParsed = {
  segments?: RawSegment[];
  assignToExisting?: RawAssignment[];
  continuingAtEnd?: string | null;
};

function extractAndParseJson(cleaned: string): RawParsed | null {
  const jsonMatch = /\{[\s\S]*\}/.exec(cleaned);
  if (!jsonMatch) {
    log.error({ preview: cleaned.slice(0, 300) }, "No JSON found in AI response");
    return null;
  }
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    log.error({ preview: jsonMatch[0].slice(0, 300) }, "JSON parse error in AI response");
    return null;
  }
}

function buildVideoEvidence(
  evidence: Record<string, string>,
  videos: VideoInput[]
): Record<string, string> {
  const videoEvidence: Record<string, string> = {};
  for (const [idxStr, quote] of Object.entries(evidence)) {
    const vid = videos[Number(idxStr) - 1]?.videoId;
    if (vid && quote) videoEvidence[vid] = quote;
  }
  return videoEvidence;
}

function parseSegments(
  rawSegments: RawSegment[],
  videos: VideoInput[]
): SegmentResult[] {
  const segments: SegmentResult[] = [];
  for (const seg of rawSegments) {
    if (!seg.name || !Array.isArray(seg.indices) || seg.indices.length < 2) continue;
    const videoIds = seg.indices
      .map((idx) => videos[idx - 1]?.videoId)
      .filter((id): id is string => Boolean(id));
    if (videoIds.length < 2) continue;

    const videoEvidence = seg.evidence ? buildVideoEvidence(seg.evidence, videos) : undefined;
    segments.push({ name: seg.name, videoIds, reasoning: seg.reasoning, videoEvidence });
  }
  return segments;
}

function applyExistingAssignments(
  assignments: RawAssignment[],
  videos: VideoInput[],
  segments: SegmentResult[]
): void {
  for (const assign of assignments) {
    if (!assign.sagaName || typeof assign.index !== "number") continue;
    const videoId = videos[assign.index - 1]?.videoId;
    if (!videoId) continue;
    const existing = segments.find((s) => s.name === assign.sagaName);
    if (existing) {
      existing.videoIds.push(videoId);
    } else {
      segments.push({ name: assign.sagaName, videoIds: [videoId] });
    }
  }
}

export function parseAiResponse(
  text: string,
  videos: VideoInput[]
): { segments: SegmentResult[]; tailContext: string } {
  const cleaned = text.replaceAll(/```(?:json)?\s*/g, "").replaceAll(/```\s*$/g, "");
  const parsed = extractAndParseJson(cleaned);
  if (!parsed) return { segments: [], tailContext: "" };

  const segments = parseSegments(parsed.segments ?? [], videos);
  applyExistingAssignments(parsed.assignToExisting ?? [], videos, segments);

  const tailContext = parsed.continuingAtEnd ?? "";
  return { segments, tailContext };
}

export async function loadTranscriptsForVideos(
  videoIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();

  const dbRows = await db
    .select({ videoId: transcripts.videoId, excerpt: transcripts.excerpt, fullText: transcripts.fullText })
    .from(transcripts)
    .where(inArray(transcripts.videoId, videoIds));

  const inDb = new Set<string>();
  for (const row of dbRows) {
    inDb.add(row.videoId);
    const text = prepareTranscript(row.fullText, row.excerpt);
    if (text) {
      result.set(row.videoId, text);
    }
  }

  const toFetch = videoIds.filter((id) => !inDb.has(id));

  if (toFetch.length > 0 && toFetch.length <= 5) {
    const freshTranscripts = await fetchTranscriptBatch(toFetch, 1000);

    for (const [id, text] of freshTranscripts) {
      result.set(id, text);
    }

    const newRows = toFetch.map((id) => ({
      videoId: id,
      fullText: null,
      excerpt: freshTranscripts.get(id) ?? null,
      language: null,
      fetchedAt: new Date(),
    }));

    if (newRows.length > 0) {
      await db
        .insert(transcripts)
        .values(newRows)
        .onConflictDoNothing()
        .catch((err) => log.warn({ err }, "Failed to cache transcripts"));
    }
  }

  return result;
}

export async function analyzeBatchFromDb(
  videos: VideoInput[],
  overlapContext?: string,
  knownSagaNames?: string[]
): Promise<AnalyzeResponse> {
  const videoIds = videos.map((v) => v.videoId);
  const transcriptMap = await loadTranscriptsForVideos(videoIds);
  const userPrompt = buildUserPrompt(videos, transcriptMap, overlapContext, knownSagaNames);
  const aiText = await callAI(userPrompt);
  return parseAiResponse(aiText, videos);
}
