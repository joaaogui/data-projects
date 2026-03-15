import { db } from "@/db";
import { sagas, videos } from "@/db/schema";
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

const log = createTaggedLogger("discover-starter-pack");

const SYSTEM_PROMPT = `You are a YouTube recommendation expert. Given a creator's full video catalog with scores, topics, and series (sagas), pick 5-7 videos that form the perfect "starter pack" for a new viewer discovering this channel.

Your picks should include a balanced mix:
- "signature": Their most representative/iconic content
- "best": Their highest quality work
- "gem": A hidden gem most people haven't seen
- "recent": Something recent to show where they are now
- "classic": An early/classic video that shows their roots

For each pick, write a short compelling reason why it's a must-watch (1-2 sentences).

Return valid JSON only:
{
  "picks": [
    {
      "videoId": "actual_video_id_from_the_list",
      "reason": "Why this is a must-watch",
      "category": "signature"
    }
  ],
  "intro": "One sentence about what makes this creator worth watching"
}

IMPORTANT: Only use videoIds that appear in the provided list.`;

function buildVideoContext(
  vids: { id: string; title: string; views: number; score: number; topics: string[] | null; publishedAt: Date; duration: number }[],
  channelSagas: { name: string; videoIds: string[] }[],
): string {
  const sagaMap = new Map<string, string>();
  for (const s of channelSagas) {
    for (const vid of s.videoIds) {
      sagaMap.set(vid, s.name);
    }
  }

  const sorted = [...vids].sort(
    (a, b) => b.score - a.score,
  );

  const lines = sorted.map(
    (v) =>
      `${v.id} | "${v.title}" | ${v.publishedAt.toISOString().slice(0, 10)} | ${v.views.toLocaleString()} views | score ${v.score.toFixed(0)} | ${Math.round(v.duration / 60)}min | topics: ${(v.topics ?? []).join(", ")} | saga: ${sagaMap.get(v.id) ?? "none"}`,
  );

  return `${vids.length} videos total:\n\n${lines.join("\n")}`;
}

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const POST = withErrorHandling("discover-starter-pack", async (request, { params }) => {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Not authenticated" }, { status: 401, headers: corsHeaders });
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`discover-starter:${clientIp}`, RATE_LIMITS.aiQuery);
  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(rateLimitResult, "Too many requests", corsHeaders);
  }

  const { channelId } = await params;

  const [channelVideos, channelSagas] = await Promise.all([
    db
      .select({
        id: videos.id,
        title: videos.title,
        views: videos.views,
        score: videos.score,
        topics: videos.topics,
        publishedAt: videos.publishedAt,
        duration: videos.duration,
      })
      .from(videos)
      .where(eq(videos.channelId, channelId)),
    db
      .select({
        name: sagas.name,
        videoIds: sagas.videoIds,
      })
      .from(sagas)
      .where(eq(sagas.channelId, channelId)),
  ]);

  if (channelVideos.length < 5) {
    return Response.json(
      { error: "Not enough videos for a starter pack (minimum 5)" },
      { status: 400, headers: corsHeaders },
    );
  }

  const context = buildVideoContext(channelVideos, channelSagas);

  log.info({ channelId, videoCount: channelVideos.length }, "Generating starter pack");

  const { text } = await generateText({
    model: getModel(),
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: context }],
    temperature: 0.4,
    maxOutputTokens: 1500,
  });

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    log.error({ channelId }, "Failed to parse AI response for starter pack");
    return Response.json({ error: "Failed to generate starter pack" }, { status: 500, headers: corsHeaders });
  }

  const result = JSON.parse(jsonMatch[0]);

  const validIds = new Set(channelVideos.map((v) => v.id));
  result.picks = (result.picks ?? []).filter(
    (p: { videoId: string }) => validIds.has(p.videoId),
  );

  return Response.json(result, {
    headers: mergeHeaders(corsHeaders, withRateLimitHeaders(rateLimitResult)),
  });
});
