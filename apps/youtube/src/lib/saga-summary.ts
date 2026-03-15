import { db } from "@/db";
import { sagas, transcripts, videos } from "@/db/schema";
import { getModel } from "./ai-providers";
import { eq, inArray } from "drizzle-orm";
import { generateText } from "ai";

export async function generateSagaSummary(
  sagaName: string,
  videoData: Array<{ title: string; excerpt: string }>
): Promise<string> {
  const context = videoData
    .map((v) => {
      const excerpt = v.excerpt ? ` — ${v.excerpt.slice(0, 200)}` : "";
      return `• ${v.title}${excerpt}`;
    })
    .join("\n");

  const { text } = await generateText({
    model: getModel(),
    system: "You are a YouTube content analyst. Generate a concise 1-2 sentence summary describing the narrative arc or theme of a video series/saga. Be specific about the content, not generic.",
    prompt: `Saga: "${sagaName}"\n\nVideos:\n${context}\n\nWrite a brief summary of what this saga is about.`,
    temperature: 0.3,
    maxOutputTokens: 150,
  });

  return text.trim();
}

export async function generateAndSaveSagaSummaries(channelId: string): Promise<number> {
  const channelSagas = await db
    .select()
    .from(sagas)
    .where(eq(sagas.channelId, channelId));

  const aiSagas = channelSagas.filter(
    (s) => s.source === "ai-detected" && !s.summary && s.videoIds.length > 0
  );

  if (aiSagas.length === 0) return 0;

  const allVideoIds = [...new Set(aiSagas.flatMap((s) => s.videoIds))];

  const videoRows = await db
    .select({ id: videos.id, title: videos.title })
    .from(videos)
    .where(inArray(videos.id, allVideoIds));
  const titleMap = new Map(videoRows.map((r) => [r.id, r.title]));

  const transcriptRows = await db
    .select({ videoId: transcripts.videoId, excerpt: transcripts.excerpt })
    .from(transcripts)
    .where(inArray(transcripts.videoId, allVideoIds));
  const excerptMap = new Map(transcriptRows.map((r) => [r.videoId, r.excerpt ?? ""]));

  let count = 0;
  for (const saga of aiSagas) {
    try {
      const videoData = saga.videoIds.slice(0, 10).map((id) => ({
        title: titleMap.get(id) ?? id,
        excerpt: excerptMap.get(id) ?? "",
      }));

      const summary = await generateSagaSummary(saga.name, videoData);
      await db
        .update(sagas)
        .set({ summary })
        .where(eq(sagas.id, saga.id));
      count++;
    } catch {
      // continue on failure
    }
  }

  return count;
}
