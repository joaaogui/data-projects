import "server-only";

import { processScoped } from "@/lib/process-cache";
import { logger } from "@/lib/logger";
import {
  precomputeListingFeatures,
  type PrecomputedListing,
} from "@/lib/scoring-engine";
import type { SlimPropertyRecord } from "@/types/housing";
import { createHash } from "node:crypto";

const MAX_ENTRIES = 3;

interface ListingFeaturesState {
  cache: Map<string, PrecomputedListing[]>;
}

const state = processScoped<ListingFeaturesState>("listing-features", () => ({
  cache: new Map(),
}));

export function hashContent(...parts: Array<string | Buffer>): string {
  const h = createHash("sha1");
  for (const part of parts) {
    h.update(part);
    h.update("\u0000");
  }
  return h.digest("hex");
}

/**
 * Listing-only features (normalization, duplicates merge, nuances, modernity, furniture tier…)
 * computed once per input content hash and reused for every weight set.
 */
export function getPrecomputedListings(
  contentHash: string,
  buildInput: () => SlimPropertyRecord[],
): PrecomputedListing[] {
  const hit = state.cache.get(contentHash);
  if (hit) {
    state.cache.delete(contentHash);
    state.cache.set(contentHash, hit);
    return hit;
  }
  const t0 = performance.now();
  const input = buildInput();
  const listings = precomputeListingFeatures(input);
  state.cache.set(contentHash, listings);
  while (state.cache.size > MAX_ENTRIES) {
    state.cache.delete(state.cache.keys().next().value!);
  }
  logger.info("listing-features", "precomputed listing features", {
    contentHash: contentHash.slice(0, 12),
    count: listings.length,
    durationMs: Math.round(performance.now() - t0),
  });
  return listings;
}
