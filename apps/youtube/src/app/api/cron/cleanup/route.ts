import { createTaggedLogger } from "@/lib/logger";
import { cleanupStaleJobs, getJobHealthMetrics } from "@/lib/sync-cleanup";
import { NextRequest, NextResponse } from "next/server";

const log = createTaggedLogger("cron-cleanup");

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await cleanupStaleJobs();
  const metrics = await getJobHealthMetrics();

  log.info({ ...result, ...metrics }, "Cron cleanup completed");

  return NextResponse.json({ cleanup: result, metrics });
}
