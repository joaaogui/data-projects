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

export const inngestFunctions = [syncChannelPipeline, scheduledCleanup];
