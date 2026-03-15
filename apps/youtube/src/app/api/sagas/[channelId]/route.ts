import { db } from "@/db";
import { sagaCorrections, sagas, videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { handleRouteError } from "@/lib/errors";
import { validateChannelId } from "@/lib/validation";
import type { Saga, SagaSource } from "@/types/youtube";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

const MAX_SAGAS = 200;
const MAX_VIDEO_IDS_PER_SAGA = 2000;

function toSaga(row: typeof sagas.$inferSelect): Saga {
  return {
    id: row.id,
    name: row.name,
    source: row.source,
    playlistId: row.playlistId ?? undefined,
    videoIds: row.videoIds,
    videoCount: row.videoCount,
    dateRange: row.dateRange,
    reasoning: row.reasoning ?? undefined,
    videoEvidence: row.videoEvidence ?? undefined,
  };
}

async function getAllSagas(channelId: string): Promise<Saga[]> {
  const rows = await db
    .select()
    .from(sagas)
    .where(eq(sagas.channelId, channelId))
    .orderBy(sagas.createdAt);
  return rows.map(toSaga);
}

async function computeDateRange(
  videoIds: string[]
): Promise<{ first: string; last: string }> {
  if (videoIds.length === 0) return { first: "", last: "" };
  const rows = await db
    .select({ publishedAt: videos.publishedAt })
    .from(videos)
    .where(inArray(videos.id, videoIds))
    .orderBy(videos.publishedAt);
  if (rows.length === 0) return { first: "", last: "" };
  return {
    first: rows[0].publishedAt.toISOString(),
    last: rows[rows.length - 1].publishedAt.toISOString(),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await params;
  console.log(`[Sagas] GET channelId=${channelId}`);
  const v = validateChannelId(channelId);
  if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });
  const result = await getAllSagas(channelId);
  console.log(`[Sagas] GET channelId=${channelId} sagaCount=${result.length}`);
  return NextResponse.json(result);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { channelId } = await params;
    const body = (await request.json()) as {
      sagas: Saga[];
      source?: SagaSource | "replace-all";
    };

    const v = validateChannelId(channelId);
    if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });

    const incomingSagas = body.sagas ?? (body as unknown as Saga[]);
    const source = body.source ?? "replace-all";
    const toUpsert = (Array.isArray(incomingSagas) ? incomingSagas : []).slice(0, MAX_SAGAS);
    console.log(`[Sagas] PUT channelId=${channelId} incomingCount=${toUpsert.length} source=${source}`);

    for (const s of toUpsert) {
      if (Array.isArray(s.videoIds) && s.videoIds.length > MAX_VIDEO_IDS_PER_SAGA) {
        s.videoIds = s.videoIds.slice(0, MAX_VIDEO_IDS_PER_SAGA);
        s.videoCount = s.videoIds.length;
      }
    }

    for (let i = 0; i < toUpsert.length; i += 50) {
      const chunk = toUpsert.slice(i, i + 50);
      await db
        .insert(sagas)
        .values(
          chunk.map((s) => ({
            id: s.id,
            channelId,
            name: s.name,
            source: s.source,
            playlistId: s.playlistId ?? null,
            videoIds: s.videoIds,
            videoCount: s.videoCount,
            dateRange: s.dateRange,
            reasoning: s.reasoning ?? null,
            videoEvidence: s.videoEvidence ?? null,
          }))
        )
        .onConflictDoUpdate({
          target: sagas.id,
          set: {
            name: sql`excluded.name`,
            source: sql`excluded.source`,
            playlistId: sql`excluded.playlist_id`,
            videoIds: sql`excluded.video_ids`,
            videoCount: sql`excluded.video_count`,
            dateRange: sql`excluded.date_range`,
            reasoning: sql`excluded.reasoning`,
            videoEvidence: sql`excluded.video_evidence`,
          },
        });
    }

    const incomingIds = toUpsert.map((s) => s.id);
    let deletedStaleCount = 0;
    if (incomingIds.length > 0) {
      const deleteWhere =
        source === "replace-all"
          ? and(
            eq(sagas.channelId, channelId),
            notInArray(sagas.id, incomingIds)
          )
          : and(
            eq(sagas.channelId, channelId),
            eq(sagas.source, source),
            notInArray(sagas.id, incomingIds)
          );
      const staleRows = await db.select({ id: sagas.id }).from(sagas).where(deleteWhere);
      deletedStaleCount = staleRows.length;
      await db.delete(sagas).where(deleteWhere);
    }

    const result = await getAllSagas(channelId);
    console.log(`[Sagas] PUT channelId=${channelId} upsertedCount=${toUpsert.length} deletedStaleCount=${deletedStaleCount}`);
    return NextResponse.json({ saved: toUpsert.length, sagas: result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`[Sagas] PUT Error: ${errMsg}`);
    if (errStack) console.error(`[Sagas] Stack: ${errStack}`);
    return handleRouteError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { channelId } = await params;
    const { searchParams } = new URL(request.url);
    const source = searchParams.get("source") as SagaSource | null;
    console.log(`[Sagas] DELETE channelId=${channelId} sourceFilter=${source ?? "all"}`);

    let deletedCount = 0;
    if (source) {
      const toDelete = await db.select({ id: sagas.id }).from(sagas).where(and(eq(sagas.channelId, channelId), eq(sagas.source, source)));
      deletedCount = toDelete.length;
      await db.delete(sagas).where(and(eq(sagas.channelId, channelId), eq(sagas.source, source)));
    } else {
      const toDelete = await db.select({ id: sagas.id }).from(sagas).where(eq(sagas.channelId, channelId));
      deletedCount = toDelete.length;
      await db.delete(sagas).where(eq(sagas.channelId, channelId));
    }
    console.log(`[Sagas] DELETE channelId=${channelId} deletedCount=${deletedCount}`);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`[Sagas] DELETE Error: ${errMsg}`);
    if (errStack) console.error(`[Sagas] Stack: ${errStack}`);
    return handleRouteError(error);
  }
}

