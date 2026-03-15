import { db } from "@/db";
import { comments } from "@/db/schema";
import { auth } from "@/lib/auth";
import { fetchTopComments } from "@/lib/youtube-comments";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { videoId } = await params;
  if (!videoId || videoId.length < 5) {
    return NextResponse.json({ error: "Invalid video ID" }, { status: 400 });
  }

  const cached = await db
    .select()
    .from(comments)
    .where(eq(comments.videoId, videoId))
    .orderBy(desc(comments.likeCount))
    .limit(20);

  if (cached.length > 0) {
    return NextResponse.json({ comments: cached, source: "cache" });
  }

  const fetched = await fetchTopComments(videoId);

  if (fetched.length > 0) {
    await db.insert(comments).values(
      fetched.map((c) => ({
        id: c.id,
        videoId,
        authorName: c.authorName,
        text: c.text,
        likeCount: c.likeCount,
        publishedAt: new Date(c.publishedAt),
      }))
    ).onConflictDoNothing();
  }

  return NextResponse.json({ comments: fetched, source: "youtube" });
}
