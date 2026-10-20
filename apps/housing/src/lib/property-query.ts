import { isCityVisible } from "@/lib/city-config";
import { FacetIndex, suggestRelaxations, type Relaxation } from "@/lib/filter-facets";
import { PINNED_OPTIONS, SHEET_OPTIONS } from "@/lib/filter-options";
import {
  buildBenchmarkStats,
  filterAndSortProperties,
  formatTopPropertiesForAiPrompt,
  isRecentlyPublishedListing,
  isStrictlyInTop20Neighborhoods,
  parseExplorerFiltersObject,
  resolvePropertyListingAgeAndDate,
  serializeExplorerFilters,
  type ParsedExplorerFiltersState,
  type PropertyExplorerFilters,
} from "@/lib/property-filters";
import {
  DEFAULT_WEIGHTS,
  normalizeNeighborhoodKey,
} from "@/lib/scoring-engine";
import type {
  CityHubCode,
  ComputedNeighborhood,
  EvaluatedProperty,
  NeighborhoodEntry,
  ScoringWeights,
} from "@/types/housing";
import type { NeighborhoodRationale, NeighborhoodResearchSummary, QolRow } from "@/types/neighborhood-research";

/** Photos shipped with each card; the rest load with the details. */
export const CARD_PHOTO_COUNT = 3;
export const DEFAULT_PAGE_SIZE = 30;

/**
 * A ranked property as shipped to the list/map: same shape as `EvaluatedProperty`, with the
 * heavy text (description, amenity lists, long justifications) left empty until details load.
 */
export type PropertyCardDTO = EvaluatedProperty & {
  detailsLoaded?: boolean;
  /** Set server-side (lib/neighborhood-research) when the listing's neighbourhood has a research dossier. */
  neighborhoodResearch?: NeighborhoodResearchSummary;
};

export interface NeighborhoodOption {
  name: string;
  count: number;
  cityCode: CityHubCode;
  score: number;
}

export interface PoolCounts {
  totalBasePoolCount: number;
  ineligibleActiveCount: number;
  deactivatedTotalCount: number;
  recentCount: number;
}

/** Filter state that affects which listings match (UI-only fields like viewMode are excluded). */
export type QueryFilters = Omit<
  ReturnType<typeof serializeExplorerFilters>,
  "showAdvancedFilters" | "viewMode"
>;

export interface PropertyQueryRequest {
  filters: QueryFilters;
  weights: ScoringWeights;
  /** Only sent when `onlyFavorites` is on (the only filter that depends on them). */
  favorites: string[];
  offset?: number;
  limit?: number;
  includeFacets?: boolean;
  includeMeta?: boolean;
  /** `count`: only the total (and option counts) for the filter sheet's live "Ver N imóveis". */
  mode?: "page" | "copyTop50" | "activeKeys" | "count";
  /** Copy Top 50 extras. */
  activeFilterLabels?: string[];
  allFavorites?: string[];
}

export interface DatasetMeta {
  updatedAt: string;
  source: "neon" | "snapshot";
  totalCount: number;
  /** Listings per city (hidden cities included); the portal sums only the visible ones. */
  countByCity?: Partial<Record<CityHubCode, number>>;
  neighborhoods: NeighborhoodEntry[];
  /** Non-catalog neighbourhoods with engine sub-scores and active listings (lib/extra-neighborhoods); ranking tab only. */
  extraNeighborhoods?: NeighborhoodEntry[];
  neighborhoodNamesByCity: Partial<Record<CityHubCode, string[]>>;
  /** Research summaries by `<cityCode>:<neighborhood>` (catalog and extra names, plus the reference neighbourhood). */
  neighborhoodResearch?: Record<string, NeighborhoodResearchSummary>;
  /** Top Bairros public quality-of-life cells (display only), same keys as `neighborhoodResearch`. */
  neighborhoodQol?: Record<string, QolRow>;
  /** Ranking-tab rationale of each reference neighbourhood, by its key. */
  referenceRationales?: Record<string, NeighborhoodRationale>;
}

