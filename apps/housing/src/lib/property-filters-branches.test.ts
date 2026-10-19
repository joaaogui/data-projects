import { describe, expect, it } from "vitest";
import {
  buildBenchmarkStats,
  DEFAULT_EXPLORER_FILTERS,
  deriveFurnitureTiersFromLegacyFilter,
  deriveLegacyFurnishedFilter,
  filterAndSortProperties,
  formatTopPropertiesForAiPrompt,
  getEffectiveFloorSortValue,
  hasNoSafetyProblems,
  isRecentlyPublishedListing,
  isStrictlyInTop20Neighborhoods,
  matchesFloorFilter,
  matchesPropertyFeature,
  parseExplorerFiltersObject,
  resolvePropertyListingAgeAndDate,
  serializeExplorerFilters,
  type FloorFilterOption,
  type PropertyExplorerFilters,
} from "@/lib/property-filters";
import type { EvaluatedProperty, FloorRarity } from "@/types/housing";

type Tags = EvaluatedProperty["cardTags"];
const baseTags = (over: Partial<Tags> = {}): Tags => ({
  acLabel: null,
  floorTag: { label: "Andar medio", rarity: "rare" },
  highFloorLabel: null,
  lowFloorLabel: null,
  noParking: false,
  greenTags: [],
  redTags: [],
  warningTags: [],
  ...over,
});
const withRarity = (rarity: FloorRarity | null) =>
  baseTags({ floorTag: rarity ? { label: "x", rarity } : null });

function ep(id: string, over: Partial<EvaluatedProperty> = {}): EvaluatedProperty {
  return {
    provider: "quintoandar",
    id,
    cityCode: "BH",
    city: "Belo Horizonte",
    neighborhood: "Funcionários",
    street: "Rua Sintetica",
    streetNumber: "10",
    condominiumName: null,
    doorman: "NightAndDayShift",
    url: `https://example.com/${id}`,
    title: "Apartamento",
    rent: 2500,
    condoFee: 400,
    iptu: 100,
    totalMonthly: 3000,
    salePrice: null,
    areaM2: 60,
    bedrooms: 2,
    suites: 1,
    bathrooms: 2,
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
    placesNearby: [{ name: "Parque Municipal", type: "PARK_OR_GREEN_AREA" }],
    photoCaptions: [],
    photosCount: 5,
    modernityScore: 80,
    modernityTier: "MODERN_OR_RENOVATED",
    positiveSignals: [],
    negativeSignals: [],
    samplePhotos: [{ room: null, url: "https://example.com/p.jpg" }],
    description: "Apartamento com varanda e piscina",
    generatedDescription: null,
    sourceSearch: null,
    isNewEntry: false,
    isActive: true,
    publishedAt: "2026-01-01T00:00:00.000Z",
    listingUpdatedAt: null,
    listingAgeDays: 10,
    eligible: true,
    exclusionReason: null,
    finalScore: 80,
    cityRank: 1,
    overallRank: 1,
    neighborhoodRank: 1,
    neighborhoodDynamicScore: 9,
    breakdown: {
      neighborhoodPoints: 10,
      modernityPoints: 10,
      nuancesPoints: 5,
      budgetPoints: 5,
      furniturePoints: 5,
      areaPoints: 5,
      parkingPoints: 5,
      safetyPoints: 2,
      commutePoints: 5,
      cityPreferencePoints: 0,
    },
    cardTags: baseTags(),
    nuanceHighlights: [],
    nuanceWarnings: [],
    parksNearby: [],
    mallsNearby: [],
    shortJustification: "Bom imovel.",
    narrativeJustification: "Narrativa.",
    detailedJustification: "Detalhes.",
    furnitureTier: "UNFURNISHED",
    commuteMinutes: 15,
    ...over,
  };
}
const filters = (over: Partial<PropertyExplorerFilters> = {}): PropertyExplorerFilters => ({
  ...DEFAULT_EXPLORER_FILTERS,
  showIneligible: true,
  ...over,
});
const ids = (list: EvaluatedProperty[]) => list.map((p) => p.id);

describe("matchesFloorFilter", () => {
  it("covers every single rarity selector and the unknown-filter fallthrough", () => {
    expect(matchesFloorFilter(ep("a", { cardTags: withRarity("legendary") }), "LEGENDARY")).toBe(true);
    expect(matchesFloorFilter(ep("a", { cardTags: withRarity("epic") }), "LEGENDARY")).toBe(false);
    expect(matchesFloorFilter(ep("a", { cardTags: withRarity("epic") }), "EPIC")).toBe(true);
    expect(matchesFloorFilter(ep("a", { cardTags: withRarity("rare") }), "RARE")).toBe(true);
    expect(matchesFloorFilter(ep("a", { cardTags: withRarity("uncommon") }), "UNCOMMON")).toBe(true);
    expect(matchesFloorFilter(ep("a", { cardTags: withRarity("uncommon") }), "HIGH_OR_TOP")).toBe(false);
    expect(matchesFloorFilter(ep("a", { cardTags: withRarity("legendary") }), "HIGH_OR_TOP")).toBe(true);
    expect(matchesFloorFilter(ep("a"), "ALL")).toBe(true);
    expect(matchesFloorFilter(ep("a"), "BOGUS" as FloorFilterOption)).toBe(true);
  });

  it("handles NO_GROUND and array combinations", () => {
    const ground = ep("g", { floor: 0, cardTags: withRarity("common") });
    const low = ep("l", { floor: 2, cardTags: withRarity("uncommon") });
    expect(matchesFloorFilter(ground, "NO_GROUND")).toBe(false);
    expect(matchesFloorFilter(low, "NO_GROUND")).toBe(true);
    // rarity common rejects even above ground
    expect(matchesFloorFilter(ep("c", { floor: 3, cardTags: withRarity("common") }), "NO_GROUND")).toBe(false);
    expect(matchesFloorFilter(low, [])).toBe(true);
    expect(matchesFloorFilter(low, ["ALL"])).toBe(true);
    expect(matchesFloorFilter(low, ["NO_GROUND"])).toBe(true);
    expect(matchesFloorFilter(ground, ["NO_GROUND", "UNCOMMON"])).toBe(false);
    expect(matchesFloorFilter(low, ["NO_GROUND", "RARE"])).toBe(false);
    expect(matchesFloorFilter(low, ["NO_GROUND", "UNCOMMON"])).toBe(true);
    expect(matchesFloorFilter(low, ["RARE", "UNCOMMON"])).toBe(true);
  });
});

