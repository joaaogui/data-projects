import { db } from "@/db";
import { transcripts, videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { withErrorHandling } from "@/lib/route-handler";
import { validateChannelId } from "@/lib/validation";
import { and, eq, ilike, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

const MAX_RESULTS = 50;

function extractSnippetByRegex(fullText: string, pattern: string) {
  try {
    const re = new RegExp(pattern, "gi");
    const match = re.exec(fullText);
    if (!match) return { contextSnippet: "", matchOffset: -1 };

    const idx = match.index;
    const matchLen = match[0].length;
    const start = Math.max(0, idx - 80);
    const end = Math.min(fullText.length, idx + matchLen + 80);
    const contextSnippet =
      (start > 0 ? "..." : "") +
      fullText.slice(start, end) +
      (end < fullText.length ? "..." : "");

    return { contextSnippet, matchOffset: idx };
  } catch {
    return { contextSnippet: "", matchOffset: -1 };
  }
}

function extractSnippetByString(fullText: string, query: string) {
  const lowerText = fullText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx < 0) return { contextSnippet: "", matchOffset: -1 };

  const start = Math.max(0, idx - 80);
  const end = Math.min(fullText.length, idx + query.length + 80);
  const contextSnippet =
    (start > 0 ? "..." : "") +
    fullText.slice(start, end) +
    (end < fullText.length ? "..." : "");

  return { contextSnippet, matchOffset: idx };
}

export const GET = withErrorHandling("transcripts-search:GET", async (request, { params }) => {
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

  const isRegex = request.nextUrl.searchParams.get("regex") === "true";

  const textFilter = isRegex
    ? sql`${transcripts.fullText} ~* ${query}`
    : ilike(transcripts.fullText, `%${query}%`);

  let results;
  try {
    results = await db
      .select({
        videoId: videos.id,
        title: videos.title,
        publishedAt: videos.publishedAt,
        score: videos.score,
        views: videos.views,
        thumbnail: videos.thumbnail,
        duration: videos.duration,
        excerpt: transcripts.excerpt,
        language: transcripts.language,
        fullText: transcripts.fullText,
      })
      .from(transcripts)
      .innerJoin(videos, eq(transcripts.videoId, videos.id))
      .where(and(eq(videos.channelId, channelId), textFilter))
      .orderBy(videos.publishedAt)
      .limit(MAX_RESULTS);
  } catch (err) {
    if (isRegex) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("regular expression")) {
        return NextResponse.json({ error: "Invalid regex pattern" }, { status: 400 });
      }
    }
    throw err;
  }

  const matches = results.map((r) => {
    const textLength = r.fullText?.length ?? 0;
    let contextSnippet = "";
    let matchOffset = -1;

    if (r.fullText) {
      const snippet = isRegex
        ? extractSnippetByRegex(r.fullText, query)
        : extractSnippetByString(r.fullText, query);
      contextSnippet = snippet.contextSnippet;
      matchOffset = snippet.matchOffset;
    }

    return {
      videoId: r.videoId,
      title: r.title,
      publishedAt: r.publishedAt.toISOString(),
      score: r.score,
      views: r.views,
      thumbnail: r.thumbnail,
      language: r.language,
      duration: r.duration,
      matchOffset,
      textLength,
      contextSnippet,
    };
  });

  return NextResponse.json({ results: matches, query, total: matches.length });
});
