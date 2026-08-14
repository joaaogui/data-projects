import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

const log = createTaggedLogger("sync-cancel");

// Open: an anonymous visitor who started a sync needs to be able to stop it.
// Guarded by the job UUID, and it can only ever halt work, never destroy data.
export const POST = withErrorHandling("sync-cancel", async (_req, ctx) => {
  const start = Date.now();
  log.info("Request received");

  const { jobId } = await ctx.params;
  log.info({ jobId }, "Processing cancel request");

  if (!jobId) {
    return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
  }

  const result = await db
    .update(syncJobs)
    .set({
      status: "failed",
      error: "Cancelled by user",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(syncJobs.id, jobId),
        inArray(syncJobs.status, ["pending", "running"])
      )
    );

  const cancelled = (result.rowCount ?? 0) > 0;
  log.info({
    jobId,
    cancelled,
    rowCount: result.rowCount ?? 0,
    elapsedMs: Date.now() - start,
  }, "Cancel result");

  return NextResponse.json({ jobId, cancelled });
});