describe("getEffectiveFloorSortValue", () => {
  it("uses floor, then floorRange, then rarity fallbacks", () => {
    expect(getEffectiveFloorSortValue(ep("a", { floor: 7, cardTags: withRarity("legendary") }))).toBe(107);
    expect(getEffectiveFloorSortValue(ep("a", { floor: 7, cardTags: withRarity("rare") }))).toBe(7);
    expect(getEffectiveFloorSortValue(ep("a", { floor: null, floorRange: { min: 4, max: 8 } }))).toBe(6);
    expect(getEffectiveFloorSortValue(ep("a", { floor: null, cardTags: withRarity("legendary") }))).toBe(120);
    expect(getEffectiveFloorSortValue(ep("a", { floor: null, cardTags: withRarity("epic") }))).toBe(12);
    expect(getEffectiveFloorSortValue(ep("a", { floor: null, cardTags: withRarity("rare") }))).toBe(5.5);
    expect(getEffectiveFloorSortValue(ep("a", { floor: null, cardTags: withRarity("uncommon") }))).toBe(2);
    expect(getEffectiveFloorSortValue(ep("a", { floor: null, cardTags: withRarity("common") }))).toBe(0);
    expect(getEffectiveFloorSortValue(ep("a", { floor: null, cardTags: withRarity(null) }))).toBe(-1);
  });
});

describe("hasNoSafetyProblems / isRecentlyPublishedListing / features", () => {
  it("flags red safety tags and negative safety points", () => {
    expect(hasNoSafetyProblems(ep("a"))).toBe(true);
    expect(hasNoSafetyProblems(ep("a", { cardTags: baseTags({ redTags: ["Alerta de Segurança na Rua"] }) }))).toBe(false);
    expect(hasNoSafetyProblems(ep("a", { cardTags: baseTags({ redTags: ["Via Arterial / Efeito Bunker"] }) }))).toBe(false);
    const neg = ep("a");
    neg.breakdown = { ...neg.breakdown, safetyPoints: -1 };
    expect(hasNoSafetyProblems(neg)).toBe(false);
  });

  it("classifies recent listings by age, falling back to isNewEntry", () => {
    expect(isRecentlyPublishedListing(ep("a", { listingAgeDays: 5 }))).toBe(true);
    expect(isRecentlyPublishedListing(ep("a", { listingAgeDays: 6 }))).toBe(false);
    expect(isRecentlyPublishedListing(ep("a", { listingAgeDays: null, isNewEntry: true }))).toBe(true);
    expect(isRecentlyPublishedListing(ep("a", { listingAgeDays: undefined, isNewEntry: false }))).toBe(false);
  });

  it("matches every property feature through its distinct evidence paths", () => {
    expect(matchesPropertyFeature(ep("a", { cardTags: baseTags({ acLabel: "AC central" }) }), "ac")).toBe(true);
    expect(matchesPropertyFeature(ep("a"), "ac")).toBe(false);
    expect(matchesPropertyFeature(ep("a", { cardTags: baseTags({ greenTags: ["Vista livre e sol"] }) }), "free_view_sun")).toBe(true);
    expect(matchesPropertyFeature(ep("a", { nuanceHighlights: ["Sol da manhã na sala"] }), "free_view_sun")).toBe(true);
    expect(matchesPropertyFeature(ep("a"), "free_view_sun")).toBe(false);
    expect(matchesPropertyFeature(ep("a", { cardTags: baseTags({ greenTags: ["Torre única / Reservado"] }) }), "reserved_building")).toBe(true);
    expect(matchesPropertyFeature(ep("a", { nuanceHighlights: ["Torre única / Prédio reservado"] }), "reserved_building")).toBe(true);
    expect(matchesPropertyFeature(ep("a", { constructionYear: 2005, cardTags: baseTags({ greenTags: ["Prédio Novo (2012)"] }) }), "new_building")).toBe(true);
    expect(matchesPropertyFeature(ep("a", { constructionYear: 2005 }), "new_building")).toBe(false);
    expect(matchesPropertyFeature(ep("a", { constructionYear: null }), "new_building")).toBe(false);
    expect(matchesPropertyFeature(ep("a", { nuanceHighlights: ["Varanda"] }), "balcony")).toBe(true);
    expect(matchesPropertyFeature(ep("a", { description: "Tem sacada ampla" }), "balcony")).toBe(true);
    expect(matchesPropertyFeature(ep("a", { suites: 0, description: "Possui suíte master" }), "suite")).toBe(true);
    expect(matchesPropertyFeature(ep("a", { suites: 0, description: "Sem detalhes" }), "suite")).toBe(false);
    expect(matchesPropertyFeature(ep("a", { doorman: "24h" }), "doorman_24h")).toBe(true);
    expect(matchesPropertyFeature(ep("a", { doorman: null, description: "Portaria 24 horas todos os dias" }), "doorman_24h")).toBe(true);
    expect(matchesPropertyFeature(ep("a", { doorman: "NotAvailable", description: "Portaria 24h" }), "doorman_24h")).toBe(false);
    expect(matchesPropertyFeature(ep("a", { description: "Condominio com piscina e academia" }), "pool_gym")).toBe(true);
    expect(matchesPropertyFeature(ep("a", { description: "Sem lazer", amenities: [] }), "pool_gym")).toBe(false);
    expect(matchesPropertyFeature(ep("a", { acceptsPets: false }), "pets")).toBe(false);
    expect(matchesPropertyFeature(ep("a", { acceptsPets: true }), "pets")).toBe(true);
    expect(matchesPropertyFeature(ep("a", { cardTags: baseTags({ redTags: ["Alerta de Segurança na Rua"] }) }), "safe_street")).toBe(false);
  });
});

