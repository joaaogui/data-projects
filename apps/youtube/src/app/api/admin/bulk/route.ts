import { db } from "@/db";
import { channels, sagas, syncJobs, transcripts, videos } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { bulkRequestSchema } from "@/lib/schemas";
import { syncChannelTranscripts } from "@/lib/sync-transcripts";
import { syncChannelVideos } from "@/lib/sync-videos";
import type { CleanupAction } from "@/types/admin";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

const log = createTaggedLogger("admin-bulk");

async function startBulkSync(channelIds: string[], type: "videos" | "transcripts") {
  let started = 0;

  for (const channelId of channelIds) {
    const existing = await db
      .select()
      .from(syncJobs)
      .where(and(eq(syncJobs.channelId, channelId), eq(syncJobs.type, type), inArray(syncJobs.status, ["pending", "running"])))
      .limit(1);

    if (existing.length > 0) continue;

    await db.insert(channels).values({ id: channelId, title: channelId, fetchedAt: new Date() }).onConflictDoNothing();

    const jobId = crypto.randomUUID();
    await db.insert(syncJobs).values({ id: jobId, channelId, type, status: "pending", progress: { phase: "queued", fetched: 0 } });

    if (type === "videos") {
      syncChannelVideos(channelId, jobId).catch((err) => {
        log.error({ err, channelId }, "Video sync failed");
      });
    } else if (type === "transcripts") {
      syncChannelTranscripts(channelId, jobId).catch((err) => {
        log.error({ err, channelId }, "Transcript sync failed");
      });
    }
    started++;
  }

  return started;
}

async function deleteForChannel(action: CleanupAction, channelId: string): Promise<number> {
  return db.transaction(async (tx) => {
    switch (action) {
      case "delete-transcripts": {
        const videoIds = await tx.select({ id: videos.id }).from(videos).where(eq(videos.channelId, channelId));
        const ids = videoIds.map((r) => r.id);
        if (ids.length === 0) return 0;
        const result = await tx.delete(transcripts).where(inArray(transcripts.videoId, ids));
        return result.rowCount ?? 0;
      }
      case "delete-sagas": {
        const result = await tx.delete(sagas).where(eq(sagas.channelId, channelId));
        return result.rowCount ?? 0;
      }
      case "delete-ai-sagas": {
        const result = await tx.delete(sagas).where(and(eq(sagas.channelId, channelId), eq(sagas.source, "ai-detected")));
        return result.rowCount ?? 0;
      }
      case "delete-videos": {
        const result = await tx.delete(videos).where(eq(videos.channelId, channelId));
        return result.rowCount ?? 0;
      }
      case "delete-channel": {
        const result = await tx.delete(channels).where(eq(channels.id, channelId));
        return result.rowCount ?? 0;
      }
      default:
        return 0;
    }
  });
}

export const POST = withErrorHandling("admin-bulk", async (req, _ctx) => {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const parsed = bulkRequestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { action, channelIds } = parsed.data;
  log.info({ action, channelCount: channelIds.length }, "Bulk request");

  if (action === "sync-videos" || action === "sync-transcripts") {
    const type = action === "sync-videos" ? "videos" : "transcripts";
    const started = await startBulkSync(channelIds, type);
    log.info({ action, started, total: channelIds.length }, "Bulk sync started");
    return NextResponse.json({ action, started, total: channelIds.length });
  }

  let totalDeleted = 0;
  for (const channelId of channelIds) {
    totalDeleted += await deleteForChannel(action as CleanupAction, channelId);
  }

  log.info({ action, deleted: totalDeleted, total: channelIds.length }, "Bulk delete complete");
  return NextResponse.json({ action, deleted: totalDeleted, total: channelIds.length });
});