async function removeVideosFromOtherSagas(
  channelId: string,
  videoIds: string[],
  excludeSagaId?: string
) {
  const rows = await db
    .select()
    .from(sagas)
    .where(eq(sagas.channelId, channelId));

  const videoIdSet = new Set(videoIds);
  const affectedSagas: Array<{ id: string; newIds: string[] }> = [];

  for (const row of rows) {
    if (row.id === excludeSagaId) continue;
    const hasOverlap = row.videoIds.some((id) => videoIdSet.has(id));
    if (!hasOverlap) continue;
    const newIds = row.videoIds.filter((id) => !videoIdSet.has(id));
    affectedSagas.push({ id: row.id, newIds });
  }

  if (affectedSagas.length > 0) {
    const allVideoIds = [...new Set(affectedSagas.flatMap((s) => s.newIds))];
    const dateRows = allVideoIds.length > 0
      ? await db
          .select({ id: videos.id, publishedAt: videos.publishedAt })
          .from(videos)
          .where(inArray(videos.id, allVideoIds))
      : [];
    const publishMap = new Map(dateRows.map((r) => [r.id, r.publishedAt.toISOString()]));

    for (const { id, newIds } of affectedSagas) {
      const dates = newIds
        .map((vid) => publishMap.get(vid))
        .filter((d): d is string => !!d)
        .sort((a, b) => a.localeCompare(b));
      const dateRange = dates.length > 0
        ? { first: dates[0], last: dates.at(-1)! }
        : { first: "", last: "" };
      await db
        .update(sagas)
        .set({ videoIds: newIds, videoCount: newIds.length, dateRange })
        .where(eq(sagas.id, id));
    }
  }

  return rows;
}

async function handleAssign(
  channelId: string,
  videoIds: string[],
  sagaId: string
) {
  const allRows = await removeVideosFromOtherSagas(channelId, videoIds, sagaId);

  const target = allRows.find((r) => r.id === sagaId);
  if (target) {
    const merged = [...new Set([...target.videoIds, ...videoIds])];
    const dateRange = await computeDateRange(merged);
    await db
      .update(sagas)
      .set({ videoIds: merged, videoCount: merged.length, dateRange })
      .where(and(eq(sagas.id, sagaId), eq(sagas.channelId, channelId)));
  }
}

async function handleUnassign(
  channelId: string,
  videoIds: string[],
  sagaId: string
) {
  const [target] = await db
    .select()
    .from(sagas)
    .where(and(eq(sagas.id, sagaId), eq(sagas.channelId, channelId)))
    .limit(1);

  if (target) {
    const newIds = target.videoIds.filter((id) => !videoIds.includes(id));
    const dateRange = await computeDateRange(newIds);
    await db
      .update(sagas)
      .set({ videoIds: newIds, videoCount: newIds.length, dateRange })
      .where(and(eq(sagas.id, sagaId), eq(sagas.channelId, channelId)));
  }
}