describe("isStrictlyInTop20Neighborhoods", () => {
  it("accepts listed neighborhoods, rejects others and unknown cities", () => {
    expect(isStrictlyInTop20Neighborhoods(ep("a"))).toBe(true); // Funcionários BH
    expect(isStrictlyInTop20Neighborhoods(ep("a", { neighborhood: "Buritis" }))).toBe(false);
    expect(
      isStrictlyInTop20Neighborhoods(ep("a", { cityCode: "XX" as EvaluatedProperty["cityCode"] })),
    ).toBe(false);
  });

  it("rejects Jd. Oceânico / Barra listings (not in the strict RJ top-20 set)", () => {
    const base = { cityCode: "RJ" as const, neighborhood: "Jd. Oceânico" };
    expect(isStrictlyInTop20Neighborhoods(ep("a", { ...base, description: "Perto do Recreio e Jacarepaguá" }))).toBe(false);
    expect(isStrictlyInTop20Neighborhoods(ep("a", { ...base, street: "Estrada dos Bandeirantes", description: "Confortavel" }))).toBe(false);
    expect(isStrictlyInTop20Neighborhoods(ep("a", { ...base, description: "Confortavel e silencioso" }))).toBe(false);
    expect(isStrictlyInTop20Neighborhoods(ep("a", { cityCode: "RJ", neighborhood: "Flamengo" }))).toBe(true);
  });
});

describe("resolvePropertyListingAgeAndDate", () => {
  it("prefers explicit listingAgeDays and derives the date from it when no ISO exists", () => {
    const r = resolvePropertyListingAgeAndDate(ep("a", { listingAgeDays: 10, publishedAt: null, listingUpdatedAt: null }));
    expect(r.ageDays).toBe(10);
    const expected = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    expect(r.dateIso).toBe(expected);
  });

  it("parses ISO and non-ISO publication dates", () => {
    const iso = resolvePropertyListingAgeAndDate(
      ep("a", { listingAgeDays: null, publishedAt: "2026-01-15T12:00:00.000Z", listingUpdatedAt: null }),
    );
    expect(iso.dateIso).toBe("2026-01-15");
    expect(iso.ageDays).not.toBeNull();
    const loose = resolvePropertyListingAgeAndDate(
      ep("a", {
        listingAgeDays: null,
        publishedAt: "Jan 15 2026",
        listingUpdatedAt: null,
        provider: "zapimoveis",
      }),
    );
    expect(loose.dateIso).toBe("2026-01-15");
  });

  it("returns nulls when there is no date information at all", () => {
    expect(
      resolvePropertyListingAgeAndDate(ep("a", { listingAgeDays: null, publishedAt: null, listingUpdatedAt: null })),
    ).toEqual({ ageDays: null, dateIso: null });
  });
});

