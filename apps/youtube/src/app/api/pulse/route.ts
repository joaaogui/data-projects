import { db } from "@/db";
import { channels, savedChannels, videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { withErrorHandling } from "@/lib/route-handler";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = withErrorHandling("pulse:GET", async () => {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const tracked = await db
    .select({
      channelId: savedChannels.channelId,
      label: savedChannels.label,
      pinned: savedChannels.pinned,
      lastVisitedAt: savedChannels.lastVisitedAt,
      channelTitle: channels.title,
      thumbnailUrl: channels.thumbnailUrl,
      subscriberCount: channels.subscriberCount,
      totalViewCount: channels.totalViewCount,
      videoCount: channels.videoCount,
      fetchedAt: channels.fetchedAt,
    })
    .from(savedChannels)
    .innerJoin(channels, eq(savedChannels.channelId, channels.id))
    .where(eq(savedChannels.userId, session.user.email))
    .orderBy(desc(savedChannels.pinned), desc(savedChannels.lastVisitedAt))
    .limit(50);

  if (tracked.length === 0) {
    return NextResponse.json({ channels: [], feed: [], summary: null });
  }

  const feedItems: FeedItem[] = [];

  for (const ch of tracked) {
    await collectChannelFeedItems(ch, feedItems);
  }

  feedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const summary = await buildSummary(tracked, feedItems);

  return NextResponse.json({
    channels: tracked.map((t) => ({
      channelId: t.channelId,
      channelTitle: t.channelTitle,
      thumbnailUrl: t.thumbnailUrl,
      subscriberCount: t.subscriberCount,
      totalViewCount: t.totalViewCount,
      videoCount: t.videoCount,
      label: t.label,
      pinned: t.pinned,
      lastVisitedAt: t.lastVisitedAt?.toISOString() ?? null,
      fetchedAt: t.fetchedAt?.toISOString() ?? null,
    })),
    feed: feedItems,
    summary,
  });
});

type TrackedRow = {
  channelId: string;
  channelTitle: string | null;
  thumbnailUrl: string | null;
  lastVisitedAt: Date | null;
  subscriberCount: number | null;
  totalViewCount: number | null;
  videoCount: number | null;
  label: string | null;
  pinned: number;
  fetchedAt: Date;
};

async function collectChannelFeedItems(ch: TrackedRow, feedItems: FeedItem[]) {
  const lastVisit = ch.lastVisitedAt ?? new Date(0);
  const title = ch.channelTitle ?? ch.channelId;

  const newVids = await db
    .select({
      id: videos.id,
      title: videos.title,
      publishedAt: videos.publishedAt,
      views: videos.views,
      score: videos.score,
      thumbnail: videos.thumbnail,
    })
    .from(videos)
    .where(and(eq(videos.channelId, ch.channelId), gt(videos.fetchedAt, lastVisit)))
    .orderBy(desc(videos.publishedAt))
    .limit(10);

  if (newVids.length > 0) {
    const topNew = newVids.reduce((best, v) => (v.score > best.score ? v : best), newVids[0]);
    feedItems.push({
      type: "new_videos",
      channelId: ch.channelId,
      channelTitle: title,
      thumbnailUrl: ch.thumbnailUrl,
      count: newVids.length,
      topVideo: { id: topNew.id, title: topNew.title, score: topNew.score, views: topNew.views, thumbnail: topNew.thumbnail },
      timestamp: newVids[0].publishedAt.toISOString(),
    });
  }

  const allScores = await db
    .select({ score: videos.score, publishedAt: videos.publishedAt })
    .from(videos)
    .where(eq(videos.channelId, ch.channelId))
    .orderBy(desc(videos.publishedAt));

  if (allScores.length >= 5) {
    collectScoreAlerts(ch, title, allScores, feedItems);
    await collectBreakouts(ch, title, allScores, feedItems);
  }

  if (allScores.length > 0) {
    collectHiatus(ch, title, allScores[0], feedItems);
  }
}

function collectScoreAlerts(
  ch: TrackedRow,
  title: string,
  allScores: { score: number; publishedAt: Date }[],
  feedItems: FeedItem[]
) {
  const avgScore = allScores.reduce((s, v) => s + v.score, 0) / allScores.length;
  const recent5 = allScores.slice(0, 5);
  const recentAvg = recent5.reduce((s, v) => s + v.score, 0) / recent5.length;
  const diff = recentAvg - avgScore;

  if (Math.abs(diff) > 10) {
    feedItems.push({
      type: "score_alert",
      channelId: ch.channelId,
      channelTitle: title,
      thumbnailUrl: ch.thumbnailUrl,
      avgScore: Math.round(avgScore * 10) / 10,
      recentAvg: Math.round(recentAvg * 10) / 10,
      direction: diff > 0 ? "up" : "down",
      delta: Math.round(Math.abs(diff) * 10) / 10,
      timestamp: recent5[0].publishedAt.toISOString(),
    });
  }
}

async function collectBreakouts(
  ch: TrackedRow,
  title: string,
  allScores: { score: number; publishedAt: Date }[],
  feedItems: FeedItem[]
) {
  const avgScore = allScores.reduce((s, v) => s + v.score, 0) / allScores.length;
  const recent5 = allScores.slice(0, 5);
  const topRecent = recent5.reduce((best, v) => (v.score > best.score ? v : best), recent5[0]);

  if (topRecent.score < 80 || topRecent.score <= avgScore + 20) return;

  const [topVid] = await db
    .select({ id: videos.id, title: videos.title, score: videos.score, views: videos.views, thumbnail: videos.thumbnail })
    .from(videos)
    .where(and(eq(videos.channelId, ch.channelId), eq(videos.score, topRecent.score)))
    .limit(1);

  if (topVid) {
    feedItems.push({
      type: "breakout",
      channelId: ch.channelId,
      channelTitle: title,
      thumbnailUrl: ch.thumbnailUrl,
      video: { id: topVid.id, title: topVid.title, score: topVid.score, views: topVid.views, thumbnail: topVid.thumbnail },
      channelAvg: Math.round(avgScore * 10) / 10,
      timestamp: topRecent.publishedAt.toISOString(),
    });
  }
}

function collectHiatus(
  ch: TrackedRow,
  title: string,
  latest: { publishedAt: Date },
  feedItems: FeedItem[]
) {
  const daysSince = Math.floor((Date.now() - latest.publishedAt.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince > 30) {
    feedItems.push({
      type: "hiatus",
      channelId: ch.channelId,
      channelTitle: title,
      thumbnailUrl: ch.thumbnailUrl,
      daysSinceUpload: daysSince,
      timestamp: latest.publishedAt.toISOString(),
    });
  }
}

async function buildSummary(tracked: TrackedRow[], feedItems: FeedItem[]) {
  let totalNewVideos = 0;
  for (const item of feedItems) {
    if (item.type === "new_videos") totalNewVideos += item.count;
  }

  let totalAvgScore = 0;
  let channelsWithScores = 0;

  for (const ch of tracked) {
    const [row] = await db
      .select({ avg: sql<number>`COALESCE(AVG(${videos.score}), 0)` })
      .from(videos)
      .where(eq(videos.channelId, ch.channelId));

    if (row && row.avg > 0) {
      totalAvgScore += row.avg;
      channelsWithScores++;
    }
  }

  return {
    totalTracked: tracked.length,
    totalNewVideos,
    avgScoreAcrossChannels: channelsWithScores > 0
      ? Math.round((totalAvgScore / channelsWithScores) * 10) / 10
      : 0,
    alerts: feedItems.filter((i) => i.type === "score_alert" || i.type === "breakout").length,
  };
}

type FeedItem =
  | {
    type: "new_videos";
    channelId: string;
    channelTitle: string;
    thumbnailUrl: string | null;
    count: number;
    topVideo: { id: string; title: string; score: number; views: number; thumbnail: string };
    timestamp: string;
  }
  | {
    type: "score_alert";
    channelId: string;
    channelTitle: string;
    thumbnailUrl: string | null;
    avgScore: number;
    recentAvg: number;
    direction: "up" | "down";
    delta: number;
    timestamp: string;
  }
  | {
    type: "breakout";
    channelId: string;
    channelTitle: string;
    thumbnailUrl: string | null;
    video: { id: string; title: string; score: number; views: number; thumbnail: string };
    channelAvg: number;
    timestamp: string;
  }
  | {
    type: "hiatus";
    channelId: string;
    channelTitle: string;
    thumbnailUrl: string | null;
    daysSinceUpload: number;
    timestamp: string;
  };
