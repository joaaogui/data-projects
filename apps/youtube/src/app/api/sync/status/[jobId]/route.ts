import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const log = createTaggedLogger("sync-status");

// Open: anyone can start a sync, so anyone must be able to watch it finish.
// Reads are keyed by an unguessable job UUID and expose only progress.
export const GET = withErrorHandling("sync-status", async (req, ctx) => {
  const { jobId } = await ctx.params;

  if (!jobId) {
    return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
  }

  const job = await db.select().from(syncJobs).where(eq(syncJobs.id, jobId)).limit(1);

  if (job.length === 0) {
    log.warn({ jobId }, "Job not found");
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { status, type, channelId, progress, logs, error, createdAt, updatedAt } = job[0];

  const logsSince = Number.parseInt(req.nextUrl.searchParams.get("logsSince") ?? "0", 10);
  const newLogs = (logs ?? []).slice(logsSince);

  return NextResponse.json({
    jobId,
    channelId,
    type,
    status,
    progress,
    logs: newLogs,
    logsSince,
    totalLogs: (logs ?? []).length,
    error,
    createdAt,
    updatedAt,
  });
});
