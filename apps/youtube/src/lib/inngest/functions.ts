import { inngest } from "./client";

export const syncChannelPipeline = inngest.createFunction(
  {
    id: "sync-channel-pipeline",
    retries: 2,
    concurrency: [{ limit: 3 }],
  },
  { event: "sync/channel.requested" },
  async ({ event, step }) => {
    const { channelId, jobId, phases } = event.data as {
      channelId: string;
      jobId: string;
      phases: ("videos" | "transcripts" | "sagas")[];
    };

    if (phases.includes("videos")) {
      await step.run("sync-videos", async () => {
        const { syncChannelVideos } = await import("@/lib/sync-videos");
        await syncChannelVideos(channelId, jobId);
      });
    }

    if (phases.includes("transcripts")) {
      await step.run("sync-transcripts", async () => {
        const { syncChannelTranscripts } = await import("@/lib/sync-transcripts");
        const transcriptJobId = `${jobId}-transcripts`;
        await syncChannelTranscripts(channelId, transcriptJobId);
      });
    }

    if (phases.includes("sagas")) {
      await step.run("sync-sagas", async () => {
        const { syncChannelSagas } = await import("@/lib/sync-sagas");
        const sagaJobId = `${jobId}-sagas`;
        await syncChannelSagas(channelId, sagaJobId, "full");
      });
    }

    return { channelId, completedPhases: phases };
  }
);

export const scheduledCleanup = inngest.createFunction(
  {
    id: "scheduled-cleanup",
    retries: 1,
  },
  { cron: "0 */6 * * *" },
  async ({ step }) => {
    const result = await step.run("cleanup-stale-jobs", async () => {
      const { cleanupStaleJobs } = await import("@/lib/sync-cleanup");
      return cleanupStaleJobs();
    });

    return result;
  }
);

export const pulseAutoResync = inngest.createFunction(
  {
    id: "pulse-auto-resync",
    retries: 1,
    concurrency: [{ limit: 2 }],
  },
  { cron: "0 */12 * * *" },
  async ({ step }) => {
    const channelIds = await step.run("get-tracked-channels", async () => {
      const { db } = await import("@/db");
      const { savedChannels, channels } = await import("@/db/schema");
      const { eq, lt } = await import("drizzle-orm");

      const staleThreshold = new Date(Date.now() - 12 * 60 * 60 * 1000);

      const staleChannels = await db
        .selectDistinct({ channelId: savedChannels.channelId })
        .from(savedChannels)
        .innerJoin(channels, eq(savedChannels.channelId, channels.id))
        .where(lt(channels.fetchedAt, staleThreshold))
        .limit(10);

      return staleChannels.map((r) => r.channelId);
    });

    if (channelIds.length === 0) {
      return { synced: 0, message: "No stale tracked channels" };
    }

    const results: string[] = [];
    for (const channelId of channelIds) {
      await step.run(`resync-${channelId}`, async () => {
        const { db } = await import("@/db");
        const { syncJobs } = await import("@/db/schema");
        const { syncChannelVideos } = await import("@/lib/sync-videos");

        const jobId = `pulse-${channelId}-${Date.now()}`;
        await db.insert(syncJobs).values({
          id: jobId,
          channelId,
          type: "videos",
          status: "pending",
          progress: { phase: "queued", fetched: 0 },
        });

        await syncChannelVideos(channelId, jobId);
        results.push(channelId);
      });
    }

    return { synced: results.length, channels: results };
  }
);

export const inngestFunctions = [syncChannelPipeline, scheduledCleanup, pulseAutoResync];
