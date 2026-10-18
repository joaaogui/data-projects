import { deriveLegacyFurnishedFilter, type PropertyFeatureKey } from "@/lib/property-filters";
import type { FilterPatch, FilterState } from "@/lib/filter-state";
import type { ModernityTier } from "@/types/housing";

/**
 * A one-tap filter option. `select` is the state with this option chosen in its group (what its facet count
 * measures, with every other filter applied); `toggle` is what tapping it does from the current state.
 * `group` is the constraint it replaces (see `buildFilterConstraints`).
 */
export interface FilterOption {
  id: string;
  group: string;
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
    group: `feat-${key}`,
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
  const active = (s: FilterState) => s.maxTotalMonthly === max && s.minTotalMonthly === null;
  return {
    id: `price:${max}`,
    group: "price",
    label,
    isActive: active,
    select: () => ({ minTotalMonthly: null, maxTotalMonthly: max }),
    toggle: (s) => (active(s) ? { maxTotalMonthly: null } : { minTotalMonthly: null, maxTotalMonthly: max }),
  };
}

export function commuteOption(max: number, label: string): FilterOption {
  return {
    id: `commute:${max}`,
    group: "commute",
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
    group: "floor",
    label,
    isActive: (s) => s.floorFilters.includes(value),
    select: (s) =>
      setFloors(value === "NO_GROUND" ? [...new Set([...s.floorFilters, value])] : [
        ...s.floorFilters.filter((f) => f === "NO_GROUND"),
        value,
      ]),
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
    group: "furniture",
    label,
    isActive: same,
    select: () => patch(tiers),
    toggle: (s) => patch(same(s) ? [] : tiers),
  };
}

export function areaOption(id: string, label: string, min: number | null, max: number | null): FilterOption {
  const active = (s: FilterState) => s.minAreaM2 === min && s.maxAreaM2 === max;
  return {
    id: `area:${id}`,
    group: "area",
    label,
    isActive: active,
    select: () => ({ minAreaM2: min, maxAreaM2: max }),
    toggle: (s) => (active(s) ? { minAreaM2: null, maxAreaM2: null } : { minAreaM2: min, maxAreaM2: max }),
  };
}

export function tierOption(tier: ModernityTier, label: string): FilterOption {
  return {
    id: `tier:${tier}`,
    group: "modernity",
    label,
    isActive: (s) => s.modernityTiers.includes(tier),
    select: () => ({ modernityTiers: [tier] }),
    toggle: (s) => ({
      modernityTiers: s.modernityTiers.includes(tier)
        ? s.modernityTiers.filter((t) => t !== tier)
        : [...s.modernityTiers, tier],
    }),
  };
}

export function scoreOption(min: number): FilterOption {
  return {
    id: `score:${min}`,
    group: "score",
    label: `≥ ${min}`,
    isActive: (s) => s.minScore === min,
    select: () => ({ minScore: min }),
    toggle: (s) => ({ minScore: s.minScore === min ? null : min }),
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
  featureOption("free_parking", "Vaga livre"),
];

export const AREA_OPTIONS = [
  areaOption("45-72", "45–72 m²", 45, 72),
  areaOption("45", "≥ 45 m²", 45, null),
  areaOption("60", "≥ 60 m²", 60, null),
  areaOption("75", "≥ 75 m²", 75, null),
];

export const COMMUTE_OPTIONS = [15, 20, 25, 30, 40].map((m) => commuteOption(m, `≤ ${m}`));

export const FLOOR_OPTIONS = [
  floorOption("HIGH_OR_TOP", "Alto / cobertura"),
  floorOption("LEGENDARY", "Só cobertura / último"),
  floorOption("RARE", "Médio (4º–7º)"),
  floorOption("UNCOMMON", "Baixo (1º–3º)"),
  floorOption("NO_GROUND", "Sem térreo"),
];

export const APARTMENT_FEATURES = [
  featureOption("ac", "Ar-condicionado"),
  featureOption("free_view_sun", "Vista livre"),
  featureOption("balcony", "Varanda"),
  featureOption("suite", "Suíte"),
];

export const FURNITURE_OPTIONS = [
  furnitureOption(["UNFURNISHED"], "unfurnished", "Não mobiliado"),
  furnitureOption(["FULLY_FURNISHED"], "furnished", "Mobiliado"),
];

export const BUILDING_FEATURES = [
  featureOption("new_building", "Prédio novo (2010+)"),
  featureOption("doorman_24h", "Portaria 24h"),
  featureOption("pool_gym", "Piscina / academia"),
  featureOption("reserved_building", "Torre única"),
  featureOption("pets", "Aceita pet"),
  featureOption("free_parking", "Vaga livre"),
];

export const TIER_OPTIONS = [
  tierOption("MODERN_OR_RENOVATED", "Novo / reformado"),
  tierOption("WELL_MAINTAINED", "Bem conservado"),
  tierOption("STANDARD", "Padrão"),
  tierOption("DATED", "Antigo"),
];

export const SCORE_OPTIONS = [140, 155, 170, 185, 200].map(scoreOption);

/** Every option whose facet count the filter sheet shows. */
export const SHEET_OPTIONS: FilterOption[] = [
  ...AREA_OPTIONS,
  ...COMMUTE_OPTIONS,
  ...FLOOR_OPTIONS,
  ...APARTMENT_FEATURES,
  ...FURNITURE_OPTIONS,
  ...BUILDING_FEATURES,
  ...TIER_OPTIONS,
  ...SCORE_OPTIONS,
];
