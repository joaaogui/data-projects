import { db } from "@/db";
import { channels, syncJobs, videos } from "@/db/schema";
import type { VideoData } from "@/types/youtube";
import { eq, sql } from "drizzle-orm";
import { createJobLogger } from "./sync-logger";
import { fetchChannelVideos, getChannelById } from "./youtube-server";

const BATCH_SIZE = 50;

export async function syncChannelVideos(channelId: string, jobId: string): Promise<void> {
  const t0 = Date.now();
  const log = createJobLogger(jobId, "Sync Videos");
  log.info(`Starting video sync for channel ${channelId}`);

  try {
    await db
      .update(syncJobs)
      .set({ status: "running", progress: { phase: "init", fetched: 0 }, updatedAt: new Date() })
      .where(eq(syncJobs.id, jobId));
    await log.flush();

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
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: channels.id,
        set: {
          title: channelInfo.channelTitle,
          thumbnailUrl: channelInfo.thumbnails.default.url,
          fetchedAt: new Date(),
        },
      });

    log.info("Fetching all videos from YouTube API...");
    await log.flush();
    const fetchStart = Date.now();
    const allVideos = await fetchChannelVideos(channelId);
    log.info(`Fetched ${allVideos.length} videos in ${((Date.now() - fetchStart) / 1000).toFixed(1)}s`);
    await log.flush();

    const [preCheck] = await db
      .select({ status: syncJobs.status })
      .from(syncJobs)
      .where(eq(syncJobs.id, jobId))
      .limit(1);
    if (preCheck?.status !== "running") {
      log.warn("Cancelled before saving");
      await log.flush();
      return;
    }

    await db
      .update(syncJobs)
      .set({
        progress: { phase: "saving", fetched: 0, total: allVideos.length },
        updatedAt: new Date(),
      })
      .where(eq(syncJobs.id, jobId));

    log.info(`Saving ${allVideos.length} videos to database...`);
    const saveStart = Date.now();

    for (let i = 0; i < allVideos.length; i += BATCH_SIZE) {
      const [currentJob] = await db
        .select({ status: syncJobs.status })
        .from(syncJobs)
        .where(eq(syncJobs.id, jobId))
        .limit(1);
      if (currentJob?.status !== "running") {
        log.warn(`Cancelled at ${Math.min(i, allVideos.length)}/${allVideos.length}`);
        await log.flush();
        return;
      }

      const batch = allVideos.slice(i, i + BATCH_SIZE);
      await upsertVideoBatch(batch, channelId);

      const saved = Math.min(i + BATCH_SIZE, allVideos.length);
      log.info(`Saved ${saved}/${allVideos.length} videos`);

      await log.flush();
      await db
        .update(syncJobs)
        .set({
          progress: { phase: "saving", fetched: saved, total: allVideos.length },
          updatedAt: new Date(),
        })
        .where(eq(syncJobs.id, jobId));
    }

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log.info(`Completed: ${allVideos.length} videos saved in ${elapsed}s (save: ${((Date.now() - saveStart) / 1000).toFixed(1)}s)`);
    await log.flush();

    await db
      .update(syncJobs)
      .set({
        status: "completed",
        progress: { phase: "done", fetched: allVideos.length, total: allVideos.length },
        updatedAt: new Date(),
      })
      .where(eq(syncJobs.id, jobId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error(`Failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${message}`);
    await log.flush();
    await db
      .update(syncJobs)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(syncJobs.id, jobId));
    throw error;
  }
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
