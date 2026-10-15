import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const omdbConfigured = Boolean(process.env.OMDB_API_KEY?.trim());
  const tmdbConfigured = Boolean(process.env.TMDB_API_KEY?.trim());

  return NextResponse.json(
    {
      status: omdbConfigured ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        omdbApiKey: omdbConfigured,
        tmdbApiKey: tmdbConfigured,
      },
    },
    {
      status: omdbConfigured ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