export interface PropertyQueryResponse {
  ok: true;
  key: string;
  datasetHash: string;
  total: number;
  offset: number;
  items: PropertyCardDTO[];
  facets?: {
    counts: PoolCounts;
    neighborhoodOptions: NeighborhoodOption[];
    benchmark: ReturnType<typeof buildBenchmarkStats> | null;
    /** Favorites (from `allFavorites`) not in the visible pool, e.g. listings of a hidden city. */
    favoritesOutsidePool: string[];
    /** Facet counts for the bar's pinned chips, by option id. */
    optionCounts?: Record<string, number>;
  };
  /** Facet counts for the filter sheet options (`count` mode). */
  optionCounts?: Record<string, number>;
  /** When nothing matches: the best single-filter relaxations, with their result counts. */
  relaxations?: Relaxation[];
  meta?: DatasetMeta;
  text?: string;
  keys?: string[];
  timings?: Record<string, number>;
}

export function toQueryFilters(state: ParsedExplorerFiltersState): QueryFilters {
  const serialized: Partial<ReturnType<typeof serializeExplorerFilters>> =
    serializeExplorerFilters(state);
  delete serialized.showAdvancedFilters;
  delete serialized.viewMode;
  return serialized as QueryFilters;
}

/** Canonical identity of a result set: same filters + weights (+ favorites when filtering by them). */
export function buildQueryKey(
  req: Pick<PropertyQueryRequest, "filters" | "weights" | "favorites">,
): string {
  return JSON.stringify({
    f: req.filters,
    w: buildWeightsKey(req.weights),
    fav: req.filters.onlyFavorites ? [...req.favorites].sort((a, b) => a.localeCompare(b)) : [],
  });
}

export function buildWeightsKey(weights: ScoringWeights): string {
  const keys = Object.keys(weights).sort((a, b) => a.localeCompare(b)) as Array<keyof ScoringWeights>;
  return JSON.stringify(keys.map((k) => [k, weights[k]]));
}

/** Keeps the weights exactly as the client scored them; only drops unknown/invalid values. */
export function coerceWeights(raw: unknown): ScoringWeights {
  const merged: Record<string, number | boolean> = { ...DEFAULT_WEIGHTS };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const src = raw as Record<string, unknown>;
    for (const [key, def] of Object.entries(DEFAULT_WEIGHTS)) {
      const value = src[key];
      if (typeof def === "number" && typeof value === "number" && Number.isFinite(value)) {
        merged[key] = value;
      } else if (typeof def === "boolean" && typeof value === "boolean") {
        merged[key] = value;
      }
    }
  }
  return merged as unknown as ScoringWeights;
}

export function toExplorerFilters(
  filters: QueryFilters,
  favorites: string[],
): PropertyExplorerFilters {
  const parsed = parseExplorerFiltersObject(filters as Record<string, unknown>);
  return {
    ...parsed,
    selectedCity: parsed.selectedCities.length === 1 ? parsed.selectedCities[0]! : "ALL",
    favoriteKeys: favorites,
  };
}