describe("filterAndSortProperties — filter combinations", () => {
  const pool = [
    ep("cheap", { totalMonthly: 2000, rent: 1600, areaM2: 45, finalScore: 60 }),
    ep("mid", { totalMonthly: 3000, rent: 2500, areaM2: 60, finalScore: 80 }),
    ep("pricey", { totalMonthly: 6000, rent: 5200, areaM2: 90, finalScore: 95, bedrooms: 3, bathrooms: 3, parkingSpaces: 2 }),
  ];

  it("applies price, score and area bounds", () => {
    expect(ids(filterAndSortProperties(pool, filters({ minTotalMonthly: 2500 })))).toEqual(["pricey", "mid"]);
    expect(ids(filterAndSortProperties(pool, filters({ maxTotalMonthly: 3000 })))).toEqual(["mid", "cheap"]);
    expect(ids(filterAndSortProperties(pool, filters({ minScore: 90 })))).toEqual(["pricey"]);
    expect(ids(filterAndSortProperties(pool, filters({ minAreaM2: 50 })))).toEqual(["pricey", "mid"]);
    expect(ids(filterAndSortProperties(pool, filters({ maxAreaM2: 60 })))).toEqual(["mid", "cheap"]);
    expect(ids(filterAndSortProperties(pool, filters({ maxCommuteMinutes: 10 })))).toEqual([]);
    expect(ids(filterAndSortProperties(pool, filters({ minScore: null })))).toHaveLength(3);
  });

  it("applies room-count selections with 3+/2+ semantics and min fallbacks", () => {
    expect(ids(filterAndSortProperties(pool, filters({ selectedBedrooms: [3] })))).toEqual(["pricey"]);
    expect(ids(filterAndSortProperties(pool, filters({ selectedBedrooms: [2] })))).toEqual(["mid", "cheap"]);
    expect(ids(filterAndSortProperties(pool, filters({ minBedrooms: 3 })))).toEqual(["pricey"]);
    expect(ids(filterAndSortProperties(pool, filters({ selectedBathrooms: [3] })))).toEqual(["pricey"]);
    expect(ids(filterAndSortProperties(pool, filters({ minBathrooms: 3 })))).toEqual(["pricey"]);
    expect(ids(filterAndSortProperties(pool, filters({ selectedParking: [2] })))).toEqual(["pricey"]);
    expect(ids(filterAndSortProperties(pool, filters({ minParking: 2 })))).toEqual(["pricey"]);
  });

  it("applies modernity, furniture and provider filters", () => {
    const mixed = [
      ep("modern", { modernityTier: "MODERN_OR_RENOVATED", modernityScore: 90 }),
      ep("dated", { modernityTier: "DATED", modernityScore: 30, furnitureTier: "FULLY_FURNISHED", provider: "zap" }),
      ep("standard", { modernityTier: "STANDARD", modernityScore: 55, furnitureTier: "UNFURNISHED", provider: "vivareal" }),
    ];
    expect(ids(filterAndSortProperties(mixed, filters({ modernityTiers: ["DATED"] })))).toEqual(["dated"]);
    expect(ids(filterAndSortProperties(mixed, filters({ minModernityScore: 50 })))).toEqual(expect.arrayContaining(["modern", "standard"]));
    expect(ids(filterAndSortProperties(mixed, filters({ furnishedFilter: "UNFURNISHED" })))).toEqual(expect.arrayContaining(["modern", "standard"]));
    expect(ids(filterAndSortProperties(mixed, filters({ furnishedFilter: "UNFURNISHED" })))).not.toContain("dated");
    expect(ids(filterAndSortProperties(mixed, filters({ furnishedFilter: "FURNISHED" })))).toEqual(["dated"]);
    expect(ids(filterAndSortProperties(mixed, filters({ selectedFurnitureTiers: ["FULLY_FURNISHED"] })))).toEqual(["dated"]);
    // zap alias matches both zap and zapimoveis providers
    expect(ids(filterAndSortProperties(mixed, filters({ providerFilter: "zapimoveis" })))).toEqual(["dated"]);
    expect(ids(filterAndSortProperties(mixed, filters({ providerFilter: "vivareal" })))).toEqual(["standard"]);
  });

  it("handles deactivated, BSB, top20, city and neighborhood selection", () => {
    const mixed = [
      ep("active"),
      ep("inactive", { isActive: false }),
      ep("inactive-nophoto", { isActive: false, samplePhotos: [], photosCount: 0 }),
      ep("bsb", { cityCode: "BSB", neighborhood: "Águas Claras" }),
      ep("other-nb", { neighborhood: "Buritis" }),
    ];
    expect(ids(filterAndSortProperties(mixed, filters()))).not.toContain("bsb");
    expect(ids(filterAndSortProperties(mixed, filters({ enabledHiddenCities: ["BSB"] })))).toContain("bsb");
    expect(ids(filterAndSortProperties(mixed, filters({ deactivatedFilter: "DEACTIVATED_ONLY" })))).toEqual(
      expect.arrayContaining(["inactive", "inactive-nophoto"]),
    );
    expect(ids(filterAndSortProperties(mixed, filters({ deactivatedFilter: "ALL" })))).toContain("inactive");
    // ACTIVE_ONLY (default) drops inactive and active-but-photoless
    const photoless = ep("photoless", { samplePhotos: [], photosCount: 0 });
    expect(ids(filterAndSortProperties([photoless], filters()))).toEqual([]);
    expect(ids(filterAndSortProperties(mixed, filters({ onlyTop20Neighborhoods: true })))).not.toContain("other-nb");
    expect(ids(filterAndSortProperties(mixed, filters({ selectedCities: ["BH"] })))).not.toContain("bsb");
    expect(ids(filterAndSortProperties(mixed, filters({ selectedCity: "SP" })))).toEqual([]);
    expect(ids(filterAndSortProperties(mixed, filters({ selectedNeighborhoods: ["Buritis"] })))).toEqual(["other-nb"]);
    expect(ids(filterAndSortProperties(mixed, filters({ selectedNeighborhoods: ["BH:Funcionários"] })))).toContain("active");
    expect(ids(filterAndSortProperties(mixed, filters({ selectedNeighborhoods: ["SP:Funcionários"] })))).toEqual([]);
  });

  it("handles favorites, eligibility overrides, new entries, mega-condo, for-sale, safety, features and search", () => {
    const fav = ep("fav", { isActive: false });
    expect(ids(filterAndSortProperties([fav, ep("x")], filters({ onlyFavorites: true, favoriteKeys: ["quintoandar:fav"] })))).toEqual(["fav"]);
    expect(ids(filterAndSortProperties([fav], filters({ onlyFavorites: true, favoriteKeys: ["fav"] })))).toEqual(["fav"]);
    expect(ids(filterAndSortProperties([ep("x")], filters({ onlyFavorites: true }), ["quintoandar:x"]))).toEqual(["x"]);

    const ineligible = ep("inel", { eligible: false, exclusionReason: "Sem vaga" });
    expect(ids(filterAndSortProperties([ineligible], filters({ showIneligible: false })))).toEqual([]);
    expect(ids(filterAndSortProperties([ineligible], filters({ onlyIneligible: true, showIneligible: false })))).toEqual(["inel"]);
    expect(ids(filterAndSortProperties([ep("ok")], filters({ onlyIneligible: true })))).toEqual([]);
    const furnishedInel = ep("finel", {
      eligible: false,
      furnitureTier: "FULLY_FURNISHED",
      exclusionReason: "Totalmente mobiliado (conflito com mobília própria)",
    });
    expect(
      ids(filterAndSortProperties([furnishedInel], filters({ showIneligible: false, selectedFurnitureTiers: ["FULLY_FURNISHED"] }))),
    ).toEqual(["finel"]);
    const commuteInel = ep("cinel", {
      eligible: false,
      exclusionReason: "Gargalo pendular crítico no trajeto",
    });
    expect(
      ids(filterAndSortProperties([commuteInel], filters({ showIneligible: false, maxCommuteMinutes: 45, selectedNeighborhoods: [] }))),
    ).toEqual(["cinel"]);
    expect(
      ids(filterAndSortProperties([commuteInel], filters({ showIneligible: false, maxCommuteMinutes: 30 }))),
    ).toEqual([]);

    expect(ids(filterAndSortProperties([ep("new", { listingAgeDays: 2 }), ep("old")], filters({ onlyNewEntries: true })))).toEqual(["new"]);
    const mega = ep("mega", { cardTags: baseTags({ redTags: ["Megacondomínio"] }) });
    const megaWarn = ep("megaw", { nuanceWarnings: ["Megacondomínio com 800 unidades"] });
    expect(ids(filterAndSortProperties([mega, megaWarn, ep("ok")], filters({ hideMegaCondo: true })))).toEqual(["ok"]);
    const forSale = ep("sale", { provider: "zapimoveis", salePrice: 800_000 });
    expect(ids(filterAndSortProperties([forSale, ep("ok")], filters({ hideForSale: true })))).toEqual(["ok"]);
    const unsafe = ep("unsafe", { cardTags: baseTags({ redTags: ["Alerta de Segurança na Rua"] }) });
    expect(ids(filterAndSortProperties([unsafe, ep("ok")], filters({ onlySafeStreets: true })))).toEqual(["ok"]);
    expect(ids(filterAndSortProperties([ep("ok")], filters({ requiredFeatures: ["pets", "suite"] })))).toEqual(["ok"]);
    expect(ids(filterAndSortProperties([ep("ok", { acceptsPets: false })], filters({ requiredFeatures: ["pets"] })))).toEqual([]);
    // accent-insensitive search over neighborhood/street/id
    expect(ids(filterAndSortProperties(pool, filters({ searchQuery: "funcionarios" })))).toHaveLength(3);
    expect(ids(filterAndSortProperties(pool, filters({ searchQuery: "rua sintetica" })))).toHaveLength(3);
    expect(ids(filterAndSortProperties(pool, filters({ searchQuery: "cheap" })))).toEqual(["cheap"]);
    expect(ids(filterAndSortProperties(pool, filters({ searchQuery: "nada-a-ver" })))).toEqual([]);
  });

  it("applies listing-age and listing-date windows", () => {
    const young = ep("young", { listingAgeDays: 3 });
    const old = ep("old", { listingAgeDays: 40 });
    const unknown = ep("unknown", { listingAgeDays: null, publishedAt: null, listingUpdatedAt: null });
    const all = [young, old, unknown];
    expect(ids(filterAndSortProperties(all, filters({ minListingAgeDays: 10 })))).toEqual(["old"]);
    expect(ids(filterAndSortProperties(all, filters({ maxListingAgeDays: 10 })))).toEqual(["young"]);
    const dated = ep("dated", { listingAgeDays: null, publishedAt: "2026-01-10T00:00:00.000Z", listingUpdatedAt: null, provider: "zapimoveis" });
    expect(ids(filterAndSortProperties([dated], filters({ listingDateFrom: "2026-01-01", listingDateTo: "2026-01-31" })))).toEqual(["dated"]);
    expect(ids(filterAndSortProperties([dated], filters({ listingDateFrom: "2026-02-01" })))).toEqual([]);
    expect(ids(filterAndSortProperties([dated], filters({ listingDateTo: "2025-12-31" })))).toEqual([]);
    expect(ids(filterAndSortProperties(all, filters({ floorFilters: ["RARE"] })))).toHaveLength(3);
    expect(ids(filterAndSortProperties(all, filters({ floorFilter: "LEGENDARY" })))).toEqual([]);
  });
});

