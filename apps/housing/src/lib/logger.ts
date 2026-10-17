import { appendFile } from "node:fs/promises";
import { join } from "node:path";

export const HOUSING_RUNTIME_LOG_FILE = join(
  process.cwd(),
  ".housing-runtime.log",
);

export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface StructuredLogEntry {
  ts: string;
  level: LogLevel;
  scope: string;
  event: string;
  [key: string]: unknown;
}

const FLUSH_DELAY_MS = 1_000;
const MAX_BUFFERED_LINES = 2_000;

/**
 * The file sink is a local debugging aid: on by default only under `next dev`, never in tests or
 * on Vercel; `HOUSING_RUNTIME_LOG=1|0` overrides.
 */
function fileSinkEnabled(): boolean {
  const flag = process.env.HOUSING_RUNTIME_LOG;
  if (flag === "1") return true;
  if (flag === "0") return false;
  if (process.env.VITEST || process.env.VERCEL) return false;
  return process.env.NODE_ENV === "development";
}

let buffer: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushChain: Promise<void> = Promise.resolve();

function flushBuffer(): Promise<void> {
  flushTimer = null;
  if (buffer.length === 0) return flushChain;
  const chunk = buffer.join("");
  buffer = [];
  flushChain = flushChain
    .then(() => appendFile(/*turbopackIgnore: true*/ HOUSING_RUNTIME_LOG_FILE, chunk, "utf8"))
    .catch(() => {
      // Read-only filesystem: the console line already went out.
    });
  return flushChain;
}

function enqueueFileLine(line: string): void {
  if (buffer.length >= MAX_BUFFERED_LINES) buffer.shift();
  buffer.push(line);
  if (flushTimer) return;
  flushTimer = setTimeout(() => void flushBuffer(), FLUSH_DELAY_MS);
  flushTimer.unref?.();
}

/** Writes buffered lines now; for scripts that exit right after logging. */
export function flushRuntimeLog(): Promise<void> {
  if (flushTimer) clearTimeout(flushTimer);
  return flushBuffer();
}

function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack?.split("\n").slice(0, 4).join(" | "),
    };
  }
  return { message: String(err) };
}

function normalizeMeta(
  meta?: Record<string, unknown>,
): Record<string, unknown> {
  if (!meta) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (value instanceof Error) {
      out[key] = serializeError(value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out;
}

function emitLog(
  level: LogLevel,
  scope: string,
  event: string,
  meta?: Record<string, unknown>,
): StructuredLogEntry {
  const ts = new Date().toISOString();
  const normalized = normalizeMeta(meta);
  const entry: StructuredLogEntry = {
    ts,
    level,
    scope,
    event,
    ...normalized,
  };

  const metaJson =
    Object.keys(normalized).length > 0 ? ` ${JSON.stringify(normalized)}` : "";
  const readableLine = `[housing][${ts}][${level}][${scope}] ${event}${metaJson}`;

  if (level === "ERROR") {
    console.error(readableLine);
  } else if (level === "WARN") {
    console.warn(readableLine);
  } else {
    console.info(readableLine);
  }

  if (fileSinkEnabled()) {
    enqueueFileLine(`${readableLine} | json=${JSON.stringify(entry)}\n`);
  }

  return entry;
}

export const logger = {
  info(
    scope: string,
    event: string,
    meta?: Record<string, unknown>,
  ): StructuredLogEntry {
    return emitLog("INFO", scope, event, meta);
  },
  warn(
    scope: string,
    event: string,
    meta?: Record<string, unknown>,
  ): StructuredLogEntry {
    return emitLog("WARN", scope, event, meta);
  },
  error(
    scope: string,
    event: string,
    meta?: Record<string, unknown>,
  ): StructuredLogEntry {
    return emitLog("ERROR", scope, event, meta);
  },
};
