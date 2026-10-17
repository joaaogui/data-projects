"use client";

import { isAwaitingDetailedAnswer } from "@/lib/chat-text";
import {
  createFilterStore,
  useFilterField,
} from "@/components/portal/filter-store";
import {
  completedPhotoFetchKeys,
  fetchPropertyPhotosShared,
  getClientDescriptionCached,
  getClientPhotosCached,
} from "@/components/property-photo-showcase";
import {
  filterVisibleCities,
  isCityVisible,
  normalizeEnabledHiddenCities,
  selectableCities,
} from "@/lib/city-config";
import {
  FLOOR_FILTER_OPTIONS,
  SORT_BY_OPTIONS,
  PROPERTY_FEATURE_OPTIONS,
  buildBenchmarkStats,
  deriveLegacyFurnishedFilter,
  parseExplorerFiltersObject,
  serializeExplorerFilters,
  type FloorFilterOption,
  type FurnishedFilterOption,
  type PropertyFeatureKey,
  type ParsedExplorerFiltersState,
} from "@/lib/property-filters";
import {
  buildQueryKey,
  buildWeightsKey,
  toQueryFilters,
  type DatasetMeta,
  type PropertyCardDTO,
  type PropertyQueryRequest,
  type PropertyQueryResponse,
} from "@/lib/property-query";
import {
  BUILTIN_PRESETS,
  computeDynamicNeighborhoods,
  normalizeNeighborhoodKey,
  sanitizeAndMigrateWeights,
} from "@/lib/scoring-engine";
import type {
  CityHubCode,
  EvaluatedProperty,
  FurnitureTier,
  PropertyQuestionItem,
  ScoringWeights,
  ScrapeJobStatus,
  SharedUserPreferences,
} from "@/types/housing";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  DEFAULT_COMPARE_KEYS,
  getProviderStyle,
  MODERNITY_TIER_BADGES,
  upsertBoundedRecord,
} from "@/components/portal/constants";

const MAX_CLIENT_QUERY_CACHE_ENTRIES = 24;
const PREFERENCES_SAVE_DEBOUNCE_MS = 800;
const WEIGHTS_QUERY_DEBOUNCE_MS = 250;
/** Ignore pushed QA snapshots briefly after a local optimistic change so it isn't undone. */
const QA_PUSH_MUTATION_GRACE_MS = 1500;
const MAX_DETAILS_CACHE_ENTRIES = 40;
const EMPTY_BENCHMARK_STATS = buildBenchmarkStats([]);
const EMPTY_DETAILS_MAP = new Map<string, PropertyCardDTO>();

interface ListState {
  key: string;
  datasetHash: string;
  items: PropertyCardDTO[];
  total: number;
  facets: PropertyQueryResponse["facets"] | null;
}

