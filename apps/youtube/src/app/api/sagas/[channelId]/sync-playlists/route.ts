import { db } from "@/db";
import { sagas, videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { fetchChannelPlaylists, fetchPlaylistVideoIds } from "@/lib/youtube-server";
import type { Saga } from "@/types/youtube";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const log = createTaggedLogger("sync-playlists");

export const POST = withErrorHandling("sync-playlists:POST", async (_request, { params }) => {
  const { channelId } = await params;

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  log.info({ channelId }, "POST");

  const playlists = await fetchChannelPlaylists(channelId);
  log.info({ channelId, playlistCount: playlists.length }, "fetched playlists");

  const channelVideoRows = await db
    .select({ id: videos.id, publishedAt: videos.publishedAt })
    .from(videos)
    .where(eq(videos.channelId, channelId));

  const channelVideoIds = new Set(channelVideoRows.map((r) => r.id));
  const publishMap = new Map(channelVideoRows.map((r) => [r.id, r.publishedAt.toISOString()]));
  log.info({ channelId, channelVideoCount: channelVideoIds.size }, "loaded channel videos");

  const playlistSagas: Saga[] = [];

  for (const pl of playlists) {
    const videoIds = await fetchPlaylistVideoIds(pl.playlistId);
    const matched = videoIds.filter((id) => channelVideoIds.has(id));
    if (matched.length > 0) {
      log.debug({ channelId, playlistId: pl.playlistId, matchedCount: matched.length }, "playlist matched");
    }
    if (matched.length === 0) continue;

    const dates = matched
      .map((id) => publishMap.get(id))
      .filter((d): d is string => Boolean(d))
      .sort((a, b) => a.localeCompare(b));

    playlistSagas.push({
      id: `playlist-${pl.playlistId}`,
      name: pl.title,
      source: "playlist",
      playlistId: pl.playlistId,
      videoIds: matched,
      videoCount: matched.length,
      dateRange: {
        first: dates[0] ?? "",
        last: dates.at(-1) ?? "",
      },
    });
  }

  await db.delete(sagas).where(
    and(eq(sagas.channelId, channelId), eq(sagas.source, "playlist"))
  );

  if (playlistSagas.length > 0) {
    await db.insert(sagas).values(
      playlistSagas.map((s) => ({
        id: s.id,
        channelId,
        name: s.name,
        source: s.source,
        playlistId: s.playlistId ?? null,
        videoIds: s.videoIds,
        videoCount: s.videoCount,
        dateRange: s.dateRange,
      }))
    );
  }

  log.info({ channelId, sagasCreated: playlistSagas.length }, "POST complete");
  return NextResponse.json(playlistSagas);
});
