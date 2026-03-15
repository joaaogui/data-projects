import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { and, desc, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

const log = createTaggedLogger("sync-active");

export const GET = withErrorHandling("sync-active", async (_req, ctx) => {
  const start = Date.now();
  log.info("Request received");
  const session = await auth();
  if (!session) {
    log.info({ elapsedMs: Date.now() - start }, "Auth failed");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await ctx.params;
  log.info({ channelId }, "Fetching active jobs");

  const activeJobs = await db
    .select({
      jobId: syncJobs.id,
      type: syncJobs.type,
      status: syncJobs.status,
      progress: syncJobs.progress,
      error: syncJobs.error,
      createdAt: syncJobs.createdAt,
    })
    .from(syncJobs)
    .where(
      and(
        eq(syncJobs.channelId, channelId),
        inArray(syncJobs.status, ["pending", "running"])
      )
    )
    .orderBy(desc(syncJobs.createdAt));

  log.info({
    channelId,
    count: activeJobs.length,
    elapsedMs: Date.now() - start,
  }, "Active jobs fetched");
  return NextResponse.json(activeJobs);
});
