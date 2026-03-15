import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

const log = createTaggedLogger("sync-cancel");

export const POST = withErrorHandling("sync-cancel", async (_req, ctx) => {
  const start = Date.now();
  log.info("Request received");
  const session = await auth();
  if (!session) {
    log.info({ elapsedMs: Date.now() - start }, "Auth failed");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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
