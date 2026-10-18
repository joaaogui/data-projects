import "server-only";

import { getDb, schema } from "@/db";
import { logger } from "@/lib/logger";
import { eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** "scrape-runner" is written by the scraper's runner (heartbeat), read by lib/scrape-jobs.ts. */
export type RuntimeKvNamespace = "listing-deactivation" | "geocode" | "photo-gallery" | "scrape-runner";

export interface RuntimeKv<V> {
  /** Every entry, cached per instance for `ttlMs` (writes on this instance show up immediately). */
  all(): Promise<ReadonlyMap<string, V>>;
  set(key: string, value: V): Promise<void>;
  /** Changes whenever the loaded entries change. */
  signature(): string;
}

/**
 * Small runtime maps live in housing.runtime_kv. Without a database (local dev) they fall back
 * to a JSON file in the OS temp dir — never inside the repo.
 */
function signatureOf(map: ReadonlyMap<string, unknown>): string {
  const h = createHash("sha256");
  for (const key of [...map.keys()].sort()) h.update(key).update(JSON.stringify(map.get(key))).update("\u0000");
  return `${map.size}:${h.digest("hex").slice(0, 16)}`;
}

export function createRuntimeKv<V>(namespace: RuntimeKvNamespace, ttlMs: number): RuntimeKv<V> {
  const tmpFile = join(tmpdir(), `housing-kv-${namespace}.json`);
  let cache: Map<string, V> | null = null;
  let loadedAt = 0;
  let contentSig = "empty";
  let inFlight: Promise<Map<string, V>> | null = null;

  async function loadFromDb(): Promise<Map<string, V>> {
    const db = getDb();
    if (!db) {
      if (!existsSync(/*turbopackIgnore: true*/ tmpFile)) return new Map();
      try {
        const raw = JSON.parse(readFileSync(/*turbopackIgnore: true*/ tmpFile, "utf8")) as Record<string, V>;
        return new Map(Object.entries(raw));
      } catch {
        return new Map();
      }
    }
    const rows = await db
      .select({ key: schema.runtimeKv.key, value: schema.runtimeKv.value })
      .from(schema.runtimeKv)
      .where(eq(schema.runtimeKv.namespace, namespace));
    return new Map(rows.map((r) => [r.key, r.value as V]));
  }

  return {
    async all() {
      if (cache && Date.now() - loadedAt < ttlMs) return cache;
      inFlight ??= loadFromDb()
        .then((map) => {
          cache = map;
          loadedAt = Date.now();
          contentSig = signatureOf(map);
          return map;
        })
        .catch((err) => {
          logger.warn("runtime-kv", "load failed; serving last known entries", { namespace, error: err });
          loadedAt = Date.now();
          return cache ?? new Map<string, V>();
        })
        .finally(() => {
          inFlight = null;
        });
      return inFlight;
    },

    async set(key, value) {
      const current = await this.all();
      const next = new Map(current);
      next.set(key, value);
      cache = next;
      contentSig = signatureOf(next);
      const db = getDb();
      if (!db) {
        const partial = `${tmpFile}.${process.pid}.partial`;
        await writeFile(partial, JSON.stringify(Object.fromEntries(next)), "utf8");
        await rename(partial, tmpFile);
        return;
      }
      await db
        .insert(schema.runtimeKv)
        .values({ namespace, key, value: value as object })
        .onConflictDoUpdate({
          target: [schema.runtimeKv.namespace, schema.runtimeKv.key],
          set: { value: sql`excluded.value`, updatedAt: sql`now()` },
        });
    },

    signature() {
      return `${namespace}:${contentSig}`;
    },
  };
}