describe("filterAndSortProperties — sorting", () => {
  const a = ep("a", { finalScore: 70, totalMonthly: 4000, rent: 3000, areaM2: 50, modernityScore: 60, floor: 3, commuteMinutes: 30, listingAgeDays: 20 });
  const b = ep("b", { finalScore: 90, totalMonthly: 3000, rent: 3500, areaM2: 80, modernityScore: 90, floor: 9, commuteMinutes: 10, listingAgeDays: 5 });
  const c = ep("c", { finalScore: 90, totalMonthly: 2000, rent: 2000, areaM2: 80, modernityScore: 90, floor: 9, commuteMinutes: 10, listingAgeDays: null, publishedAt: null, listingUpdatedAt: null });
  const all = [a, b, c];
  const sorted = (sortBy: PropertyExplorerFilters["sortBy"]) =>
    ids(filterAndSortProperties(all, filters({ sortBy })));

  it("sorts by score, price, rent, area, modernity, price/m2, floor and commute", () => {
    expect(sorted("score_desc")[0]).toBe("c"); // score tie -> cheaper first
    expect(sorted("score_asc")).toEqual(["a", "c", "b"]);
    expect(sorted("price_asc")).toEqual(["c", "b", "a"]);
    expect(sorted("price_desc")).toEqual(["a", "b", "c"]);
    expect(sorted("rent_asc")).toEqual(["c", "a", "b"]);
    expect(sorted("rent_desc")).toEqual(["b", "a", "c"]);
    expect(sorted("area_desc")[0]).toBe("b");
    expect(sorted("modernity_desc")[0]).not.toBe("a");
    expect(sorted("price_per_m2_asc")[0]).toBe("c");
    expect(sorted("floor_desc")[0]).not.toBe("a");
    expect(sorted("commute_asc")[0]).not.toBe("a");
  });

  it("sorts by listing age with unknown ages last in both directions", () => {
    expect(sorted("age_asc")).toEqual(["b", "a", "c"]);
    expect(sorted("age_desc")).toEqual(["a", "b", "c"]);
    const bothUnknown = [
      ep("u1", { listingAgeDays: null, publishedAt: null, listingUpdatedAt: null, finalScore: 50 }),
      ep("u2", { listingAgeDays: null, publishedAt: null, listingUpdatedAt: null, finalScore: 70 }),
    ];
    expect(ids(filterAndSortProperties(bothUnknown, filters({ sortBy: "age_asc" })))).toEqual(["u2", "u1"]);
    expect(ids(filterAndSortProperties(bothUnknown, filters({ sortBy: "age_desc" })))).toEqual(["u2", "u1"]);
  });

  it("puts eligible listings before ineligible regardless of score", () => {
    const inel = ep("inel", { eligible: false, finalScore: 99 });
    expect(ids(filterAndSortProperties([inel, ep("ok", { finalScore: 10 })], filters()))).toEqual(["ok", "inel"]);
  });
});

