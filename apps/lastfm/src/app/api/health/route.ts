import { db } from "@/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();
  const checks: Record<string, "ok" | "error"> = {};

  try {
    await db.execute(sql`SELECT 1`);
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  checks.lastfmApiKey = process.env.LASTFM_API_KEY?.trim() ? "ok" : "error";
  checks.lastfmUsername = process.env.LASTFM_USERNAME?.trim() ? "ok" : "error";

  const allOk = Object.values(checks).every((v) => v === "ok");
  const elapsed = Date.now() - start;

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      responseTimeMs: elapsed,
      checks,
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
