import { describe, expect, it } from "vitest";
import seed from "@/data/seed-snapshot.json";
import { loadServedListings } from "@/lib/dataset-store";
import { cleanListingText } from "@/lib/listing-normalization";

type SeedProperty = {
  provider: string;
  id: string | number;
  description?: string | null;
};

const keyOf = (p: SeedProperty) => `${p.provider}:${p.id}`;

describe("loadServedListings", () => {
  // Contract: every listing is scored with its full cleaned description. The former
  // "description deferral" (score the listing without text when the text did not change the
  // default-weights evaluation) was removed: it cost two full evaluations at cold start and
  // made scores depend on whether a listing was deferred.
  it("serves every listing with its cleaned seed description (nothing deferred)", async () => {
    const served = await loadServedListings();
    const seedProperties = seed.properties as unknown as SeedProperty[];
    const seedByKey = new Map(seedProperties.map((p) => [keyOf(p), p]));

    // No listing is dropped or invented.
    expect(served.properties).toHaveLength(seedProperties.length);
    expect(served.properties.every((p) => seedByKey.has(keyOf(p)))).toBe(true);

    // Served text is exactly the cleaned seed text — never blanked, truncated or invented.
    const mismatched = served.properties.filter(
      (p) => p.description !== cleanListingText(seedByKey.get(keyOf(p))?.description),
    );
    expect(mismatched.map(keyOf)).toEqual([]);

    // Guard against a vacuous pass: the seed has plenty of text.
    expect(
      seedProperties.filter((p) => (p.description ?? "").trim().length > 0).length,
    ).toBeGreaterThan(1_000);
  });
});
