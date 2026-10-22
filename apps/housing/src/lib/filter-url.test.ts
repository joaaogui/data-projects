import { describe, expect, it } from "vitest";

import { CLEARED_FILTERS, PERFEITO_PRESET, applyPresetFilters, sameFilters, type FilterState } from "@/lib/filter-state";
import { filtersFromSearch, filtersToSearch } from "@/lib/filter-url";
import { parseExplorerFiltersObject } from "@/lib/property-filters";

const roundTrip = (s: FilterState) => filtersFromSearch(filtersToSearch(s))!;

describe("filter URL", () => {
  it("returns null when the URL carries no filters", () => {
    expect(filtersFromSearch("")).toBeNull();
    expect(filtersFromSearch("?utm=x")).toBeNull();
  });

  it("encodes a cleared state as just the marker", () => {
    expect(filtersToSearch(CLEARED_FILTERS)).toBe("?f=1");
    expect(sameFilters(roundTrip(CLEARED_FILTERS), CLEARED_FILTERS)).toBe(true);
    expect(roundTrip(CLEARED_FILTERS).maxTotalMonthly).toBeNull();
  });

  it("round-trips Perfeito in Campinas with sort", () => {
    const state: FilterState = {
      ...applyPresetFilters({ ...CLEARED_FILTERS, selectedCities: ["CP"] }, PERFEITO_PRESET),
      sortBy: "price_asc",
    };
    const search = filtersToSearch(state);
    expect(search).toContain("cidade=CP");
    expect(search).toContain("max=4500");
    const back = roundTrip(state);
    expect(sameFilters(back, state)).toBe(true);
    expect(back.sortBy).toBe("price_asc");
  });

  it("never carries the view mode, so a shared link opens with the map closed", () => {
    const search = filtersToSearch({ ...CLEARED_FILTERS, viewMode: "split" });
    expect(search).toBe("?f=1");
    expect(filtersFromSearch("?f=1&ver=split")!.viewMode).toBe("list");
  });

  it("round-trips every kind of field", () => {
    const state = parseExplorerFiltersObject({
      selectedCities: ["BH", "RJ"],
      selectedNeighborhoods: ["BH:Savassi", "RJ:Leblon"],
      searchQuery: "rua da bahia, 1",
      minTotalMonthly: 3000,
      maxTotalMonthly: 5500,
      maxCommuteMinutes: 30,
      minAreaM2: 45,
      maxAreaM2: 72,
      selectedBedrooms: [2, 3],
      selectedParking: [1],
      floorFilters: ["HIGH_OR_TOP", "NO_GROUND"],
      requiredFeatures: ["ac", "free_parking"],
      selectedFurnitureTiers: ["UNFURNISHED"],
      modernityTiers: ["WELL_MAINTAINED"],
      minScore: 170,
      maxListingAgeDays: 30,
      listingDateFrom: "2026-09-01",
      hideMegaCondo: true,
      hideForSale: true,
      showIneligible: true,
      onlyTop20Neighborhoods: true,
      onlySafeStreets: true,
      providerFilter: "quintoandar",
      deactivatedFilter: "ALL",
      enabledHiddenCities: ["SP"],
    });
    const back = roundTrip(state);
    expect(sameFilters(back, state)).toBe(true);
    expect(back.enabledHiddenCities).toEqual(["SP"]);
    expect(back.requiredFeatures).toEqual(["ac", "free_parking"]);
  });

  it("drops invalid values instead of failing", () => {
    const back = filtersFromSearch("?f=1&cidade=XX,CP&andar=BOGUS&max=abc&tem=ac,nope")!;
    expect(back.selectedCities).toEqual(["CP"]);
    expect(back.floorFilters).toEqual([]);
    expect(back.maxTotalMonthly).toBeNull();
    expect(back.requiredFeatures).toEqual(["ac"]);
  });
});
