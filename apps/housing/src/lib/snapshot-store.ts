import "server-only";

import { getDb } from "@/db";
import { hashContent } from "@/lib/listing-features-store";
import { logger } from "@/lib/logger";
import { processScoped } from "@/lib/process-cache";
import { listingSnapshotSchema } from "@data-projects/housing-contract";
import { Pool } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { existsSync, readFileSync, statSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

export type PhotoGalleries = Record<string, Array<{ room: string | null; url: string }>>;

export interface SnapshotData {
  updatedAt: string;
  source?: string;
  neighborhoods?: unknown[];
  properties?: unknown[];
}

export interface LoadedSnapshot {
  data: SnapshotData;
  contentHash: string;
  source: "neon" | "file";
  /** Full photo galleries shipped with the snapshot (file mode: the committed photos-cache.json). */
  galleries: PhotoGalleries;
  galleriesHash: string;
}

const POINTER_TTL_MS = 30_000;
const SNAPSHOT_FILES = [
  join(process.cwd(), "src/data/seed-snapshot.json"),
  join(process.cwd(), "apps/housing/src/data/seed-snapshot.json"),
];
const GALLERY_FILES = [
  join(process.cwd(), "src/data/photos-cache.json"),
  join(process.cwd(), "apps/housing/src/data/photos-cache.json"),
];

interface SnapshotStoreState {
  neon: LoadedSnapshot | null;
  pointerCheckedAt: number;
  file: (LoadedSnapshot & { mtimeKey: string }) | null;
  loading: Promise<LoadedSnapshot> | null;
}

const state = processScoped<SnapshotStoreState>("snapshot-store", () => ({
  neon: null,
  pointerCheckedAt: 0,
  file: null,
  loading: null,
}));

const EMPTY_SNAPSHOT: SnapshotData = { updatedAt: new Date(0).toISOString(), neighborhoods: [], properties: [] };

function firstExisting(paths: string[]): string | null {
  return paths.find((p) => existsSync(/*turbopackIgnore: true*/ p)) ?? null;
}

/** The committed fixture: fallback when Neon has no active snapshot, and `HOUSING_SNAPSHOT_SOURCE=file`. */
function loadFileSnapshot(): LoadedSnapshot {
  const snapshotPath = firstExisting(SNAPSHOT_FILES);
  const galleriesPath = firstExisting(GALLERY_FILES);
  const mtime = (p: string | null) => (p ? statSync(/*turbopackIgnore: true*/ p).mtimeMs : -1);
  const mtimeKey = `${snapshotPath}:${mtime(snapshotPath)}|${galleriesPath}:${mtime(galleriesPath)}`;
  if (state.file?.mtimeKey === mtimeKey) return state.file;

  let data = EMPTY_SNAPSHOT;
  let contentHash = "empty";
  if (snapshotPath) {
    try {
      const rawText = readFileSync(/*turbopackIgnore: true*/ snapshotPath, "utf8");
      data = JSON.parse(rawText) as SnapshotData;
      contentHash = hashContent(rawText);
    } catch (err) {
      logger.warn("snapshot-store", "failed reading snapshot file", { snapshotPath, error: err });
    }
  }
  let galleries: PhotoGalleries = {};
  let galleriesHash = "none";
  if (galleriesPath) {
    try {
      const rawText = readFileSync(/*turbopackIgnore: true*/ galleriesPath, "utf8");
      const raw = JSON.parse(rawText) as unknown;
      if (raw && typeof raw === "object" && !Array.isArray(raw)) galleries = raw as PhotoGalleries;
      galleriesHash = `file:${mtime(galleriesPath)}`;
    } catch (err) {
      logger.warn("snapshot-store", "failed reading galleries file", { galleriesPath, error: err });
    }
  }
  state.file = { data, contentHash, source: "file", galleries, galleriesHash, mtimeKey };
  return state.file;
}

function databaseUrl(): string {
  return (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "").trim();
}

function toBuffer(value: unknown): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string" && value.startsWith("\\x")) return Buffer.from(value.slice(2), "hex");
  throw new Error("unexpected bytea encoding");
}

function blobCachePath(contentHash: string, kind: "payload" | "galleries"): string {
  return join(tmpdir(), `housing-snapshot-${contentHash.slice(0, 32)}.${kind}.gz`);
}

