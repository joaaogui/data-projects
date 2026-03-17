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

const log = createTaggedLogger("discover-rabbit-hole");

const AT_MENTION_RE = /@[\w.-]+/g;
const YT_CHANNEL_RE =
  /(?:youtube\.com\/(?:c\/|channel\/|@))[\w.-]+/gi;

function extractMentionsFromText(descriptions: { videoId: string; text: string }[]): Map<string, string[]> {
  const mentions = new Map<string, string[]>();

  for (const { videoId, text } of descriptions) {
    const atMentions = text.match(AT_MENTION_RE) ?? [];
    const urlMentions = text.match(YT_CHANNEL_RE) ?? [];
    const all = [...atMentions, ...urlMentions];

    for (const mention of all) {
      const clean = mention.replace(/^@/, "").replace(/youtube\.com\/(c\/|channel\/|@)/, "");
      if (clean.length < 2) continue;
      const existing = mentions.get(clean) ?? [];
      if (!existing.includes(videoId)) existing.push(videoId);
      mentions.set(clean, existing);
    }
  }

  return mentions;
}

const SYSTEM_PROMPT = `You are an expert at analyzing YouTube creator networks. Given video descriptions and transcript excerpts, identify other YouTube creators or channels that this person frequently mentions, collaborates with, or references.

You're also given a list of @mentions and channel URLs already extracted from descriptions.

Return valid JSON only:
{
  "mentions": [
    {
      "name": "Creator/channel name",
      "context": "Brief description of the relationship (e.g. 'Frequent collaborator on gaming videos', 'Mentioned as inspiration')",
      "frequency": 3,
      "videoIds": ["id1", "id2"]
    }
  ]
}

Rules:
- Focus on real creators/channels, not brands or generic accounts
- Merge duplicates (same person under different names/handles)
- Sort by frequency descending
- Include a maximum of 15 mentions
- Only include creators mentioned at least once with clear context`;

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const POST = withErrorHandling("discover-rabbit-hole", async (request, { params }) => {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders });
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`discover-rabbit:${clientIp}`, RATE_LIMITS.aiQuery);
  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(rateLimitResult, "Too many requests", corsHeaders);
  }

  const { channelId } = await params;

  const [descRows, transcriptRows] = await Promise.all([
    db
      .select({
        id: videos.id,
        title: videos.title,
        description: videos.description,
      })
      .from(videos)
      .where(eq(videos.channelId, channelId)),
    db
      .select({
        videoId: transcripts.videoId,
        excerpt: transcripts.excerpt,
      })
      .from(transcripts)
      .innerJoin(videos, eq(transcripts.videoId, videos.id))
      .where(eq(videos.channelId, channelId)),
  ]);

  if (descRows.length < 3) {
    return Response.json(
      { error: "Not enough videos to find connections (minimum 3)" },
      { status: 400, headers: corsHeaders },
    );
  }

  const descriptions = descRows
    .filter((r) => r.description && r.description.length > 10)
    .map((r) => ({ videoId: r.id, text: r.description! }));

  const parsedMentions = extractMentionsFromText(descriptions);

  const mentionSummary = [...parsedMentions.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 30)
    .map(([name, vids]) => `@${name} (${vids.length} videos)`)
    .join(", ");

  const excerptMap = new Map(
    transcriptRows
      .filter((r) => r.excerpt)
      .map((r) => [r.videoId, r.excerpt!]),
  );

  const sampled = descRows.sort(() => Math.random() - 0.5).slice(0, 25);
  const contextLines = sampled.map((r) => {
    const excerpt = excerptMap.get(r.id);
    const desc = r.description?.slice(0, 300) ?? "";
    const excerptPart = excerpt ? `\nTranscript excerpt: ${excerpt.slice(0, 200)}` : "";
    return `## "${r.title}" [${r.id}]\nDescription: ${desc}${excerptPart}`;
  });

  const prompt = `Extracted @mentions and channel URLs: ${mentionSummary || "none found"}\n\n${contextLines.join("\n\n---\n\n")}`;

  log.info({ channelId, videoCount: descRows.length, mentionCount: parsedMentions.size }, "Generating rabbit hole");

  const { text } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    maxOutputTokens: 1500,
  });

  const jsonMatch = /\{[\s\S]*\}/.exec(text);
  if (!jsonMatch) {
    log.error({ channelId }, "Failed to parse AI response for rabbit hole");
    return Response.json({ error: "Failed to find connections" }, { status: 500, headers: corsHeaders });
  }

  const result = JSON.parse(jsonMatch[0]);

  return Response.json(result, {
    headers: mergeHeaders(corsHeaders, withRateLimitHeaders(rateLimitResult)),
  });
});
