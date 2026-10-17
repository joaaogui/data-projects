import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { GOLDEN_NOW, type GoldenInput } from "@/lib/__fixtures__/golden";
import { FacetIndex, suggestRelaxations } from "@/lib/filter-facets";
import { PINNED_OPTIONS, SHEET_OPTIONS } from "@/lib/filter-options";
import { CLEARED_FILTERS, type FilterState } from "@/lib/filter-state";
import { filterAndSortProperties } from "@/lib/property-filters";
import {
  DEFAULT_WEIGHTS,
  computeDynamicNeighborhoods,
  precomputeListingFeatures,
  scorePrecomputedListings,
} from "@/lib/scoring-engine";
import type { EvaluatedProperty } from "@/types/housing";

const input = JSON.parse(
  readFileSync(join(__dirname, "__fixtures__", "golden-listings.json"), "utf8"),
) as GoldenInput;

let properties: EvaluatedProperty[];

const exactCount = (state: FilterState) =>
  filterAndSortProperties(properties, {
    ...state,
    selectedCity: state.selectedCities.length === 1 ? state.selectedCities[0]! : "ALL",
  }).length;

/** Options whose group also loosens the eligibility pool (fully-furnished / long-commute overrides). */
const POOL_COUPLED = new Set(["furn:furnished", "commute:40"]);

const STATES: FilterState[] = [
  CLEARED_FILTERS,
  { ...CLEARED_FILTERS, maxTotalMonthly: 5000 },
  { ...CLEARED_FILTERS, requiredFeatures: ["ac"], floorFilters: ["HIGH_OR_TOP"], maxTotalMonthly: 4500 },
  { ...CLEARED_FILTERS, selectedCities: ["CP"], maxCommuteMinutes: 25, onlySafeStreets: true },
  { ...CLEARED_FILTERS, showIneligible: true, minAreaM2: 45, maxAreaM2: 72, hideForSale: true },
  { ...CLEARED_FILTERS, selectedBedrooms: [2], modernityTiers: ["MODERN_OR_RENOVATED"], minScore: 140 },
  {
    ...CLEARED_FILTERS,
    selectedFurnitureTiers: ["UNFURNISHED"],
    furnishedFilter: "UNFURNISHED",
    requiredFeatures: ["balcony", "doorman_24h"],
    searchQuery: "rua",
  },
];

describe("FacetIndex", () => {
  beforeAll(() => {
    vi.useFakeTimers({ now: new Date(GOLDEN_NOW), toFake: ["Date"] });
    const { ranked } = computeDynamicNeighborhoods(input.neighborhoods, DEFAULT_WEIGHTS);
    properties = scorePrecomputedListings(precomputeListingFeatures(input.properties), ranked, DEFAULT_WEIGHTS, {
      includeBsbBenchmark: false,
    });
  });
  afterAll(() => vi.useRealTimers());

  it.each(STATES.map((s, i) => [i, s] as const))("total matches filterAndSortProperties (state %i)", (_, state) => {
    expect(new FacetIndex(properties, state, []).total).toBe(exactCount(state));
  });

  it.each(STATES.map((s, i) => [i, s] as const))(
    "option counts equal the count with that option selected (state %i)",
    (_, state) => {
      const index = new FacetIndex(properties, state, []);
      for (const opt of [...PINNED_OPTIONS, ...SHEET_OPTIONS]) {
        if (POOL_COUPLED.has(opt.id)) continue;
        expect([opt.id, index.optionCount(opt)]).toEqual([opt.id, exactCount({ ...state, ...opt.select(state) })]);
      }
    },
  );

  it("suggests relaxations with exact counts when nothing matches", () => {
    const empty: FilterState = {
      ...CLEARED_FILTERS,
      maxTotalMonthly: 1500,
      requiredFeatures: ["ac", "pool_gym"],
      floorFilters: ["LEGENDARY"],
    };
    expect(exactCount(empty)).toBe(0);
    const suggestions = suggestRelaxations(properties, empty, []);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    for (const s of suggestions) {
      expect(s.count).toBe(exactCount({ ...empty, ...s.patch }));
      expect(s.count).toBeGreaterThan(0);
    }
    expect(suggestions.map((s) => s.count)).toEqual([...suggestions.map((s) => s.count)].sort((a, b) => b - a));
  });
});
