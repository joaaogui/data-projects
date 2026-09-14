import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const clashRoyale = Boolean(process.env.CLASH_ROYALE_API_KEY?.trim());
  const ai = Boolean(
    process.env.GROQ_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim(),
  );

  return NextResponse.json(
    {
      status: clashRoyale && ai ? "ready" : "needs_configuration",
      configuration: {
        clashRoyale,
        ai,
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
