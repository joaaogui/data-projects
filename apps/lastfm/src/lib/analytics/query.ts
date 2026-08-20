import { db } from "@/db";
import { env } from "@/lib/env";
import { sql, type SQL } from "drizzle-orm";

/**
 * Scrobbles are stored as UTC instants. Every "when did I listen" question is
 * really about local wall-clock time, so each query rebases through this before
 * bucketing by hour, day or month. The zone is a bound parameter, not
 * interpolated text.
 */
export const localPlayedAt = sql`(s.played_at AT TIME ZONE ${env.LASTFM_TIMEZONE})`;

export async function rows<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}

export async function firstRow<T>(query: SQL): Promise<T | null> {
  const result = await rows<T>(query);
  return result[0] ?? null;
}

/** Postgres hands back numerics as strings; every count here fits a double. */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

/** Dates arrive as `YYYY-MM-DD` or a full timestamp; keep only the day. */
export function day(value: unknown): string {
  return str(value).slice(0, 10);
}
