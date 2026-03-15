import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import type { FetchProgress } from "@/types/youtube";
import { eq } from "drizzle-orm";
import { createJobLogger, type JobLogger } from "./sync-logger";

export interface SyncJobContext {
  isCancelled: () => Promise<boolean>;
  updateProgress: (progress: FetchProgress) => Promise<void>;
}

export interface SyncJobResult {
  fetched: number;
  total: number;
}

export async function isJobCancelled(jobId: string): Promise<boolean> {
  const [row] = await db
    .select({ status: syncJobs.status })
    .from(syncJobs)
    .where(eq(syncJobs.id, jobId))
    .limit(1);
  return row?.status !== "running";
}

async function setJobStatus(
  jobId: string,
  status: "running" | "completed" | "failed",
  progress?: FetchProgress,
  error?: string
) {
  await db
    .update(syncJobs)
    .set({
      status,
      ...(progress && { progress }),
      ...(error && { error }),
      updatedAt: new Date(),
    })
    .where(eq(syncJobs.id, jobId));
}

export async function withSyncJob(
  jobId: string,
  prefix: string,
  work: (log: JobLogger, ctx: SyncJobContext) => Promise<SyncJobResult | void>
): Promise<void> {
  const t0 = Date.now();
  const log = createJobLogger(jobId, prefix);

  const ctx: SyncJobContext = {
    isCancelled: () => isJobCancelled(jobId),
    updateProgress: (progress) => setJobStatus(jobId, "running", progress),
  };

  try {
    await setJobStatus(jobId, "running", { phase: "init", fetched: 0 });
    await log.flush();

    const result = await work(log, ctx);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    log.info(`Completed in ${elapsed}s`);
    await log.flush();

    await setJobStatus(jobId, "completed", {
      phase: "done",
      fetched: result?.fetched ?? 0,
      total: result?.total ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error(`Failed after ${((Date.now() - t0) / 1000).toFixed(1)}s: ${message}`);
    await log.flush();
    await setJobStatus(jobId, "failed", undefined, message);
    throw error;
  }
}