async function postPropertyQuery(
  body: PropertyQueryRequest,
  signal?: AbortSignal,
): Promise<PropertyQueryResponse> {
  const res = await fetch("/api/properties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`properties query failed (${res.status})`);
  return (await res.json()) as PropertyQueryResponse;
}

export type HousingPortalProps = {
  initialMeta: DatasetMeta;
  initialQuery: PropertyQueryResponse;
  initialQueryKey: string;
  initialPreferences?: SharedUserPreferences;
};

export function usePortalController({
  initialMeta,
  initialQuery,
  initialQueryKey,
  initialPreferences,
}: HousingPortalProps) {
  const resolvedInitialPrefs = initialPreferences;
  const initialParsedFilters = useMemo(
    () => parseExplorerFiltersObject(resolvedInitialPrefs?.filters),
    [resolvedInitialPrefs],
  );
  const initialWeights = useMemo<ScoringWeights>(
    () =>
      sanitizeAndMigrateWeights(
        resolvedInitialPrefs?.weights,
        resolvedInitialPrefs?.schemaVersion ?? 2,
      ),
    [resolvedInitialPrefs],
  );
  const initialPresetId =
    resolvedInitialPrefs?.activePresetId || "balanced-original";
  const initialFavorites = useMemo(
    () => resolvedInitialPrefs?.favorites ?? [],
    [resolvedInitialPrefs],
  );
  const initialCompareKeys = useMemo(
    () =>
      Array.isArray(resolvedInitialPrefs?.compareKeys)
        ? resolvedInitialPrefs.compareKeys
        : DEFAULT_COMPARE_KEYS,
    [resolvedInitialPrefs],
  );

  const [filterStore] = useState(() => createFilterStore(initialParsedFilters));
  const [meta, setMeta] = useState<DatasetMeta>(initialMeta);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [weights, setWeights] = useState<ScoringWeights>(initialWeights);
  // Sliders update `weights` on every tick; queries (server rescoring) follow once the value settles.
  const [queryWeights, setQueryWeights] = useState<ScoringWeights>(initialWeights);
  useEffect(() => {
    if (queryWeights === weights) return;
    const id = window.setTimeout(() => setQueryWeights(weights), WEIGHTS_QUERY_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [weights, queryWeights]);
  const [activePresetId, setActivePresetId] = useState<string>(initialPresetId);
  const [activeTab, setActiveTab] = useState<
    "properties" | "neighborhoods" | "compare"
  >("properties");
  const [selectedCities, setSelectedCities] = useFilterField(
    filterStore,
    "selectedCities",
  );
  const [selectedNeighborhoods, setSelectedNeighborhoods] = useFilterField(
    filterStore,
    "selectedNeighborhoods",
  );
  const [searchQuery, setSearchQuery] = useFilterField(
    filterStore,
    "searchQuery",
  );
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [floorFilters, setFloorFilters] = useFilterField(
    filterStore,
    "floorFilters",
  );
  const floorFilter: FloorFilterOption =
    floorFilters.length === 1 ? floorFilters[0]! : "ALL";
  const [minTotalMonthly, setMinTotalMonthly] = useFilterField(
    filterStore,
    "minTotalMonthly",
  );
  const [maxTotalMonthly, setMaxTotalMonthly] = useFilterField(
    filterStore,
    "maxTotalMonthly",
  );
  const [maxCommuteMinutes, setMaxCommuteMinutes] = useFilterField(
    filterStore,
    "maxCommuteMinutes",
  );
  const [minScore, setMinScore] = useFilterField(filterStore, "minScore");
  const [sortBy, setSortBy] = useFilterField(filterStore, "sortBy");
  const [minAreaM2, setMinAreaM2] = useFilterField(filterStore, "minAreaM2");
  const [maxAreaM2, setMaxAreaM2] = useFilterField(filterStore, "maxAreaM2");
  const [minListingAgeDays, setMinListingAgeDays] = useFilterField(
    filterStore,
    "minListingAgeDays",
  );
  const [maxListingAgeDays, setMaxListingAgeDays] = useFilterField(
    filterStore,
    "maxListingAgeDays",
  );
  const [listingDateFrom, setListingDateFrom] = useFilterField(
    filterStore,
    "listingDateFrom",
  );
  const [listingDateTo, setListingDateTo] = useFilterField(
    filterStore,
    "listingDateTo",
  );
  const [selectedBedrooms, setSelectedBedrooms] = useFilterField(
    filterStore,
    "selectedBedrooms",
  );
  const [selectedBathrooms, setSelectedBathrooms] = useFilterField(
    filterStore,
    "selectedBathrooms",
  );
  const [selectedParking, setSelectedParking] = useFilterField(
    filterStore,
    "selectedParking",
  );
  const [minBedrooms, setMinBedrooms] = useFilterField(
    filterStore,
    "minBedrooms",
  );
  const [minBathrooms, setMinBathrooms] = useFilterField(
    filterStore,
    "minBathrooms",
  );
  const [minParking, setMinParking] = useFilterField(filterStore, "minParking");
  const [modernityTiers, setModernityTiers] = useFilterField(
    filterStore,
    "modernityTiers",
  );
  const [minModernityScore, setMinModernityScore] = useFilterField(
    filterStore,
    "minModernityScore",
  );
  const [furnishedFilter, setFurnishedFilter] = useFilterField(
    filterStore,
    "furnishedFilter",
  );
  const [selectedFurnitureTiers, setSelectedFurnitureTiers] = useFilterField(
    filterStore,
    "selectedFurnitureTiers",
  );
  const [requiredFeatures, setRequiredFeatures] = useFilterField(
    filterStore,
    "requiredFeatures",
  );
  const [hideMegaCondo, setHideMegaCondo] = useFilterField(
    filterStore,
    "hideMegaCondo",
  );
  const [hideForSale, setHideForSale] = useFilterField(
    filterStore,
    "hideForSale",
  );
  const [onlyNewEntries, setOnlyNewEntries] = useFilterField(
    filterStore,
    "onlyNewEntries",
  );
  const [showIneligible, setShowIneligible] = useFilterField(
    filterStore,
    "showIneligible",
  );
  const [onlyIneligible, setOnlyIneligible] = useFilterField(
    filterStore,
    "onlyIneligible",
  );
  const [providerFilter, setProviderFilter] = useFilterField(
    filterStore,
    "providerFilter",
  );
  const [onlyFavorites, setOnlyFavorites] = useFilterField(
    filterStore,
    "onlyFavorites",
  );
  const [onlyTop20Neighborhoods, setOnlyTop20Neighborhoods] = useFilterField(
    filterStore,
    "onlyTop20Neighborhoods",
  );
  const [onlySafeStreets, setOnlySafeStreets] = useFilterField(
    filterStore,
    "onlySafeStreets",
  );
  const [enabledHiddenCities, setEnabledHiddenCities] = useFilterField(
    filterStore,
    "enabledHiddenCities",
  );
  const enableBsbBenchmark = enabledHiddenCities.includes("BSB");
  // Header counts follow the cities that are switched on.
  const visibleMeta = useMemo(() => {
    if (!meta.countByCity) return meta;
    const totalCount = Object.entries(meta.countByCity).reduce(
      (sum, [city, n]) =>
        isCityVisible(city as CityHubCode, enabledHiddenCities) ? sum + n : sum,
      0,
    );
    return { ...meta, totalCount };
  }, [meta, enabledHiddenCities]);
  const selectableCityList = useMemo(
    () => selectableCities(enabledHiddenCities),
    [enabledHiddenCities],
  );
  const [benchmarkPanelCollapsed, setBenchmarkPanelCollapsed] =
    useState<boolean>(false);
  const [deactivatedFilter, setDeactivatedFilter] = useFilterField(
    filterStore,
    "deactivatedFilter",
  );
  const [favoriteKeys, setFavoriteKeys] = useState<string[]>(initialFavorites);
  const [showAdvancedFilters, setShowAdvancedFilters] = useFilterField(
    filterStore,
    "showAdvancedFilters",
  );
  const [showSlidersDrawer, setShowSlidersDrawer] = useState<boolean>(false);
  const [showScrapeDrawer, setShowScrapeDrawer] = useState<boolean>(false);
  const [scrapeCities, setScrapeCities] = useState<CityHubCode[]>([
    "BH",
    "RJ",
    "CP",
    "SP",
  ]);
  const [customSearchUrl, setCustomSearchUrl] = useState<string>("");
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeJobStatus>({
    jobId: "none",
    status: "idle",
  });
  const [isStartingScrape, setIsStartingScrape] = useState<boolean>(false);
  const prevScrapeStatusRef = useRef<ScrapeJobStatus["status"]>("idle");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [galleryState, setGalleryState] = useState<{
    property: EvaluatedProperty;
    initialIndex: number;
  } | null>(null);
  const [extraPhotosByKey, setExtraPhotosByKey] = useState<
    Record<string, Array<{ room: string | null; url: string }>>
  >({});
  const [extraDescriptionsByKey, setExtraDescriptionsByKey] = useState<
    Record<string, string>
  >({});
  const fetchedPhotoKeysRef = useRef<Set<string>>(new Set());
  const [compareKeys, setCompareKeys] = useState<string[]>(initialCompareKeys);
  const [visibleCount, setVisibleCount] = useState<number>(30);
  const [focusedPropertyKey, setFocusedPropertyKey] = useState<string | null>(
    null,
  );
  const [mountedWindow, setMountedWindow] = useState<{
    start: number;
    end: number;
  }>({ start: 0, end: 16 });
  const cardsListRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useFilterField(filterStore, "viewMode");
  const [hoveredPropertyKey, setHoveredPropertyKey] = useState<string | null>(
    null,
  );
  const [selectedMapPropertyKey, setSelectedMapPropertyKey] = useState<
    string | null
  >(null);
  const [qaItems, setQaItems] = useState<PropertyQuestionItem[]>([]);
  const [showChatDrawer, setShowChatDrawer] = useState<boolean>(false);
  const [pinnedChatPropertyKey, setPinnedChatPropertyKey] = useState<
    string | null
  >(null);
  const [chatScrollTargetKey, setChatScrollTargetKey] = useState<string | null>(
    null,
  );
  const [isSubmittingChatQuestion, setIsSubmittingChatQuestion] =
    useState<boolean>(false);

  const filteredPropertiesRef = useRef<PropertyCardDTO[]>([]);
  const resetAllFiltersRef = useRef<() => void>(() => {});

  const focusCardInList = useCallback(
    (key: string) => {
      setActiveTab("properties");
      setViewMode((prev) => (prev === "map" ? "split" : prev));
      const idx = filteredPropertiesRef.current.findIndex(
        (p) => `${p.provider}:${p.id}` === key,
      );
      // Never expand visibleCount to thousands of items!
      // If the target card is outside the initial 30-card slice (or filtered out),
      // pin it via focusedPropertyKey at index 0 of displayedCards and keep the window small.
      if (idx < 0 || idx >= 30) {
        setFocusedPropertyKey(key);
        setMountedWindow({ start: 0, end: 16 });
      } else {
        setFocusedPropertyKey(null);
        const start = Math.max(0, idx - 4);
        setMountedWindow({ start, end: start + 16 });
      }
      setExpandedId(key);
      setSelectedMapPropertyKey(key);
      setTimeout(() => {
        const safeId = `property-card-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        const el = document.getElementById(safeId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    },
    [setViewMode],
  );
  const [filtersHydrated, setFiltersHydrated] = useState<boolean>(false);
  const lastSyncedUpdatedAtRef = useRef<string>(
    resolvedInitialPrefs?.updatedAt ?? "",
  );
  const lastSavedSnapshotJsonRef = useRef<string>(
    JSON.stringify({
      filters: serializeExplorerFilters(initialParsedFilters),
      weights: initialWeights,
      activePresetId: initialPresetId,
      favorites: initialFavorites,
      compareKeys: initialCompareKeys,
    }),
  );
  const hasUnsavedLocalPrefsRef = useRef<boolean>(false);
  const localPrefRevRef = useRef<number>(0);
  const ackedPrefRevRef = useRef<number>(0);
  const isApplyingRemotePrefsRef = useRef<boolean>(false);
  const prefSaveChainRef = useRef<Promise<void>>(Promise.resolve());
  const [prefSaveRetryTick, setPrefSaveRetryTick] = useState<number>(0);

  const applyFilterStateObject = useCallback(
    (parsed: ParsedExplorerFiltersState) => {
      filterStore.setState({
        ...parsed,
        onlyIneligible: parsed.onlyIneligible ?? false,
      });
    },
    [filterStore],
  );

  const applySharedPreferencesToState = useCallback(
    (prefs: SharedUserPreferences) => {
      const parsedFilters = parseExplorerFiltersObject(prefs.filters);
      const nextWeights: ScoringWeights = sanitizeAndMigrateWeights(
        prefs.weights,
        prefs.schemaVersion ?? 2,
      );
      const nextPresetId = prefs.activePresetId || "balanced-original";
      const nextFavorites = Array.isArray(prefs.favorites)
        ? prefs.favorites
        : [];
      const nextCompareKeys = Array.isArray(prefs.compareKeys)
        ? prefs.compareKeys
        : DEFAULT_COMPARE_KEYS;

      const serializedFilters = serializeExplorerFilters(parsedFilters);
      isApplyingRemotePrefsRef.current = true;
      lastSavedSnapshotJsonRef.current = JSON.stringify({
        filters: serializedFilters,
        weights: nextWeights,
        activePresetId: nextPresetId,
        favorites: nextFavorites,
        compareKeys: nextCompareKeys,
      });
      lastSyncedUpdatedAtRef.current = prefs.updatedAt;

      applyFilterStateObject(parsedFilters);
      setWeights(nextWeights);
      setQueryWeights(nextWeights);
      setActivePresetId(nextPresetId);
      setFavoriteKeys(nextFavorites);
      setCompareKeys(nextCompareKeys);

      try {
        localStorage.setItem(
          "housing_explorer_filters_v1",
          JSON.stringify(serializedFilters),
        );
        localStorage.setItem(
          "housing_weights_v2",
          JSON.stringify({ presetId: nextPresetId, weights: nextWeights }),
        );
        localStorage.setItem(
          "housing_favorites_v1",
          JSON.stringify(nextFavorites),
        );
        localStorage.setItem(
          "housing_compare_v1",
          JSON.stringify(nextCompareKeys),
        );
        localStorage.setItem(
          "housing_preferences_updated_at_v1",
          prefs.updatedAt,
        );
      } catch {
        // Ignore storage errors
      }
    },
    [applyFilterStateObject],
  );

  const pruneNeighborhoodsForCities = useCallback(
    (prevNeighborhoods: string[], nextCities: CityHubCode[]) => {
      if (
        nextCities.length === 0 ||
        nextCities.length >= selectableCities(enabledHiddenCities).length
      ) {
        return prevNeighborhoods;
      }
      if (prevNeighborhoods.length === 0) {
        return prevNeighborhoods;
      }
      return prevNeighborhoods.filter((nb) => {
        if (nb.includes(":")) {
          const [nbCity] = nb.split(":");
          return nextCities.includes(nbCity as CityHubCode);
        }
        const inProperties = nextCities.some((cityCode) =>
          (meta.neighborhoodNamesByCity[cityCode] ?? []).some(
            (name) =>
              name === nb ||
              normalizeNeighborhoodKey(name, cityCode) ===
                normalizeNeighborhoodKey(nb, cityCode),
          ),
        );
        if (inProperties) return true;
        return meta.neighborhoods.some(
          (n) =>
            nextCities.includes(n.cityCode) &&
            (n.neighborhood === nb ||
              normalizeNeighborhoodKey(n.neighborhood, n.cityCode) ===
                normalizeNeighborhoodKey(nb, n.cityCode)),
        );
      });
    },
    [meta.neighborhoodNamesByCity, meta.neighborhoods, enabledHiddenCities],
  );

  const handleCitySelect = useCallback(
    (city: CityHubCode | "ALL") => {
      if (city === "ALL") {
        setSelectedCities([]);
        setSelectedNeighborhoods([]);
        setVisibleCount(30);
        return;
      }
      const exists = selectedCities.includes(city);
      const rawNext = exists
        ? selectedCities.filter((c) => c !== city)
        : [...selectedCities, city];
      const maxAllCount = selectableCities(enabledHiddenCities).length;
      const nextCities = rawNext.length >= maxAllCount ? [] : rawNext;
      setSelectedCities(nextCities);
      setSelectedNeighborhoods((prevNbs) =>
        pruneNeighborhoodsForCities(prevNbs, nextCities),
      );
      setVisibleCount(30);
    },
    [
      selectedCities,
      enabledHiddenCities,
      pruneNeighborhoodsForCities,
      setSelectedCities,
      setSelectedNeighborhoods,
    ],
  );

  /** Switches a hidden-by-default city (SP, BSB) on or off; listings, ranks and counts follow. */
  const handleToggleHiddenCity = useCallback(
    (city: CityHubCode) => {
      const turnOn = !enabledHiddenCities.includes(city);
      setEnabledHiddenCities(
        normalizeEnabledHiddenCities(
          turnOn
            ? [...enabledHiddenCities, city]
            : enabledHiddenCities.filter((c) => c !== city),
        ),
      );
      if (turnOn) {
        if (city === "BSB") setBenchmarkPanelCollapsed(false);
      } else {
        setSelectedCities((prev) => prev.filter((c) => c !== city));
        setSelectedNeighborhoods((prev) =>
          prev.filter(
            (nb) =>
              !nb.startsWith(`${city}:`) &&
              !(meta.neighborhoodNamesByCity[city] ?? []).includes(nb) &&
              !meta.neighborhoods.some(
                (n) => n.cityCode === city && n.neighborhood === nb,
              ),
          ),
        );
      }
      setVisibleCount(30);
    },
    [
      enabledHiddenCities,
      meta.neighborhoodNamesByCity,
      meta.neighborhoods,
      setEnabledHiddenCities,
      setSelectedCities,
      setSelectedNeighborhoods,
    ],
  );

  const resetAllFilters = () => {
    setSelectedCities([]);
    setSelectedNeighborhoods([]);
    setSearchQuery("");
    setFloorFilters([]);
    setMinTotalMonthly(null);
    setMaxTotalMonthly(5000);
    setMaxCommuteMinutes(null);
    setMinScore(null);
    setSortBy("score_desc");
    setMinAreaM2(null);
    setMaxAreaM2(null);
    setMinListingAgeDays(null);
    setMaxListingAgeDays(null);
    setListingDateFrom("");
    setListingDateTo("");
    setSelectedBedrooms([]);
    setSelectedBathrooms([]);
    setSelectedParking([]);
    setMinBedrooms(null);
    setMinBathrooms(null);
    setMinParking(null);
    setModernityTiers([]);
    setMinModernityScore(null);
    setFurnishedFilter("ALL");
    setSelectedFurnitureTiers([]);
    setRequiredFeatures([]);
    setHideMegaCondo(false);
    setHideForSale(false);
    setOnlyNewEntries(false);
    setShowIneligible(false);
    setOnlyIneligible(false);
    setProviderFilter("ALL");
    setOnlyFavorites(false);
    setOnlyTop20Neighborhoods(false);
    setOnlySafeStreets(false);
    setDeactivatedFilter("ACTIVE_ONLY");
    setVisibleCount(30);
  };
  resetAllFiltersRef.current = resetAllFilters;

  const isPerfeitoPresetActive =
    requiredFeatures.includes("ac") &&
    (floorFilters.includes("HIGH_OR_TOP") ||
      (floorFilters.includes("LEGENDARY") && floorFilters.includes("EPIC"))) &&
    maxTotalMonthly === 4500 &&
    maxCommuteMinutes === 25 &&
    (onlySafeStreets || requiredFeatures.includes("safe_street")) &&
    ((selectedFurnitureTiers.includes("UNFURNISHED") &&
      !selectedFurnitureTiers.includes("FULLY_FURNISHED")) ||
      furnishedFilter === "UNFURNISHED" ||
      furnishedFilter === "UNFURNISHED_OR_SEMI");

  const applyPerfeitoFilterPreset = () => {
    if (isPerfeitoPresetActive) {
      resetAllFilters();
      return;
    }
    setRequiredFeatures((prev) => [
      ...new Set<PropertyFeatureKey>([
        ...prev.filter((f) => f !== "safe_street"),
        "ac",
      ]),
    ]);
    setFloorFilters(["HIGH_OR_TOP"]);
    setMinTotalMonthly(null);
    setMaxTotalMonthly(4500);
    setMaxCommuteMinutes(25);
    setSelectedFurnitureTiers(["UNFURNISHED"]);
    setFurnishedFilter("UNFURNISHED");
    setOnlySafeStreets(true);
    setVisibleCount(30);
  };

  useEffect(() => {
    try {
      const hasServerSavedFilters = Boolean(
        resolvedInitialPrefs?.filters &&
        Object.keys(resolvedInitialPrefs.filters).length > 0,
      );
      const serverUpdatedAtMs = resolvedInitialPrefs?.updatedAt
        ? Date.parse(resolvedInitialPrefs.updatedAt)
        : 0;
      const localUpdatedAtRaw = localStorage.getItem(
        "housing_preferences_updated_at_v1",
      );
      const localUpdatedAtMs = localUpdatedAtRaw
        ? Date.parse(localUpdatedAtRaw)
        : 0;

      // Only fall back to localStorage if the shared DB has no saved filters yet
      // or if this browser has an explicit newer timestamp than the SSR snapshot.
      const shouldHydrateFromLocal =
        !hasServerSavedFilters ||
        (localUpdatedAtMs > 0 && localUpdatedAtMs > serverUpdatedAtMs);

      if (shouldHydrateFromLocal) {
        const rawWeights = localStorage.getItem("housing_weights_v2");
        if (rawWeights) {
          const parsedWeights = JSON.parse(rawWeights) as {
            schemaVersion?: number;
            presetId?: string;
            weights?: Partial<ScoringWeights>;
          };
          if (parsedWeights && typeof parsedWeights === "object") {
            if (typeof parsedWeights.presetId === "string") {
              setActivePresetId(parsedWeights.presetId);
            }
            if (
              parsedWeights.weights &&
              typeof parsedWeights.weights === "object"
            ) {
              const restored = sanitizeAndMigrateWeights(
                parsedWeights.weights,
                parsedWeights.schemaVersion ?? 2,
              );
              setWeights(restored);
              setQueryWeights(restored);
            }
          }
        }

        const rawFilters = localStorage.getItem("housing_explorer_filters_v1");
        if (rawFilters) {
          const parsed = JSON.parse(rawFilters) as Record<string, unknown>;
          if (parsed && typeof parsed === "object") {
            applyFilterStateObject(parseExplorerFiltersObject(parsed));
          }
        }

        const rawFavs = localStorage.getItem("housing_favorites_v1");
        if (rawFavs) {
          const localFavs = (JSON.parse(rawFavs) as unknown[]).filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0,
          );
          if (localFavs.length > 0) {
            setFavoriteKeys((prev) => [...new Set([...prev, ...localFavs])]);
          }
        }

        const rawCompare = localStorage.getItem("housing_compare_v1");
        if (rawCompare) {
          const parsedCompare = JSON.parse(rawCompare) as unknown;
          if (Array.isArray(parsedCompare)) {
            setCompareKeys(
              parsedCompare.filter(
                (x): x is string =>
                  typeof x === "string" && x.trim().length > 0,
              ),
            );
          }
        }
      } else if (resolvedInitialPrefs) {
        applySharedPreferencesToState(resolvedInitialPrefs);
      }
    } catch {
      // Ignore storage errors
    } finally {
      setFiltersHydrated(true);
    }
  }, [
    resolvedInitialPrefs,
    applyFilterStateObject,
    applySharedPreferencesToState,
  ]);

  const syncPreferencesFromServer = useCallback(async () => {
    if (
      hasUnsavedLocalPrefsRef.current ||
      localPrefRevRef.current > ackedPrefRevRef.current
    ) {
      return;
    }
    try {
      const syncedAt = lastSyncedUpdatedAtRef.current;
      const res = await fetch("/api/preferences", {
        cache: "no-store",
        headers: syncedAt
          ? { "If-None-Match": `W/"prefs-${syncedAt}"` }
          : undefined,
      });
      if (res.status === 304 || !res.ok) return;
      const data = (await res.json()) as {
        ok?: boolean;
        preferences?: SharedUserPreferences;
      };
      if (
        !data.preferences ||
        hasUnsavedLocalPrefsRef.current ||
        localPrefRevRef.current > ackedPrefRevRef.current
      ) {
        return;
      }
      const remotePrefs = data.preferences;
      const remoteHasFilters =
        remotePrefs.filters && Object.keys(remotePrefs.filters).length > 0;
      if (!remoteHasFilters && !lastSyncedUpdatedAtRef.current) return;

      const remoteMs = Date.parse(remotePrefs.updatedAt || "");
      const currentMs = Date.parse(lastSyncedUpdatedAtRef.current || "");
      if (
        Number.isFinite(remoteMs) &&
        (!Number.isFinite(currentMs) || remoteMs > currentMs)
      ) {
        applySharedPreferencesToState(remotePrefs);
      }
    } catch {
      // Ignore transient network errors
    }
  }, [applySharedPreferencesToState]);

  useEffect(() => {
    void syncPreferencesFromServer();
    const handleFocus = () => {
      void syncPreferencesFromServer();
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncPreferencesFromServer();
      }
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncPreferencesFromServer();
      }
    }, 10000);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [syncPreferencesFromServer]);

  useEffect(() => {
    if (!filtersHydrated) return;
    const filtersPayload = serializeExplorerFilters({
      selectedCities,
      selectedNeighborhoods,
      searchQuery,
      floorFilter,
      floorFilters,
      minTotalMonthly,
      maxTotalMonthly,
      maxCommuteMinutes,
      minScore,
      sortBy,
      minAreaM2,
      maxAreaM2,
      minListingAgeDays,
      maxListingAgeDays,
      listingDateFrom,
      listingDateTo,
      selectedBedrooms,
      selectedBathrooms,
      selectedParking,
      minBedrooms,
      minBathrooms,
      minParking,
      modernityTiers,
      minModernityScore,
      furnishedFilter,
      selectedFurnitureTiers,
      requiredFeatures,
      hideMegaCondo,
      hideForSale,
      onlyNewEntries,
      showIneligible,
      onlyIneligible,
      providerFilter,
      onlyFavorites,
      onlyTop20Neighborhoods,
      onlySafeStreets,
      enabledHiddenCities,
      deactivatedFilter,
      showAdvancedFilters,
      viewMode,
    });

    try {
      localStorage.setItem(
        "housing_explorer_filters_v1",
        JSON.stringify(filtersPayload),
      );
      localStorage.setItem(
        "housing_weights_v2",
        JSON.stringify({ schemaVersion: 2, presetId: activePresetId, weights }),
      );
      localStorage.setItem(
        "housing_favorites_v1",
        JSON.stringify(favoriteKeys),
      );
      localStorage.setItem("housing_compare_v1", JSON.stringify(compareKeys));
    } catch {
      // Ignore storage errors
    }

    const fullPayload = {
      filters: filtersPayload,
      weights,
      activePresetId,
      favorites: favoriteKeys,
      compareKeys,
    };
    const serialized = JSON.stringify(fullPayload);
    const wasApplyingRemote = isApplyingRemotePrefsRef.current;
    isApplyingRemotePrefsRef.current = false;
    if (wasApplyingRemote || serialized === lastSavedSnapshotJsonRef.current) {
      return;
    }

    localPrefRevRef.current += 1;
    const revToSave = localPrefRevRef.current;
    hasUnsavedLocalPrefsRef.current = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const timer = setTimeout(() => {
      prefSaveChainRef.current = prefSaveChainRef.current
        .catch(() => {})
        .then(async () => {
          let saveSucceeded = false;
          try {
            const res = await fetch("/api/preferences", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: serialized,
            });
            if (res.ok) {
              const data = (await res.json()) as {
                ok?: boolean;
                persistedToDb?: boolean;
                dbConfigured?: boolean;
                preferences?: SharedUserPreferences;
              };
              const durableOk =
                data?.ok !== false &&
                (data?.persistedToDb !== false || data?.dbConfigured === false);
              if (durableOk) {
                saveSucceeded = true;
                if (revToSave >= ackedPrefRevRef.current) {
                  ackedPrefRevRef.current = revToSave;
                  lastSavedSnapshotJsonRef.current = serialized;
                  if (data.preferences?.updatedAt) {
                    lastSyncedUpdatedAtRef.current = data.preferences.updatedAt;
                    try {
                      localStorage.setItem(
                        "housing_preferences_updated_at_v1",
                        data.preferences.updatedAt,
                      );
                    } catch {
                      // Ignore storage errors
                    }
                  }
                }
                if (revToSave === localPrefRevRef.current) {
                  hasUnsavedLocalPrefsRef.current = false;
                }
              }
            }
          } catch {
            saveSucceeded = false;
          }

          if (!saveSucceeded && revToSave === localPrefRevRef.current) {
            retryTimer = setTimeout(() => {
              setPrefSaveRetryTick((t) => t + 1);
            }, 4000);
          }
        });
    }, PREFERENCES_SAVE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [
    filtersHydrated,
    prefSaveRetryTick,
    selectedCities,
    selectedNeighborhoods,
    searchQuery,
    floorFilter,
    floorFilters,
    minTotalMonthly,
    maxTotalMonthly,
    maxCommuteMinutes,
    minScore,
    sortBy,
    minAreaM2,
    maxAreaM2,
    minListingAgeDays,
    maxListingAgeDays,
    listingDateFrom,
    listingDateTo,
    selectedBedrooms,
    selectedBathrooms,
    selectedParking,
    minBedrooms,
    minBathrooms,
    minParking,
    modernityTiers,
    minModernityScore,
    furnishedFilter,
    selectedFurnitureTiers,
    requiredFeatures,
    hideMegaCondo,
    hideForSale,
    onlyNewEntries,
    showIneligible,
    onlyIneligible,
    providerFilter,
    onlyFavorites,
    onlyTop20Neighborhoods,
    onlySafeStreets,
    enabledHiddenCities,
    deactivatedFilter,
    showAdvancedFilters,
    viewMode,
    activePresetId,
    weights,
    favoriteKeys,
    compareKeys,
  ]);

  useEffect(() => {
    if (selectedCities.length > 0) {
      setScrapeCities(selectedCities);
    } else {
      setScrapeCities(["BH", "RJ", "CP", "SP"]);
    }
  }, [selectedCities]);

  const toggleFavorite = useCallback((key: string) => {
    setFavoriteKeys((prev) => {
      const exists = prev.includes(key);
      const next = exists ? prev.filter((k) => k !== key) : [...prev, key];
      try {
        localStorage.setItem("housing_favorites_v1", JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  const updateWeight = <K extends keyof ScoringWeights>(
    key: K,
    value: ScoringWeights[K],
  ) => {
    setActivePresetId("custom");
    setWeights((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (presetId: string) => {
    const found = BUILTIN_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setActivePresetId(found.id);
    setWeights(found.weights);
    setQueryWeights(found.weights);
    if (presetId === "perfeito") {
      setRequiredFeatures((prev) => [
        ...new Set<PropertyFeatureKey>([
          ...prev.filter((f) => f !== "safe_street"),
          "ac",
        ]),
      ]);
      setFloorFilters(["HIGH_OR_TOP"]);
      setMinTotalMonthly(null);
      setMaxTotalMonthly(4500);
      setMaxCommuteMinutes(25);
      setSelectedFurnitureTiers(["UNFURNISHED"]);
      setFurnishedFilter("UNFURNISHED");
      setOnlySafeStreets(true);
      setVisibleCount(30);
    }
  };

  const toggleCompare = useCallback((key: string) => {
    setCompareKeys((prev) =>
      prev.includes(key)
        ? prev.filter((k) => k !== key)
        : prev.length >= 4
          ? [...prev.slice(1), key]
          : [...prev, key],
    );
  }, []);

  const [refreshTick, setRefreshTick] = useState<number>(0);

  const refreshDatasetFromServer = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/preferences", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as {
          preferences?: SharedUserPreferences;
        };
        if (data.preferences) {
          applySharedPreferencesToState(data.preferences);
        }
      }
    } catch {
      // Ignore transient network errors
    } finally {
      setRefreshTick((t) => t + 1);
      setIsRefreshing(false);
    }
  }, [applySharedPreferencesToState]);

  const fetchScrapeStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/scrape/status", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as ScrapeJobStatus;
      setScrapeStatus(data);
      if (
        prevScrapeStatusRef.current === "running" &&
        data.status === "completed"
      ) {
        void refreshDatasetFromServer();
      }
      prevScrapeStatusRef.current = data.status;
    } catch {
      // Ignore polling errors
    }
  }, [refreshDatasetFromServer]);

  useEffect(() => {
    void fetchScrapeStatus();
  }, [fetchScrapeStatus]);

  useEffect(() => {
    if (scrapeStatus.status !== "running") return;
    const interval = setInterval(() => {
      void fetchScrapeStatus();
    }, 1500);
    return () => clearInterval(interval);
  }, [scrapeStatus.status, fetchScrapeStatus]);

  const qaMutationSeqRef = useRef<number>(0);
  const lastQaMutationAtRef = useRef<number>(0);

  const qaEtagRef = useRef<string | null>(null);

  /** Resolves `true` when new items were applied. */
  const fetchQaItems = useCallback(async (): Promise<boolean> => {
    const seqAtStart = qaMutationSeqRef.current;
    try {
      const res = await fetch("/api/qa", {
        cache: "no-store",
        headers: qaEtagRef.current
          ? { "If-None-Match": qaEtagRef.current }
          : undefined,
      });
      if (res.status === 304 || !res.ok) return false;
      const data = (await res.json()) as {
        ok?: boolean;
        items?: PropertyQuestionItem[];
      };
      if (qaMutationSeqRef.current !== seqAtStart) {
        return false;
      }
      if (Array.isArray(data.items)) {
        qaEtagRef.current = res.headers.get("ETag");
        setQaItems(data.items);
        return true;
      }
    } catch {
      // Ignore polling errors
    }
    return false;
  }, []);

  useEffect(() => {
    void fetchQaItems();
  }, [fetchQaItems]);

  const hasAwaitingDetailedQa = useMemo(
    () => qaItems.some((item) => isAwaitingDetailedAnswer(item)),
    [qaItems],
  );

  // While the drawer is open and a Cursor answer is due, listen for server pushes (SSE);
  // fall back to polling with backoff (3s → 30s) when the stream can't be established.
  useEffect(() => {
    if (isSubmittingChatQuestion) return;
    if (!showChatDrawer || !hasAwaitingDetailedQa) return;
    let delayMs = 3000;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let polling = false;
    let source: EventSource | null = null;
    const schedule = () => {
      if (!polling) return;
      timer = setTimeout(() => void tick(), delayMs);
    };
    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === "hidden") return;
      const changed = await fetchQaItems();
      if (cancelled) return;
      delayMs = changed ? 3000 : Math.min(Math.round(delayMs * 1.6), 30000);
      schedule();
    };
    const onVisibility = () => {
      if (!polling || document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      delayMs = 3000;
      void tick();
    };
    const startPolling = () => {
      if (polling || cancelled) return;
      polling = true;
      schedule();
    };
    if (typeof EventSource === "undefined") {
      startPolling();
    } else {
      let failuresWithoutData = 0;
      source = new EventSource("/api/qa?stream=1");
      source.addEventListener("items", (event) => {
        failuresWithoutData = 0;
        if (
          Date.now() - lastQaMutationAtRef.current <
          QA_PUSH_MUTATION_GRACE_MS
        )
          return;
        try {
          const data = JSON.parse((event as MessageEvent<string>).data) as {
            items?: PropertyQuestionItem[];
            etag?: string;
          };
          if (Array.isArray(data.items)) {
            qaEtagRef.current = data.etag ?? null;
            setQaItems(data.items);
          }
        } catch {
          // Ignore malformed events
        }
      });
      source.onerror = () => {
        failuresWithoutData += 1;
        if (failuresWithoutData >= 3) {
          source?.close();
          source = null;
          startPolling();
        }
      };
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      source?.close();
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    hasAwaitingDetailedQa,
    showChatDrawer,
    isSubmittingChatQuestion,
    fetchQaItems,
  ]);

  useEffect(() => {
    if (showChatDrawer) void fetchQaItems();
  }, [showChatDrawer, fetchQaItems]);

  const openChatForProperty = useCallback(
    (propertyKey: string, scrollToMessages = false) => {
      setPinnedChatPropertyKey(propertyKey);
      if (scrollToMessages) {
        setChatScrollTargetKey(propertyKey);
      }
      setShowChatDrawer(true);
    },
    [],
  );

  const handleSelectChatThread = useCallback((threadKey: string | null) => {
    setPinnedChatPropertyKey(threadKey);
  }, []);

  const handleConsumeChatScrollTarget = useCallback(() => {
    setChatScrollTargetKey(null);
  }, []);

  const deletePropertyQuestion = useCallback(async (id: string) => {
    qaMutationSeqRef.current += 1;
    lastQaMutationAtRef.current = Date.now();
    setQaItems((prev) => prev.filter((item) => item.id !== id));
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      qaMutationSeqRef.current += 1;
      lastQaMutationAtRef.current = Date.now();
      if (res.ok) {
        const data = (await res.json()) as {
          ok?: boolean;
          items?: PropertyQuestionItem[];
        };
        if (Array.isArray(data.items)) {
          setQaItems(data.items);
        }
      }
    } catch {
      // Ignore network errors
    }
  }, []);

  const clearChatHistory = useCallback(async () => {
    qaMutationSeqRef.current += 1;
    lastQaMutationAtRef.current = Date.now();
    setQaItems([]);
    try {
      const res = await fetch("/api/qa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });
      qaMutationSeqRef.current += 1;
      lastQaMutationAtRef.current = Date.now();
      if (res.ok) {
        setQaItems([]);
      }
    } catch {
      // Ignore network errors
    }
  }, []);

  const qaItemsByPropertyKey = useMemo(() => {
    const map = new Map<string, PropertyQuestionItem[]>();
    for (const item of qaItems) {
      const existing = map.get(item.propertyKey);
      if (existing) {
        existing.push(item);
      } else {
        map.set(item.propertyKey, [item]);
      }
    }
    return map;
  }, [qaItems]);

  const startScrapeJob = async (params: {
    mode: "full_sync" | "verify_only" | "custom_url";
    cities?: CityHubCode[];
    neighborhoods?: string[];
    customUrl?: string;
    keys?: string[];
  }) => {
    setIsStartingScrape(true);
    try {
      const res = await fetch("/api/scrape/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          ...params,
        }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        status?: ScrapeJobStatus;
        error?: string;
      };
      if (json.status) {
        prevScrapeStatusRef.current = json.status.status;
        setScrapeStatus(json.status);
      }
    } finally {
      setIsStartingScrape(false);
    }
  };

  const cancelScrapeJob = async () => {
    try {
      const res = await fetch("/api/scrape/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const json = (await res.json()) as { status?: ScrapeJobStatus };
      if (json.status) {
        prevScrapeStatusRef.current = json.status.status;
        setScrapeStatus(json.status);
      }
    } catch {
      // Ignore cancel errors
    }
  };

  const toggleScrapeCity = (city: CityHubCode) => {
    setScrapeCities((prev) =>
      prev.includes(city)
        ? prev.length > 1
          ? prev.filter((c) => c !== city)
          : prev
        : [...prev, city],
    );
  };

  const { ranked: dynamicNeighborhoods, cityAverages } = useMemo(
    () =>
      computeDynamicNeighborhoods(
        filterVisibleCities(meta.neighborhoods, enabledHiddenCities),
        weights,
      ),
    [meta.neighborhoods, weights, enabledHiddenCities],
  );

  const queryFilters = useMemo(
    () =>
      toQueryFilters({
        selectedCities,
        selectedNeighborhoods,
        searchQuery: deferredSearchQuery,
        floorFilter,
        floorFilters,
        minTotalMonthly,
        maxTotalMonthly,
        maxCommuteMinutes,
        minScore,
        sortBy,
        minAreaM2,
        maxAreaM2,
        minListingAgeDays,
        maxListingAgeDays,
        listingDateFrom,
        listingDateTo,
        selectedBedrooms,
        selectedBathrooms,
        selectedParking,
        minBedrooms,
        minBathrooms,
        minParking,
        modernityTiers,
        minModernityScore,
        furnishedFilter,
        selectedFurnitureTiers,
        requiredFeatures,
        hideMegaCondo,
        hideForSale,
        onlyNewEntries,
        showIneligible,
        onlyIneligible,
        providerFilter,
        onlyFavorites,
        onlyTop20Neighborhoods,
        onlySafeStreets,
        enabledHiddenCities,
        deactivatedFilter,
        showAdvancedFilters: false,
        viewMode: "list",
      }),
    [
      selectedCities,
      selectedNeighborhoods,
      deferredSearchQuery,
      floorFilter,
      floorFilters,
      minTotalMonthly,
      maxTotalMonthly,
      maxCommuteMinutes,
      minScore,
      sortBy,
      minAreaM2,
      maxAreaM2,
      minListingAgeDays,
      maxListingAgeDays,
      listingDateFrom,
      listingDateTo,
      selectedBedrooms,
      selectedBathrooms,
      selectedParking,
      minBedrooms,
      minBathrooms,
      minParking,
      modernityTiers,
      minModernityScore,
      furnishedFilter,
      selectedFurnitureTiers,
      requiredFeatures,
      hideMegaCondo,
      hideForSale,
      onlyNewEntries,
      showIneligible,
      onlyIneligible,
      providerFilter,
      onlyFavorites,
      onlyTop20Neighborhoods,
      onlySafeStreets,
      enabledHiddenCities,
      deactivatedFilter,
    ],
  );
  const queryFavorites = useMemo(
    () => (onlyFavorites ? favoriteKeys : []),
    [onlyFavorites, favoriteKeys],
  );
  const queryKey = useMemo(
    () =>
      buildQueryKey({
        filters: queryFilters,
        weights: queryWeights,
        favorites: queryFavorites,
      }),
    [queryFilters, queryWeights, queryFavorites],
  );

  const [listState, setListState] = useState<ListState>(() => ({
    key: initialQueryKey,
    datasetHash: initialQuery.datasetHash,
    items: initialQuery.items,
    total: initialQuery.total,
    facets: initialQuery.facets ?? null,
  }));
  const listStateRef = useRef<ListState>(listState);
  listStateRef.current = listState;
  const queryCacheRef = useRef<Map<string, ListState>>(
    new Map([[initialQueryKey, listState]]),
  );
  const lastRefreshTickRef = useRef<number>(0);
  const lastSearchQueryRef = useRef<string>(deferredSearchQuery);
  const [isQueryLoading, setIsQueryLoading] = useState<boolean>(false);
  // Rendering a new result page yields to typing and clicks.
  const [, startListTransition] = useTransition();

  // Server-side filtering/sorting/pagination: fetch the first `visibleCount` matches for the
  // current filters + weights, appending pages on "Carregar mais" and reusing cached result sets.
  useEffect(() => {
    const isRefresh = refreshTick !== lastRefreshTickRef.current;
    const cache = queryCacheRef.current;
    const current = listStateRef.current;
    const cached = isRefresh
      ? undefined
      : current.key === queryKey
        ? current
        : cache.get(queryKey);
    const need = cached ? Math.min(visibleCount, cached.total) : visibleCount;
    if (cached && cached.items.length >= need) {
      if (current !== cached) startListTransition(() => setListState(cached));
      return;
    }
    const searchChanged = lastSearchQueryRef.current !== deferredSearchQuery;
    lastSearchQueryRef.current = deferredSearchQuery;
    const controller = new AbortController();
    const offset = cached ? cached.items.length : 0;
    const timer = setTimeout(
      () => {
        setIsQueryLoading(true);
        postPropertyQuery(
          {
            filters: queryFilters,
            weights: queryWeights,
            favorites: queryFavorites,
            offset,
            limit: Math.max(1, need - offset),
            includeFacets: !cached,
            includeMeta: isRefresh,
          },
          controller.signal,
        )
          .then((data) => {
            if (controller.signal.aborted) return;
            lastRefreshTickRef.current = refreshTick;
            if (data.meta) setMeta(data.meta);
            if (cached && cached.datasetHash !== data.datasetHash) {
              // Dataset changed underneath: drop stale pages and start over.
              cache.clear();
              setRefreshTick((t) => t + 1);
              return;
            }
            if (!cached && data.datasetHash !== current.datasetHash) {
              cache.clear();
            }
            const next: ListState = cached
              ? { ...cached, items: [...cached.items, ...data.items] }
              : {
                  key: queryKey,
                  datasetHash: data.datasetHash,
                  items: data.items,
                  total: data.total,
                  facets: data.facets ?? null,
                };
            cache.delete(queryKey);
            cache.set(queryKey, next);
            while (cache.size > MAX_CLIENT_QUERY_CACHE_ENTRIES) {
              cache.delete(cache.keys().next().value!);
            }
            startListTransition(() => setListState(next));
            setIsQueryLoading(false);
          })
          .catch(() => {
            if (!controller.signal.aborted) setIsQueryLoading(false);
          });
      },
      searchChanged ? 120 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    queryKey,
    queryFilters,
    queryWeights,
    queryFavorites,
    visibleCount,
    refreshTick,
    deferredSearchQuery,
  ]);

  // The API may run on a different server instance than the page: warm its scoring cache early.
  const warmupWeightsRef = useRef({ weights, enabledHiddenCities });
  useEffect(() => {
    const { weights: w, enabledHiddenCities: hidden } = warmupWeightsRef.current;
    const params = new URLSearchParams({
      w: JSON.stringify(w),
      hidden: hidden.join(","),
    });
    const id = window.setTimeout(() => {
      void fetch(`/api/properties?${params.toString()}`, {
        cache: "no-store",
      }).catch(() => {});
    }, 300);
    return () => window.clearTimeout(id);
  }, []);

  const listMatchesQuery = listState.key === queryKey;
  const filteredItems = listState.items;
  const filteredTotal = listState.total;
  const facets = listState.facets;
  filteredPropertiesRef.current = filteredItems;

  const bsbBenchmarkStats = facets?.benchmark ?? EMPTY_BENCHMARK_STATS;
  const availableNeighborhoodOptions = facets?.neighborhoodOptions ?? [];

  const mapProperties = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount],
  );
  const itemsByKey = useMemo(
    () => new Map(filteredItems.map((p) => [`${p.provider}:${p.id}`, p])),
    [filteredItems],
  );

  // Full records (description, all photos, long justifications) load on demand.
  const detailsWeightsKey = `${buildWeightsKey(queryWeights)}|${enabledHiddenCities.join(",")}`;
  const [detailsState, setDetailsState] = useState<{
    weightsKey: string;
    byKey: Map<string, PropertyCardDTO>;
  }>(() => ({ weightsKey: detailsWeightsKey, byKey: new Map() }));
  const detailsByKey =
    detailsState.weightsKey === detailsWeightsKey
      ? detailsState.byKey
      : EMPTY_DETAILS_MAP;
  const detailsInFlightRef = useRef<
    Map<string, Promise<PropertyCardDTO | null>>
  >(new Map());

  const fetchDetails = useCallback(
    async (keys: string[]): Promise<Map<string, PropertyCardDTO>> => {
      const wk = detailsWeightsKey;
      const found = new Map<string, PropertyCardDTO>();
      const missing: string[] = [];
      for (const k of keys) {
        const hit =
          detailsState.weightsKey === wk
            ? detailsState.byKey.get(k)
            : undefined;
        if (hit) found.set(k, hit);
        else missing.push(k);
      }
      const toRequest = missing.filter(
        (k) => !detailsInFlightRef.current.has(`${wk}|${k}`),
      );
      if (toRequest.length > 0) {
        const request = fetch("/api/properties/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            keys: toRequest,
            weights: queryWeights,
            enabledHiddenCities,
          }),
        })
          .then((res) => (res.ok ? res.json() : null))
          .then(
            (data: { items?: PropertyCardDTO[] } | null) => data?.items ?? [],
          )
          .catch(() => [] as PropertyCardDTO[]);
        for (const k of toRequest) {
          detailsInFlightRef.current.set(
            `${wk}|${k}`,
            request.then(
              (items) =>
                items.find((p) => `${p.provider}:${p.id}` === k) ?? null,
            ),
          );
        }
        void request.then((items) => {
          for (const k of toRequest)
            detailsInFlightRef.current.delete(`${wk}|${k}`);
          if (items.length === 0) return;
          setDetailsState((prev) => {
            const byKey = new Map(prev.weightsKey === wk ? prev.byKey : []);
            for (const item of items) {
              const k = `${item.provider}:${item.id}`;
              byKey.delete(k);
              byKey.set(k, item);
            }
            while (byKey.size > MAX_DETAILS_CACHE_ENTRIES) {
              byKey.delete(byKey.keys().next().value!);
            }
            return { weightsKey: wk, byKey };
          });
        });
      }
      await Promise.all(
        missing.map(async (k) => {
          const item = await detailsInFlightRef.current.get(`${wk}|${k}`);
          if (item) found.set(k, item);
        }),
      );
      return found;
    },
    [detailsWeightsKey, detailsState, queryWeights, enabledHiddenCities],
  );

  const neededDetailKeys = useMemo(
    () => [
      ...new Set(
        [
          expandedId,
          pinnedChatPropertyKey,
          focusedPropertyKey,
          ...compareKeys,
        ].filter((k): k is string => Boolean(k) && k !== "general"),
      ),
    ],
    [expandedId, pinnedChatPropertyKey, focusedPropertyKey, compareKeys],
  );
  useEffect(() => {
    const missing = neededDetailKeys.filter((k) => !detailsByKey.has(k));
    if (missing.length > 0) void fetchDetails(missing);
  }, [neededDetailKeys, detailsByKey, fetchDetails]);

  const resolveProperty = useCallback(
    (key: string): PropertyCardDTO | null =>
      detailsByKey.get(key) ?? itemsByKey.get(key) ?? null,
    [detailsByKey, itemsByKey],
  );

  const pinnedChatProperty = useMemo(() => {
    if (!pinnedChatPropertyKey) return null;
    const found = resolveProperty(pinnedChatPropertyKey);
    if (!found) return null;
    const extraPhotos = extraPhotosByKey[pinnedChatPropertyKey];
    if (extraPhotos && extraPhotos.length > found.samplePhotos.length) {
      return {
        ...found,
        samplePhotos: extraPhotos,
      };
    }
    return found;
  }, [pinnedChatPropertyKey, resolveProperty, extraPhotosByKey]);

  const submitChatQuestion = useCallback(
    async ({
      question,
      property,
    }: {
      question: string;
      property: EvaluatedProperty | null;
    }) => {
      const trimmed = question.trim();
      if (!trimmed) return;
      const key = property ? `${property.provider}:${property.id}` : "general";
      if (property && !(property as PropertyCardDTO).detailsLoaded) {
        const full = (await fetchDetails([key])).get(key);
        if (full) {
          property = {
            ...full,
            samplePhotos:
              property.samplePhotos.length > full.samplePhotos.length
                ? property.samplePhotos
                : full.samplePhotos,
          };
        }
      }

      const topContextLines = filteredItems
        .slice(0, 5)
        .map(
          (p, idx) =>
            `${idx + 1}. #${p.overallRank ?? idx + 1} ${p.neighborhood} (${p.cityCode}) — ${p.street}: ${p.finalScore.toFixed(1)} pts · R$ ${p.totalMonthly.toLocaleString("pt-BR")}/mês · ${p.areaM2} m²`,
        )
        .join("\n");

      const propertySnapshotPayload = property
        ? {
            title: property.title,
            neighborhood: property.neighborhood,
            cityCode: property.cityCode,
            street: property.street,
            streetNumber: property.streetNumber,
            condominiumName: property.condominiumName,
            totalMonthly: property.totalMonthly,
            rent: property.rent,
            condoFee: property.condoFee,
            iptu: property.iptu,
            areaM2: property.areaM2,
            bedrooms: property.bedrooms,
            bathrooms: property.bathrooms,
            parkingSpaces: property.parkingSpaces,
            floor: property.floor,
            floorLabel: property.cardTags.floorTag?.label ?? null,
            furnished: property.furnished,
            modernityScore: property.modernityScore,
            finalScore: property.finalScore,
            overallRank: property.overallRank,
            cityRank: property.cityRank,
            furnitureTier: property.furnitureTier,
            url: property.url,
            shortJustification: property.shortJustification,
            description:
              property.description ?? property.generatedDescription ?? null,
            thumbnailUrl: property.samplePhotos[0]?.url ?? null,
            suites: property.suites,
            totalFloors: property.totalFloors,
            floorRange: property.floorRange,
            constructionYear: property.constructionYear,
            doorman: property.doorman,
            acLabel: property.cardTags.acLabel,
            greenTags: property.cardTags.greenTags,
            redTags: property.cardTags.redTags,
            nuanceHighlights: property.nuanceHighlights,
            nuanceWarnings: property.nuanceWarnings,
            breakdown: property.breakdown,
            eligible: property.eligible,
            exclusionReason: property.exclusionReason,
          }
        : undefined;

      const optimisticId = `optimistic-${Date.now()}-${
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID().slice(0, 8)
          : String(Date.now()).slice(-4)
      }`;
      const nowIso = new Date().toISOString();
      const optimisticItem: PropertyQuestionItem = {
        id: optimisticId,
        propertyKey: key,
        question: trimmed,
        status: "pending",
        answer: null,
        createdAt: nowIso,
        answeredAt: null,
        propertySnapshot: propertySnapshotPayload ?? {
          title: "Contexto Geral (Top imóveis filtrados)",
          neighborhood: "",
          cityCode: "",
          street: "",
          streetNumber: null,
          condominiumName: null,
          totalMonthly: 0,
          rent: 0,
          condoFee: 0,
          iptu: 0,
          areaM2: 0,
          bedrooms: 0,
          bathrooms: 0,
          parkingSpaces: 0,
          floor: null,
          floorLabel: null,
          furnished: null,
          modernityScore: 0,
          finalScore: 0,
          overallRank: null,
          url: "",
          shortJustification: "",
          description: null,
        },
      };

      qaMutationSeqRef.current += 1;
      lastQaMutationAtRef.current = Date.now();
      setIsSubmittingChatQuestion(true);
      setQaItems((prev) => [...prev, optimisticItem]);
      try {
        const res = await fetch("/api/qa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "ask",
            propertyKey: key,
            question: trimmed,
            contextSummary:
              filteredTotal > 0
                ? `Filtro atual na tela (${filteredTotal} imóveis):\n${topContextLines}`
                : undefined,
            propertySnapshot: propertySnapshotPayload,
            weights,
            enabledHiddenCities,
          }),
        });
        qaMutationSeqRef.current += 1;
        lastQaMutationAtRef.current = Date.now();
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          item?: PropertyQuestionItem;
          items?: PropertyQuestionItem[];
        };
        if (!res.ok || data.ok === false) {
          setQaItems((prev) => prev.filter((item) => item.id !== optimisticId));
          throw new Error(
            data.error ??
              "Não foi possível enviar sua pergunta. Tente novamente.",
          );
        }
        if (Array.isArray(data.items)) {
          setQaItems(data.items);
        } else if (data.item) {
          setQaItems((prev) =>
            prev.map((item) => (item.id === optimisticId ? data.item! : item)),
          );
        }
        return true;
      } catch (err) {
        qaMutationSeqRef.current += 1;
        lastQaMutationAtRef.current = Date.now();
        setQaItems((prev) => prev.filter((item) => item.id !== optimisticId));
        throw err;
      } finally {
        setIsSubmittingChatQuestion(false);
      }
    },
    [filteredItems, filteredTotal, weights, enabledHiddenCities, fetchDetails],
  );

  const deactivatedTotalCount = facets?.counts.deactivatedTotalCount ?? 0;
  const ineligibleActiveCount = facets?.counts.ineligibleActiveCount ?? 0;
  const totalBasePoolCount = facets?.counts.totalBasePoolCount ?? 0;
  const recentListingsCount = facets?.counts.recentCount ?? 0;

  const activeAdvancedFilterCount = useMemo(() => {
    let count = 0;
    if (selectedNeighborhoods.length > 0) count += selectedNeighborhoods.length;
    if (floorFilters.length > 0) count += floorFilters.length;
    if (minTotalMonthly !== null || maxTotalMonthly !== null) count += 1;
    if (maxCommuteMinutes !== null) count += 1;
    if (minScore !== null) count += 1;
    if (minAreaM2 !== null || maxAreaM2 !== null) count += 1;
    if (minListingAgeDays !== null || maxListingAgeDays !== null) count += 1;
    if (listingDateFrom.trim() !== "" || listingDateTo.trim() !== "")
      count += 1;
    if (selectedBedrooms.length > 0 || minBedrooms !== null) count += 1;
    if (selectedBathrooms.length > 0 || minBathrooms !== null) count += 1;
    if (selectedParking.length > 0 || minParking !== null) count += 1;
    if (modernityTiers.length > 0) count += modernityTiers.length;
    if (minModernityScore !== null) count += 1;
    if (selectedFurnitureTiers.length > 0) {
      count += selectedFurnitureTiers.length;
    } else if (furnishedFilter !== "ALL") {
      count += 1;
    }
    if (requiredFeatures.length > 0) count += requiredFeatures.length;
    if (hideMegaCondo) count += 1;
    if (hideForSale) count += 1;
    if (onlyNewEntries) count += 1;
    if (showIneligible || onlyIneligible) count += 1;
    if (providerFilter !== "ALL") count += 1;
    if (onlyTop20Neighborhoods) count += 1;
    if (onlySafeStreets && !requiredFeatures.includes("safe_street"))
      count += 1;
    if (deactivatedFilter !== "ACTIVE_ONLY") count += 1;
    return count;
  }, [
    selectedNeighborhoods,
    floorFilters,
    minTotalMonthly,
    maxTotalMonthly,
    maxCommuteMinutes,
    minScore,
    minAreaM2,
    maxAreaM2,
    minListingAgeDays,
    maxListingAgeDays,
    listingDateFrom,
    listingDateTo,
    selectedBedrooms,
    selectedBathrooms,
    selectedParking,
    minBedrooms,
    minBathrooms,
    minParking,
    modernityTiers,
    minModernityScore,
    furnishedFilter,
    selectedFurnitureTiers,
    requiredFeatures,
    hideMegaCondo,
    hideForSale,
    onlyNewEntries,
    showIneligible,
    onlyIneligible,
    providerFilter,
    onlyTop20Neighborhoods,
    onlySafeStreets,
    deactivatedFilter,
  ]);

  const activeFilterPills = useMemo(() => {
    const pills: { id: string; label: string; onClear: () => void }[] = [];

    for (const city of selectedCities) {
      pills.push({
        id: `city-${city}`,
        label: `Praça: ${city}`,
        onClear: () => handleCitySelect(city),
      });
    }
    if (searchQuery.trim()) {
      pills.push({
        id: "search",
        label: `Busca: "${searchQuery.trim()}"`,
        onClear: () => setSearchQuery(""),
      });
    }
    for (const ff of floorFilters) {
      const opt = FLOOR_FILTER_OPTIONS.find((o) => o.value === ff);
      pills.push({
        id: `floor-${ff}`,
        label: opt ? opt.label : `Andar: ${ff}`,
        onClear: () =>
          setFloorFilters((prev) => prev.filter((item) => item !== ff)),
      });
    }
    if (minTotalMonthly !== null || maxTotalMonthly !== null) {
      const label =
        minTotalMonthly !== null && maxTotalMonthly !== null
          ? `R$ ${minTotalMonthly.toLocaleString("pt-BR")}–R$ ${maxTotalMonthly.toLocaleString("pt-BR")}`
          : maxTotalMonthly !== null
            ? `≤ R$ ${maxTotalMonthly.toLocaleString("pt-BR")}`
            : `≥ R$ ${(minTotalMonthly ?? 0).toLocaleString("pt-BR")}`;
      pills.push({
        id: "price",
        label,
        onClear: () => {
          setMinTotalMonthly(null);
          setMaxTotalMonthly(null);
        },
      });
    }
    if (maxCommuteMinutes !== null) {
      pills.push({
        id: "commute",
        label: `Tempo ≤ ${maxCommuteMinutes} min`,
        onClear: () => setMaxCommuteMinutes(null),
      });
    }
    if (minScore !== null) {
      pills.push({
        id: "score",
        label: `Nota ≥ ${minScore} pts`,
        onClear: () => setMinScore(null),
      });
    }
    if (sortBy !== "score_desc") {
      const sortOpt = SORT_BY_OPTIONS.find((s) => s.value === sortBy);
      pills.push({
        id: "sort",
        label: `Ordem: ${sortOpt?.label ?? sortBy}`,
        onClear: () => setSortBy("score_desc"),
      });
    }
    for (const nb of selectedNeighborhoods) {
      const displayNb = nb.includes(":") ? nb.replace(":", " · ") : nb;
      pills.push({
        id: `nb-${nb}`,
        label: `Bairro: ${displayNb}`,
        onClear: () =>
          setSelectedNeighborhoods((prev) =>
            prev.filter((item) => item !== nb),
          ),
      });
    }
    if (minAreaM2 !== null || maxAreaM2 !== null) {
      const label =
        minAreaM2 !== null && maxAreaM2 !== null
          ? `${minAreaM2}–${maxAreaM2} m²`
          : minAreaM2 !== null
            ? `≥ ${minAreaM2} m²`
            : `≤ ${maxAreaM2} m²`;
      pills.push({
        id: "area",
        label: `Área: ${label}`,
        onClear: () => {
          setMinAreaM2(null);
          setMaxAreaM2(null);
        },
      });
    }
    if (minListingAgeDays !== null || maxListingAgeDays !== null) {
      const label =
        minListingAgeDays !== null && maxListingAgeDays !== null
          ? `Idade: ${minListingAgeDays}–${maxListingAgeDays} dias`
          : maxListingAgeDays !== null
            ? `Idade do anúncio: ≤ ${maxListingAgeDays} dias`
            : `Idade do anúncio: ≥ ${minListingAgeDays} dias`;
      pills.push({
        id: "listing-age",
        label,
        onClear: () => {
          setMinListingAgeDays(null);
          setMaxListingAgeDays(null);
        },
      });
    }
    if (listingDateFrom.trim() !== "" || listingDateTo.trim() !== "") {
      const fromStr = listingDateFrom.trim();
      const toStr = listingDateTo.trim();
      const label =
        fromStr && toStr
          ? `Data do anúncio: ${fromStr} → ${toStr}`
          : fromStr
            ? `Data do anúncio: a partir de ${fromStr}`
            : `Data do anúncio: até ${toStr}`;
      pills.push({
        id: "listing-date",
        label,
        onClear: () => {
          setListingDateFrom("");
          setListingDateTo("");
        },
      });
    }
    if (selectedBedrooms.length > 0) {
      const labelNums = [...selectedBedrooms]
        .sort((a, b) => a - b)
        .map((n) => (n >= 3 ? "3+" : String(n)))
        .join(", ");
      pills.push({
        id: "bedrooms",
        label: `Quartos: ${labelNums}`,
        onClear: () => {
          setSelectedBedrooms([]);
          setMinBedrooms(null);
        },
      });
    } else if (minBedrooms !== null) {
      pills.push({
        id: "bedrooms",
        label: `${minBedrooms}+ quartos`,
        onClear: () => setMinBedrooms(null),
      });
    }
    if (selectedBathrooms.length > 0) {
      const labelNums = [...selectedBathrooms]
        .sort((a, b) => a - b)
        .map((n) => (n >= 3 ? "3+" : String(n)))
        .join(", ");
      pills.push({
        id: "bathrooms",
        label: `Banheiros: ${labelNums}`,
        onClear: () => {
          setSelectedBathrooms([]);
          setMinBathrooms(null);
        },
      });
    } else if (minBathrooms !== null) {
      pills.push({
        id: "bathrooms",
        label: `${minBathrooms}+ banheiros`,
        onClear: () => setMinBathrooms(null),
      });
    }
    if (selectedParking.length > 0) {
      const labelNums = [...selectedParking]
        .sort((a, b) => a - b)
        .map((n) => (n >= 2 ? "2+" : String(n)))
        .join(", ");
      pills.push({
        id: "parking",
        label: `Vagas: ${labelNums}`,
        onClear: () => {
          setSelectedParking([]);
          setMinParking(null);
        },
      });
    } else if (minParking !== null) {
      pills.push({
        id: "parking",
        label: `≥ ${minParking} vaga(s)`,
        onClear: () => setMinParking(null),
      });
    }
    for (const tier of modernityTiers) {
      const tierLabel =
        MODERNITY_TIER_BADGES[tier]?.label.replace("Estado: ", "") ?? tier;
      pills.push({
        id: `tier-${tier}`,
        label: `Estado: ${tierLabel}`,
        onClear: () =>
          setModernityTiers((prev) => prev.filter((t) => t !== tier)),
      });
    }
    if (minModernityScore !== null) {
      pills.push({
        id: "min-mod",
        label: `Modernidade ≥ ${minModernityScore}/100`,
        onClear: () => setMinModernityScore(null),
      });
    }
    if (selectedFurnitureTiers.length > 0) {
      const furnitureTierPillLabels: Record<FurnitureTier, string> = {
        UNFURNISHED: "Não mobiliado",
        SEMI_FURNISHED: "Não mobiliado",
        FULLY_FURNISHED: "Mobiliado",
      };
      for (const tier of selectedFurnitureTiers) {
        pills.push({
          id: `furn-${tier}`,
          label: furnitureTierPillLabels[tier],
          onClear: () => {
            setSelectedFurnitureTiers((prev) => {
              const next = prev.filter((t) => t !== tier);
              setFurnishedFilter(deriveLegacyFurnishedFilter(next));
              return next;
            });
          },
        });
      }
    } else if (furnishedFilter !== "ALL") {
      const furnishedPillLabels: Record<
        Exclude<FurnishedFilterOption, "ALL">,
        string
      > = {
        UNFURNISHED: "Sem mobília",
        UNFURNISHED_OR_SEMI: "Sem mobília ou Semi",
        SEMI_FURNISHED: "Só Semi-mobiliado",
        FURNISHED: "Mobiliado",
      };
      pills.push({
        id: "furnished",
        label: furnishedPillLabels[furnishedFilter],
        onClear: () => {
          setSelectedFurnitureTiers([]);
          setFurnishedFilter("ALL");
        },
      });
    }
    for (const feat of requiredFeatures) {
      const fOpt = PROPERTY_FEATURE_OPTIONS.find((f) => f.key === feat);
      pills.push({
        id: `feat-${feat}`,
        label: fOpt?.label ?? feat,
        onClear: () => {
          setRequiredFeatures((prev) => prev.filter((f) => f !== feat));
          if (feat === "safe_street") {
            setOnlySafeStreets(false);
          }
        },
      });
    }
    if (onlySafeStreets && !requiredFeatures.includes("safe_street")) {
      pills.push({
        id: "only-safe-streets",
        label: "Sem problemas de segurança",
        onClear: () => setOnlySafeStreets(false),
      });
    }
    if (hideMegaCondo) {
      pills.push({
        id: "no-megacondo",
        label: "Sem Megacondomínio",
        onClear: () => setHideMegaCondo(false),
      });
    }
    if (hideForSale) {
      pills.push({
        id: "no-forsale",
        label: "Sem imóveis à venda",
        onClear: () => setHideForSale(false),
      });
    }
    if (onlyNewEntries) {
      pills.push({
        id: "new-entries",
        label: "Só Novas Entradas",
        onClear: () => setOnlyNewEntries(false),
      });
    }
    if (onlyIneligible) {
      pills.push({
        id: "only-ineligible",
        label: "Só reprovados / retidos",
        onClear: () => {
          setOnlyIneligible(false);
          setShowIneligible(false);
        },
      });
    } else if (showIneligible) {
      pills.push({
        id: "show-ineligible",
        label: "Incluindo reprovados",
        onClear: () => setShowIneligible(false),
      });
    }
    if (providerFilter !== "ALL") {
      pills.push({
        id: "provider",
        label: getProviderStyle(providerFilter).label,
        onClear: () => setProviderFilter("ALL"),
      });
    }
    if (onlyFavorites) {
      pills.push({
        id: "only-favorites",
        label: `♥ Favoritos (${favoriteKeys.length})`,
        onClear: () => setOnlyFavorites(false),
      });
    }
    if (onlyTop20Neighborhoods) {
      pills.push({
        id: "only-top-20-neighborhoods",
        label: "Só Top 20 Bairros",
        onClear: () => setOnlyTop20Neighborhoods(false),
      });
    }
    if (deactivatedFilter !== "ACTIVE_ONLY") {
      pills.push({
        id: "deactivated-filter",
        label:
          deactivatedFilter === "ALL"
            ? "Incluindo Desativados / Alugados"
            : "Só Desativados / Alugados",
        onClear: () => setDeactivatedFilter("ACTIVE_ONLY"),
      });
    }

    return pills;
  }, [
    selectedCities,
    handleCitySelect,
    searchQuery,
    floorFilters,
    minTotalMonthly,
    maxTotalMonthly,
    maxCommuteMinutes,
    minScore,
    sortBy,
    selectedNeighborhoods,
    minAreaM2,
    maxAreaM2,
    minListingAgeDays,
    maxListingAgeDays,
    listingDateFrom,
    listingDateTo,
    selectedBedrooms,
    selectedBathrooms,
    selectedParking,
    minBedrooms,
    minBathrooms,
    minParking,
    modernityTiers,
    minModernityScore,
    furnishedFilter,
    selectedFurnitureTiers,
    requiredFeatures,
    hideMegaCondo,
    hideForSale,
    onlyNewEntries,
    showIneligible,
    onlyIneligible,
    providerFilter,
    onlyFavorites,
    onlyTop20Neighborhoods,
    onlySafeStreets,
    favoriteKeys.length,
    deactivatedFilter,
    setDeactivatedFilter,
    setFloorFilters,
    setFurnishedFilter,
    setHideForSale,
    setHideMegaCondo,
    setListingDateFrom,
    setListingDateTo,
    setMaxAreaM2,
    setMaxCommuteMinutes,
    setMaxListingAgeDays,
    setMaxTotalMonthly,
    setMinAreaM2,
    setMinBathrooms,
    setMinBedrooms,
    setMinListingAgeDays,
    setMinModernityScore,
    setMinParking,
    setMinScore,
    setMinTotalMonthly,
    setModernityTiers,
    setOnlyFavorites,
    setOnlyIneligible,
    setOnlyNewEntries,
    setOnlySafeStreets,
    setOnlyTop20Neighborhoods,
    setProviderFilter,
    setRequiredFeatures,
    setSearchQuery,
    setSelectedBathrooms,
    setSelectedBedrooms,
    setSelectedFurnitureTiers,
    setSelectedNeighborhoods,
    setSelectedParking,
    setShowIneligible,
    setSortBy,
  ]);

  const [copiedTop50Count, setCopiedTop50Count] = useState<number | null>(null);
  const copyTop50TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyTop50ForAi = useCallback(async () => {
    if (filteredTotal === 0) return;
    const countToCopy = Math.min(50, filteredTotal);
    let text: string;
    try {
      const data = await postPropertyQuery({
        filters: queryFilters,
        weights: queryWeights,
        favorites: queryFavorites,
        mode: "copyTop50",
        activeFilterLabels: activeFilterPills.map((p) => p.label),
        allFavorites: favoriteKeys,
      });
      text = data.text ?? "";
    } catch {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopiedTop50Count(countToCopy);
    if (copyTop50TimerRef.current) {
      clearTimeout(copyTop50TimerRef.current);
    }
    copyTop50TimerRef.current = setTimeout(() => {
      setCopiedTop50Count(null);
    }, 2500);
  }, [
    filteredTotal,
    queryFilters,
    queryWeights,
    queryFavorites,
    activeFilterPills,
    favoriteKeys,
  ]);

  const comparedProperties = useMemo(
    () =>
      compareKeys
        .map((k) => resolveProperty(k))
        .filter((p): p is PropertyCardDTO => Boolean(p)),
    [compareKeys, resolveProperty],
  );

  const displayedProperties = useMemo(() => {
    const baseSlice = filteredItems
      .slice(0, visibleCount)
      .map((p) => detailsByKey.get(`${p.provider}:${p.id}`) ?? p);
    if (!focusedPropertyKey) return baseSlice;
    if (baseSlice.some((p) => `${p.provider}:${p.id}` === focusedPropertyKey)) {
      return baseSlice;
    }
    const target = resolveProperty(focusedPropertyKey);
    if (!target) return baseSlice;
    return [target, ...baseSlice];
  }, [
    filteredItems,
    visibleCount,
    focusedPropertyKey,
    detailsByKey,
    resolveProperty,
  ]);

  // Viewport-windowed virtualization: keep only ~16 cards around the scroll position fully mounted
  useEffect(() => {
    let rafId = 0;
    const updateWindowFromScroll = () => {
      rafId = 0;
      const listEl = cardsListRef.current;
      if (!listEl) return;
      const articles = listEl.querySelectorAll<HTMLElement>(
        "article[data-card-index]",
      );
      if (articles.length === 0) return;
      let firstNear = 0;
      for (let i = 0; i < articles.length; i++) {
        const rect = articles[i]!.getBoundingClientRect();
        if (rect.bottom >= -320) {
          firstNear = i;
          break;
        }
      }
      const start = Math.max(0, firstNear - 2);
      const end = start + 16;
      setMountedWindow((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
      );
    };

    const onScrollOrResize = () => {
      if (rafId === 0) {
        rafId = window.requestAnimationFrame(updateWindowFromScroll);
      }
    };

    updateWindowFromScroll();
    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    return () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [displayedProperties.length, viewMode, activeTab]);

  useEffect(() => {
    if (!expandedId || fetchedPhotoKeysRef.current.has(expandedId)) return;
    const prop = resolveProperty(expandedId);
    if (!prop?.url) return;
    const currentPhotos =
      extraPhotosByKey[expandedId] ?? prop.samplePhotos ?? [];
    const expectedCount = prop.photosCount ?? 0;
    const hasDesc = Boolean(
      extraDescriptionsByKey[expandedId] || prop.description,
    );
    if (
      expectedCount <= currentPhotos.length &&
      currentPhotos.length > 6 &&
      hasDesc
    ) {
      return;
    }

    const key = expandedId;
    let cancelled = false;
    // The card's showcase may already have loaded the full list (e.g. while browsing photos).
    const photosRequest = completedPhotoFetchKeys.has(key)
      ? Promise.resolve(getClientPhotosCached(key) ?? [])
      : fetchPropertyPhotosShared({
          provider: prop.provider,
          id: prop.id,
          url: prop.url,
        });
    void photosRequest
      .then((photos) => {
        if (cancelled) return;
        fetchedPhotoKeysRef.current.add(key);
        const cachedDesc = getClientDescriptionCached(key);
        if (cachedDesc) {
          setExtraDescriptionsByKey((prev) =>
            upsertBoundedRecord(prev, key, cachedDesc),
          );
        }
        if (photos.length > currentPhotos.length) {
          setExtraPhotosByKey((prev) => {
            const next = upsertBoundedRecord(prev, key, photos);
            const activeKeys = new Set(Object.keys(next));
            for (const fk of fetchedPhotoKeysRef.current) {
              if (!activeKeys.has(fk)) {
                fetchedPhotoKeysRef.current.delete(fk);
              }
            }
            return next;
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [expandedId, resolveProperty, extraPhotosByKey, extraDescriptionsByKey]);

  const cityTop3ByCode = useMemo(() => {
    const map = new Map<
      CityHubCode,
      { top3Avg: number; top3Names: string[]; cityName: string }
    >();
    for (const c of cityAverages) {
      map.set(c.cityCode, {
        top3Avg: c.top3Avg,
        top3Names: c.top3Names,
        cityName: c.cityName,
      });
    }
    return map;
  }, [cityAverages]);

  return {
    filterStore,
    activeAdvancedFilterCount,
    activeFilterPills,
    activePresetId,
    activeTab,
    applyPerfeitoFilterPreset,
    applyPreset,
    availableNeighborhoodOptions,
    benchmarkPanelCollapsed,
    bsbBenchmarkStats,
    cancelScrapeJob,
    cardsListRef,
    chatScrollTargetKey,
    cityTop3ByCode,
    clearChatHistory,
    compareKeys,
    comparedProperties,
    copiedTop50Count,
    customSearchUrl,
    deactivatedFilter,
    deactivatedTotalCount,
    deletePropertyQuestion,
    displayedProperties,
    dynamicNeighborhoods,
    enableBsbBenchmark,
    enabledHiddenCities,
    expandedId,
    extraDescriptionsByKey,
    extraPhotosByKey,
    favoriteKeys,
    filteredItems,
    filteredTotal,
    floorFilters,
    focusCardInList,
    focusedPropertyKey,
    galleryState,
    handleCitySelect,
    handleConsumeChatScrollTarget,
    handleCopyTop50ForAi,
    handleSelectChatThread,
    handleToggleHiddenCity,
    selectableCityList,
    hasAwaitingDetailedQa,
    hideMegaCondo,
    hoveredPropertyKey,
    ineligibleActiveCount,
    isPerfeitoPresetActive,
    isQueryLoading,
    isRefreshing,
    isStartingScrape,
    isSubmittingChatQuestion,
    listMatchesQuery,
    listingDateFrom,
    listingDateTo,
    mapProperties,
    maxAreaM2,
    maxCommuteMinutes,
    maxListingAgeDays,
    maxTotalMonthly,
    meta: visibleMeta,
    minAreaM2,
    minListingAgeDays,
    minModernityScore,
    minScore,
    minTotalMonthly,
    modernityTiers,
    mountedWindow,
    onlyFavorites,
    onlyIneligible,
    onlyNewEntries,
    onlySafeStreets,
    onlyTop20Neighborhoods,
    openChatForProperty,
    pinnedChatProperty,
    pinnedChatPropertyKey,
    postPropertyQuery,
    providerFilter,
    qaItems,
    qaItemsByPropertyKey,
    queryFavorites,
    queryFilters,
    recentListingsCount,
    refreshDatasetFromServer,
    requiredFeatures,
    resetAllFilters,
    scrapeCities,
    scrapeStatus,
    searchQuery,
    selectedBathrooms,
    selectedBedrooms,
    selectedCities,
    selectedFurnitureTiers,
    selectedMapPropertyKey,
    selectedNeighborhoods,
    selectedParking,
    setActiveTab,
    setBenchmarkPanelCollapsed,
    setCompareKeys,
    setCustomSearchUrl,
    setDeactivatedFilter,
    setExpandedId,
    setExtraPhotosByKey,
    setFloorFilters,
    setFurnishedFilter,
    setGalleryState,
    setHideMegaCondo,
    setHoveredPropertyKey,
    setListingDateFrom,
    setListingDateTo,
    setMaxAreaM2,
    setMaxCommuteMinutes,
    setMaxListingAgeDays,
    setMaxTotalMonthly,
    setMinAreaM2,
    setMinBathrooms,
    setMinBedrooms,
    setMinListingAgeDays,
    setMinModernityScore,
    setMinParking,
    setMinScore,
    setMinTotalMonthly,
    setModernityTiers,
    setOnlyFavorites,
    setOnlyIneligible,
    setOnlyNewEntries,
    setOnlySafeStreets,
    setOnlyTop20Neighborhoods,
    setPinnedChatPropertyKey,
    setProviderFilter,
    setRequiredFeatures,
    setScrapeCities,
    setSearchQuery,
    setSelectedBathrooms,
    setSelectedBedrooms,
    setSelectedCities,
    setSelectedFurnitureTiers,
    setSelectedMapPropertyKey,
    setSelectedNeighborhoods,
    setSelectedParking,
    setShowAdvancedFilters,
    setShowChatDrawer,
    setShowIneligible,
    setShowScrapeDrawer,
    setShowSlidersDrawer,
    setSortBy,
    setViewMode,
    setVisibleCount,
    showAdvancedFilters,
    showChatDrawer,
    showIneligible,
    showScrapeDrawer,
    showSlidersDrawer,
    sortBy,
    startScrapeJob,
    submitChatQuestion,
    toggleCompare,
    toggleFavorite,
    toggleScrapeCity,
    totalBasePoolCount,
    updateWeight,
    upsertBoundedRecord,
    viewMode,
    visibleCount,
    weights,
  };
}

export type PortalController = ReturnType<typeof usePortalController>;
