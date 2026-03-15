import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sagas, videos } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { handleRouteError } from "@/lib/errors";
import { fetchChannelPlaylists, fetchPlaylistVideoIds } from "@/lib/youtube-server";
import type { Saga } from "@/types/youtube";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;

  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  console.log(`[Sync Playlists] POST channelId=${channelId}`);

  try {
    const playlists = await fetchChannelPlaylists(channelId);
    console.log(`[Sync Playlists] channelId=${channelId} playlistCount=${playlists.length}`);

    const channelVideoRows = await db
      .select({ id: videos.id, publishedAt: videos.publishedAt })
      .from(videos)
      .where(eq(videos.channelId, channelId));

    const channelVideoIds = new Set(channelVideoRows.map((r) => r.id));
    const publishMap = new Map(channelVideoRows.map((r) => [r.id, r.publishedAt.toISOString()]));
    console.log(`[Sync Playlists] channelId=${channelId} channelVideoCount=${channelVideoIds.size}`);

    const playlistSagas: Saga[] = [];

    for (const pl of playlists) {
      const videoIds = await fetchPlaylistVideoIds(pl.playlistId);
      const matched = videoIds.filter((id) => channelVideoIds.has(id));
      if (matched.length > 0) {
        console.log(`[Sync Playlists] channelId=${channelId} playlistId=${pl.playlistId} matchedCount=${matched.length}`);
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

    console.log(`[Sync Playlists] channelId=${channelId} sagasCreated=${playlistSagas.length}`);
    return NextResponse.json(playlistSagas);
  } catch (error) {
    return handleRouteError(error);
  }
}
