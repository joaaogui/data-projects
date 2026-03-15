import { db } from "@/db";
import { channels, syncJobs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { STALE_JOB_THRESHOLD_MS } from "@/lib/constants";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { syncChannelVideos } from "@/lib/sync-videos";
import { and, eq, inArray, lt } from "drizzle-orm";
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

  if (!channelId || channelId.length < 10) {
    return NextResponse.json({ error: "Invalid channel ID" }, { status: 400 });
  }

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`sync-videos:${clientIp}`, { maxRequests: 5, windowMs: 60_000 });
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: "Too many sync requests. Please wait." }, { status: 429 });
  }

  await cleanupStaleJobs(channelId, "videos");

  const existing = await db
    .select()
    .from(syncJobs)
    .where(
      and(
        eq(syncJobs.channelId, channelId),
        eq(syncJobs.type, "videos"),
        inArray(syncJobs.status, ["pending", "running"])
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json({
      jobId: existing[0].id,
      status: existing[0].status,
      message: "Sync already in progress",
    });
  }

  const jobId = crypto.randomUUID();

  await db
    .insert(channels)
    .values({ id: channelId, title: channelId, fetchedAt: new Date() })
    .onConflictDoNothing();

  await db.insert(syncJobs).values({
    id: jobId,
    channelId,
    type: "videos",
    status: "pending",
    progress: { phase: "queued", fetched: 0 },
  });

  syncChannelVideos(channelId, jobId).catch((err) => {
    console.error(`[Sync] Video sync failed for ${channelId}:`, err);
  });

  return NextResponse.json({ jobId, status: "running" });
}