async function handleCreateSaga(
  channelId: string,
  name: string,
  videoIds: string[]
) {
  await removeVideosFromOtherSagas(channelId, videoIds);

  const dateRange = await computeDateRange(videoIds);
  const id = `manual-${Date.now()}-${name.toLowerCase().replaceAll(/\s+/g, "-").slice(0, 30)}`;
  await db.insert(sagas).values({
    id,
    channelId,
    name,
    source: "manual",
    videoIds,
    videoCount: videoIds.length,
    dateRange,
  });
}

async function logCorrections(
  channelId: string,
  action: "assign" | "unassign" | "create",
  videoIds: string[],
  targetSagaId: string | null,
  targetSagaName: string | null,
  neighborContext?: { leftSaga?: { id: string; name: string }; rightSaga?: { id: string; name: string } },
) {
  const videoRows = await db
    .select({ id: videos.id, title: videos.title, publishedAt: videos.publishedAt })
    .from(videos)
    .where(inArray(videos.id, videoIds));

  const rows = videoRows.map((v) => ({
    id: crypto.randomUUID(),
    channelId,
    action,
    videoId: v.id,
    videoTitle: v.title,
    videoPublishedAt: v.publishedAt,
    targetSagaId,
    targetSagaName,
    neighborContext: neighborContext ?? null,
  }));

  if (rows.length > 0) {
    await db.insert(sagaCorrections).values(rows);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { channelId } = await params;
    const cv = validateChannelId(channelId);
    if (!cv.valid) return NextResponse.json({ error: cv.error }, { status: 400 });

    const body = await request.json();
    const { action, neighborContext } = body as {
      action: string;
      neighborContext?: { leftSaga?: { id: string; name: string }; rightSaga?: { id: string; name: string } };
    };

    if (action === "assign") {
      const { videoIds, sagaId } = body as { videoIds: string[]; sagaId: string };
      console.log(`[Sagas] PATCH channelId=${channelId} action=assign sagaId=${sagaId} videoIdsCount=${videoIds?.length ?? 0}`);
      if (!sagaId || !Array.isArray(videoIds) || videoIds.length === 0) {
        return NextResponse.json({ error: "Missing sagaId or videoIds" }, { status: 400 });
      }
      const clipped = videoIds.slice(0, MAX_VIDEO_IDS_PER_SAGA);
      await handleAssign(channelId, clipped, sagaId);
      const [targetRow] = await db.select({ name: sagas.name }).from(sagas).where(eq(sagas.id, sagaId)).limit(1);
      logCorrections(channelId, "assign", clipped, sagaId, targetRow?.name ?? null, neighborContext).catch(console.error);
    } else if (action === "unassign") {
      const { videoIds, sagaId } = body as { videoIds: string[]; sagaId: string };
      console.log(`[Sagas] PATCH channelId=${channelId} action=unassign sagaId=${sagaId} videoIdsCount=${videoIds?.length ?? 0}`);
      if (!sagaId || !Array.isArray(videoIds) || videoIds.length === 0) {
        return NextResponse.json({ error: "Missing sagaId or videoIds" }, { status: 400 });
      }
      const clipped = videoIds.slice(0, MAX_VIDEO_IDS_PER_SAGA);
      const [targetRow] = await db.select({ name: sagas.name }).from(sagas).where(eq(sagas.id, sagaId)).limit(1);
      await handleUnassign(channelId, clipped, sagaId);
      logCorrections(channelId, "unassign", clipped, sagaId, targetRow?.name ?? null, neighborContext).catch(console.error);
    } else if (action === "create") {
      const { name, videoIds } = body as { name: string; videoIds: string[] };
      console.log(`[Sagas] PATCH channelId=${channelId} action=create name=${name ?? ""} videoIdsCount=${videoIds?.length ?? 0}`);
      if (!name?.trim() || !Array.isArray(videoIds) || videoIds.length === 0) {
        return NextResponse.json({ error: "Missing name or videoIds" }, { status: 400 });
      }
      const clipped = videoIds.slice(0, MAX_VIDEO_IDS_PER_SAGA);
      await handleCreateSaga(channelId, name.trim(), clipped);
      logCorrections(channelId, "create", clipped, null, name.trim(), neighborContext).catch(console.error);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const result = await getAllSagas(channelId);
    return NextResponse.json({ sagas: result });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`[Sagas] PATCH Error: ${errMsg}`);
    if (errStack) console.error(`[Sagas] Stack: ${errStack}`);
    return handleRouteError(error);
  }
}
