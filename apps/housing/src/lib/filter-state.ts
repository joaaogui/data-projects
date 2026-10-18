import {
  FLOOR_FILTER_OPTIONS,
  PERFEITO_EXPLORER_FILTERS,
  PROPERTY_FEATURE_OPTIONS,
  deriveLegacyFurnishedFilter,
  parseExplorerFiltersObject,
  type ParsedExplorerFiltersState,
} from "@/lib/property-filters";
import type { CityHubCode, FurnitureTier, ModernityTier } from "@/types/housing";

export type FilterState = ParsedExplorerFiltersState;
export type FilterPatch = Partial<FilterState>;

/** Fields that are not filters: view settings, ordering, and which hidden cities are switched on. */
export const NON_FILTER_KEYS = [
  "viewMode",
  "showAdvancedFilters",
  "sortBy",
  "enabledHiddenCities",
] as const satisfies ReadonlyArray<keyof FilterState>;

/** Location scope kept when a preset (e.g. Perfeito) replaces the other filters. */
export const PRESET_PRESERVED_KEYS = [
  ...NON_FILTER_KEYS,
  "selectedCities",
  "selectedNeighborhoods",
] as const satisfies ReadonlyArray<keyof FilterState>;

/** Every filter at "no restriction" (no R$ 5.000 cap: that default only applies to first-time users). */
export const CLEARED_FILTERS: FilterState = parseExplorerFiltersObject({
  maxTotalMonthly: null,
});

const FILTER_KEYS = (Object.keys(CLEARED_FILTERS) as Array<keyof FilterState>).filter(
  (k) => !(NON_FILTER_KEYS as readonly string[]).includes(k),
);
/** `floorFilter` mirrors `floorFilters` (legacy single value), so it is not compared. */
const COMPARED_FILTER_KEYS = FILTER_KEYS.filter((k) => k !== "floorFilter");

function pick(state: FilterState, keys: readonly (keyof FilterState)[]): FilterPatch {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = state[k];
  return out as FilterPatch;
}

export function clearFilters(state: FilterState): FilterState {
  return { ...CLEARED_FILTERS, ...pick(state, NON_FILTER_KEYS) };
}

/** Filter fields only (what a saved view stores). */
export function snapshotFilters(state: FilterState): FilterPatch {
  return pick(state, FILTER_KEYS);
}

/** A preset replaces every filter except the location scope (cities, neighborhoods) it does not set itself. */
export function applyPresetFilters(state: FilterState, preset: FilterPatch): FilterState {
  return {
    ...CLEARED_FILTERS,
    ...pick(state, PRESET_PRESERVED_KEYS),
    ...preset,
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return JSON.stringify([...value].map(String).sort((a, b) => a.localeCompare(b)));
  }
  return JSON.stringify(value ?? null);
}

export function sameFilters(a: FilterState, b: FilterState): boolean {
  return COMPARED_FILTER_KEYS.every((k) => canonical(a[k]) === canonical(b[k]));
}

export function isPresetActive(state: FilterState, preset: FilterPatch): boolean {
  return sameFilters(state, applyPresetFilters(state, preset));
}

export const PERFEITO_PRESET: FilterPatch = PERFEITO_EXPLORER_FILTERS as FilterPatch;

/**
 * Toggles a preset: on replaces the filters (remembering the previous ones), off restores them.
 * Without a remembered state (e.g. after a reload) turning it off clears the preset's filters.
 */
export function togglePreset(
  state: FilterState,
  preset: FilterPatch,
  previous: FilterState | null,
): { next: FilterState; previous: FilterState | null } {
  if (isPresetActive(state, preset)) {
    const keepCurrent = PRESET_PRESERVED_KEYS.filter((k) => !(k in preset));
    const restored = previous
      ? { ...previous, ...pick(state, keepCurrent) }
      : { ...CLEARED_FILTERS, ...pick(state, keepCurrent) };
    return { next: restored, previous: null };
  }
  return { next: applyPresetFilters(state, preset), previous: state };
}

export const CITY_SHORT_LABELS: Record<CityHubCode, string> = {
  BH: "Belo Horizonte",
  CP: "Campinas",
  RJ: "Rio de Janeiro",
  SP: "São Paulo",
  BSB: "Brasília",
};

const MODERNITY_TIER_LABELS: Record<ModernityTier, string> = {
  MODERN_OR_RENOVATED: "Novo / Reformado",
  WELL_MAINTAINED: "Bem conservado",
  STANDARD: "Padrão",
  DATED: "Antigo / Datado",
};

const FURNITURE_TIER_LABELS: Record<FurnitureTier, string> = {
  UNFURNISHED: "Não mobiliado",
  SEMI_FURNISHED: "Semi-mobiliado",
  FULLY_FURNISHED: "Mobiliado",
};

