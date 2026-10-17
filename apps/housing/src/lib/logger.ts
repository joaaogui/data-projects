import { appendFileSync } from "node:fs";
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

  try {
    appendFileSync(
      /*turbopackIgnore: true*/ HOUSING_RUNTIME_LOG_FILE,
      `${readableLine} | json=${JSON.stringify(entry)}\n`,
      "utf8",
    );
  } catch {
    // Ignore file write errors in read-only environments
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
