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
  if (!existsSync(STATUS_FILE)) {
    const idle: ScrapeJobStatus = {
      jobId: "none",
      status: "idle",
    };
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
          return NextResponse.json(failedStatus);
        }

        return NextResponse.json(recheck);
      }
    }

    return NextResponse.json(status);
  } catch {
    return NextResponse.json({
      jobId: "none",
      status: "idle",
    } satisfies ScrapeJobStatus);
  }
}
