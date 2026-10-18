import { CLEARED_FILTERS, type FilterState } from "@/lib/filter-state";
import { parseExplorerFiltersObject, serializeExplorerFilters } from "@/lib/property-filters";

type Kind = "list" | "numList" | "num" | "bool" | "str";

/** URL parameter for each shareable field (filters, sort, view, hidden cities). */
const PARAMS: Array<[keyof FilterState, string, Kind]> = [
  ["selectedCities", "cidade", "list"],
  ["selectedNeighborhoods", "bairro", "list"],
  ["searchQuery", "q", "str"],
  ["minTotalMonthly", "min", "num"],
  ["maxTotalMonthly", "max", "num"],
  ["maxCommuteMinutes", "tempo", "num"],
  ["minAreaM2", "area_min", "num"],
  ["maxAreaM2", "area_max", "num"],
  ["selectedBedrooms", "quartos", "numList"],
  ["selectedBathrooms", "banheiros", "numList"],
  ["selectedParking", "vagas", "numList"],
  ["minBedrooms", "quartos_min", "num"],
  ["minBathrooms", "banheiros_min", "num"],
  ["minParking", "vagas_min", "num"],
  ["floorFilters", "andar", "list"],
  ["requiredFeatures", "tem", "list"],
  ["selectedFurnitureTiers", "mobilia", "list"],
  ["modernityTiers", "conservacao", "list"],
  ["minModernityScore", "modernidade_min", "num"],
  ["minScore", "nota", "num"],
  ["minListingAgeDays", "idade_min", "num"],
  ["maxListingAgeDays", "idade_max", "num"],
  ["listingDateFrom", "de", "str"],
  ["listingDateTo", "ate", "str"],
  ["hideMegaCondo", "sem_mega", "bool"],
  ["hideForSale", "sem_venda", "bool"],
  ["onlyNewEntries", "novos", "bool"],
  ["showIneligible", "retidos", "bool"],
  ["onlyIneligible", "so_retidos", "bool"],
  ["onlyFavorites", "favoritos", "bool"],
  ["onlyTop20Neighborhoods", "top_bairros", "bool"],
  ["onlySafeStreets", "rua_segura", "bool"],
  ["providerFilter", "plataforma", "str"],
  ["deactivatedFilter", "status", "str"],
  ["enabledHiddenCities", "ocultas", "list"],
  ["sortBy", "ordem", "str"],
  ["viewMode", "ver", "str"],
];

/** Marks a URL that carries filter state, even when every filter is cleared. */
const MARKER = "f";

function canonical(value: unknown): string {
  return JSON.stringify(Array.isArray(value) ? [...value].map(String).sort() : (value ?? null));
}

export function filtersToSearch(state: FilterState): string {
  const params = new URLSearchParams();
  params.set(MARKER, "1");
  for (const [key, name, kind] of PARAMS) {
    const value = state[key];
    if (canonical(value) === canonical(CLEARED_FILTERS[key])) continue;
    if (kind === "list" || kind === "numList") {
      params.set(name, (value as Array<string | number>).join(","));
    } else if (kind === "bool") {
      params.set(name, value ? "1" : "0");
    } else if (value === null) {
      params.set(name, "");
    } else {
      params.set(name, String(value));
    }
  }
  return `?${params.toString()}`;
}

/** Filter state encoded in a URL query, or `null` when the URL carries none (then saved preferences apply). */
export function filtersFromSearch(search: string): FilterState | null {
  const params = new URLSearchParams(search);
  if (!params.has(MARKER)) return null;
  const raw: Record<string, unknown> = serializeExplorerFilters(CLEARED_FILTERS);
  for (const [key, name, kind] of PARAMS) {
    const value = params.get(name);
    if (value === null) continue;
    if (kind === "list") raw[key] = value === "" ? [] : value.split(",").map((v) => v.trim()).filter(Boolean);
    else if (kind === "numList") raw[key] = value.split(",").map(Number).filter(Number.isFinite);
    else if (kind === "bool") raw[key] = value === "1";
    else if (kind === "num") raw[key] = value === "" ? null : Number.isFinite(Number(value)) ? Number(value) : null;
    else raw[key] = value;
  }
  return parseExplorerFiltersObject(raw);
}