describe("buildBenchmarkStats", () => {
  it("returns zeroed stats and empty cohorts for no data", () => {
    const s = buildBenchmarkStats([]);
    expect(s.totalScrapedBsb).toBe(0);
    expect(s.totalEligibleBsb).toBe(0);
    expect(s.bsbMedianMonthly).toBe(0);
    expect(s.contractGapReais).toBe(0);
    expect(s.contractGapPct).toBe(0);
    // SP is hidden by default: it only gets a comparison while SP listings are present/enabled.
    expect(s.cityComparisons).toHaveLength(4);
    expect(s.cityComparisons.map((c) => c.code)).toEqual(["BSB", "CP", "BH", "RJ"]);
    expect(s.cityComparisons.every((c) => c.cohortCount === 0 && c.medianMonthly === null)).toBe(true);
  });

  it("computes BSB medians, counts and a city cohort", () => {
    const bsb = (id: string, monthly: number) =>
      ep(id, {
        cityCode: "BSB",
        city: "Brasilia",
        neighborhood: "Águas Claras",
        totalMonthly: monthly,
        areaM2: 60,
        parkingSpaces: 1,
        modernityScore: 80,
      });
    const s = buildBenchmarkStats([bsb("b1", 3000), bsb("b2", 4000), bsb("b3", 5000), ep("bh1")]);
    expect(s.totalScrapedBsb).toBe(3);
    expect(s.totalEligibleBsb).toBe(3);
    expect(s.countUpTo3400).toBe(1);
    expect(s.countUpTo4000).toBe(2);
    expect(s.countUpTo4500).toBe(2);
    expect(s.bsbMedianMonthly).toBe(4000);
    expect(s.bsbMedianPm2).toBeGreaterThan(0);
    const bsbCity = s.cityComparisons.find((c) => c.code === "BSB")!;
    expect(bsbCity.cohortCount).toBe(3);
    expect(bsbCity.upTo4200Count).toBe(2);
    expect(bsbCity.medianMonthly).toBe(4000);
  });
});

