import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import type { SyncLogEntry } from "@/types/youtube";
import { eq, sql } from "drizzle-orm";
import { createTaggedLogger } from "./logger";

export interface JobLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  flush(): Promise<void>;
}

export function createJobLogger(jobId: string, prefix: string): JobLogger {
  const log = createTaggedLogger(`job:${prefix}`).child({ jobId: jobId.slice(0, 8) });
  const buffer: SyncLogEntry[] = [];
  let flushPromise: Promise<void> | null = null;

  function push(level: SyncLogEntry["level"], msg: string) {
    const entry: SyncLogEntry = { ts: Date.now(), level, msg };
    buffer.push(entry);

    if (level === "error") log.error(msg);
    else if (level === "warn") log.warn(msg);
    else log.info(msg);
  }

  async function doFlush() {
    if (buffer.length === 0) return;
    const entries = buffer.splice(0);
    const entriesJson = JSON.stringify(entries);

    await db
      .update(syncJobs)
      .set({
        logs: sql`(COALESCE(${syncJobs.logs}, '[]'::jsonb) || ${entriesJson}::jsonb)`,
      })
      .where(eq(syncJobs.id, jobId));
  }

  return {
    info: (msg) => push("info", msg),
    warn: (msg) => push("warn", msg),
    error: (msg) => push("error", msg),

    flush() {
      const prev = flushPromise ?? Promise.resolve();
      flushPromise = prev.then(doFlush).finally(() => { flushPromise = null; });
      return flushPromise;
    },
  };
}
