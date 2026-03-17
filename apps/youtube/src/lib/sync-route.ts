import { db } from "@/db";
import { channels, syncJobs, transcripts, users, videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { STALE_JOB_THRESHOLD_MS, SYNC_RATE_LIMIT } from "@/lib/constants";
import { createTaggedLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { checkSyncQuota, incrementSyncUsage } from "@/lib/user-service";
import { validateChannelId } from "@/lib/validation";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const slog = createTaggedLogger("sync");

type SyncJobType = "videos" | "transcripts" | "sagas";

async function checkQuotaOrReturn(
  email: string | null | undefined,
  channelId: string,
  type: SyncJobType
): Promise<NextResponse | null> {
  if (!email) return null;
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) return null;
  const quota = await checkSyncQuota(user.id);
  if (!quota.allowed) {
    slog.info({ channelId, type, used: quota.used, limit: quota.limit }, "Sync quota exceeded");
    return NextResponse.json(
      {
        error: `Daily sync limit reached (${quota.used}/${quota.limit}). Resets tomorrow.`,
        quota: { used: quota.used, limit: quota.limit },
      },
      { status: 429 }
    );
  }
  return null;
}

function checkRateLimitOrReturn(
  request: NextRequest,
  type: SyncJobType,
  channelId: string,
  start: number
): NextResponse | null {
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(`sync-${type}:${clientIp}`, SYNC_RATE_LIMIT);
  if (!rateLimitResult.success) {
    slog.info({ channelId, type, clientIp, elapsedMs: Date.now() - start }, "Rate limited");
    return NextResponse.json(
      { error: "Too many sync requests. Please wait." },
      { status: 429 }
    );
  }
  return null;
}

async function checkChannelExistsOrReturn(
  channelId: string,
  type: SyncJobType,
  requireChannel: boolean,
  start: number
): Promise<NextResponse | null> {
  if (!requireChannel) return null;
  const exists = await channelExists(channelId);
  if (!exists) {
    slog.info({ channelId, type, elapsedMs: Date.now() - start }, "Channel not found");
    return NextResponse.json(
      { error: "Channel not found. Sync videos first." },
      { status: 404 }
    );
  }
  return null;
}

async function cleanupStaleJobs(channelId: string, type: SyncJobType) {
  const threshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);
  await db
    .update(syncJobs)
    .set({ status: "failed", error: "Job timed out", updatedAt: new Date() })
    .where(
      and(
        eq(syncJobs.channelId, channelId),
        eq(syncJobs.type, type),
        inArray(syncJobs.status, ["pending", "running"]),
        lt(syncJobs.updatedAt, threshold)
      )
    );
}

async function findExistingJob(channelId: string, type: SyncJobType) {
  const [existing] = await db
    .select({ id: syncJobs.id, status: syncJobs.status })
    .from(syncJobs)
    .where(
      and(
        eq(syncJobs.channelId, channelId),
        eq(syncJobs.type, type),
        inArray(syncJobs.status, ["pending", "running"])
      )
    )
    .limit(1);
  return existing ?? null;
}

async function channelExists(channelId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);
  return !!row;
}

export async function upsertChannelPlaceholder(channelId: string) {
  await db
    .insert(channels)
    .values({ id: channelId, title: channelId, fetchedAt: new Date() })
    .onConflictDoNothing();
}

export async function clearNullTranscripts(channelId: string) {
  const nullRows = await db
    .select({ videoId: transcripts.videoId })
    .from(transcripts)
    .innerJoin(videos, eq(transcripts.videoId, videos.id))
    .where(and(eq(videos.channelId, channelId), isNull(transcripts.fullText)));

  if (nullRows.length > 0) {
    const ids = nullRows.map((r) => r.videoId);
    await db.delete(transcripts).where(inArray(transcripts.videoId, ids));
  }
}

export async function startSyncJob(opts: {
  request: NextRequest;
  channelId: string;
  type: SyncJobType;
  requireChannel?: boolean;
  beforeStart?: (channelId: string) => Promise<void>;
  run: (channelId: string, jobId: string) => Promise<void>;
}): Promise<NextResponse> {
  const start = Date.now();
  const { channelId, type, request } = opts;
  slog.info({ channelId, type }, "Sync request received");

  const session = await auth();
  if (!session) {
    slog.info({ channelId, type, elapsedMs: Date.now() - start }, "Auth failed");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const validation = validateChannelId(channelId);
  if (!validation.valid) {
    slog.info({ channelId, type, reason: validation.error }, "Invalid channel ID");
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const email = session.user?.email;
  const quotaResponse = await checkQuotaOrReturn(email, channelId, type);
  if (quotaResponse) return quotaResponse;

  const rateLimitResponse = checkRateLimitOrReturn(request, type, channelId, start);
  if (rateLimitResponse) return rateLimitResponse;

  const channelResponse = await checkChannelExistsOrReturn(
    channelId,
    type,
    opts.requireChannel ?? false,
    start
  );
  if (channelResponse) return channelResponse;

  if (opts.beforeStart) {
    const beforeStart = Date.now();
    await opts.beforeStart(channelId);
    slog.info({ channelId, type, elapsedMs: Date.now() - beforeStart }, "beforeStart complete");
  }

  const cleanupStart = Date.now();
  await cleanupStaleJobs(channelId, type);
  slog.info({ channelId, type, elapsedMs: Date.now() - cleanupStart }, "Stale job cleanup complete");

  const existing = await findExistingJob(channelId, type);
  if (existing) {
    slog.info({ channelId, type, jobId: existing.id, status: existing.status, elapsedMs: Date.now() - start }, "Existing job found");
    return NextResponse.json({
      jobId: existing.id,
      status: existing.status,
      message: "Sync already in progress",
    });
  }

  const jobId = crypto.randomUUID();
  await db.insert(syncJobs).values({
    id: jobId,
    channelId,
    type,
    status: "pending",
    progress: { phase: "queued", fetched: 0 },
  });
  slog.info({ channelId, type, jobId, elapsedMs: Date.now() - start }, "Job created");

  if (email) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (user) {
      await incrementSyncUsage(user.id);
    }
  }

  opts.run(channelId, jobId).catch((err) => {
    slog.error({ err, channelId, type, jobId }, "Sync job failed");
  });

  return NextResponse.json({ jobId, status: "running" });
}
