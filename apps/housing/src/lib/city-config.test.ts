import { describe, expect, it } from "vitest";
import {
  filterVisibleCities,
  HIDDEN_BY_DEFAULT_CITIES,
  isCityVisible,
  isSelectableCity,
  normalizeEnabledHiddenCities,
  resolveEnabledHiddenCities,
  selectableCities,
} from "@/lib/city-config";
import {
  DEFAULT_EXPLORER_FILTERS,
  filterAndSortProperties,
  parseExplorerFiltersObject,
  serializeExplorerFilters,
} from "@/lib/property-filters";
import {
  computeDynamicNeighborhoods,
  computeDynamicProperties,
  DEFAULT_WEIGHTS,
} from "@/lib/scoring-engine";
import type { CityHubCode, NeighborhoodEntry, SlimPropertyRecord } from "@/types/housing";

describe("city-config", () => {
  it("hides SP and BSB unless enabled", () => {
    expect(HIDDEN_BY_DEFAULT_CITIES).toEqual(["SP", "BSB"]);
    expect(isCityVisible("BH", [])).toBe(true);
    expect(isCityVisible("SP", [])).toBe(false);
    expect(isCityVisible("BSB", [])).toBe(false);
    expect(isCityVisible("SP", ["SP"])).toBe(true);
    expect(isCityVisible("BSB", ["SP"])).toBe(false);
    expect(
      filterVisibleCities([{ cityCode: "BH" }, { cityCode: "SP" }, { cityCode: "BSB" }], ["BSB"]),
    ).toEqual([{ cityCode: "BH" }, { cityCode: "BSB" }]);
  });

  it("normalizes the enabled list and maps the legacy enableBsbBenchmark flag", () => {
    expect(normalizeEnabledHiddenCities(["BSB", "BH", "SP", "SP", "XX"])).toEqual(["SP", "BSB"]);
    expect(normalizeEnabledHiddenCities("SP")).toEqual([]);
    expect(resolveEnabledHiddenCities({ enableBsbBenchmark: true })).toEqual(["BSB"]);
    expect(resolveEnabledHiddenCities({ enableBsbBenchmark: false })).toEqual([]);
    expect(resolveEnabledHiddenCities({})).toEqual([]);
    // The new field wins over the legacy one.
    expect(resolveEnabledHiddenCities({ enabledHiddenCities: ["SP"], enableBsbBenchmark: true })).toEqual(["SP"]);
    expect(resolveEnabledHiddenCities({ enabledHiddenCities: [], enableBsbBenchmark: true })).toEqual([]);
  });

  it("offers hidden cities in the selector only while enabled", () => {
    expect(selectableCities([])).toEqual(["BH", "CP", "RJ"]);
    expect(selectableCities(["BSB", "SP"])).toEqual(["BH", "CP", "RJ", "SP", "BSB"]);
    expect(isSelectableCity("SP", [])).toBe(false);
    expect(isSelectableCity("SP", ["SP"])).toBe(true);
  });
});

describe("explorer filters with hidden cities", () => {
  it("drops hidden cities from saved selections without crashing", () => {
    const parsed = parseExplorerFiltersObject({ selectedCities: ["SP", "BH"] });
    expect(parsed.enabledHiddenCities).toEqual([]);
    expect(parsed.selectedCities).toEqual(["BH"]);
    expect(parseExplorerFiltersObject({ selectedCities: ["SP"] }).selectedCities).toEqual([]);
    expect(parseExplorerFiltersObject({ selectedCity: "SP" }).selectedCities).toEqual([]);
  });

  it("keeps a hidden city in the selection once it is enabled", () => {
    const parsed = parseExplorerFiltersObject({
      enabledHiddenCities: ["SP"],
      selectedCities: ["SP", "BH"],
    });
    expect(parsed.selectedCities).toEqual(["SP", "BH"]);
    expect(serializeExplorerFilters(parsed).enabledHiddenCities).toEqual(["SP"]);
  });

  it("treats the legacy enableBsbBenchmark flag as enabledHiddenCities: [BSB]", () => {
    const parsed = parseExplorerFiltersObject({ enableBsbBenchmark: true, selectedCities: ["BSB"] });
    expect(parsed.enabledHiddenCities).toEqual(["BSB"]);
    expect(parsed.selectedCities).toEqual(["BSB"]);
  });

  it("collapses 'all visible cities' to an empty selection", () => {
    expect(parseExplorerFiltersObject({ selectedCities: ["BH", "CP", "RJ"] }).selectedCities).toEqual([]);
    expect(
      parseExplorerFiltersObject({ enabledHiddenCities: ["SP"], selectedCities: ["BH", "CP", "RJ"] })
        .selectedCities,
    ).toEqual(["BH", "CP", "RJ"]);
  });
});

