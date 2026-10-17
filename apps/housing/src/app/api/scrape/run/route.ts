import { parseJsonBody, scrapeRunSchema } from "@/lib/api-guards";
import { requireAuth } from "@/lib/auth";
import { getLocalScraperDir } from "@/lib/local-scraper";
import { logger } from "@/lib/logger";
import type { CityHubCode, ScrapeJobStatus } from "@/types/housing";
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import {
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

function readCurrentStatus(statusFile: string): ScrapeJobStatus | null {
  if (!existsSync(/*turbopackIgnore: true*/ statusFile)) return null;
  try {
    return JSON.parse(readFileSync(/*turbopackIgnore: true*/ statusFile, "utf8")) as ScrapeJobStatus;
  } catch {
    return null;
  }
}

function isPidAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const t0 = performance.now();
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  const SCRAPER_WORKSPACE_DIR = getLocalScraperDir();
  const workerAvailable = SCRAPER_WORKSPACE_DIR !== null;
  if (!SCRAPER_WORKSPACE_DIR) {
    return NextResponse.json(
      { ok: false, error: "Scraper local indisponível neste ambiente (HOUSING_SCRAPER_DIR)." },
      { status: 503 },
    );
  }
  const STATUS_FILE = join(SCRAPER_WORKSPACE_DIR, ".scrape-job-status.json");
  const PID_FILE = join(SCRAPER_WORKSPACE_DIR, ".scrape-job.pid");
  try {
    const parsedBody = await parseJsonBody(request, scrapeRunSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data;

    if (body.action === "cancel") {
      if (existsSync(PID_FILE)) {
        try {
          const pid = Number(readFileSync(PID_FILE, "utf8").trim());
          if (isPidAlive(pid)) {
            process.kill(pid, "SIGTERM");
          }
        } catch {
          // Ignore kill errors
        }
        try {
          rmSync(PID_FILE, { force: true });
        } catch {
          // Ignore rm errors
        }
      }

      const prev = readCurrentStatus(STATUS_FILE);
      const now = new Date().toISOString();
      const cancelledStatus: ScrapeJobStatus = {
        jobId: prev?.jobId ?? `job-${Date.now()}`,
        ...prev,
        status: "failed",
        phase: "Cancelado",
        error: "Cancelado pelo usuário",
        updatedAt: now,
        finishedAt: now,
        logs: [...(prev?.logs ?? []), `[${now}] Job cancelado pelo usuário.`],
      };

      writeFileSync(
        STATUS_FILE,
        `${JSON.stringify(cancelledStatus, null, 2)}\n`,
        "utf8",
      );

      const durationMs = Math.round((performance.now() - t0) * 100) / 100;
      logger.info("api/scrape/run", "POST cancel completed", {
        workerAvailable,
        status: cancelledStatus.status,
        mode: cancelledStatus.mode ?? null,
        cities: body.cities ?? [],
        durationMs,
      });

      return NextResponse.json({ ok: true, status: cancelledStatus });
    }

    // Check if a job is currently running and alive
    if (existsSync(PID_FILE)) {
      try {
        const existingPid = Number(readFileSync(PID_FILE, "utf8").trim());
        const existingStatus = readCurrentStatus(STATUS_FILE);
        if (existingStatus?.status === "running" && isPidAlive(existingPid)) {
          const durationMs = Math.round((performance.now() - t0) * 100) / 100;
          logger.info("api/scrape/run", "POST already running", {
            workerAvailable,
            status: existingStatus.status,
            mode: existingStatus.mode ?? null,
            cities: body.cities ?? [],
            durationMs,
          });
          return NextResponse.json({
            ok: true,
            alreadyRunning: true,
            status: existingStatus,
          });
        }
      } catch {
        // Proceed to start a new job
      }
    }

    const mode: "full_sync" | "verify_only" | "custom_url" =
      body.mode ?? (body.customUrl ? "custom_url" : "full_sync");
    const cities =
      body.cities && body.cities.length > 0
        ? body.cities
        : (["BH", "RJ", "CP", "SP"] as CityHubCode[]);
    const neighborhoods = body.neighborhoods ?? [];
    const customUrl = body.customUrl?.trim() ?? "";
    const keys = body.keys ?? [];
    const maxPages = body.maxPages ?? 5;

    if (mode === "custom_url" && !customUrl) {
      const durationMs = Math.round((performance.now() - t0) * 100) / 100;
      logger.warn("api/scrape/run", "POST rejected missing customUrl", {
        workerAvailable,
        status: "rejected",
        mode,
        cities,
        durationMs,
      });
      return NextResponse.json(
        { ok: false, error: "Informe uma URL de busca válida." },
        { status: 400 },
      );
    }

    const jobId = `scrape-${Date.now()}`;
    const now = new Date().toISOString();
    const initialStatus: ScrapeJobStatus = {
      jobId,
      status: "running",
      mode,
      startedAt: now,
      updatedAt: now,
      finishedAt: null,
      phase:
        mode === "verify_only"
          ? "Iniciando verificação rápida de anúncios..."
          : mode === "custom_url"
            ? "Iniciando extração da URL customizada..."
            : `Iniciando varredura (${cities.join(", ")})...`,
      currentSearchLabel:
        mode === "custom_url"
          ? customUrl
          : neighborhoods.length > 0
            ? `${cities.join(", ")} · ${neighborhoods.join(", ")}`
            : cities.join(", "),
      completedSteps: 0,
      totalSteps:
        mode === "verify_only"
          ? Math.max(1, keys.length)
          : mode === "custom_url"
            ? 2
            : Math.max(1, cities.length * 2),
      newListingsAdded: 0,
      deactivatedCount: 0,
      reactivatedCount: 0,
      verifiedCount: 0,
      logs: [
        `[${new Date().toLocaleTimeString("pt-BR")}] Job ${jobId} iniciado (modo: ${mode}).`,
      ],
      error: null,
    };

    writeFileSync(
      STATUS_FILE,
      `${JSON.stringify(initialStatus, null, 2)}\n`,
      "utf8",
    );

    const args: string[] = [
      "scripts/scrape-sync-job.ts",
      "--job-id",
      jobId,
      "--mode",
      mode,
      "--status-file",
      STATUS_FILE,
      "--cities",
      cities.join(","),
      "--max-pages",
      String(maxPages),
    ];

    if (neighborhoods.length > 0) {
      args.push("--neighborhoods", neighborhoods.join(","));
    }
    if (customUrl) {
      args.push("--custom-url", customUrl);
    }
    if (keys.length > 0) {
      args.push("--keys", keys.join(","));
    }

    const child = spawn(process.execPath, args, {
      cwd: SCRAPER_WORKSPACE_DIR,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
      },
    });

    child.unref();

    if (child.pid) {
      writeFileSync(PID_FILE, `${child.pid}\n`, "utf8");
    }

    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.info("api/scrape/run", "POST started scrape job", {
      jobId,
      pid: child.pid ?? null,
      workerAvailable,
      status: initialStatus.status,
      mode,
      cities,
      neighborhoodsCount: neighborhoods.length,
      keysCount: keys.length,
      durationMs,
    });

    return NextResponse.json({ ok: true, status: initialStatus });
  } catch (err) {
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.error("api/scrape/run", "POST failed", {
      workerAvailable,
      durationMs,
      error: err,
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro ao iniciar job de scrape.",
      },
      { status: 500 },
    );
  }
}