export function toCardDTO(p: EvaluatedProperty): PropertyCardDTO {
  return {
    provider: p.provider,
    id: p.id,
    cityCode: p.cityCode,
    city: p.city,
    neighborhood: p.neighborhood,
    street: p.street,
    streetNumber: p.streetNumber,
    condominiumName: p.condominiumName,
    doorman: p.doorman,
    url: p.url,
    title: p.title,
    rent: p.rent,
    condoFee: p.condoFee,
    iptu: p.iptu,
    totalMonthly: p.totalMonthly,
    salePrice: p.salePrice,
    areaM2: p.areaM2,
    bedrooms: p.bedrooms,
    suites: p.suites,
    bathrooms: p.bathrooms,
    parkingSpaces: p.parkingSpaces,
    floor: p.floor,
    floorRange: p.floorRange,
    totalFloors: p.totalFloors,
    furnished: p.furnished,
    acceptsPets: p.acceptsPets,
    nearSubway: p.nearSubway,
    constructionYear: p.constructionYear,
    condition: p.condition,
    installations: [],
    amenities: [],
    comfortCommodities: [],
    practicalityCommodities: [],
    placesNearby: [],
    photoCaptions: [],
    photosCount: p.photosCount,
    modernityScore: p.modernityScore,
    modernityTier: p.modernityTier,
    positiveSignals: [],
    negativeSignals: [],
    samplePhotos: p.samplePhotos.slice(0, CARD_PHOTO_COUNT),
    description: null,
    generatedDescription: null,
    sourceSearch: null,
    isNewEntry: p.isNewEntry,
    publishedAt: p.publishedAt ?? null,
    listingUpdatedAt: p.listingUpdatedAt ?? null,
    isActive: p.isActive,
    deactivatedAt: p.deactivatedAt ?? null,
    ...(p.listedRent !== undefined ? { listedRent: p.listedRent } : {}),
    ...(p.listedIptu !== undefined ? { listedIptu: p.listedIptu } : {}),
    ...(p.alsoListedOn ? { alsoListedOn: p.alsoListedOn } : {}),
    furnitureTier: p.furnitureTier,
    commuteMinutes: p.commuteMinutes,
    commuteLabel: p.commuteLabel,
    listingAgeDays: p.listingAgeDays,
    listingAgeLabel: p.listingAgeLabel,
    firstPublicationAgeLabel: p.firstPublicationAgeLabel ?? null,
    eligible: p.eligible,
    exclusionReason: p.exclusionReason,
    finalScore: p.finalScore,
    cityRank: p.cityRank,
    overallRank: p.overallRank,
    neighborhoodRank: p.neighborhoodRank,
    neighborhoodDynamicScore: p.neighborhoodDynamicScore,
    breakdown: p.breakdown,
    cardTags: p.cardTags,
    nuanceHighlights: [],
    nuanceWarnings: [],
    parksNearby: [],
    mallsNearby: [],
    shortJustification: "",
    narrativeJustification: "",
    detailedJustification: "",
    detailsLoaded: false,
  };
}

/** Full record (all fields + lazily built justifications) as a plain serializable object. */
export function toDetailsDTO(p: EvaluatedProperty): PropertyCardDTO {
  return {
    ...p,
    shortJustification: p.shortJustification,
    narrativeJustification: p.narrativeJustification,
    detailedJustification: p.detailedJustification,
    detailsLoaded: true,
  };
}

export function computePoolCounts(
  evaluated: EvaluatedProperty[],
  state: ParsedExplorerFiltersState,
): PoolCounts {
  const {
    enabledHiddenCities,
    selectedCities,
    deactivatedFilter,
    onlyFavorites,
    onlyIneligible,
    showIneligible,
  } = state;
  let deactivatedTotalCount = 0;
  let ineligibleActiveCount = 0;
  let totalBasePoolCount = 0;
  let recentCount = 0;
  for (const p of evaluated) {
    if (isRecentlyPublishedListing(p)) recentCount += 1;
    const visible = isCityVisible(p.cityCode, enabledHiddenCities);
    if (visible && p.isActive === false) deactivatedTotalCount += 1;
    if (
      visible &&
      (selectedCities.length === 0 || selectedCities.includes(p.cityCode)) &&
      p.isActive !== false &&
      !p.eligible
    ) {
      ineligibleActiveCount += 1;
    }
    if (!visible) continue;
    if (deactivatedFilter === "ACTIVE_ONLY" && !onlyFavorites && p.isActive === false) continue;
    if (deactivatedFilter === "DEACTIVATED_ONLY" && p.isActive !== false) continue;
    const inPool = onlyIneligible ? !p.eligible : showIneligible || onlyFavorites ? true : p.eligible;
    if (inPool) totalBasePoolCount += 1;
  }
  return { totalBasePoolCount, ineligibleActiveCount, deactivatedTotalCount, recentCount };
}

