import { NextResponse } from "next/server";
import { db } from "@/db";
import { syncJobs, channels } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin-auth";

export async function GET() {
  const forbidden = await requireAdmin();
  if (forbidden) return forbidden;

  console.log("[Admin SyncJobs] Request");

  try {
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

    console.log("[Admin SyncJobs] Result", { jobCount: jobs.length });
    return NextResponse.json({ jobs });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[Admin SyncJobs] Error:", err.message, err.stack);
    return NextResponse.json({ error: "Failed to fetch sync jobs" }, { status: 500 });
  }
}
