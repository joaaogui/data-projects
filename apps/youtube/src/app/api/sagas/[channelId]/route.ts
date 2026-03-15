import { db } from "@/db";
import { sagas, videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { handleRouteError } from "@/lib/errors";
import { validateChannelId } from "@/lib/validation";
import type { Saga, SagaSource } from "@/types/youtube";
import { and, eq, inArray, notInArray } from "drizzle-orm";
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
  const v = validateChannelId(channelId);
  if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });
  return NextResponse.json(await getAllSagas(channelId));
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

    for (const s of toUpsert) {
      if (Array.isArray(s.videoIds) && s.videoIds.length > MAX_VIDEO_IDS_PER_SAGA) {
        s.videoIds = s.videoIds.slice(0, MAX_VIDEO_IDS_PER_SAGA);
        s.videoCount = s.videoIds.length;
      }
    }

    for (const s of toUpsert) {
      await db
        .insert(sagas)
        .values({
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
        })
        .onConflictDoUpdate({
          target: sagas.id,
          set: {
            name: s.name,
            source: s.source,
            playlistId: s.playlistId ?? null,
            videoIds: s.videoIds,
            videoCount: s.videoCount,
            dateRange: s.dateRange,
            reasoning: s.reasoning ?? null,
            videoEvidence: s.videoEvidence ?? null,
          },
        });
    }

    const incomingIds = toUpsert.map((s) => s.id);
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
      await db.delete(sagas).where(deleteWhere);
    }

    const result = await getAllSagas(channelId);
    return NextResponse.json({ saved: toUpsert.length, sagas: result });
  } catch (error) {
    console.error("[Sagas PUT] Error:", error);
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

    if (source) {
      await db
        .delete(sagas)
        .where(and(eq(sagas.channelId, channelId), eq(sagas.source, source)));
    } else {
      await db.delete(sagas).where(eq(sagas.channelId, channelId));
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("[Sagas DELETE] Error:", error);
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

  for (const row of rows) {
    if (row.id === excludeSagaId) continue;
    const overlap = row.videoIds.filter((id) => videoIds.includes(id));
    if (overlap.length === 0) continue;
    const newIds = row.videoIds.filter((id) => !videoIds.includes(id));
    const dateRange = await computeDateRange(newIds);
    await db
      .update(sagas)
      .set({ videoIds: newIds, videoCount: newIds.length, dateRange })
      .where(eq(sagas.id, row.id));
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
    const { action } = body as { action: string };

    if (action === "assign") {
      const { videoIds, sagaId } = body as { videoIds: string[]; sagaId: string };
      if (!sagaId || !Array.isArray(videoIds) || videoIds.length === 0) {
        return NextResponse.json({ error: "Missing sagaId or videoIds" }, { status: 400 });
      }
      await handleAssign(channelId, videoIds.slice(0, MAX_VIDEO_IDS_PER_SAGA), sagaId);
    } else if (action === "unassign") {
      const { videoIds, sagaId } = body as { videoIds: string[]; sagaId: string };
      if (!sagaId || !Array.isArray(videoIds) || videoIds.length === 0) {
        return NextResponse.json({ error: "Missing sagaId or videoIds" }, { status: 400 });
      }
      await handleUnassign(channelId, videoIds.slice(0, MAX_VIDEO_IDS_PER_SAGA), sagaId);
    } else if (action === "create") {
      const { name, videoIds } = body as { name: string; videoIds: string[] };
      if (!name?.trim() || !Array.isArray(videoIds) || videoIds.length === 0) {
        return NextResponse.json({ error: "Missing name or videoIds" }, { status: 400 });
      }
      await handleCreateSaga(channelId, name.trim(), videoIds.slice(0, MAX_VIDEO_IDS_PER_SAGA));
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const result = await getAllSagas(channelId);
    return NextResponse.json({ sagas: result });
  } catch (error) {
    console.error("[Sagas PATCH] Error:", error);
    return handleRouteError(error);
  }
}
