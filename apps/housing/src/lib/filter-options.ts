import { deriveLegacyFurnishedFilter, type PropertyFeatureKey } from "@/lib/property-filters";
import type { FilterPatch, FilterState } from "@/lib/filter-state";

/**
 * A one-tap filter option. `select` is the state with only this option chosen in its group (what its facet
 * count measures); `toggle` is what tapping it does from the current state.
 */
export interface FilterOption {
  id: string;
  label: string;
  isActive: (s: FilterState) => boolean;
  select: (s: FilterState) => FilterPatch;
  toggle: (s: FilterState) => FilterPatch;
}

export function featureOption(key: PropertyFeatureKey, label: string): FilterOption {
  const has = (s: FilterState) =>
    s.requiredFeatures.includes(key) || (key === "safe_street" && s.onlySafeStreets);
  return {
    id: `feat:${key}`,
    label,
    isActive: has,
    select: (s) => ({ requiredFeatures: has(s) ? s.requiredFeatures : [...s.requiredFeatures, key] }),
    toggle: (s) =>
      has(s)
        ? {
            requiredFeatures: s.requiredFeatures.filter((f) => f !== key),
            ...(key === "safe_street" ? { onlySafeStreets: false } : {}),
          }
        : { requiredFeatures: [...s.requiredFeatures, key] },
  };
}

export function maxPriceOption(max: number, label: string): FilterOption {
  return {
    id: `price:${max}`,
    label,
    isActive: (s) => s.maxTotalMonthly === max && s.minTotalMonthly === null,
    select: () => ({ minTotalMonthly: null, maxTotalMonthly: max }),
    toggle: (s) =>
      s.maxTotalMonthly === max && s.minTotalMonthly === null
        ? { maxTotalMonthly: null }
        : { minTotalMonthly: null, maxTotalMonthly: max },
  };
}

export function commuteOption(max: number | null, label: string): FilterOption {
  return {
    id: `commute:${max ?? "any"}`,
    label,
    isActive: (s) => s.maxCommuteMinutes === max,
    select: () => ({ maxCommuteMinutes: max }),
    toggle: (s) => ({ maxCommuteMinutes: s.maxCommuteMinutes === max ? null : max }),
  };
}

export function floorOption(value: FilterState["floorFilters"][number], label: string): FilterOption {
  const setFloors = (floors: FilterState["floorFilters"]): FilterPatch => ({
    floorFilters: floors,
    floorFilter: floors.length === 1 ? floors[0]! : "ALL",
  });
  return {
    id: `floor:${value}`,
    label,
    isActive: (s) => s.floorFilters.includes(value),
    select: (s) => setFloors([...s.floorFilters.filter((f) => f === "NO_GROUND" && value !== "NO_GROUND"), value]),
    toggle: (s) =>
      setFloors(
        s.floorFilters.includes(value)
          ? s.floorFilters.filter((f) => f !== value)
          : [...s.floorFilters, value],
      ),
  };
}

export function furnitureOption(
  tiers: FilterState["selectedFurnitureTiers"],
  id: string,
  label: string,
): FilterOption {
  const same = (s: FilterState) =>
    s.selectedFurnitureTiers.length === tiers.length &&
    tiers.every((t) => s.selectedFurnitureTiers.includes(t));
  const patch = (next: FilterState["selectedFurnitureTiers"]): FilterPatch => ({
    selectedFurnitureTiers: next,
    furnishedFilter: deriveLegacyFurnishedFilter(next),
  });
  return {
    id: `furn:${id}`,
    label,
    isActive: same,
    select: () => patch(tiers),
    toggle: (s) => patch(same(s) ? [] : tiers),
  };
}

/** Requirement chips pinned in the bar (apply instantly). */
export const PINNED_OPTIONS: FilterOption[] = [
  maxPriceOption(4500, "≤ R$ 4.500"),
  featureOption("ac", "Ar-cond."),
  floorOption("HIGH_OR_TOP", "Andar alto"),
  commuteOption(25, "≤ 25 min"),
  featureOption("free_view_sun", "Vista livre"),
  featureOption("balcony", "Varanda"),
  featureOption("doorman_24h", "Portaria 24h"),
];
