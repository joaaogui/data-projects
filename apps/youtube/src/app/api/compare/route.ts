import { db } from "@/db";
import { channels, videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const channelIds = request.nextUrl.searchParams.get("channels")?.split(",").filter(Boolean) ?? [];
  if (channelIds.length < 2 || channelIds.length > 5) {
    return NextResponse.json({ error: "Provide 2-5 channel IDs" }, { status: 400 });
  }

  const channelRows = await db
    .select()
    .from(channels)
    .where(inArray(channels.id, channelIds));

  const statsRows = await db
    .select({
      channelId: videos.channelId,
      videoCount: sql<number>`count(*)::int`,
      totalViews: sql<number>`coalesce(sum(${videos.views}), 0)::bigint`,
      avgScore: sql<number>`round(avg(${videos.score})::numeric, 1)`,
      avgEngagement: sql<number>`round(avg((${videos.rates}->>'engagementRate')::numeric), 1)`,
      topVideoTitle: sql<string>`(array_agg(${videos.title} order by ${videos.score} desc))[1]`,
      topVideoScore: sql<number>`max(${videos.score})`,
      topVideoThumbnail: sql<string>`(array_agg(${videos.thumbnail} order by ${videos.score} desc))[1]`,
      topVideoId: sql<string>`(array_agg(${videos.id} order by ${videos.score} desc))[1]`,
    })
    .from(videos)
    .where(inArray(videos.channelId, channelIds))
    .groupBy(videos.channelId);

  const results = channelIds.map((id) => {
    const ch = channelRows.find((r) => r.id === id);
    const stats = statsRows.find((r) => r.channelId === id);
    return {
      channelId: id,
      title: ch?.title ?? id,
      thumbnailUrl: ch?.thumbnailUrl ?? null,
      subscriberCount: (ch as Record<string, unknown>)?.subscriberCount ?? null,
      videoCount: stats?.videoCount ?? 0,
      totalViews: Number(stats?.totalViews ?? 0),
      avgScore: stats?.avgScore ?? 0,
      avgEngagement: stats?.avgEngagement ?? 0,
      topVideo: stats
        ? {
            id: stats.topVideoId,
            title: stats.topVideoTitle,
            score: stats.topVideoScore,
            thumbnail: stats.topVideoThumbnail,
          }
        : null,
    };
  });

  return NextResponse.json({ channels: results });
}
