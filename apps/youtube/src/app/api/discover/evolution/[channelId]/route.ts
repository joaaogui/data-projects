import { db } from "@/db";
import { videos } from "@/db/schema";
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

const log = createTaggedLogger("discover-evolution");

const SYSTEM_PROMPT = `You are an expert YouTube analyst. Given a list of videos grouped by time period, analyze how the creator's content evolved.

For each era, describe:
- What topics dominated
- How the style or format changed
- Key growth or decline signals

Return valid JSON only, with this structure:
{
  "eras": [
    {
      "period": "Era name (e.g. 'The Early Days')",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM",
      "topics": ["topic1", "topic2"],
      "style": "Brief style description",
      "description": "2-3 sentence narrative of this period",
      "videoCount": 15
    }
  ],
  "summary": "One paragraph overall evolution summary"
}

Keep era names creative and descriptive. Identify 3-6 distinct eras based on natural shifts you observe.`;

function groupIntoEras(
  vids: { title: string; publishedAt: Date; views: number; topics: string[] | null; duration: number }[],
): string {
  const sorted = [...vids].sort(
    (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime(),
  );

  const eraSize = Math.max(1, Math.ceil(sorted.length / 5));
  const groups: string[] = [];

  for (let i = 0; i < sorted.length; i += eraSize) {
    const slice = sorted.slice(i, i + eraSize);
    const start = slice[0].publishedAt.toISOString().slice(0, 7);
    const end = slice.at(-1)!.publishedAt.toISOString().slice(0, 7);
    const lines = slice.map(
      (v) =>
        `- "${v.title}" (${v.publishedAt.toISOString().slice(0, 10)}, ${v.views.toLocaleString()} views, ${Math.round(v.duration / 60)}min) [${(v.topics ?? []).join(", ")}]`,
    );
    groups.push(`### ${start} to ${end} (${slice.length} videos)\n${lines.join("\n")}`);
  }

  return groups.join("\n\n");
}

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const POST = withErrorHandling("discover-evolution", async (request, { params }) => {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders });
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`discover-evolution:${clientIp}`, RATE_LIMITS.aiQuery);
  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(rateLimitResult, "Too many requests", corsHeaders);
  }

  const { channelId } = await params;

  const channelVideos = await db
    .select({
      title: videos.title,
      publishedAt: videos.publishedAt,
      views: videos.views,
      topics: videos.topics,
      duration: videos.duration,
    })
    .from(videos)
    .where(eq(videos.channelId, channelId));

  if (channelVideos.length < 5) {
    return Response.json(
      { error: "Not enough videos to analyze evolution (minimum 5)" },
      { status: 400, headers: corsHeaders },
    );
  }

  const grouped = groupIntoEras(channelVideos);

  log.info({ channelId, videoCount: channelVideos.length }, "Generating evolution analysis");

  const { text } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: grouped }],
    temperature: 0.3,
    maxOutputTokens: 2000,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    log.error({ channelId }, "Failed to parse AI response for evolution");
    return Response.json({ error: "Failed to generate analysis" }, { status: 500, headers: corsHeaders });
  }

  const result = JSON.parse(jsonMatch[0]);

  return Response.json(result, {
    headers: mergeHeaders(corsHeaders, withRateLimitHeaders(rateLimitResult)),
  });
});