/** Snapshots are immutable per content hash, so a local copy skips the multi-MB download on restarts. */
async function cachedSnapshotBlobs(
  id: number,
  contentHash: string,
): Promise<{ payload: Buffer; galleries: Buffer | null }> {
  const payloadPath = blobCachePath(contentHash, "payload");
  const galleriesPath = blobCachePath(contentHash, "galleries");
  if (existsSync(/*turbopackIgnore: true*/ payloadPath)) {
    return {
      payload: readFileSync(/*turbopackIgnore: true*/ payloadPath),
      galleries: existsSync(/*turbopackIgnore: true*/ galleriesPath)
        ? readFileSync(/*turbopackIgnore: true*/ galleriesPath)
        : null,
    };
  }
  const blobs = await fetchSnapshotBlobs(id);
  try {
    if (blobs.galleries) {
      await writeFile(`${galleriesPath}.partial`, blobs.galleries);
      await rename(`${galleriesPath}.partial`, galleriesPath);
    }
    await writeFile(`${payloadPath}.partial`, blobs.payload);
    await rename(`${payloadPath}.partial`, payloadPath);
  } catch (err) {
    logger.warn("snapshot-store", "local snapshot cache write failed", { error: err });
  }
  return blobs;
}

/** Payloads are several MB, so they go over the WebSocket driver instead of the HTTP one. */
async function fetchSnapshotBlobs(id: number): Promise<{ payload: Buffer; galleries: Buffer | null }> {
  const pool = new Pool({ connectionString: databaseUrl() });
  try {
    const { rows } = await pool.query(
      "SELECT payload_gzip, galleries_gzip FROM housing.snapshots WHERE id = $1",
      [id],
    );
    const row = rows[0] as { payload_gzip: unknown; galleries_gzip: unknown } | undefined;
    if (!row) throw new Error(`snapshot ${id} not found`);
    return {
      payload: toBuffer(row.payload_gzip),
      galleries: row.galleries_gzip == null ? null : toBuffer(row.galleries_gzip),
    };
  } finally {
    await pool.end();
  }
}

async function loadNeonSnapshot(): Promise<LoadedSnapshot | null> {
  const db = getDb();
  if (!db) return null;
  if (state.neon && Date.now() - state.pointerCheckedAt < POINTER_TTL_MS) return state.neon;

  const pointer = await db.execute(sql`
    SELECT s.id, s.content_hash
    FROM housing.snapshot_pointer p
    JOIN housing.snapshots s ON s.id = p.snapshot_id
    WHERE p.id = 'active'
  `);
  state.pointerCheckedAt = Date.now();
  const row = pointer.rows[0] as { id: number; content_hash: string } | undefined;
  if (!row) return null;
  if (state.neon?.contentHash === row.content_hash) return state.neon;

  const t0 = performance.now();
  const blobs = await cachedSnapshotBlobs(Number(row.id), row.content_hash);
  const data = JSON.parse(gunzipSync(blobs.payload).toString("utf8")) as SnapshotData;
  const check = listingSnapshotSchema.safeParse(data);
  if (!check.success) {
    const issue = check.error.issues[0];
    throw new Error(`active snapshot ${row.id} violates the contract at ${issue?.path.join(".")}: ${issue?.message}`);
  }
  const galleries = blobs.galleries
    ? (JSON.parse(gunzipSync(blobs.galleries).toString("utf8")) as PhotoGalleries)
    : {};
  state.neon = {
    data,
    contentHash: row.content_hash,
    source: "neon",
    galleries,
    galleriesHash: `neon:${row.content_hash}`,
  };
  logger.info("snapshot-store", "loaded active snapshot", {
    id: row.id,
    contentHash: row.content_hash.slice(0, 12),
    properties: data.properties?.length ?? 0,
    durationMs: Math.round(performance.now() - t0),
  });
  return state.neon;
}

/**
 * The listing snapshot the portal serves: the active Neon snapshot (cached per content hash,
 * pointer re-checked every 30 s), else the committed fixture. `HOUSING_SNAPSHOT_SOURCE=file` forces the fixture.
 */
export async function loadActiveSnapshot(): Promise<LoadedSnapshot> {
  if (process.env.HOUSING_SNAPSHOT_SOURCE === "file") return loadFileSnapshot();
  if (state.neon && Date.now() - state.pointerCheckedAt < POINTER_TTL_MS) return state.neon;
  state.loading ??= loadNeonSnapshot()
    .then((neon) => neon ?? loadFileSnapshot())
    .catch((err) => {
      logger.error("snapshot-store", "Neon snapshot unavailable; serving the last loaded one or the fixture", {
        error: err,
      });
      state.pointerCheckedAt = Date.now();
      return state.neon ?? loadFileSnapshot();
    })
    .finally(() => {
      state.loading = null;
    });
  return state.loading;
}
