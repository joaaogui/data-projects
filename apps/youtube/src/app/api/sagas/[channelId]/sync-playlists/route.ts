import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sagas, videos } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { fetchChannelPlaylists, fetchPlaylistVideoIds } from "@/lib/youtube-server";
import type { Saga } from "@/types/youtube";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;

  try {
    const playlists = await fetchChannelPlaylists(channelId);

    const channelVideoRows = await db
      .select({ id: videos.id, publishedAt: videos.publishedAt })
      .from(videos)
      .where(eq(videos.channelId, channelId));

    const channelVideoIds = new Set(channelVideoRows.map((r) => r.id));
    const publishMap = new Map(channelVideoRows.map((r) => [r.id, r.publishedAt.toISOString()]));

    const playlistSagas: Saga[] = [];

    for (const pl of playlists) {
      const videoIds = await fetchPlaylistVideoIds(pl.playlistId);
      const matched = videoIds.filter((id) => channelVideoIds.has(id));
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

    return NextResponse.json(playlistSagas);
  } catch (error) {
    console.error("[Sync Playlists] Error:", error);
    return NextResponse.json(
      { error: "Failed to sync playlists" },
      { status: 500 }
    );
  }
}
