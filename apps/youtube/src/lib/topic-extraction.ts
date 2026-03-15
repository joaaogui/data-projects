import { db } from "@/db";
import { transcripts, videos } from "@/db/schema";
import { getModel } from "./ai-providers";
import { eq } from "drizzle-orm";
import { generateText } from "ai";

export async function extractTopicsForVideo(
  title: string,
  excerpt: string
): Promise<string[]> {
  const { text } = await generateText({
    model: getModel(),
    system: "Extract 3-5 key topics/themes from this YouTube video. Return only a JSON array of short topic strings (2-4 words each). No explanation.",
    prompt: `Title: ${title}\n\nTranscript excerpt: ${excerpt.slice(0, 500)}`,
    temperature: 0.2,
    maxOutputTokens: 100,
  });

  try {
    const cleaned = text.replaceAll(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is string => typeof t === "string").slice(0, 5);
    }
  } catch {
    // fallback: try to extract quoted strings
    const matches = text.match(/"([^"]+)"/g);
    if (matches) {
      return matches.map((m) => m.replaceAll('"', "")).slice(0, 5);
    }
  }
  return [];
}

export async function extractTopicsForChannel(
  channelId: string,
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  const pending = await db
    .select({
      videoId: videos.id,
      title: videos.title,
      excerpt: transcripts.excerpt,
    })
    .from(videos)
    .innerJoin(transcripts, eq(videos.id, transcripts.videoId))
    .where(eq(videos.channelId, channelId))
    .orderBy(videos.publishedAt);

  const needsTopics = pending.filter((r) => r.excerpt && r.excerpt.length > 20);
  const total = needsTopics.length;

  if (total === 0) return 0;

  let done = 0;
  const BATCH_SIZE = 5;

  for (let i = 0; i < needsTopics.length; i += BATCH_SIZE) {
    const batch = needsTopics.slice(i, i + BATCH_SIZE);

    await Promise.all(
      batch.map(async (row) => {
        try {
          const excerpt = row.excerpt;
          if (excerpt) {
            const topics = await extractTopicsForVideo(row.title, excerpt);
            if (topics.length > 0) {
              await db
                .update(videos)
                .set({ topics })
                .where(eq(videos.id, row.videoId));
            }
          }
        } catch {
          // skip on error
        }
        done++;
        onProgress?.(done, total);
      })
    );
  }

  return done;
}
