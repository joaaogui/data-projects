import { logger } from "@/lib/logger";
import { enqueueScrapeJob } from "@/lib/scrape-jobs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "Cron authentication is not configured." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  try {
    const { status, alreadyRunning } = await enqueueScrapeJob({
      mode: "full_sync",
      cities: ["RJ"],
      neighborhoods: [],
      customUrl: "",
      keys: [],
      maxPages: 5,
    });
    logger.info(
      "api/scrape/cron",
      alreadyRunning ? "Daily sync skipped because a job is active" : "Daily sync queued",
      {
        jobId: status.jobId,
        workerAvailable: status.workerAvailable ?? false,
      },
    );
    return NextResponse.json({ ok: true, alreadyRunning, status });
  } catch (error) {
    logger.error("api/scrape/cron", "Daily sync could not be queued", { error });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Could not queue daily sync.",
      },
      { status: 500 },
    );
  }
}
