import { db } from "@/db";
import { videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { validateChannelId } from "@/lib/validation";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await params;
  const v = validateChannelId(channelId);
  if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });

  const rows = await db
    .select({ videoId: videos.id, topics: videos.topics })
    .from(videos)
    .where(eq(videos.channelId, channelId));

  const topicCounts = new Map<string, number>();
  for (const row of rows) {
    if (Array.isArray(row.topics)) {
      for (const topic of row.topics) {
        topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
      }
    }
  }

  const topTopics = [...topicCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([topic, count]) => ({ topic, count }));

  const videoCount = rows.length;
  const withTopics = rows.filter((r) => Array.isArray(r.topics) && r.topics.length > 0).length;

  return NextResponse.json({
    topics: topTopics,
    videoCount,
    videosWithTopics: withTopics,
  });
}
