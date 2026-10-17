import { resolveEnabledHiddenCities } from "@/lib/city-config";
import { logger } from "@/lib/logger";
import { coerceWeights, toDetailsDTO } from "@/lib/property-query";
import { getScoredProperties } from "@/lib/server-scoring";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_KEYS = 60;

/** Full records (description, all photos, full breakdown/justifications) for a few listings. */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const keys = Array.isArray(body.keys)
    ? body.keys.filter((k): k is string => typeof k === "string").slice(0, MAX_KEYS)
    : [];
  try {
    const set = await getScoredProperties(coerceWeights(body.weights), {
      enabledHiddenCities: resolveEnabledHiddenCities(body),
      signal: request.signal,
    });
    set.byKey ??= new Map(set.properties.map((p) => [`${p.provider}:${p.id}`, p]));
    const items = keys
      .map((k) => set.byKey!.get(k))
      .filter((p) => p !== undefined)
      .map(toDetailsDTO);
    return NextResponse.json(
      { ok: true, datasetHash: set.datasetHash, items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    logger.error("api/properties/details", "details failed", { error: err });
    return NextResponse.json({ ok: false, error: "details failed" }, { status: 500 });
  }
}
