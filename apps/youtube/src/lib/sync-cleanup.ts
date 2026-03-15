import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import { and, inArray, lt, sql } from "drizzle-orm";
import { STALE_JOB_THRESHOLD_MS } from "./constants";
import { createTaggedLogger } from "./logger";

const log = createTaggedLogger("sync-cleanup");

export interface CleanupResult {
  markedFailed: number;
  deletedOld: number;
}

export async function cleanupStaleJobs(): Promise<CleanupResult> {
  const staleThreshold = new Date(Date.now() - STALE_JOB_THRESHOLD_MS);

  const staleJobs = await db
    .update(syncJobs)
    .set({
      status: "failed",
      error: "Job timed out (stale job cleanup)",
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(syncJobs.status, ["pending", "running"]),
        lt(syncJobs.updatedAt, staleThreshold)
      )
    );
  const markedFailed = staleJobs.rowCount ?? 0;

  if (markedFailed > 0) {
    log.warn({ count: markedFailed }, "Marked stale jobs as failed");
  }

  const oldThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const oldJobs = await db
    .delete(syncJobs)
    .where(
      and(
        inArray(syncJobs.status, ["completed", "failed"]),
        lt(syncJobs.updatedAt, oldThreshold)
      )
    );
  const deletedOld = oldJobs.rowCount ?? 0;

  if (deletedOld > 0) {
    log.info({ count: deletedOld }, "Deleted old completed/failed jobs");
  }

  return { markedFailed, deletedOld };
}

export async function getJobHealthMetrics() {
  const rows = await db
    .select({
      status: syncJobs.status,
      count: sql<number>`count(*)::int`,
    })
    .from(syncJobs)
    .groupBy(syncJobs.status);

  const metrics: Record<string, number> = {};
  for (const row of rows) {
    metrics[row.status] = row.count;
  }

  return {
    pending: metrics.pending ?? 0,
    running: metrics.running ?? 0,
    completed: metrics.completed ?? 0,
    failed: metrics.failed ?? 0,
    total: Object.values(metrics).reduce((a, b) => a + b, 0),
  };
}
