import { db } from "@/db";
import { syncJobs, channels } from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { eq, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

const log = createTaggedLogger("admin-sync-jobs");

export const GET = withErrorHandling("admin-sync-jobs", async (_req, _ctx) => {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  log.info("Fetching sync jobs");

  const jobs = await db
    .select({
      id: syncJobs.id,
      channelId: syncJobs.channelId,
      channelTitle: channels.title,
      type: syncJobs.type,
      status: syncJobs.status,
      progress: syncJobs.progress,
      error: syncJobs.error,
      createdAt: syncJobs.createdAt,
      updatedAt: syncJobs.updatedAt,
    })
    .from(syncJobs)
    .leftJoin(channels, eq(syncJobs.channelId, channels.id))
    .orderBy(desc(syncJobs.createdAt))
    .limit(50);

  log.info({ jobCount: jobs.length }, "Fetched sync jobs");
  return NextResponse.json({ jobs });
});
