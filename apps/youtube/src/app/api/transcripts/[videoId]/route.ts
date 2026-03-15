import { db } from "@/db";
import { transcripts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
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

  const [row] = await db
    .select({
      fullText: transcripts.fullText,
      excerpt: transcripts.excerpt,
      language: transcripts.language,
    })
    .from(transcripts)
    .where(eq(transcripts.videoId, videoId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ transcript: null });
  }

  return NextResponse.json({
    transcript: {
      fullText: row.fullText,
      excerpt: row.excerpt,
      language: row.language,
    },
  });
}
