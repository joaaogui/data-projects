import { describe, expect, it } from "vitest";

import { CLEARED_FILTERS, isPresetActive, togglePreset } from "@/lib/filter-state";
import { normalizePreferences } from "@/lib/preferences-store";
import {
  PREFERENCES_SCHEMA_VERSION,
  createSavedView,
  normalizeSavedViews,
  savedViewPreset,
  weightsSchemaVersion,
} from "@/lib/saved-views";
import { sanitizeAndMigrateWeights } from "@/lib/scoring-engine";

describe("saved views", () => {
  const bhUnfurnished = {
    ...CLEARED_FILTERS,
    selectedCities: ["BH" as const],
    selectedFurnitureTiers: ["UNFURNISHED" as const],
    furnishedFilter: "UNFURNISHED" as const,
  };

  it("a saved view replaces every filter, cities included, and toggles back", () => {
    const view = createSavedView(bhUnfurnished, "  BH sem mobília  ");
    expect(view.name).toBe("BH sem mobília");
    const elsewhere = { ...CLEARED_FILTERS, selectedCities: ["RJ" as const], requiredFeatures: ["ac" as const] };
    const on = togglePreset(elsewhere, savedViewPreset(view), null);
    expect(on.next.selectedCities).toEqual(["BH"]);
    expect(on.next.requiredFeatures).toEqual([]);
    expect(isPresetActive(on.next, savedViewPreset(view))).toBe(true);
    const off = togglePreset(on.next, savedViewPreset(view), on.previous);
    expect(off.next.requiredFeatures).toEqual(["ac"]);
    expect(off.next.selectedCities).toEqual(["RJ"]);
  });

  it("normalizes untrusted input", () => {
    const views = normalizeSavedViews([
      { id: "a", name: "A", filters: {}, createdAt: "2026-10-17T00:00:00.000Z" },
      { id: "a", name: "dup", filters: {} },
      { id: "perfeito", name: "shadow builtin", filters: {} },
      { id: "b", name: "", filters: {} },
      { id: "c", name: "C", filters: [] },
      "junk",
    ]);
    expect(views.map((v) => v.id)).toEqual(["a"]);
    expect(normalizeSavedViews(undefined)).toEqual([]);
  });
});

describe("preferences schema v3", () => {
  it("reads v2 rows (no views) and keeps their weights as v2", () => {
    const prefs = normalizePreferences({
      schemaVersion: 2,
      filters: { maxTotalMonthly: 4500, schemaVersion: 2 },
      weights: { minAreaM2: 45 },
      favorites: ["quintoandar:1"],
    });
    expect(prefs.schemaVersion).toBe(PREFERENCES_SCHEMA_VERSION);
    expect(prefs.savedViews).toEqual([]);
    expect(prefs.filters.maxTotalMonthly).toBe(4500);
    expect(prefs.weights).toEqual(sanitizeAndMigrateWeights({ minAreaM2: 45 }, 2));
  });

  it("lifts views out of the stored filters document (DB row shape)", () => {
    const prefs = normalizePreferences({
      filters: {
        schemaVersion: 3,
        selectedCities: ["CP"],
        savedViews: [{ id: "v1", name: "CP", filters: { selectedCities: ["CP"] } }],
      },
      weights: {},
      favorites: [],
    });
    expect(prefs.savedViews?.map((v) => v.name)).toEqual(["CP"]);
    expect(prefs.filters).not.toHaveProperty("savedViews");
  });

  it("weights migration semantics do not change with the new schema number", () => {
    expect(weightsSchemaVersion(undefined)).toBe(2);
    expect(weightsSchemaVersion(2)).toBe(2);
    expect(weightsSchemaVersion(3)).toBe(2);
    expect(weightsSchemaVersion(1)).toBe(1);
  });
});
