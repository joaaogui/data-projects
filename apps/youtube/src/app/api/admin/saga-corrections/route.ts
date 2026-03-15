import { db } from "@/db";
import { channels, sagaCorrections } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { withErrorHandling } from "@/lib/route-handler";
import { validateChannelId } from "@/lib/validation";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = withErrorHandling("admin-saga-corrections:GET", async (request) => {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  const channelId = request.nextUrl.searchParams.get("channelId");
  if (channelId) {
    const v = validateChannelId(channelId);
    if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });
  }
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "200");
  const limit = Math.min(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 200, 1000);

  const where = channelId ? eq(sagaCorrections.channelId, channelId) : undefined;

  const rows = await db
    .select({
      id: sagaCorrections.id,
      channelId: sagaCorrections.channelId,
      channelTitle: channels.title,
      action: sagaCorrections.action,
      videoId: sagaCorrections.videoId,
      videoTitle: sagaCorrections.videoTitle,
      videoPublishedAt: sagaCorrections.videoPublishedAt,
      targetSagaId: sagaCorrections.targetSagaId,
      targetSagaName: sagaCorrections.targetSagaName,
      previousSagaId: sagaCorrections.previousSagaId,
      previousSagaName: sagaCorrections.previousSagaName,
      neighborContext: sagaCorrections.neighborContext,
      createdAt: sagaCorrections.createdAt,
    })
    .from(sagaCorrections)
    .leftJoin(channels, eq(sagaCorrections.channelId, channels.id))
    .where(where)
    .orderBy(desc(sagaCorrections.createdAt))
    .limit(limit);

  return NextResponse.json({ corrections: rows });
});
