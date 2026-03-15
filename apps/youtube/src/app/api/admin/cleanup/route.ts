import { db } from "@/db";
import { channels, sagas, suggestionCache, syncJobs, transcripts, videos } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { cleanupSchema } from "@/lib/schemas";
import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

const log = createTaggedLogger("admin-cleanup");

function rowCount(result: { rowCount: number | null }): number {
  return result.rowCount ?? 0;
}

async function deleteTranscripts(channelId?: string): Promise<number> {
  if (!channelId) return rowCount(await db.delete(transcripts));
  const videoIds = await db.select({ id: videos.id }).from(videos).where(eq(videos.channelId, channelId));
  const ids = videoIds.map((r) => r.id);
  if (ids.length === 0) return 0;
  return rowCount(await db.delete(transcripts).where(inArray(transcripts.videoId, ids)));
}

async function deleteSagas(channelId?: string): Promise<number> {
  if (!channelId) return rowCount(await db.delete(sagas));
  return rowCount(await db.delete(sagas).where(eq(sagas.channelId, channelId)));
}

async function deleteAiSagas(channelId?: string): Promise<number> {
  if (!channelId) return rowCount(await db.delete(sagas).where(eq(sagas.source, "ai-detected")));
  return rowCount(await db.delete(sagas).where(and(eq(sagas.channelId, channelId), eq(sagas.source, "ai-detected"))));
}

async function deleteSyncJobs(channelId?: string): Promise<number> {
  if (!channelId) return rowCount(await db.delete(syncJobs));
  return rowCount(await db.delete(syncJobs).where(eq(syncJobs.channelId, channelId)));
}

type CleanupFn = (channelId?: string) => Promise<number>;

const ACTIONS: Record<string, CleanupFn | { fn: CleanupFn; requiresChannel: boolean }> = {
  "delete-transcripts": deleteTranscripts,
  "delete-sagas": deleteSagas,
  "delete-ai-sagas": deleteAiSagas,
  "delete-sync-jobs": deleteSyncJobs,
  "delete-videos": {
    fn: async (channelId) => rowCount(await db.delete(videos).where(eq(videos.channelId, channelId as string))),
    requiresChannel: true,
  },
  "delete-channel": {
    fn: async (channelId) => rowCount(await db.delete(channels).where(eq(channels.id, channelId as string))),
    requiresChannel: true,
  },
  "delete-suggestion-cache": async () => rowCount(await db.delete(suggestionCache)),
  "delete-completed-sync-jobs": async () => rowCount(await db.delete(syncJobs).where(inArray(syncJobs.status, ["completed", "failed"]))),
  "delete-null-transcripts": async () => rowCount(await db.delete(transcripts).where(sql`${transcripts.excerpt} IS NULL AND ${transcripts.fullText} IS NULL`)),
};

export const POST = withErrorHandling("admin-cleanup", async (req, _ctx) => {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const parsed = cleanupSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }
  const { action, channelId } = parsed.data;
  log.info({ action, channelId }, "Cleanup request");

  const handler = ACTIONS[action];
  if (!handler) {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  const { fn, requiresChannel } = typeof handler === "function" ? { fn: handler, requiresChannel: false } : handler;

  if (requiresChannel && !channelId) {
    return NextResponse.json({ error: `channelId required for ${action}` }, { status: 400 });
  }

  const deleted = await fn(channelId);
  log.info({ action, channelId, deleted }, "Cleanup complete");
  return NextResponse.json({ action, channelId, deleted });
});
