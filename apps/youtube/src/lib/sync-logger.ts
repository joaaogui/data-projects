import { db } from "@/db";
import { syncJobs } from "@/db/schema";
import type { SyncLogEntry } from "@/types/youtube";
import { eq } from "drizzle-orm";

export interface JobLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  flush(): Promise<void>;
}

export function createJobLogger(jobId: string, prefix: string): JobLogger {
  const tag = `[${prefix}][${jobId.slice(0, 8)}]`;
  const buffer: SyncLogEntry[] = [];
  let flushPromise: Promise<void> | null = null;

  function push(level: SyncLogEntry["level"], msg: string) {
    const entry: SyncLogEntry = { ts: Date.now(), level, msg };
    buffer.push(entry);

    if (level === "error") console.error(tag, msg);
    else if (level === "warn") console.warn(tag, msg);
    else console.log(tag, msg);
  }

  async function doFlush() {
    if (buffer.length === 0) return;
    const entries = buffer.splice(0);

    const [row] = await db
      .select({ logs: syncJobs.logs })
      .from(syncJobs)
      .where(eq(syncJobs.id, jobId))
      .limit(1);

    const current = (row?.logs as SyncLogEntry[] | null) ?? [];
    const MAX_LOGS = 500;
    const allLogs = [...current, ...entries];
    const cappedLogs = allLogs.length > MAX_LOGS ? allLogs.slice(-MAX_LOGS) : allLogs;

    await db
      .update(syncJobs)
      .set({ logs: cappedLogs })
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