function nb(cityCode: CityHubCode, neighborhood: string, baseScore: number, position: number): NeighborhoodEntry {
  return {
    cityCode,
    cityName: cityCode,
    neighborhood,
    overallPosition: position,
    cityPosition: 1,
    baseScore,
    idhm: 0.9,
    commuteTime: "15 min",
    nubankHubDistance: "3 km",
    urbanBreathingScore: baseScore,
    commuteLogisticsScore: baseScore,
    buildingStockFitScore: baseScore,
    budgetFitScore: baseScore,
    safetyCarScore: baseScore,
    detailedJustification: "x",
  } as unknown as NeighborhoodEntry;
}

function listing(cityCode: CityHubCode, id: string, neighborhood: string): SlimPropertyRecord {
  return {
    provider: "quintoandar",
    id,
    cityCode,
    city: cityCode,
    neighborhood,
    street: "Rua Teste",
    streetNumber: "10",
    rent: 3500,
    condoFee: 700,
    iptu: 100,
    totalMonthly: 4300,
    areaM2: 60,
    bedrooms: 2,
    suites: 1,
    bathrooms: 2,
    parkingSpaces: 1,
    floor: 8,
    floorRange: null,
    condominiumName: null,
    doorman: null,
    salePrice: null,
    acceptsPets: true,
    nearSubway: false,
    constructionYear: 2019,
    condition: null,
    generatedDescription: null,
    sourceSearch: null,
    isNewEntry: false,
    totalFloors: 12,
    url: "https://example.com/x",
    title: "Apto",
    description: "Apartamento com elevador e portaria 24h.",
    modernityScore: 80,
    modernityTier: "MODERN_OR_RENOVATED",
    furnished: false,
    installations: [],
    amenities: [],
    comfortCommodities: [],
    practicalityCommodities: [],
    placesNearby: [],
    photoCaptions: [],
    positiveSignals: [],
    negativeSignals: [],
    photosCount: 1,
    samplePhotos: [{ room: "Sala", url: "https://example.com/p.jpg" }],
    isActive: true,
  } as unknown as SlimPropertyRecord;
}

describe("hidden cities and ranking", () => {
  it("ranks the remaining cities as if the hidden ones did not exist, with identical scores", () => {
    const nbs = [nb("BH", "Lourdes", 9, 1), nb("SP", "Moema", 9.5, 2), nb("CP", "Taquaral", 8, 3)];
    const props = [listing("SP", "sp-1", "Moema"), listing("BH", "bh-1", "Lourdes"), listing("CP", "cp-1", "Taquaral")];
    const w = DEFAULT_WEIGHTS;
    const ranked = (n: NeighborhoodEntry[]) => computeDynamicNeighborhoods(n, w).ranked;
    const all = computeDynamicProperties(props, ranked(nbs), w, { includeBsbBenchmark: true });
    const visible = computeDynamicProperties(
      props.filter((p) => isCityVisible(p.cityCode, [])),
      ranked(filterVisibleCities(nbs, [])),
      w,
      { includeBsbBenchmark: true },
    );
    expect(visible.map((p) => p.cityCode).sort()).toEqual(["BH", "CP"]);
    for (const v of visible) {
      const a = all.find((p) => p.id === v.id)!;
      expect(v.finalScore).toBe(a.finalScore);
      expect(v.breakdown).toEqual(a.breakdown);
    }
    const ranks = visible.filter((p) => p.overallRank !== null).map((p) => p.overallRank!).sort();
    expect(ranks).toEqual(ranks.map((_, i) => i + 1));
  });

  it("filterAndSortProperties never returns a hidden city's listings", () => {
    const props = computeDynamicProperties(
      [listing("SP", "sp-1", "Moema"), listing("BH", "bh-1", "Lourdes")],
      computeDynamicNeighborhoods(
        [nb("BH", "Lourdes", 9, 1), nb("SP", "Moema", 9.5, 2)],
        DEFAULT_WEIGHTS,
      ).ranked,
      DEFAULT_WEIGHTS,
      { includeBsbBenchmark: true },
    );
    const off = filterAndSortProperties(props, DEFAULT_EXPLORER_FILTERS);
    expect(off.map((p) => p.cityCode)).not.toContain("SP");
    const on = filterAndSortProperties(props, { ...DEFAULT_EXPLORER_FILTERS, enabledHiddenCities: ["SP"] });
    expect(on.map((p) => p.cityCode)).toContain("SP");
  });
});
