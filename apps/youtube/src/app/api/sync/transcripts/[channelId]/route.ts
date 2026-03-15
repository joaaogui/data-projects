import { db } from "@/db";
import { channels, syncJobs, transcripts, videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { STALE_JOB_THRESHOLD_MS } from "@/lib/constants";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { syncChannelTranscripts } from "@/lib/sync-transcripts";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

async function cleanupStaleJobs(channelId: string, type: string) {
  const threshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);
  await db
    .update(syncJobs)
    .set({ status: "failed", error: "Job timed out", updatedAt: new Date() })
    .where(
      and(
        eq(syncJobs.channelId, channelId),
        eq(syncJobs.type, type as "videos" | "transcripts"),
        inArray(syncJobs.status, ["pending", "running"]),
        lt(syncJobs.updatedAt, threshold)
      )
    );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await params;
  const retry = request.nextUrl.searchParams.get("retry") === "true";

  if (!channelId || channelId.length < 10) {
    return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`sync-transcripts:${clientIp}`, { maxRequests: 5, windowMs: 60_000 });
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Too many sync requests. Please wait." }, { status: 429 });
  }

  const channelExists = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (channelExists.length === 0) {
    return NextResponse.json(
      { error: "Channel not found. Sync videos first." },
      { status: 404 }
    );
  }

  if (retry) {
    const nullRows = await db
      .select({ videoId: transcripts.videoId })
      .from(transcripts)
      .innerJoin(videos, eq(transcripts.videoId, videos.id))
      .where(and(eq(videos.channelId, channelId), isNull(transcripts.fullText)));

    if (nullRows.length > 0) {
      const ids = nullRows.map((r) => r.videoId);
      await db.delete(transcripts).where(inArray(transcripts.videoId, ids));
      console.log(`[Sync] Cleared ${ids.length} null transcripts for ${channelId} — will retry`);
    }
  }

  await cleanupStaleJobs(channelId, "transcripts");

  const existing = await db
    .select()
    .from(syncJobs)
    .where(
      and(
        eq(syncJobs.channelId, channelId),
        eq(syncJobs.type, "transcripts"),
        inArray(syncJobs.status, ["pending", "running"])
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({
      jobId: existing[0].id,
      status: existing[0].status,
      message: "Transcript sync already in progress",
    });
  }

  const jobId = crypto.randomUUID();

  await db.insert(syncJobs).values({
    id: jobId,
    channelId,
    type: "transcripts",
    status: "pending",
    progress: { phase: "queued", fetched: 0 },
  });

  syncChannelTranscripts(channelId, jobId).catch((err) => {
    console.error(`[Sync] Transcript sync failed for ${channelId}:`, err);
  });

  return NextResponse.json({ jobId, status: "running" });
}
