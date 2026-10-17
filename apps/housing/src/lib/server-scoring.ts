import "server-only";

import { processScoped } from "@/lib/process-cache";
import { loadServedListings, type ServedListings } from "@/lib/dataset-store";
import { getPrecomputedListings, hashContent } from "@/lib/listing-features-store";
import { logger } from "@/lib/logger";
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

/** Scores every listing for a weight set; cached per (listing features, weights, benchmark flag). */
export async function getScoredProperties(
  weights: ScoringWeights,
  options: { includeBsbBenchmark: boolean; signal?: AbortSignal },
): Promise<ScoredSet> {
  const served = await loadServedListings();
  const key = hashContent(
    served.featureHash,
    buildWeightsKey(weights),
    options.includeBsbBenchmark ? "bsb" : "",
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
  const listings = getListings(served);
  const { ranked } = computeDynamicNeighborhoods(served.neighborhoods, weights);
  const properties = scorePrecomputedListings(listings, ranked, weights, {
    includeBsbBenchmark: options.includeBsbBenchmark,
  });
  const set: PhotoTrackedSet = {
    // Photo-cache updates don't change scores; keep client result caches valid.
    datasetHash: served.featureHash.slice(0, 16),
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
  for (const p of served.properties) {
    (namesByCity[p.cityCode] ??= new Set()).add(p.neighborhood);
  }
  const meta: DatasetMeta = {
    updatedAt: served.updatedAt,
    source: served.source,
    totalCount: served.properties.length,
    neighborhoods: served.neighborhoods,
    neighborhoodNamesByCity: Object.fromEntries(
      Object.entries(namesByCity).map(([city, names]) => [city, [...names]]),
    ),
  };
  state.metaCache = { servedHash: served.servedHash, meta };
  return meta;
}
