import { logger } from "@/lib/logger";
import type { ScrapeJobStatus } from "@/types/moradia";
import { NextResponse } from "next/server";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SCRAPER_WORKSPACE_DIR = "/Users/joao.guilherme/.cursor/Empty";
const STATUS_FILE = join(SCRAPER_WORKSPACE_DIR, ".scrape-job-status.json");
const PID_FILE = join(SCRAPER_WORKSPACE_DIR, ".scrape-job.pid");

function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const t0 = performance.now();
  const workerAvailable = existsSync(SCRAPER_WORKSPACE_DIR);

  if (!existsSync(STATUS_FILE)) {
    const idle: ScrapeJobStatus = {
      jobId: "none",
      status: "idle",
      workerAvailable,
    };
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.info("api/scrape/status", "GET idle", {
      workerAvailable,
      status: "idle",
      mode: null,
      cities: null,
      durationMs,
    });
    return NextResponse.json(idle);
  }

  try {
    const status = JSON.parse(
      readFileSync(STATUS_FILE, "utf8"),
    ) as ScrapeJobStatus;

    if (status.status === "running" && existsSync(PID_FILE)) {
      const pid = Number(readFileSync(PID_FILE, "utf8").trim());
      if (!isPidAlive(pid)) {
        // Re-read status file in case the process just finished writing "completed" right before exiting
        const recheck = JSON.parse(
          readFileSync(STATUS_FILE, "utf8"),
        ) as ScrapeJobStatus;

        if (recheck.status === "running") {
          const now = new Date().toISOString();
          const failedStatus: ScrapeJobStatus = {
            ...recheck,
            status: "failed",
            phase: "Interrompido",
            updatedAt: now,
            finishedAt: now,
            error:
              recheck.error ??
              "O processo de scrape encerrou inesperadamente.",
            workerAvailable,
          };
          try {
            writeFileSync(
              STATUS_FILE,
              `${JSON.stringify(failedStatus, null, 2)}\n`,
              "utf8",
            );
            rmSync(PID_FILE, { force: true });
          } catch {
            // Ignore write errors
          }
          const durationMs = Math.round((performance.now() - t0) * 100) / 100;
          logger.warn("api/scrape/status", "GET detected dead worker pid", {
            workerAvailable,
            status: failedStatus.status,
            mode: failedStatus.mode ?? null,
            cities: failedStatus.currentSearchLabel ?? null,
            durationMs,
          });
          return NextResponse.json(failedStatus);
        }

        const durationMs = Math.round((performance.now() - t0) * 100) / 100;
        logger.info("api/scrape/status", "GET completed after pid exit", {
          workerAvailable,
          status: recheck.status,
          mode: recheck.mode ?? null,
          cities: recheck.currentSearchLabel ?? null,
          durationMs,
        });
        return NextResponse.json({ ...recheck, workerAvailable });
      }
    }

    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.info("api/scrape/status", "GET completed", {
      workerAvailable,
      status: status.status,
      mode: status.mode ?? null,
      cities: status.currentSearchLabel ?? null,
      durationMs,
    });
    return NextResponse.json({ ...status, workerAvailable });
  } catch (err) {
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.warn("api/scrape/status", "GET fallback to idle on read error", {
      workerAvailable,
      status: "idle",
      mode: null,
      cities: null,
      durationMs,
      error: err,
    });
    return NextResponse.json({
      jobId: "none",
      status: "idle",
      workerAvailable,
    } satisfies ScrapeJobStatus);
  }
}
