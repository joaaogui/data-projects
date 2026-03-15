import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { jobId } = await params;

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

  return NextResponse.json({ jobId, cancelled });
}
