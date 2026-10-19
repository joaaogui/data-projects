import "server-only";

import {
  filterVisibleCities,
  isCityVisible,
  normalizeEnabledHiddenCities,
} from "@/lib/city-config";
import { processScoped } from "@/lib/process-cache";
import { loadServedListings, type ServedListings } from "@/lib/dataset-store";
import { getPrecomputedListings, hashContent } from "@/lib/listing-features-store";
import { logger } from "@/lib/logger";
import {
  getNeighborhoodDossier,
  getNeighborhoodSummary,
  summarizeDossier,
} from "@/lib/neighborhood-research";
import { REFERENCE_NEIGHBORHOOD } from "@/lib/reference-neighborhood";
import {
  buildWeightsKey,
  type DatasetMeta,
  type ScoredSet,
} from "@/lib/property-query";
import {
  computeDynamicNeighborhoods,
  scorePrecomputedListings,
  type PrecomputedListing,
} from "@/lib/scoring-engine";
import type { CityHubCode, ScoringWeights } from "@/types/housing";
import type { NeighborhoodResearchSummary } from "@/types/neighborhood-research";

const MAX_SCORED_SETS = 6;

type PhotoTrackedSet = ScoredSet & { servedHash: string };

interface ServerScoringState {
  scoredSets: Map<string, PhotoTrackedSet>;
  photoPatched: { servedHash: string; listings: PrecomputedListing[] } | null;
  metaCache: { servedHash: string; meta: DatasetMeta } | null;
}

const state = processScoped<ServerScoringState>("server-scoring", () => ({
  scoredSets: new Map(),
  photoPatched: null,
  metaCache: null,
}));

function getListings(served: ServedListings): PrecomputedListing[] {
  if (state.photoPatched?.servedHash === served.servedHash) return state.photoPatched.listings;
  const precomputed = getPrecomputedListings(served.featureHash, () => served.properties);
  // Features never depend on photos, so a photo-cache update only swaps the photo fields.
  const listings = precomputed.map((listing, i) => {
    const current = served.properties[i]!;
    if (
      listing.prop.samplePhotos === current.samplePhotos &&
      listing.prop.photosCount === current.photosCount
    ) {
      return listing;
    }
    return {
      prop: {
        ...listing.prop,
        samplePhotos: current.samplePhotos,
        photosCount: current.photosCount,
      },
      features: listing.features,
    };
  });
  state.photoPatched = { servedHash: served.servedHash, listings };
  return listings;
}

/** Copies the current photo fields onto an already scored set (scores never read photos). */
function patchPhotos(set: PhotoTrackedSet, served: ServedListings): void {
  const byKey = new Map(served.properties.map((p) => [`${p.provider}:${p.id}`, p]));
  for (const p of set.properties) {
    const current = byKey.get(`${p.provider}:${p.id}`);
    if (!current) continue;
    p.samplePhotos = current.samplePhotos;
    p.photosCount = current.photosCount;
  }
  // The ACTIVE_ONLY filter drops listings without photos, so cached matches may change.
  set.filtered.clear();
  set.servedHash = served.servedHash;
}

/**
 * Scores the listings of every visible city for a weight set; cached per (listing features, weights,
 * enabled hidden cities). Hidden cities (SP, BSB unless enabled) are dropped before scoring, so ranks and
 * neighborhood ranking are computed without them; the data itself is untouched.
 */
export async function getScoredProperties(
  weights: ScoringWeights,
  options: { enabledHiddenCities: readonly CityHubCode[]; signal?: AbortSignal },
): Promise<ScoredSet> {
  const served = await loadServedListings();
  const enabledHidden = normalizeEnabledHiddenCities(options.enabledHiddenCities);
  const key = hashContent(
    served.featureHash,
    buildWeightsKey(weights),
    enabledHidden.join(","),
  );
  const hit = state.scoredSets.get(key);
  if (hit) {
    state.scoredSets.delete(key);
    state.scoredSets.set(key, hit);
    if (hit.servedHash !== served.servedHash) patchPhotos(hit, served);
    return hit;
  }
  // A superseded request (e.g. a slider tick) shouldn't pay for a full rescore.
  options.signal?.throwIfAborted();
  const t0 = performance.now();
  const listings = getListings(served).filter((l) =>
    isCityVisible(l.prop.cityCode, enabledHidden),
  );
  const { ranked } = computeDynamicNeighborhoods(
    filterVisibleCities(served.neighborhoods, enabledHidden),
    weights,
  );
  const properties = scorePrecomputedListings(listings, ranked, weights, {
    includeBsbBenchmark: true,
  });
  const set: PhotoTrackedSet = {
    // Photo-cache updates don't change scores; keep client result caches valid.
    datasetHash: hashContent(served.featureHash, enabledHidden.join(",")).slice(0, 16),
    servedHash: served.servedHash,
    properties,
    ranked,
    filtered: new Map(),
  };
  state.scoredSets.set(key, set);
  while (state.scoredSets.size > MAX_SCORED_SETS) {
    state.scoredSets.delete(state.scoredSets.keys().next().value!);
  }
  logger.info("server-scoring", "scored listings", {
    count: properties.length,
    durationMs: Math.round(performance.now() - t0),
  });
  return set;
}

export async function getDatasetMeta(): Promise<DatasetMeta> {
  const served = await loadServedListings();
  if (state.metaCache?.servedHash === served.servedHash) return state.metaCache.meta;
  const namesByCity: Partial<Record<CityHubCode, Set<string>>> = {};
  const countByCity: Partial<Record<CityHubCode, number>> = {};
  for (const p of served.properties) {
    countByCity[p.cityCode] = (countByCity[p.cityCode] ?? 0) + 1;
    (namesByCity[p.cityCode] ??= new Set()).add(p.neighborhood);
  }
  const neighborhoodResearch: Record<string, NeighborhoodResearchSummary> = {};
  for (const n of served.neighborhoods) {
    const summary = getNeighborhoodSummary(n.cityCode, n.neighborhood);
    if (summary) neighborhoodResearch[`${n.cityCode}:${n.neighborhood}`] = summary;
  }
  const reference = getNeighborhoodDossier(REFERENCE_NEIGHBORHOOD.key);
  if (reference) neighborhoodResearch[REFERENCE_NEIGHBORHOOD.key] = summarizeDossier(reference);
  const meta: DatasetMeta = {
    updatedAt: served.updatedAt,
    source: served.source,
    totalCount: served.properties.length,
    countByCity,
    neighborhoods: served.neighborhoods,
    neighborhoodNamesByCity: Object.fromEntries(
      Object.entries(namesByCity).map(([city, names]) => [city, [...names]]),
    ),
    neighborhoodResearch,
  };
  state.metaCache = { servedHash: served.servedHash, meta };
  return meta;
}
