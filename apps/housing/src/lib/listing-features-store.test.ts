import { describe, expect, it } from "vitest";
import { getPrecomputedListings, hashContent } from "@/lib/listing-features-store";
import type { SlimPropertyRecord } from "@/types/housing";

function slim(id: string, overrides: Partial<SlimPropertyRecord> = {}): SlimPropertyRecord {
  return {
    provider: "quintoandar",
    id,
    cityCode: "BH",
    city: "Belo Horizonte",
    neighborhood: "Funcionários",
    street: `Rua Sintetica ${id}`,
    streetNumber: "10",
    condominiumName: null,
    doorman: null,
    url: `https://example.com/imovel/${id}`,
    title: "Apartamento sintetico",
    rent: 2500,
    condoFee: 400,
    iptu: 100,
    totalMonthly: 3000,
    salePrice: null,
    areaM2: 55,
    bedrooms: 2,
    suites: 1,
    bathrooms: 1,
    parkingSpaces: 1,
    floor: 5,
    floorRange: null,
    totalFloors: 10,
    furnished: false,
    acceptsPets: true,
    nearSubway: false,
    constructionYear: 2015,
    condition: null,
    installations: ["Elevador"],
    amenities: [],
    comfortCommodities: [],
    practicalityCommodities: [],
    placesNearby: [],
    photoCaptions: [],
    photosCount: 3,
    modernityScore: 80,
    modernityTier: "MODERN_OR_RENOVATED",
    positiveSignals: [],
    negativeSignals: [],
    samplePhotos: [{ room: null, url: "https://example.com/p.jpg" }],
    description: "Apartamento sintetico com varanda.",
    generatedDescription: null,
    sourceSearch: null,
    isNewEntry: false,
    ...overrides,
  };
}

describe("hashContent", () => {
  it("is deterministic, separator-aware and accepts buffers", () => {
    expect(hashContent("alpha", "beta")).toBe(hashContent("alpha", "beta"));
    expect(hashContent("alpha", "beta")).not.toBe(hashContent("alphabeta"));
    expect(hashContent("alpha")).not.toBe(hashContent("beta"));
    expect(hashContent(Buffer.from("alpha"))).toBe(hashContent("alpha"));
    // SHA-256 of empty input is a well-known constant.
    expect(hashContent()).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(hashContent("x")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("getPrecomputedListings", () => {
  it("builds once per hash and returns the same array on a cache hit", () => {
    let builds = 0;
    const build = () => {
      builds += 1;
      return [slim("hit-1")];
    };
    const first = getPrecomputedListings("lf-hit", build);
    const second = getPrecomputedListings("lf-hit", build);
    expect(builds).toBe(1);
    expect(second).toBe(first);
    expect(first[0]?.prop.id).toBe("hit-1");
    expect(first[0]?.features).toBeDefined();
  });

  it("evicts the least-recently-used entry beyond capacity and refreshes on touch", () => {
    const counts = new Map<string, number>();
    const buildFor = (key: string) => () => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return [slim(`prop-${key}`)];
    };
    getPrecomputedListings("lf-a", buildFor("lf-a"));
    getPrecomputedListings("lf-b", buildFor("lf-b"));
    getPrecomputedListings("lf-c", buildFor("lf-c"));
    // Touch A so B becomes least recent, then add D (capacity is 3).
    getPrecomputedListings("lf-a", buildFor("lf-a"));
    getPrecomputedListings("lf-d", buildFor("lf-d"));
    expect(counts.get("lf-a")).toBe(1);
    // B was evicted: rebuilding it increments its counter.
    getPrecomputedListings("lf-b", buildFor("lf-b"));
    expect(counts.get("lf-b")).toBe(2);
    // A survived eviction.
    getPrecomputedListings("lf-a", buildFor("lf-a"));
    expect(counts.get("lf-a")).toBe(1);
  });

  it("keeps different hashes independent", () => {
    const one = getPrecomputedListings("lf-one", () => [slim("one")]);
    const two = getPrecomputedListings("lf-two", () => [slim("two", { areaM2: 90 })]);
    expect(one[0]?.prop.id).toBe("one");
    expect(two[0]?.prop.areaM2).toBe(90);
  });
});
