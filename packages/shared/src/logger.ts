import pino, { type Logger } from "pino";

export function createLogger(defaultMeta?: Record<string, unknown>): Logger {
  const isProduction = process.env.NODE_ENV === "production";
  const instance = pino({
    level: process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  return defaultMeta ? instance.child(defaultMeta) : instance;
}

export const logger = createLogger();

export function createTaggedLogger(tag: string): Logger {
  return logger.child({ tag });
}

export type { Logger };
