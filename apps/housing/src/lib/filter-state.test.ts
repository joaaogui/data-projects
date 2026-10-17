import { describe, expect, it } from "vitest";

import {
  CLEARED_FILTERS,
  PERFEITO_PRESET,
  clearFilters,
  countActiveFilters,
  describeActiveFilters,
  ineligibleModeOf,
  ineligibleModePatch,
  isPresetActive,
  togglePreset,
  type FilterState,
} from "@/lib/filter-state";
import { parseExplorerFiltersObject, serializeExplorerFilters } from "@/lib/property-filters";

const base: FilterState = {
  ...CLEARED_FILTERS,
  selectedCities: ["CP"],
  selectedNeighborhoods: ["CP:Cambuí"],
  requiredFeatures: ["balcony"],
  minAreaM2: 60,
  sortBy: "price_asc",
  viewMode: "split",
};

describe("presets", () => {
  it("Perfeito replaces filters but keeps location, sort and view", () => {
    const { next, previous } = togglePreset(base, PERFEITO_PRESET, null);
    expect(previous).toBe(base);
    expect(next.selectedCities).toEqual(["CP"]);
    expect(next.selectedNeighborhoods).toEqual(["CP:Cambuí"]);
    expect(next.sortBy).toBe("price_asc");
    expect(next.viewMode).toBe("split");
    expect(next.requiredFeatures).toEqual(["ac"]);
    expect(next.minAreaM2).toBeNull();
    expect(next.maxTotalMonthly).toBe(4500);
    expect(isPresetActive(next, PERFEITO_PRESET)).toBe(true);
  });

  it("turning Perfeito off restores the previous filters, keeping the current location", () => {
    const on = togglePreset(base, PERFEITO_PRESET, null);
    const moved = { ...on.next, selectedCities: ["BH" as const], selectedNeighborhoods: [] };
    const off = togglePreset(moved, PERFEITO_PRESET, on.previous);
    expect(off.previous).toBeNull();
    expect(off.next.requiredFeatures).toEqual(["balcony"]);
    expect(off.next.minAreaM2).toBe(60);
    expect(off.next.selectedCities).toEqual(["BH"]);
  });

  it("turning Perfeito off without a remembered state clears its filters, not the cities", () => {
    const on = togglePreset(base, PERFEITO_PRESET, null).next;
    const off = togglePreset(on, PERFEITO_PRESET, null).next;
    expect(off.selectedCities).toEqual(["CP"]);
    expect(countActiveFilters(off)).toBe(2);
    expect(off.maxTotalMonthly).toBeNull();
  });

  it("stays active after a save/load round-trip", () => {
    const on = togglePreset(base, PERFEITO_PRESET, null).next;
    const reloaded = parseExplorerFiltersObject(serializeExplorerFilters(on));
    expect(isPresetActive(reloaded, PERFEITO_PRESET)).toBe(true);
  });

  it("adding a filter on top of Perfeito makes it inactive", () => {
    const on = togglePreset(base, PERFEITO_PRESET, null).next;
    expect(isPresetActive({ ...on, hideMegaCondo: true }, PERFEITO_PRESET)).toBe(false);
  });
});

describe("clearFilters", () => {
  it("leaves no price cap and keeps sort, view and hidden cities", () => {
    const cleared = clearFilters({ ...base, maxTotalMonthly: 5000, enabledHiddenCities: ["SP"] });
    expect(cleared.maxTotalMonthly).toBeNull();
    expect(cleared.selectedCities).toEqual([]);
    expect(cleared.enabledHiddenCities).toEqual(["SP"]);
    expect(cleared.sortBy).toBe("price_asc");
    expect(describeActiveFilters(cleared)).toEqual([]);
  });

  it("first-time users still get the R$ 5.000 default", () => {
    expect(parseExplorerFiltersObject({}).maxTotalMonthly).toBe(5000);
  });
});

describe("describeActiveFilters", () => {
  it("does not show sort as a filter and counts hideForSale", () => {
    const pills = describeActiveFilters({ ...CLEARED_FILTERS, sortBy: "price_asc", hideForSale: true });
    expect(pills.map((p) => p.id)).toEqual(["no-forsale"]);
    expect(pills[0]!.clear).toEqual({ hideForSale: false });
  });

  it("excludes search from the badge count", () => {
    expect(countActiveFilters({ ...CLEARED_FILTERS, searchQuery: "cambuí", hideMegaCondo: true })).toBe(1);
  });
});

describe("ineligible mode", () => {
  it("maps the 3-state control onto showIneligible / onlyIneligible", () => {
    for (const mode of ["hide", "include", "only"] as const) {
      expect(ineligibleModeOf(ineligibleModePatch(mode) as FilterState)).toBe(mode);
    }
    expect(ineligibleModePatch("only")).toEqual({ onlyIneligible: true, showIneligible: true });
  });
});