describe("formatTopPropertiesForAiPrompt", () => {
  it("renders the empty state", () => {
    const text = formatTopPropertiesForAiPrompt([]);
    expect(text).toContain("Nenhum imóvel encontrado");
    expect(text).toContain("Filtros ativos**: Nenhum");
  });

  it("renders items with favorites, furniture labels, cleaned and truncated descriptions", () => {
    const full = ep("full", { furnitureTier: "FULLY_FURNISHED", description: "$999" });
    const bare = ep("bare", {
      furnitureTier: "UNFURNISHED",
      description: `Descricao ${"longa ".repeat(80)}`,
      condominiumName: "Ed. Teste",
      suites: 0,
    });
    const text = formatTopPropertiesForAiPrompt([full, bare], {
      activeFilterLabels: ["Barato"],
      favoriteKeys: new Set(["quintoandar:full"]),
      limit: 50,
    });
    expect(text).toContain("Filtros ativos**: Barato");
    expect(text).toContain("[★ FAVORITO]");
    expect(text).toContain("Mobília: Mobiliado");
    expect(text).toContain("Mobília: Sem mobília");
    expect(text).not.toContain("Mobília: Semi");
    expect(text).not.toContain("$999");
    expect(text).toContain("…");
    expect(text).toContain("(Ed. Teste)");
    const limited = formatTopPropertiesForAiPrompt([full, bare], { limit: 1 });
    expect(limited).toContain("Top 1 Imóveis");
    expect(limited).toContain("de 2 imóveis");
  });
});

describe("furniture tier derivations", () => {
  it("derives the legacy filter from tier sets", () => {
    expect(deriveLegacyFurnishedFilter([])).toBe("ALL");
    expect(deriveLegacyFurnishedFilter(["UNFURNISHED"])).toBe("UNFURNISHED");
    expect(deriveLegacyFurnishedFilter(["FULLY_FURNISHED"])).toBe("FURNISHED");
    expect(deriveLegacyFurnishedFilter(["UNFURNISHED", "FULLY_FURNISHED"])).toBe("ALL");
    expect(deriveLegacyFurnishedFilter(["UNFURNISHED", "UNFURNISHED"])).toBe("UNFURNISHED");
  });

  it("derives tiers from every legacy filter value", () => {
    expect(deriveFurnitureTiersFromLegacyFilter("UNFURNISHED")).toEqual(["UNFURNISHED"]);
    expect(deriveFurnitureTiersFromLegacyFilter("FURNISHED")).toEqual(["FULLY_FURNISHED"]);
    expect(deriveFurnitureTiersFromLegacyFilter("ALL")).toEqual([]);
    expect(deriveFurnitureTiersFromLegacyFilter(undefined)).toEqual([]);
  });
});

