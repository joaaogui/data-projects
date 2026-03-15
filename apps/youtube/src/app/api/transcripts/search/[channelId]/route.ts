import { db } from "@/db";
import { transcripts, videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { validateChannelId } from "@/lib/validation";
import { and, eq, ilike } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const MAX_RESULTS = 50;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await params;
  const v = validateChannelId(channelId);
  if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });

  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Search query must be at least 2 characters" }, { status: 400 });
  }

  const searchPattern = `%${query}%`;

  const results = await db
    .select({
      videoId: videos.id,
      title: videos.title,
      publishedAt: videos.publishedAt,
      score: videos.score,
      views: videos.views,
      thumbnail: videos.thumbnail,
      excerpt: transcripts.excerpt,
      language: transcripts.language,
      fullText: transcripts.fullText,
    })
    .from(transcripts)
    .innerJoin(videos, eq(transcripts.videoId, videos.id))
    .where(
      and(
        eq(videos.channelId, channelId),
        ilike(transcripts.fullText, searchPattern)
      )
    )
    .orderBy(videos.publishedAt)
    .limit(MAX_RESULTS);

  const matches = results.map((r) => {
    let contextSnippet = "";
    if (r.fullText) {
      const lowerText = r.fullText.toLowerCase();
      const lowerQuery = query.toLowerCase();
      const idx = lowerText.indexOf(lowerQuery);
      if (idx >= 0) {
        const start = Math.max(0, idx - 80);
        const end = Math.min(r.fullText.length, idx + query.length + 80);
        contextSnippet =
          (start > 0 ? "..." : "") +
          r.fullText.slice(start, end) +
          (end < r.fullText.length ? "..." : "");
      }
    }

    return {
      videoId: r.videoId,
      title: r.title,
      publishedAt: r.publishedAt.toISOString(),
      score: r.score,
      views: r.views,
      thumbnail: r.thumbnail,
      language: r.language,
      contextSnippet,
    };
  });

  return NextResponse.json({ results: matches, query, total: matches.length });
}
