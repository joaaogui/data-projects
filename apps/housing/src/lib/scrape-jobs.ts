import "server-only";

import { getDb, schema } from "@/db";
import type { ScrapeJobStatus } from "@/types/housing";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";

/** The runner heartbeats every ~30 s; after this long without one it counts as offline. */
const RUNNER_OFFLINE_AFTER_MS = 2 * 60_000;

type JobRow = typeof schema.scrapeJobs.$inferSelect;

export interface ScrapeJobRequest {
  mode: "full_sync" | "verify_only" | "custom_url";
  cities: string[];
  neighborhoods: string[];
  customUrl: string;
  keys: string[];
  maxPages: number;
}

async function runnerOnline(): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const rows = await db
    .select({ updatedAt: schema.runtimeKv.updatedAt })
    .from(schema.runtimeKv)
    .where(and(eq(schema.runtimeKv.namespace, "scrape-runner"), eq(schema.runtimeKv.key, "mac")));
  const at = rows[0]?.updatedAt;
  return Boolean(at && Date.now() - at.getTime() < RUNNER_OFFLINE_AFTER_MS);
}

/**
 * The portal UI knows idle/running/completed/failed: a queued job shows as running ("na fila")
 * and a cancelled one as failed, as before.
 */
function toPortalStatus(row: JobRow, workerAvailable: boolean): ScrapeJobStatus {
  const progress = (row.progress ?? {}) as Partial<ScrapeJobStatus>;
  const base: ScrapeJobStatus = {
    ...progress,
    jobId: row.id,
    mode: row.mode,
    status: row.status === "queued" ? "running" : row.status === "cancelled" ? "failed" : row.status,
    workerAvailable,
    startedAt: (row.startedAt ?? row.requestedAt).toISOString(),
    updatedAt: (row.heartbeatAt ?? row.startedAt ?? row.requestedAt).toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    error: row.error ?? progress.error ?? null,
  };
  if (row.status === "queued") {
    base.phase = workerAvailable
      ? "Na fila — o runner local vai iniciar em instantes..."
      : "Na fila — aguardando o runner local (Mac) ficar online.";
  }
  if (row.status === "cancelled") {
    base.phase = "Cancelado";
    base.error = row.error ?? "Cancelado pelo usuário";
  }
  return base;
}

export async function getLatestScrapeStatus(): Promise<ScrapeJobStatus> {
  const db = getDb();
  if (!db) return { jobId: "none", status: "idle", workerAvailable: false };
  const [rows, online] = await Promise.all([
    db.select().from(schema.scrapeJobs).orderBy(desc(schema.scrapeJobs.requestedAt)).limit(1),
    runnerOnline(),
  ]);
  const row = rows[0];
  return row ? toPortalStatus(row, online) : { jobId: "none", status: "idle", workerAvailable: online };
}

/** Queues a job unless one is already queued or running (then returns that one). */
export async function enqueueScrapeJob(
  request: ScrapeJobRequest,
): Promise<{ status: ScrapeJobStatus; alreadyRunning: boolean }> {
  const db = getDb();
  if (!db) throw new Error("Banco não configurado: não é possível enfileirar o scrape.");
  const active = await db
    .select()
    .from(schema.scrapeJobs)
    .where(inArray(schema.scrapeJobs.status, ["queued", "running"]))
    .orderBy(desc(schema.scrapeJobs.requestedAt))
    .limit(1);
  const online = await runnerOnline();
  if (active[0]) return { status: toPortalStatus(active[0], online), alreadyRunning: true };
  const [row] = await db
    .insert(schema.scrapeJobs)
    .values({
      id: `scrape-${Date.now()}-${randomUUID().slice(0, 8)}`,
      status: "queued",
      mode: request.mode,
      params: { ...request },
    })
    .returning();
  return { status: toPortalStatus(row!, online), alreadyRunning: false };
}

/** Queued jobs are cancelled at once; a running job is flagged and the runner stops it (SIGTERM). */
export async function cancelScrapeJob(): Promise<ScrapeJobStatus> {
  const db = getDb();
  if (!db) return { jobId: "none", status: "idle", workerAvailable: false };
  await db
    .update(schema.scrapeJobs)
    .set({ status: "cancelled", finishedAt: sql`now()`, error: "Cancelado pelo usuário" })
    .where(eq(schema.scrapeJobs.status, "queued"));
  await db
    .update(schema.scrapeJobs)
    .set({ cancelRequested: true })
    .where(eq(schema.scrapeJobs.status, "running"));
  return getLatestScrapeStatus();
}