export function buildNeighborhoodOptions(
  evaluated: EvaluatedProperty[],
  state: ParsedExplorerFiltersState,
  dynamicNeighborhoods: ComputedNeighborhood[],
): NeighborhoodOption[] {
  const {
    enabledHiddenCities,
    onlyIneligible,
    showIneligible,
    selectedCities,
    onlyTop20Neighborhoods,
    minListingAgeDays,
    maxListingAgeDays,
    listingDateFrom,
    listingDateTo,
  } = state;
  const countMap = new Map<
    string,
    { name: string; count: number; cityCode: CityHubCode }
  >();
  for (const p of evaluated) {
    if (!isCityVisible(p.cityCode, enabledHiddenCities)) continue;
    if (onlyIneligible && p.eligible) continue;
    const isOnlyCommuteExcluded =
      !p.eligible &&
      Boolean(p.exclusionReason) &&
      p.exclusionReason!
        .split(" · ")
        .every((r) => /gargalo pendular cr[ií]tico > 35 min/i.test(r));
    if (!showIneligible && !onlyIneligible && !p.eligible && !isOnlyCommuteExcluded) continue;
    if (selectedCities.length > 0 && !selectedCities.includes(p.cityCode)) {
      continue;
    }
    if (onlyTop20Neighborhoods && !isStrictlyInTop20Neighborhoods(p)) {
      continue;
    }
    if (
      minListingAgeDays !== null ||
      maxListingAgeDays !== null ||
      listingDateFrom.trim() !== "" ||
      listingDateTo.trim() !== ""
    ) {
      const { ageDays, dateIso } = resolvePropertyListingAgeAndDate(p);
      if (
        minListingAgeDays !== null &&
        (ageDays === null || ageDays === undefined || ageDays < minListingAgeDays)
      ) {
        continue;
      }
      if (
        maxListingAgeDays !== null &&
        (ageDays === null || ageDays === undefined || ageDays > maxListingAgeDays)
      ) {
        continue;
      }
      const fromTrim = listingDateFrom.trim();
      if (fromTrim && (!dateIso || dateIso < fromTrim)) {
        continue;
      }
      const toTrim = listingDateTo.trim();
      if (toTrim && (!dateIso || dateIso > toTrim)) {
        continue;
      }
    }
    const mapKey = `${p.cityCode}:${p.neighborhood}`;
    const prev = countMap.get(mapKey);
    if (prev) {
      prev.count += 1;
    } else {
      countMap.set(mapKey, {
        name: p.neighborhood,
        count: 1,
        cityCode: p.cityCode,
      });
    }
  }

  const rankScoreMap = new Map<string, number>();
  for (const n of dynamicNeighborhoods) {
    rankScoreMap.set(`${n.cityCode}:${n.neighborhood}`, n.dynamicScore);
    rankScoreMap.set(
      `${n.cityCode}:${normalizeNeighborhoodKey(n.neighborhood, n.cityCode)}`,
      n.dynamicScore,
    );
    rankScoreMap.set(n.neighborhood, n.dynamicScore);
    rankScoreMap.set(
      normalizeNeighborhoodKey(n.neighborhood, n.cityCode),
      n.dynamicScore,
    );
  }

  return [...countMap.values()]
    .map((info) => ({
      name: info.name,
      count: info.count,
      cityCode: info.cityCode,
      score:
        rankScoreMap.get(`${info.cityCode}:${info.name}`) ??
        rankScoreMap.get(
          `${info.cityCode}:${normalizeNeighborhoodKey(info.name, info.cityCode)}`,
        ) ??
        rankScoreMap.get(info.name) ??
        rankScoreMap.get(normalizeNeighborhoodKey(info.name, info.cityCode)) ??
        0,
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.count - a.count ||
        a.name.localeCompare(b.name, "pt-BR"),
    );
}

export interface ScoredSet {
  datasetHash: string;
  properties: EvaluatedProperty[];
  ranked: ComputedNeighborhood[];
  /** Cache for filtered+sorted results of this scored set, keyed by query key. */
  filtered: Map<string, EvaluatedProperty[]>;
  byKey?: Map<string, EvaluatedProperty>;
  /** Live-count results of the filter sheet, keyed by query key. */
  counts?: Map<string, { total: number; optionCounts: Record<string, number> }>;
}

const MAX_FILTERED_PER_SET = 24;

export function filterScoredSet(
  set: ScoredSet,
  req: PropertyQueryRequest,
  key: string,
): EvaluatedProperty[] {
  const hit = set.filtered.get(key);
  if (hit) return hit;
  const result = filterAndSortProperties(
    set.properties,
    toExplorerFilters(req.filters, req.favorites),
    req.favorites,
  );
  set.filtered.set(key, result);
  while (set.filtered.size > MAX_FILTERED_PER_SET) {
    set.filtered.delete(set.filtered.keys().next().value!);
  }
  return result;
}

const FACET_OPTIONS = [...PINNED_OPTIONS, ...SHEET_OPTIONS];

/** Total + per-option facet counts for a filter state, without sorting (cached per query key). */
export function countScoredSet(
  set: ScoredSet,
  req: PropertyQueryRequest,
  key: string,
): { total: number; optionCounts: Record<string, number> } {
  set.counts ??= new Map();
  const hit = set.counts.get(key);
  if (hit) return hit;
  const state = parseExplorerFiltersObject(req.filters as Record<string, unknown>);
  const index = new FacetIndex(set.properties, state, req.favorites);
  const result = { total: index.total, optionCounts: index.optionCounts(FACET_OPTIONS) };
  set.counts.set(key, result);
  while (set.counts.size > MAX_FILTERED_PER_SET) {
    set.counts.delete(set.counts.keys().next().value!);
  }
  return result;
}

export function favoritesOutsidePool(set: ScoredSet, favorites: string[]): string[] {
  if (favorites.length === 0) return [];
  set.byKey ??= new Map(set.properties.map((p) => [`${p.provider}:${p.id}`, p]));
  const byKey = set.byKey;
  return favorites.filter((k) => !byKey.has(k));
}

export function runPropertyQuery(
  set: ScoredSet,
  req: PropertyQueryRequest,
): PropertyQueryResponse {
  const key = buildQueryKey(req);
  const matches = filterScoredSet(set, req, key);
  const base = { ok: true as const, key, datasetHash: set.datasetHash, total: matches.length };
  if (req.mode === "copyTop50") {
    return {
      ...base,
      offset: 0,
      items: [],
      text: formatTopPropertiesForAiPrompt(matches, {
        activeFilterLabels: req.activeFilterLabels ?? [],
        favoriteKeys: new Set(req.allFavorites ?? req.favorites),
        limit: 50,
      }),
    };
  }
  if (req.mode === "count") {
    const counted = countScoredSet(set, req, key);
    return { ...base, total: counted.total, offset: 0, items: [], optionCounts: counted.optionCounts };
  }
  if (req.mode === "activeKeys") {
    return {
      ...base,
      offset: 0,
      items: [],
      keys: matches
        .filter((p) => p.isActive !== false)
        .slice(0, req.limit ?? 25)
        .map((p) => `${p.provider}:${p.id}`),
    };
  }
  const offset = Math.max(0, Math.floor(req.offset ?? 0));
  const limit = Math.min(500, Math.max(1, Math.floor(req.limit ?? DEFAULT_PAGE_SIZE)));
  const response: PropertyQueryResponse = {
    ...base,
    offset,
    items: matches.slice(offset, offset + limit).map(toCardDTO),
  };
  if (req.includeFacets) {
    const state = parseExplorerFiltersObject(req.filters as Record<string, unknown>);
    response.facets = {
      counts: computePoolCounts(set.properties, state),
      neighborhoodOptions: buildNeighborhoodOptions(set.properties, state, set.ranked),
      benchmark: state.enabledHiddenCities.includes("BSB") ? buildBenchmarkStats(set.properties) : null,
      favoritesOutsidePool: favoritesOutsidePool(set, req.allFavorites ?? []),
      optionCounts: countScoredSet(set, req, key).optionCounts,
    };
  }
  if (matches.length === 0 && offset === 0) {
    response.relaxations = suggestRelaxations(
      set.properties,
      parseExplorerFiltersObject(req.filters as Record<string, unknown>),
      req.favorites,
    );
  }
  return response;
}
