import { NextResponse } from "next/server";

import { PLAYER_TAG } from "@/lib/brawl-stars";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const brawlStarsApi = Boolean(
    process.env.BRAWL_STARS_API_KEY?.trim(),
  );
  const googleGenerativeAi = Boolean(
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim(),
  );
  const groq = Boolean(process.env.GROQ_API_KEY?.trim());
  const aiProvider = googleGenerativeAi || groq;

  return NextResponse.json(
    {
      status:
        brawlStarsApi && aiProvider ? "ready" : "needs_configuration",
      playerTag: PLAYER_TAG,
      configuration: {
        brawlStarsApi,
        googleGenerativeAi,
        groq,
      },
      checkedAt: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
