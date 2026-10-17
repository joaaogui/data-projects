import "server-only";

import { logger } from "@/lib/logger";
import {
  precomputeListingFeatures,
  type PrecomputedListing,
} from "@/lib/scoring-engine";
import type { SlimPropertyRecord } from "@/types/housing";
import { createHash } from "node:crypto";

const MAX_ENTRIES = 3;
const cache = new Map<string, PrecomputedListing[]>();

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
  const hit = cache.get(contentHash);
  if (hit) {
    cache.delete(contentHash);
    cache.set(contentHash, hit);
    return hit;
  }
  const t0 = performance.now();
  const input = buildInput();
  const listings = precomputeListingFeatures(input);
  cache.set(contentHash, listings);
  while (cache.size > MAX_ENTRIES) {
    cache.delete(cache.keys().next().value!);
  }
  logger.info("listing-features", "precomputed listing features", {
    contentHash: contentHash.slice(0, 12),
    count: listings.length,
    durationMs: Math.round(performance.now() - t0),
  });
  return listings;
}
