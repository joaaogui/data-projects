import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const start = Date.now();
  console.log("[Sync Active] request received");
  const session = await auth();
  if (!session) {
    console.log("[Sync Active] auth failed", { elapsedMs: Date.now() - start });
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await params;
  console.log("[Sync Active] params", { channelId });

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

  console.log("[Sync Active] db query complete", {
    channelId,
    count: activeJobs.length,
    elapsedMs: Date.now() - start,
  });
  return NextResponse.json(activeJobs);
}
