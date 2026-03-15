import { auth } from "@/lib/auth";
import { validateChannelId } from "@/lib/validation";
import {
  checkSubscription,
  fetchLikedVideoIds,
  fetchUserPlaylists,
} from "@/lib/youtube-account";
import type { AccountChannelData } from "@/types/youtube";
import { NextResponse, type NextRequest } from "next/server";

const MAX_VIDEO_IDS = 5000;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ channelId: string }> },
) {
  const session = await auth();
  const token = (session as Record<string, unknown> | null)?.accessToken as string | undefined;

  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await params;
  const validation = validateChannelId(channelId);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const rawIds: unknown[] = Array.isArray(body.videoIds) ? body.videoIds : [];
  const videoIds: string[] = rawIds.filter((id): id is string => typeof id === "string").slice(0, MAX_VIDEO_IDS);

  try {
    const [likedSet, isSubscribed, allPlaylists] = await Promise.all([
      videoIds.length > 0
        ? fetchLikedVideoIds(token, videoIds)
        : Promise.resolve(new Set<string>()),
      checkSubscription(token, channelId),
      fetchUserPlaylists(token),
    ]);

    console.log("[account-route] liked:", likedSet.size, "| subscribed:", isSubscribed, "| playlists:", allPlaylists.length);

    const videoIdSet = new Set(videoIds);
    const playlists = allPlaylists
      .map((pl) => ({
        ...pl,
        videoIds: pl.videoIds.filter((id) => videoIdSet.has(id)),
      }))
      .filter((pl) => pl.videoIds.length > 0);

    const result: AccountChannelData = {
      isSubscribed,
      likedVideoIds: [...likedSet],
      playlists,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[account-route] ERROR:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
