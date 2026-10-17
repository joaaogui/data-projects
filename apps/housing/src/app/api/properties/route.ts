import { logger } from "@/lib/logger";
import { parseExplorerFiltersObject } from "@/lib/property-filters";
import {
  coerceWeights,
  runPropertyQuery,
  toQueryFilters,
  type PropertyQueryRequest,
} from "@/lib/property-query";
import { getDatasetMeta, getScoredProperties } from "@/lib/server-scoring";
import { after, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Warm-up ping: builds this instance's listing features after responding. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  let rawWeights: unknown = null;
  try {
    rawWeights = JSON.parse(params.get("w") ?? "null");
  } catch {
    rawWeights = null;
  }
  const weights = coerceWeights(rawWeights);
  after(async () => {
    await getScoredProperties(weights, {
      includeBsbBenchmark: params.get("bsb") === "1",
    });
  });
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

function stringList(raw: unknown, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string" && x.length > 0 && x.length < 200)
    .slice(0, max);
}

export async function POST(request: Request) {
  const t0 = performance.now();
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const state = parseExplorerFiltersObject(
    body.filters && typeof body.filters === "object"
      ? (body.filters as Record<string, unknown>)
      : {},
  );
  const mode =
    body.mode === "copyTop50" || body.mode === "activeKeys" ? body.mode : "page";
  const req: PropertyQueryRequest = {
    filters: toQueryFilters(state),
    weights: coerceWeights(body.weights),
    favorites: stringList(body.favorites, 2000),
    offset: typeof body.offset === "number" ? body.offset : 0,
    limit: typeof body.limit === "number" ? body.limit : undefined,
    includeFacets: body.includeFacets === true,
    includeMeta: body.includeMeta === true,
    mode,
    activeFilterLabels: stringList(body.activeFilterLabels, 100),
    allFavorites: stringList(body.allFavorites, 2000),
  };

  try {
    const set = await getScoredProperties(req.weights, {
      includeBsbBenchmark: state.enableBsbBenchmark,
      signal: request.signal,
    });
    const tScored = performance.now();
    const response = runPropertyQuery(set, req);
    if (req.includeMeta) response.meta = await getDatasetMeta();
    const tDone = performance.now();
    response.timings = {
      scoreMs: Math.round((tScored - t0) * 10) / 10,
      queryMs: Math.round((tDone - tScored) * 10) / 10,
    };
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": "no-store",
        "Server-Timing": `score;dur=${response.timings.scoreMs}, query;dur=${response.timings.queryMs}`,
      },
    });
  } catch (err) {
    if (request.signal.aborted) {
      logger.info("api/properties", "client aborted; skipped scoring", {
        durationMs: Math.round(performance.now() - t0),
      });
      return new NextResponse(null, { status: 499 });
    }
    logger.error("api/properties", "query failed", { error: err });
    return NextResponse.json({ ok: false, error: "query failed" }, { status: 500 });
  }
}
