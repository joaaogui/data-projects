import { db } from "@/db";
import { channels, sharedReports, videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { withErrorHandling } from "@/lib/route-handler";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const POST = withErrorHandling("share:POST", async (request) => {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await request.json();
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const videoRows = await db
    .select({
      title: videos.title,
      score: videos.score,
      views: videos.views,
      thumbnail: videos.thumbnail,
      engagementRate: sql<number>`(${videos.rates}->>'engagementRate')::numeric`,
    })
    .from(videos)
    .where(eq(videos.channelId, channelId));

  if (videoRows.length === 0) {
    return NextResponse.json({ error: "No videos synced for this channel" }, { status: 400 });
  }

  const totalViews = videoRows.reduce((s, v) => s + v.views, 0);
  const avgScore = videoRows.reduce((s, v) => s + v.score, 0) / videoRows.length;
  const avgEngagement = videoRows.reduce((s, v) => s + (Number(v.engagementRate) || 0), 0) / videoRows.length;

  const scoreDistribution = [0, 0, 0, 0, 0];
  for (const v of videoRows) {
    const bucket = Math.min(4, Math.floor(v.score / 20));
    scoreDistribution[bucket]++;
  }

  const topPerformers = [...videoRows]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((v) => ({ title: v.title, score: v.score, views: v.views, thumbnail: v.thumbnail }));

  const id = crypto.randomUUID().slice(0, 12);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sharedReports).values({
    id,
    channelId,
    channelTitle: channel.title,
    snapshotData: {
      videoCount: videoRows.length,
      totalViews,
      avgScore: Math.round(avgScore * 10) / 10,
      avgEngagement: Math.round(avgEngagement * 10) / 10,
      scoreDistribution,
      topPerformers,
      cadenceLabel: "",
      createdBy: session.user.email,
    },
    expiresAt,
  });

  return NextResponse.json({ reportId: id, expiresAt: expiresAt.toISOString() });
});
