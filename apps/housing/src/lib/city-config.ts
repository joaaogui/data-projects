import type { CityHubCode } from "@/types/housing";

/**
 * Cities hidden unless the user switches them on ("Cidades ocultas" in Mais Filtros). Their listings stay in
 * the data (snapshot, Neon, scraper JSON) but are dropped before scoring, so ranks, counts, facets and the
 * neighborhood ranking are computed as if they did not exist. The user's choice is `enabledHiddenCities`.
 */
export const HIDDEN_BY_DEFAULT_CITIES: readonly CityHubCode[] = ["SP", "BSB"];

export const HIDDEN_CITY_LABELS: Record<string, string> = {
  SP: "São Paulo (capital)",
  BSB: "Brasília — Águas Claras (referência)",
};

/** Cities that are always offered (everything not hidden by default). */
const ALWAYS_VISIBLE_CITIES = ["BH", "CP", "RJ"] as const;

/** Keeps only valid hidden cities, in a stable order and without duplicates. */
export function normalizeEnabledHiddenCities(raw: unknown): CityHubCode[] {
  if (!Array.isArray(raw)) return [];
  return HIDDEN_BY_DEFAULT_CITIES.filter((c) => raw.includes(c));
}

/** Reads `enabledHiddenCities`, falling back to the legacy `enableBsbBenchmark` flag. */
export function resolveEnabledHiddenCities(raw: {
  enabledHiddenCities?: unknown;
  enableBsbBenchmark?: unknown;
}): CityHubCode[] {
  if (Array.isArray(raw.enabledHiddenCities)) return normalizeEnabledHiddenCities(raw.enabledHiddenCities);
  return raw.enableBsbBenchmark === true ? ["BSB"] : [];
}

export function isCityVisible(city: CityHubCode, enabledHiddenCities: readonly CityHubCode[]): boolean {
  return !HIDDEN_BY_DEFAULT_CITIES.includes(city) || enabledHiddenCities.includes(city);
}

export function filterVisibleCities<T extends { cityCode: CityHubCode }>(
  items: T[],
  enabledHiddenCities: readonly CityHubCode[],
): T[] {
  return enabledHiddenCities.length === HIDDEN_BY_DEFAULT_CITIES.length
    ? items
    : items.filter((i) => isCityVisible(i.cityCode, enabledHiddenCities));
}

/** Cities offered in the selector: the always-visible ones plus the enabled hidden ones. */
export function selectableCities(enabledHiddenCities: readonly CityHubCode[]): CityHubCode[] {
  return [...ALWAYS_VISIBLE_CITIES, ...normalizeEnabledHiddenCities(enabledHiddenCities)];
}

export function isSelectableCity(city: unknown, enabledHiddenCities: readonly CityHubCode[]): city is CityHubCode {
  return (selectableCities(enabledHiddenCities) as unknown[]).includes(city);
}
