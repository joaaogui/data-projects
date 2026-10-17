import "server-only";

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
const scoredSets = new Map<string, ScoredSet>();
let photoPatched: { servedHash: string; listings: PrecomputedListing[] } | null = null;
let metaCache: { servedHash: string; meta: DatasetMeta } | null = null;

function getListings(served: ServedListings): PrecomputedListing[] {
  if (photoPatched?.servedHash === served.servedHash) return photoPatched.listings;
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
  photoPatched = { servedHash: served.servedHash, listings };
  return listings;
}

/** Scores every listing for a weight set; cached per (dataset, weights, benchmark flag). */
export async function getScoredProperties(
  weights: ScoringWeights,
  options: { includeBsbBenchmark: boolean },
): Promise<ScoredSet> {
  const served = await loadServedListings();
  const key = hashContent(
    served.servedHash,
    buildWeightsKey(weights),
    options.includeBsbBenchmark ? "bsb" : "",
  );
  const hit = scoredSets.get(key);
  if (hit) {
    scoredSets.delete(key);
    scoredSets.set(key, hit);
    return hit;
  }
  const t0 = performance.now();
  const listings = getListings(served);
  const { ranked } = computeDynamicNeighborhoods(served.neighborhoods, weights);
  const properties = scorePrecomputedListings(listings, ranked, weights, {
    includeBsbBenchmark: options.includeBsbBenchmark,
  });
  const set: ScoredSet = {
    // Photo-cache updates don't change scores or matches; keep client result caches valid.
    datasetHash: served.featureHash.slice(0, 16),
    properties,
    ranked,
    filtered: new Map(),
  };
  scoredSets.set(key, set);
  while (scoredSets.size > MAX_SCORED_SETS) {
    scoredSets.delete(scoredSets.keys().next().value!);
  }
  logger.info("server-scoring", "scored listings", {
    count: properties.length,
    durationMs: Math.round(performance.now() - t0),
  });
  return set;
}

export async function getDatasetMeta(): Promise<DatasetMeta> {
  const served = await loadServedListings();
  if (metaCache?.servedHash === served.servedHash) return metaCache.meta;
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
  metaCache = { servedHash: served.servedHash, meta };
  return meta;
}
