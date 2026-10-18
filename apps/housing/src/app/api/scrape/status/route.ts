import { logger } from "@/lib/logger";
import { getLatestScrapeStatus } from "@/lib/scrape-jobs";
import type { ScrapeJobStatus } from "@/types/housing";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getLatestScrapeStatus();
    return NextResponse.json(status, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logger.warn("api/scrape/status", "GET fallback to idle", { error: err });
    return NextResponse.json({ jobId: "none", status: "idle", workerAvailable: false } satisfies ScrapeJobStatus);
  }
}
