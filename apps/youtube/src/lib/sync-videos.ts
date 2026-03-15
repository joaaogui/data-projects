import { db } from "@/db";
import { channels, videos } from "@/db/schema";
import type { VideoData } from "@/types/youtube";
import { sql } from "drizzle-orm";
import { captureChannelSnapshot } from "./channel-snapshots";
import { VIDEO_UPSERT_BATCH_SIZE } from "./constants";
import { withSyncJob } from "./sync-job";
import { fetchChannelVideos, getChannelById } from "./youtube-server";

export async function syncChannelVideos(channelId: string, jobId: string): Promise<void> {
  await withSyncJob(jobId, "Sync Videos", async (log, { isCancelled, updateProgress }) => {
    log.info(`Starting video sync for channel ${channelId}`);

    log.info("Fetching channel info...");
    const channelInfo = await getChannelById(channelId);
    log.info(`Channel: "${channelInfo.channelTitle}"`);
    await log.flush();

    await db
      .insert(channels)
      .values({
        id: channelId,
        title: channelInfo.channelTitle,
        thumbnailUrl: channelInfo.thumbnails.default.url,
        subscriberCount: channelInfo.subscriberCount ?? null,
        totalViewCount: channelInfo.totalViewCount ?? null,
        videoCount: channelInfo.videoCount ?? null,
        customUrl: channelInfo.customUrl ?? null,
        description: channelInfo.description ?? null,
        country: channelInfo.country ?? null,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: channels.id,
        set: {
          title: channelInfo.channelTitle,
          thumbnailUrl: channelInfo.thumbnails.default.url,
          subscriberCount: channelInfo.subscriberCount ?? null,
          totalViewCount: channelInfo.totalViewCount ?? null,
          videoCount: channelInfo.videoCount ?? null,
          customUrl: channelInfo.customUrl ?? null,
          description: channelInfo.description ?? null,
          country: channelInfo.country ?? null,
          fetchedAt: new Date(),
        },
      });

    log.info("Fetching all videos from YouTube API...");
    await log.flush();
    const fetchStart = Date.now();
    const allVideos = await fetchChannelVideos(channelId);
    log.info(`Fetched ${allVideos.length} videos in ${((Date.now() - fetchStart) / 1000).toFixed(1)}s`);
    await log.flush();

    if (await isCancelled()) {
      log.warn("Cancelled before saving");
      await log.flush();
      return;
    }

    await updateProgress({ phase: "saving", fetched: 0, total: allVideos.length });
    log.info(`Saving ${allVideos.length} videos to database...`);
    const saveStart = Date.now();

    for (let i = 0; i < allVideos.length; i += VIDEO_UPSERT_BATCH_SIZE) {
      if (await isCancelled()) {
        log.warn(`Cancelled at ${Math.min(i, allVideos.length)}/${allVideos.length}`);
        await log.flush();
        return;
      }

      const batch = allVideos.slice(i, i + VIDEO_UPSERT_BATCH_SIZE);
      await upsertVideoBatch(batch, channelId);

      const saved = Math.min(i + VIDEO_UPSERT_BATCH_SIZE, allVideos.length);
      log.info(`Saved ${saved}/${allVideos.length} videos`);
      await log.flush();
      await updateProgress({ phase: "saving", fetched: saved, total: allVideos.length });
    }

    log.info(`Save phase: ${allVideos.length} videos in ${((Date.now() - saveStart) / 1000).toFixed(1)}s`);

    captureChannelSnapshot(channelId).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn(`Failed to capture channel snapshot: ${msg}`);
    });

    return { fetched: allVideos.length, total: allVideos.length };
  });
}

export async function upsertVideoBatch(batch: VideoData[], channelId: string): Promise<void> {
  if (batch.length === 0) return;

  const rows = batch.map((video) => ({
    id: video.videoId,
    channelId,
    title: video.title,
    publishedAt: new Date(video.publishedAt),
    duration: video.duration,
    views: video.views,
    likes: video.likes,
    comments: video.comments,
    favorites: video.favorites,
    score: video.score,
    scoreComponents: video.scoreComponents,
    rates: video.rates,
    url: video.url,
    thumbnail: video.thumbnail,
    description: video.description,
    fetchedAt: new Date(),
  }));

  await db
    .insert(videos)
    .values(rows)
    .onConflictDoUpdate({
      target: videos.id,
      set: {
        title: sql`excluded.title`,
        views: sql`excluded.views`,
        likes: sql`excluded.likes`,
        comments: sql`excluded.comments`,
        favorites: sql`excluded.favorites`,
        score: sql`excluded.score`,
        scoreComponents: sql`excluded.score_components`,
        rates: sql`excluded.rates`,
        thumbnail: sql`excluded.thumbnail`,
        description: sql`excluded.description`,
        fetchedAt: sql`excluded.fetched_at`,
      },
    });
}
