import { db } from "@/db";
import { transcripts, videos } from "@/db/schema";
import { getModel } from "@/lib/ai-providers";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/route-handler";
import { validateChannelId } from "@/lib/validation";
import { rateLimitExceededResponse } from "@data-projects/shared";
import { generateText } from "ai";
import { count, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

function buildSystemPrompt(language: string) {
  return String.raw`You convert natural language descriptions into PostgreSQL case-insensitive regular expressions (used with the ~* operator).

The transcripts you are searching are in **${language}**. The user may write their query in ANY language — you MUST translate their intent and generate the regex using terms in **${language}**.

Rules:
- Return ONLY the regex pattern. No explanation, no backticks, no quotes, no markdown.
- Be EXHAUSTIVE. For each concept, include:
  - All relevant verb conjugations (present, past, future, imperative, subjunctive, gerund, participle)
  - Noun inflections (singular, plural, masculine, feminine)
  - Diminutives and augmentatives common in speech
  - Closely related synonyms and terms from the same semantic field
  - Accent/diacritic variations (e.g., ã/a, é/e, ê/e, ç/c, ñ/n, ú/u, ó/o)
  - Common informal spellings or abbreviations used in spoken language
- Use alternation (|) to list all variants.
- Use character classes for accent variants (e.g., [aã], [eé], [oó]).
- Use simple quantifiers where they collapse many inflections (e.g., comunist[ao]s? to match comunista/comunistas/comunisto).
- Keep patterns efficient — avoid catastrophic backtracking (no nested quantifiers).
- Group alternatives with parentheses.

Examples (for Portuguese transcripts):
- User: "communism" -> (comunis[mt][ao]s?|comunismo|socialismo|socialista|marxis[mt][ao]s?|leninis[mt][ao]s?|bolchevi[sc][mt][ao]s?|sovi[eé]tic[ao]s?|uni[aã]o sovi[eé]tica|urss)
- User: "videos about cooking" -> (cozinhar|cozinhando|cozinhou|cozinha|culin[aá]ri[ao]|receita|receitas|preparar|preparando|ingredientes|tempero|temperos)
- User: "artificial intelligence" -> (intelig[eê]ncia artificial|\bIA\b|machine learning|aprendizado de m[aá]quina|redes? neurais?|deep learning|\bGPT\b|\bLLM\b)`;
}

async function detectChannelLanguage(channelId: string): Promise<string> {
  const [row] = await db
    .select({ language: transcripts.language, cnt: count() })
    .from(transcripts)
    .innerJoin(videos, eq(transcripts.videoId, videos.id))
    .where(eq(videos.channelId, channelId))
    .groupBy(transcripts.language)
    .orderBy(sql`count(*) desc`)
    .limit(1);

  return row?.language ?? "en";
}

export const POST = withErrorHandling("transcripts-search-ai:POST", async (request, { params }) => {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await params;
  const v = validateChannelId(channelId);
  if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`ai-transcript:${clientIp}`, RATE_LIMITS.aiQuery);
  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(rateLimitResult, "Too many AI requests. Please try again later.");
  }

  const body = await request.json().catch(() => null);
  const prompt = body?.prompt?.trim();
  if (!prompt || prompt.length < 3 || prompt.length > 500) {
    return NextResponse.json(
      { error: "Prompt must be between 3 and 500 characters" },
      { status: 400 },
    );
  }

  const language = await detectChannelLanguage(channelId);

  const model = getModel();
  const { text } = await generateText({
    model,
    system: buildSystemPrompt(language),
    prompt,
    maxOutputTokens: 500,
    temperature: 0,
  });

  const regex = text.trim().replaceAll(/^[`"']+|[`"']+$/g, "");

  try {
    new RegExp(regex, "gi");
  } catch {
    return NextResponse.json(
      { error: "AI generated an invalid regex. Try rephrasing your query." },
      { status: 422 },
    );
  }

  return NextResponse.json({ regex, language });
});
