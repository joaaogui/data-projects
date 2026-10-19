import { neighborhoodResearchKeySchema, parseWith } from "@/lib/api-guards";
import { getNeighborhoodDossier } from "@/lib/neighborhood-research";
import { NextResponse } from "next/server";

/** Full research dossier for one neighbourhood (public read; the data only changes on deploy). */
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  let decoded: string;
  try {
    decoded = decodeURIComponent(key);
  } catch {
    decoded = "";
  }
  const parsed = parseWith(neighborhoodResearchKeySchema, decoded);
  if (!parsed.ok) return parsed.response;
  const dossier = getNeighborhoodDossier(parsed.data);
  if (!dossier) {
    return NextResponse.json({ ok: false, error: "Bairro sem pesquisa." }, { status: 404 });
  }
  return NextResponse.json(
    { ok: true, dossier },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
