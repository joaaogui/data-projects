import { parseJsonBody, scrapeRunSchema } from "@/lib/api-guards";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { cancelScrapeJob, enqueueScrapeJob } from "@/lib/scrape-jobs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Queues (or cancels) a scrape job in Neon. The scraper's runner on the owner's Mac picks it up;
 * this route never spawns processes, so it behaves the same locally and on Vercel.
 */
export async function POST(request: Request) {
  const t0 = performance.now();
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const parsedBody = await parseJsonBody(request, scrapeRunSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data;

    if (body.action === "cancel") {
      const status = await cancelScrapeJob();
      logger.info("api/scrape/run", "POST cancel requested", {
        jobId: status.jobId,
        durationMs: Math.round(performance.now() - t0),
      });
      return NextResponse.json({ ok: true, status });
    }

    const mode = body.mode ?? (body.customUrl ? "custom_url" : "full_sync");
    const customUrl = body.customUrl?.trim() ?? "";
    if (mode === "custom_url" && !customUrl) {
      return NextResponse.json({ ok: false, error: "Informe uma URL de busca válida." }, { status: 400 });
    }
    const { status, alreadyRunning } = await enqueueScrapeJob({
      mode,
      cities: body.cities && body.cities.length > 0 ? body.cities : ["BH", "RJ", "CP", "SP"],
      neighborhoods: body.neighborhoods ?? [],
      customUrl,
      keys: body.keys ?? [],
      maxPages: body.maxPages ?? 5,
    });
    logger.info("api/scrape/run", alreadyRunning ? "POST already active" : "POST queued scrape job", {
      jobId: status.jobId,
      mode,
      workerAvailable: status.workerAvailable ?? false,
      durationMs: Math.round(performance.now() - t0),
    });
    return NextResponse.json({ ok: true, alreadyRunning, status });
  } catch (err) {
    logger.error("api/scrape/run", "POST failed", { error: err });
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro ao enfileirar o scrape." },
      { status: 500 },
    );
  }
}
