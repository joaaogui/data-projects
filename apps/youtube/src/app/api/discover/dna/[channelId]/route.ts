import { db } from "@/db";
import { transcripts, videos } from "@/db/schema";
import { getModel } from "@/lib/ai-providers";
import { auth } from "@/lib/auth";
import { createTaggedLogger } from "@/lib/logger";
import {
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/route-handler";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";
import { generateText } from "ai";
import { eq } from "drizzle-orm";

const log = createTaggedLogger("discover-dna");

const SYSTEM_PROMPT = `You are an expert at analyzing YouTube creator personalities based on their video transcripts.

Given transcript excerpts from a creator's videos, build a personality profile. Identify:
- Their humor style (if any)
- Recurring phrases or catchphrases they use frequently
- Presentation style (conversational, educational, energetic, calm, etc.)
- Favorite topics they keep coming back to
- Unique verbal or stylistic traits

Return valid JSON only, with this structure:
{
  "traits": [
    {
      "category": "Category name (e.g. 'Humor', 'Presentation', 'Expertise')",
      "value": "Brief description (e.g. 'Dry, self-deprecating wit')",
      "examples": ["Example quote or behavior"]
    }
  ],
  "catchphrases": ["phrase 1", "phrase 2"],
  "style": "2-3 sentence style summary",
  "summary": "One paragraph personality overview"
}

Be specific and reference actual content from the transcripts. Find 4-6 traits.`;

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const POST = withErrorHandling("discover-dna", async (request, { params }) => {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders });
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`discover-dna:${clientIp}`, RATE_LIMITS.aiQuery);
  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(rateLimitResult, "Too many requests", corsHeaders);
  }

  const { channelId } = await params;

  const rows = await db
    .select({
      title: videos.title,
      excerpt: transcripts.excerpt,
      fullText: transcripts.fullText,
    })
    .from(transcripts)
    .innerJoin(videos, eq(transcripts.videoId, videos.id))
    .where(eq(videos.channelId, channelId));

  const withText = rows.filter((r) => r.excerpt || r.fullText);

  if (withText.length < 3) {
    return Response.json(
      { error: "Not enough transcripts to analyze (minimum 3). Sync transcripts first." },
      { status: 400, headers: corsHeaders },
    );
  }

  const sampled = withText.length > 30
    ? withText.sort(() => Math.random() - 0.5).slice(0, 30)
    : withText;

  const excerpts = sampled.map((r) => {
    const text = r.fullText
      ? r.fullText.slice(0, 500)
      : r.excerpt ?? "";
    return `## "${r.title}"\n${text}`;
  });

  log.info({ channelId, transcriptCount: sampled.length }, "Generating DNA profile");

  const { text } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: excerpts.join("\n\n---\n\n") }],
    temperature: 0.4,
    maxOutputTokens: 2000,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    log.error({ channelId }, "Failed to parse AI response for DNA");
    return Response.json({ error: "Failed to generate profile" }, { status: 500, headers: corsHeaders });
  }

  const result = JSON.parse(jsonMatch[0]);

  return Response.json(result, {
    headers: mergeHeaders(corsHeaders, withRateLimitHeaders(rateLimitResult)),
  });
});