describe("parseExplorerFiltersObject / serializeExplorerFilters", () => {
  it("returns defaults for nullish input, with the 5000 default ceiling only when absent", () => {
    const d = parseExplorerFiltersObject(null);
    expect(d.maxTotalMonthly).toBe(5000);
    expect(d.sortBy).toBe("score_desc");
    expect(d.viewMode).toBe("list");
    expect(d.deactivatedFilter).toBe("ACTIVE_ONLY");
    expect(parseExplorerFiltersObject({ maxTotalMonthly: null }).maxTotalMonthly).toBeNull();
    expect(parseExplorerFiltersObject({ maxTotalMonthly: "x" }).maxTotalMonthly).toBeNull();
    expect(parseExplorerFiltersObject(undefined).selectedCities).toEqual([]);
  });

  it("filters, dedupes and validates city/floor/room/feature selections", () => {
    const p = parseExplorerFiltersObject({
      selectedCities: ["BH", "BH", "XX", "BSB"],
      floorFilters: ["EPIC", "EPIC", "ALL", "NOPE"],
      selectedBedrooms: [3, 1, 1, 4, "2"],
      selectedBathrooms: [2, 9],
      selectedParking: [2, 3, 1],
      selectedNeighborhoods: ["Savassi", 42],
      requiredFeatures: ["ac", "nope", "pets"],
      modernityTiers: ["DATED", "WRONG"],
      sortBy: "bogus",
      providerFilter: "bogus",
      deactivatedFilter: "bogus",
      viewMode: "bogus",
      searchQuery: 42,
    });
    expect(p.selectedCities).toEqual(["BH"]); // BSB dropped without benchmark; deduped
    expect(p.floorFilters).toEqual(["EPIC"]);
    expect(p.floorFilter).toBe("EPIC");
    expect(p.selectedBedrooms).toEqual([1, 3]);
    expect(p.selectedBathrooms).toEqual([2]);
    expect(p.selectedParking).toEqual([1, 2]);
    expect(p.selectedNeighborhoods).toEqual(["Savassi"]);
    expect(p.requiredFeatures).toEqual(["ac", "pets"]);
    expect(p.modernityTiers).toEqual(["DATED"]);
    expect(p.sortBy).toBe("score_desc");
    expect(p.providerFilter).toBe("ALL");
    expect(p.viewMode).toBe("list");
    expect(p.searchQuery).toBe("");
  });

  it("collapses all selectable cities without hidden cities, keeps them when hidden cities are enabled, and honors selectedCity", () => {
    expect(parseExplorerFiltersObject({ selectedCities: ["BH", "CP", "RJ", "SP"] }).selectedCities).toEqual([]);
    // Legacy enableBsbBenchmark enables only BSB; SP stays hidden, so it is dropped from the selection.
    const withBsb = parseExplorerFiltersObject({
      enableBsbBenchmark: true,
      selectedCities: ["BH", "CP", "RJ", "SP", "BSB"],
    });
    expect(withBsb.enabledHiddenCities).toEqual(["BSB"]);
    expect(withBsb.selectedCities).toEqual(["BH", "CP", "RJ", "BSB"]);
    const withBothHidden = parseExplorerFiltersObject({
      enabledHiddenCities: ["SP", "BSB"],
      selectedCities: ["BH", "CP", "RJ", "SP", "BSB"],
    });
    expect(withBothHidden.selectedCities).toEqual(["BH", "CP", "RJ", "SP", "BSB"]);
    expect(parseExplorerFiltersObject({ selectedCity: "RJ" }).selectedCities).toEqual(["RJ"]);
    expect(parseExplorerFiltersObject({ enableBsbBenchmark: true, selectedCity: "BSB" }).selectedCities).toEqual(["BSB"]);
    expect(parseExplorerFiltersObject({ selectedCity: "ALL" }).selectedCities).toEqual([]);
  });

  it("derives furniture tiers from the legacy filter and collapses both-tier selections", () => {
    expect(parseExplorerFiltersObject({ furnishedFilter: "FURNISHED" }).selectedFurnitureTiers).toEqual([
      "FULLY_FURNISHED",
    ]);
    const all = parseExplorerFiltersObject({
      selectedFurnitureTiers: ["UNFURNISHED", "FULLY_FURNISHED"],
    });
    expect(all.selectedFurnitureTiers).toEqual([]);
    expect(all.furnishedFilter).toBe("ALL");
    const single = parseExplorerFiltersObject({ selectedFurnitureTiers: ["UNFURNISHED", "BAD"] });
    expect(single.selectedFurnitureTiers).toEqual(["UNFURNISHED"]);
    expect(single.furnishedFilter).toBe("UNFURNISHED");
    expect(parseExplorerFiltersObject({ furnishedFilter: "bogus" }).furnishedFilter).toBe("ALL");
  });

  it("parses legacy three-tier furniture values from old preferences and URLs", () => {
    const semiOnly = parseExplorerFiltersObject({ furnishedFilter: "SEMI_FURNISHED" });
    expect(semiOnly.furnishedFilter).toBe("ALL");
    expect(semiOnly.selectedFurnitureTiers).toEqual([]);
    const unfurnishedOrSemi = parseExplorerFiltersObject({ furnishedFilter: "UNFURNISHED_OR_SEMI" });
    expect(unfurnishedOrSemi.furnishedFilter).toBe("UNFURNISHED");
    expect(unfurnishedOrSemi.selectedFurnitureTiers).toEqual(["UNFURNISHED"]);
    const semiTierOnly = parseExplorerFiltersObject({ selectedFurnitureTiers: ["SEMI_FURNISHED"] });
    expect(semiTierOnly.selectedFurnitureTiers).toEqual([]);
    expect(semiTierOnly.furnishedFilter).toBe("ALL");
    const oldPair = parseExplorerFiltersObject({ selectedFurnitureTiers: ["UNFURNISHED", "SEMI_FURNISHED"] });
    expect(oldPair.selectedFurnitureTiers).toEqual(["UNFURNISHED"]);
    expect(oldPair.furnishedFilter).toBe("UNFURNISHED");
    const oldAll = parseExplorerFiltersObject({
      selectedFurnitureTiers: ["UNFURNISHED", "SEMI_FURNISHED", "FULLY_FURNISHED"],
    });
    expect(oldAll.selectedFurnitureTiers).toEqual([]);
    expect(oldAll.furnishedFilter).toBe("ALL");
    expect(parseExplorerFiltersObject({ floorFilter: "RARE" }).floorFilters).toEqual(["RARE"]);
  });

  it("round-trips through serializeExplorerFilters", () => {
    const parsed = parseExplorerFiltersObject({
      selectedCities: ["BH"],
      searchQuery: "savassi",
      floorFilters: ["EPIC"],
      maxTotalMonthly: 4000,
      selectedBedrooms: [2],
      furnishedFilter: "UNFURNISHED",
    });
    const serialized = serializeExplorerFilters(parsed);
    expect(serialized.selectedCity).toBe("BH");
    expect(serialized.floorFilter).toBe("EPIC");
    const reparsed = parseExplorerFiltersObject(serialized as Record<string, unknown>);
    expect(reparsed.selectedCities).toEqual(["BH"]);
    expect(reparsed.searchQuery).toBe("savassi");
    expect(reparsed.floorFilters).toEqual(["EPIC"]);
    expect(reparsed.maxTotalMonthly).toBe(4000);
    expect(reparsed.selectedBedrooms).toEqual([2]);
    // multi-city serializes selectedCity as ALL (SP must be enabled: it is hidden by default)
    const multi = parseExplorerFiltersObject({ selectedCities: ["BH", "SP"], enabledHiddenCities: ["SP"] });
    expect(multi.selectedCities).toEqual(["BH", "SP"]);
    expect(serializeExplorerFilters(multi).selectedCity).toBe("ALL");
    expect(serializeExplorerFilters(multi).floorFilter).toBe("ALL");
  });

  it("keeps finite listing-age numbers and rejects non-finite ones", () => {
    expect(parseExplorerFiltersObject({ minListingAgeDays: 5 }).minListingAgeDays).toBe(5);
    expect(parseExplorerFiltersObject({ minListingAgeDays: Number.NaN }).minListingAgeDays).toBeNull();
    expect(parseExplorerFiltersObject({ maxListingAgeDays: "9" }).maxListingAgeDays).toBeNull();
  });
});
