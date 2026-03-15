import { db } from "@/db";
import { channelSnapshots, channels } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import dayjs from "dayjs";

export async function captureChannelSnapshot(channelId: string): Promise<void> {
  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) return;

  const subscriberCount = (channel as Record<string, unknown>).subscriberCount as number | null;
  const viewCount = (channel as Record<string, unknown>).totalViewCount as number | null;
  const videoCount = (channel as Record<string, unknown>).videoCount as number | null;

  if (!subscriberCount && !viewCount) return;

  const [lastSnapshot] = await db
    .select()
    .from(channelSnapshots)
    .where(eq(channelSnapshots.channelId, channelId))
    .orderBy(desc(channelSnapshots.snapshotDate))
    .limit(1);

  if (lastSnapshot && dayjs().diff(dayjs(lastSnapshot.snapshotDate), "hour") < 12) {
    return;
  }

  await db.insert(channelSnapshots).values({
    id: `${channelId}-${Date.now()}`,
    channelId,
    subscriberCount: subscriberCount ?? null,
    viewCount: viewCount ?? null,
    videoCount: videoCount ?? null,
  });
}

export async function getChannelGrowth(channelId: string) {
  const snapshots = await db
    .select()
    .from(channelSnapshots)
    .where(eq(channelSnapshots.channelId, channelId))
    .orderBy(channelSnapshots.snapshotDate)
    .limit(100);

  return snapshots.map((s) => ({
    date: s.snapshotDate.toISOString(),
    subscriberCount: s.subscriberCount,
    viewCount: s.viewCount,
    videoCount: s.videoCount,
  }));
}
