import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { jobId } = await params;

    if (!jobId) {
      return NextResponse.json({ error: "Missing job ID" }, { status: 400 });
    }

    const job = await db.select().from(syncJobs).where(eq(syncJobs.id, jobId)).limit(1);

    if (job.length === 0) {
      console.warn("[Sync Status] job not found", { jobId });
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const { status, type, channelId, progress, logs, error, createdAt, updatedAt } = job[0];

    const logsSince = parseInt(request.nextUrl.searchParams.get("logsSince") ?? "0", 10);
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
  } catch (err) {
    console.error("[Sync Status] error", err instanceof Error ? err.stack : err);
    return NextResponse.json({ error: "Failed to fetch sync status" }, { status: 500 });
  }
}