const PROVIDER_LABELS: Record<string, string> = {
  quintoandar: "QuintoAndar",
  zapimoveis: "Zap Imóveis",
  vivareal: "Viva Real",
  netimoveis: "Netimóveis",
  imovelweb: "Imovelweb",
};

export interface ActiveFilterPill {
  id: string;
  /** Constraint group this pill belongs to (see `buildFilterConstraints`). */
  group: string;
  label: string;
  /** State change that removes this pill. */
  clear: FilterPatch;
}

const brl = (n: number) => n.toLocaleString("pt-BR");

function rangeLabel(min: number | null, max: number | null, unit: string): string {
  if (min !== null && max !== null) return `${min}–${max} ${unit}`;
  if (min !== null) return `≥ ${min} ${unit}`;
  return `≤ ${max} ${unit}`;
}

function countsLabel(values: number[], plusFrom: number): string {
  return [...values]
    .sort((a, b) => a - b)
    .map((n) => (n >= plusFrom ? `${plusFrom}+` : String(n)))
    .join(", ");
}

/** Removable pills for every active filter (sort and view mode are not filters). */
export function describeActiveFilters(
  state: FilterState,
  options?: { favoritesCount?: number },
): ActiveFilterPill[] {
  const pills: ActiveFilterPill[] = [];
  const add = (id: string, group: string, label: string, clear: FilterPatch) =>
    pills.push({ id, group, label, clear });

  for (const city of state.selectedCities) {
    add(`city-${city}`, "cities", CITY_SHORT_LABELS[city] ?? city, {
      selectedCities: state.selectedCities.filter((c) => c !== city),
    });
  }
  for (const nb of state.selectedNeighborhoods) {
    add(`nb-${nb}`, "neighborhoods", nb.includes(":") ? nb.replace(":", " · ") : nb, {
      selectedNeighborhoods: state.selectedNeighborhoods.filter((x) => x !== nb),
    });
  }
  if (state.onlyTop20Neighborhoods) {
    add("top-neighborhoods", "top-neighborhoods", "Só Top Bairros", { onlyTop20Neighborhoods: false });
  }
  if (state.searchQuery.trim()) {
    add("search", "search", `“${state.searchQuery.trim()}”`, { searchQuery: "" });
  }
  if (state.minTotalMonthly !== null || state.maxTotalMonthly !== null) {
    const label =
      state.minTotalMonthly !== null && state.maxTotalMonthly !== null
        ? `R$ ${brl(state.minTotalMonthly)}–${brl(state.maxTotalMonthly)}`
        : state.maxTotalMonthly !== null
          ? `≤ R$ ${brl(state.maxTotalMonthly)}`
          : `≥ R$ ${brl(state.minTotalMonthly ?? 0)}`;
    add("price", "price", label, { minTotalMonthly: null, maxTotalMonthly: null });
  }
  if (state.maxCommuteMinutes !== null) {
    add("commute", "commute", `≤ ${state.maxCommuteMinutes} min`, { maxCommuteMinutes: null });
  }
  if (state.minAreaM2 !== null || state.maxAreaM2 !== null) {
    add("area", "area", rangeLabel(state.minAreaM2, state.maxAreaM2, "m²"), {
      minAreaM2: null,
      maxAreaM2: null,
    });
  }
  if (state.selectedBedrooms.length > 0 || state.minBedrooms !== null) {
    add(
      "bedrooms",
      "bedrooms",
      state.selectedBedrooms.length > 0
        ? `Quartos: ${countsLabel(state.selectedBedrooms, 3)}`
        : `${state.minBedrooms}+ quartos`,
      { selectedBedrooms: [], minBedrooms: null },
    );
  }
  if (state.selectedBathrooms.length > 0 || state.minBathrooms !== null) {
    add(
      "bathrooms",
      "bathrooms",
      state.selectedBathrooms.length > 0
        ? `Banheiros: ${countsLabel(state.selectedBathrooms, 3)}`
        : `${state.minBathrooms}+ banheiros`,
      { selectedBathrooms: [], minBathrooms: null },
    );
  }
  if (state.selectedParking.length > 0 || state.minParking !== null) {
    add(
      "parking",
      "parking",
      state.selectedParking.length > 0
        ? `Vagas: ${countsLabel(state.selectedParking, 2)}`
        : `≥ ${state.minParking} vaga(s)`,
      { selectedParking: [], minParking: null },
    );
  }
  for (const ff of state.floorFilters) {
    const opt = FLOOR_FILTER_OPTIONS.find((o) => o.value === ff);
    const nextFloors = state.floorFilters.filter((f) => f !== ff);
    add(`floor-${ff}`, "floor", opt?.label ?? ff, {
      floorFilters: nextFloors,
      floorFilter: nextFloors.length === 1 ? nextFloors[0]! : "ALL",
    });
  }
  if (state.selectedFurnitureTiers.length > 0) {
    for (const tier of state.selectedFurnitureTiers) {
      const next = state.selectedFurnitureTiers.filter((t) => t !== tier);
      add(`furn-${tier}`, "furniture", FURNITURE_TIER_LABELS[tier], {
        selectedFurnitureTiers: next,
        furnishedFilter: deriveLegacyFurnishedFilter(next),
      });
    }
  } else if (state.furnishedFilter !== "ALL") {
    add("furnished", "furniture", "Mobília filtrada", {
      selectedFurnitureTiers: [],
      furnishedFilter: "ALL",
    });
  }
  for (const feat of state.requiredFeatures) {
    const opt = PROPERTY_FEATURE_OPTIONS.find((f) => f.key === feat);
    add(`feat-${feat}`, `feat-${feat}`, opt?.label ?? feat, {
      requiredFeatures: state.requiredFeatures.filter((f) => f !== feat),
      ...(feat === "safe_street" ? { onlySafeStreets: false } : {}),
    });
  }
  if (state.onlySafeStreets && !state.requiredFeatures.includes("safe_street")) {
    add("safe-streets", "safe-streets", "Sem problemas de segurança", { onlySafeStreets: false });
  }
  for (const tier of state.modernityTiers) {
    add(`tier-${tier}`, "modernity", MODERNITY_TIER_LABELS[tier], {
      modernityTiers: state.modernityTiers.filter((t) => t !== tier),
    });
  }
  if (state.minModernityScore !== null) {
    add("min-modernity", "min-modernity", `Modernidade ≥ ${state.minModernityScore}`, {
      minModernityScore: null,
    });
  }
  if (state.hideMegaCondo) {
    add("no-megacondo", "no-megacondo", "Sem megacondomínio", { hideMegaCondo: false });
  }
  if (state.hideForSale) {
    add("no-forsale", "no-forsale", "Sem imóveis à venda", { hideForSale: false });
  }
  if (state.minListingAgeDays !== null || state.maxListingAgeDays !== null) {
    const label =
      state.minListingAgeDays !== null && state.maxListingAgeDays !== null
        ? `Anúncio: ${state.minListingAgeDays}–${state.maxListingAgeDays} dias`
        : state.maxListingAgeDays !== null
          ? `Anúncio ≤ ${state.maxListingAgeDays} dias`
          : `Anúncio ≥ ${state.minListingAgeDays} dias`;
    add("listing-age", "listing-age", label, { minListingAgeDays: null, maxListingAgeDays: null });
  }
  if (state.listingDateFrom.trim() || state.listingDateTo.trim()) {
    const from = state.listingDateFrom.trim();
    const to = state.listingDateTo.trim();
    const label = from && to ? `Anúncio: ${from} → ${to}` : from ? `Anúncio desde ${from}` : `Anúncio até ${to}`;
    add("listing-date", "listing-date", label, { listingDateFrom: "", listingDateTo: "" });
  }
  if (state.onlyNewEntries) {
    add("new-entries", "new-entries", "Só novas entradas", { onlyNewEntries: false });
  }
  if (state.providerFilter !== "ALL") {
    add("provider", "provider", PROVIDER_LABELS[state.providerFilter] ?? state.providerFilter, {
      providerFilter: "ALL",
    });
  }
  if (state.minScore !== null) {
    add("score", "score", `Nota ≥ ${state.minScore}`, { minScore: null });
  }
  if (state.onlyIneligible) {
    add("ineligible", "ineligible", "Só retidos", { onlyIneligible: false, showIneligible: false });
  } else if (state.showIneligible) {
    add("ineligible", "ineligible", "Incluindo retidos", { showIneligible: false });
  }
  if (state.deactivatedFilter !== "ACTIVE_ONLY") {
    add(
      "deactivated",
      "deactivated",
      state.deactivatedFilter === "ALL" ? "Incluindo desativados" : "Só desativados",
      { deactivatedFilter: "ACTIVE_ONLY" },
    );
  }
  if (state.onlyFavorites) {
    const n = options?.favoritesCount;
    add("favorites", "favorites", n === undefined ? "♥ Favoritos" : `♥ Favoritos (${n})`, {
      onlyFavorites: false,
    });
  }
  return pills;
}

/** Badge count on "Filtros": every active filter except the free-text search. */
export function countActiveFilters(state: FilterState): number {
  return describeActiveFilters(state).filter((p) => p.id !== "search").length;
}

export type IneligibleMode = "hide" | "include" | "only";

export function ineligibleModeOf(state: Pick<FilterState, "showIneligible" | "onlyIneligible">): IneligibleMode {
  if (state.onlyIneligible) return "only";
  return state.showIneligible ? "include" : "hide";
}

export function ineligibleModePatch(mode: IneligibleMode): FilterPatch {
  if (mode === "only") return { onlyIneligible: true, showIneligible: true };
  if (mode === "include") return { onlyIneligible: false, showIneligible: true };
  return { onlyIneligible: false, showIneligible: false };
}
