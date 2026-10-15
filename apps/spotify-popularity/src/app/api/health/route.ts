import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export function GET() {
  const spotifyClientId = Boolean(process.env.SPOTIFY_CLIENT_ID?.trim())
  const spotifyClientSecret = Boolean(process.env.SPOTIFY_CLIENT_SECRET?.trim())
  const allOk = spotifyClientId && spotifyClientSecret

  return NextResponse.json(
    {
      status: allOk ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        spotifyClientId,
        spotifyClientSecret,
      },
    },
    {
      status: allOk ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
