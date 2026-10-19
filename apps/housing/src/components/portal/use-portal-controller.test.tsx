// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchPropertyPhotosShared,
  getClientDescriptionCached,
} from "@/components/property-photo-showcase";
import {
  usePortalController,
  type HousingPortalProps,
} from "@/components/portal/use-portal-controller";
import {
  parseExplorerFiltersObject,
  serializeExplorerFilters,
} from "@/lib/property-filters";
import {
  buildQueryKey,
  toQueryFilters,
  type DatasetMeta,
  type PropertyCardDTO,
  type PropertyQueryResponse,
} from "@/lib/property-query";
import {
  DEFAULT_WEIGHTS,
  sanitizeAndMigrateWeights,
} from "@/lib/scoring-engine";
import type {
  NeighborhoodEntry,
  PropertyQuestionItem,
  SharedUserPreferences,
} from "@/types/housing";

vi.mock("@/components/property-photo-showcase", () => ({
  completedPhotoFetchKeys: new Set<string>(),
  fetchPropertyPhotosShared: vi.fn(),
  getClientDescriptionCached: vi.fn(),
  getClientPhotosCached: vi.fn(() => null),
}));

const mockedFetchPhotos = vi.mocked(fetchPropertyPhotosShared);
const mockedCachedDescription = vi.mocked(getClientDescriptionCached);

// ---------------------------------------------------------------------------
// Fixtures (minimal, synthetic — no real dataset rows)
// ---------------------------------------------------------------------------

const NEIGHBORHOODS: NeighborhoodEntry[] = [
  {
    cityCode: "BH",
    cityName: "Belo Horizonte",
    neighborhood: "Funcionários",
    overallPosition: 1,
    cityPosition: 1,
    baseScore: 9.6,
    idhm: 0.956,
    commuteTime: "10 min",
    nubankHub: "Santa Efigênia",
    urbanBreathingScore: 9.5,
    commuteLogisticsScore: 9.8,
    buildingStockFitScore: 9.4,
    budgetFitScore: 9.5,
    safetyCarScore: 9.6,
    shortRationale: "Perto.",
    detailedJustification: "A 10 min do Nubank.",
    pros: ["Perto"],
    cons: [],
  },
  {
    cityCode: "BH",
    cityName: "Belo Horizonte",
    neighborhood: "Savassi",
    overallPosition: 2,
    cityPosition: 2,
    baseScore: 9.2,
    idhm: 0.94,
    commuteTime: "12 min",
    nubankHub: "Santa Efigênia",
    urbanBreathingScore: 9.2,
    commuteLogisticsScore: 9.4,
    buildingStockFitScore: 9.0,
    budgetFitScore: 9.0,
    safetyCarScore: 9.2,
    shortRationale: "Movimentado.",
    detailedJustification: "Comércio forte.",
    pros: ["Comércio"],
    cons: [],
  },
  {
    cityCode: "SP",
    cityName: "São Paulo",
    neighborhood: "Pinheiros",
    overallPosition: 3,
    cityPosition: 1,
    baseScore: 9.0,
    idhm: 0.93,
    commuteTime: "20 min",
    nubankHub: "Pinheiros",
    urbanBreathingScore: 9.0,
    commuteLogisticsScore: 9.0,
    buildingStockFitScore: 8.8,
    budgetFitScore: 8.5,
    safetyCarScore: 9.0,
    shortRationale: "Bem servido.",
    detailedJustification: "Metrô perto.",
    pros: ["Metrô"],
    cons: [],
  },
];

const META: DatasetMeta = {
  updatedAt: "2026-10-01T00:00:00.000Z",
  source: "snapshot",
  totalCount: 2,
  neighborhoods: NEIGHBORHOODS,
  extraNeighborhoods: [
    { ...NEIGHBORHOODS[1]!, neighborhood: "Bairro Extra", overallPosition: 4, urbanBreathingScore: 10, commuteLogisticsScore: 10, buildingStockFitScore: 10, budgetFitScore: 10, safetyCarScore: 10, isExtra: true },
    { ...NEIGHBORHOODS[2]!, neighborhood: "Moema", overallPosition: 5, isExtra: true },
  ],
  neighborhoodNamesByCity: {
    BH: ["Funcionários", "Savassi"],
    SP: ["Pinheiros"],
  },
};

function makeProperty(
  id: string,
  overrides: Partial<PropertyCardDTO> = {},
): PropertyCardDTO {
  return {
    provider: "quintoandar",
    id,
    cityCode: "BH",
    city: "Belo Horizonte",
    neighborhood: "Funcionários",
    street: "Rua de Teste",
    streetNumber: "100",
    condominiumName: null,
    doorman: null,
    url: `https://example.com/imovel/${id}`,
    title: `Apartamento ${id}`,
    rent: 2500,
    condoFee: 500,
    iptu: 100,
    totalMonthly: 3100,
    salePrice: null,
    areaM2: 60,
    bedrooms: 2,
    suites: 1,
    bathrooms: 1,
    parkingSpaces: 1,
    floor: 5,
    floorRange: null,
    totalFloors: 10,
    furnished: false,
    acceptsPets: true,
    nearSubway: false,
    constructionYear: 2015,
    condition: null,
    installations: [],
    amenities: [],
    comfortCommodities: [],
    practicalityCommodities: [],
    placesNearby: [],
    photoCaptions: [],
    photosCount: 8,
    modernityScore: 80,
    modernityTier: "MODERN_OR_RENOVATED",
    positiveSignals: [],
    negativeSignals: [],
    samplePhotos: [
      { room: "Sala", url: "https://example.com/1.jpg" },
      { room: "Quarto", url: "https://example.com/2.jpg" },
      { room: "Cozinha", url: "https://example.com/3.jpg" },
    ],
    description: "Descrição curta",
    generatedDescription: null,
    sourceSearch: null,
    isNewEntry: false,
    publishedAt: "2026-09-01T00:00:00.000Z",
    listingUpdatedAt: null,
    isActive: true,
    deactivatedAt: null,
    furnitureTier: "UNFURNISHED",
    commuteMinutes: 15,
    commuteLabel: "15 min",
    listingAgeDays: 3,
    listingAgeLabel: "3 dias",
    firstPublicationAgeLabel: null,
    eligible: true,
    exclusionReason: null,
    finalScore: 88.5,
    cityRank: 1,
    overallRank: 1,
    neighborhoodRank: 1,
    neighborhoodDynamicScore: 9,
    breakdown: {
      neighborhoodPoints: 10,
      modernityPoints: 10,
      nuancesPoints: 5,
      budgetPoints: 5,
      furniturePoints: 5,
      areaPoints: 5,
      parkingPoints: 5,
      safetyPoints: 5,
      commutePoints: 5,
      cityPreferencePoints: 5,
    },
    cardTags: {
      acLabel: null,
      floorTag: { label: "5º andar", rarity: "common" },
      highFloorLabel: null,
      lowFloorLabel: null,
      noParking: false,
      greenTags: ["AC"],
      redTags: [],
      warningTags: [],
    },
    nuanceHighlights: [],
    nuanceWarnings: [],
    parksNearby: [],
    mallsNearby: [],
    shortJustification: "Bom imóvel",
    narrativeJustification: "",
    detailedJustification: "",
    detailsLoaded: false,
    ...overrides,
  };
}

function makeQaItem(
  overrides: Partial<PropertyQuestionItem> = {},
): PropertyQuestionItem {
  return {
    id: "qa-1",
    propertyKey: "quintoandar:1",
    question: "Vale a pena?",
    status: "answered",
    answer: "Sim.",
    createdAt: new Date().toISOString(),
    answeredAt: new Date().toISOString(),
    propertySnapshot: {
      title: "Apartamento 1",
      neighborhood: "Funcionários",
      cityCode: "BH",
      street: "Rua de Teste",
      streetNumber: "100",
      condominiumName: null,
      totalMonthly: 3100,
      rent: 2500,
      condoFee: 500,
      iptu: 100,
      areaM2: 60,
      bedrooms: 2,
      bathrooms: 1,
      parkingSpaces: 1,
      floor: 5,
      floorLabel: "5º andar",
      furnished: false,
      modernityScore: 80,
      finalScore: 88.5,
      overallRank: 1,
      url: "https://example.com/imovel/1",
      shortJustification: "Bom imóvel",
      description: "Descrição curta",
    },
    ...overrides,
  };
}

const P1 = makeProperty("1");
const P2 = makeProperty("2", { neighborhood: "Savassi", overallRank: 2 });
const P3 = makeProperty("3", { neighborhood: "Pinheiros", cityCode: "SP", city: "São Paulo" });

const DEFAULT_FACETS: NonNullable<PropertyQueryResponse["facets"]> = {
  counts: {
    totalBasePoolCount: 2,
    ineligibleActiveCount: 1,
    deactivatedTotalCount: 3,
    recentCount: 1,
  },
  neighborhoodOptions: [
    { name: "Funcionários", count: 2, cityCode: "BH", score: 9.5 },
  ],
  benchmark: null,
  favoritesOutsidePool: [],
};

function makePrefs(
  overrides: Partial<SharedUserPreferences> = {},
): SharedUserPreferences {
  return {
    schemaVersion: 2,
    filters: {},
    weights: {},
    activePresetId: "balanced-original",
    favorites: [],
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Builds props whose initialQueryKey matches the key the hook will compute,
 *  so mounting does not immediately refetch (mirrors the SSR contract). */
function buildProps(options: {
  items?: PropertyCardDTO[];
  total?: number;
  facets?: PropertyQueryResponse["facets"] | null;
  prefs?: SharedUserPreferences;
  meta?: DatasetMeta;
  datasetHash?: string;
} = {}): HousingPortalProps {
  const items = options.items ?? [P1, P2];
  const prefs = options.prefs;
  const parsed = parseExplorerFiltersObject(prefs?.filters);
  const weights = sanitizeAndMigrateWeights(
    prefs?.weights,
    prefs?.schemaVersion ?? 2,
  );
  const favorites = parsed.onlyFavorites ? (prefs?.favorites ?? []) : [];
  const initialQueryKey = buildQueryKey({
    filters: toQueryFilters(parsed),
    weights,
    favorites,
  });
  serverItems = items;
  serverTotal = options.total ?? items.length;
  return {
    initialMeta: options.meta ?? META,
    initialQuery: {
      ok: true,
      key: initialQueryKey,
      datasetHash: options.datasetHash ?? "hash-1",
      total: options.total ?? items.length,
      offset: 0,
      items,
      facets: options.facets === undefined ? DEFAULT_FACETS : (options.facets ?? undefined),
    },
    initialQueryKey,
    initialPreferences: prefs,
  };
}

// ---------------------------------------------------------------------------
// Fetch mock (the external boundary)
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string;
  method: string;
  body: Record<string, unknown> | null;
}

let calls: FetchCall[] = [];
let serverItems: PropertyCardDTO[] = [P1, P2];
let serverTotal = 2;

type Handler = (
  body: Record<string, unknown> | null,
) => Response | Promise<Response>;

function jsonRes(payload: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function defaultPropertiesPost(body: Record<string, unknown> | null): Response {
  return jsonRes({
    ok: true,
    datasetHash: "hash-1",
    total: serverTotal,
    offset: typeof body?.offset === "number" ? body.offset : 0,
    items: serverItems,
    facets: DEFAULT_FACETS,
  });
}

let propertiesPostHandler: Handler = async (body) => defaultPropertiesPost(body);
let propertiesGetHandler: Handler = async () => jsonRes({ ok: true });
let detailsPostHandler: Handler = async () => jsonRes({ items: [] });
let preferencesGetHandler: Handler = async () => jsonRes({ ok: true });
let preferencesPostHandler: Handler = async () =>
  jsonRes({
    ok: true,
    persistedToDb: true,
    preferences: makePrefs({ updatedAt: "2026-10-02T00:00:00.000Z" }),
  });
let qaGetHandler: Handler = async () => jsonRes({ ok: true, items: [] });
let qaPostHandler: Handler = async () => jsonRes({ ok: true, items: [] });
let scrapeStatusHandler: Handler = async () =>
  jsonRes({ jobId: "none", status: "idle" });
let scrapeRunHandler: Handler = async () =>
  jsonRes({ ok: true, status: { jobId: "job-1", status: "idle" } });

function callsTo(path: string, method?: string): FetchCall[] {
  return calls.filter(
    (c) => c.url.startsWith(path) && (method === undefined || c.method === method),
  );
}

async function flush(ms = 30): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  });
}

function renderPortal(props: HousingPortalProps) {
  return renderHook(() => usePortalController(props));
}

beforeEach(() => {
  localStorage.clear();
  calls = [];
  serverItems = [P1, P2];
  serverTotal = 2;
  propertiesPostHandler = async (body) => defaultPropertiesPost(body);
  propertiesGetHandler = async () => jsonRes({ ok: true });
  detailsPostHandler = async () => jsonRes({ items: [] });
  preferencesGetHandler = async () => jsonRes({ ok: true });
  preferencesPostHandler = async () =>
    jsonRes({
      ok: true,
      persistedToDb: true,
      preferences: makePrefs({ updatedAt: "2026-10-02T00:00:00.000Z" }),
    });
  qaGetHandler = async () => jsonRes({ ok: true, items: [] });
  qaPostHandler = async () => jsonRes({ ok: true, items: [] });
  scrapeStatusHandler = async () => jsonRes({ jobId: "none", status: "idle" });
  scrapeRunHandler = async () =>
    jsonRes({ ok: true, status: { jobId: "job-1", status: "idle" } });

  mockedFetchPhotos.mockReset();
  mockedFetchPhotos.mockResolvedValue([]);
  mockedCachedDescription.mockReset();
  mockedCachedDescription.mockReturnValue(null);

  const fetchMock = vi.fn(
    async (input: unknown, init?: RequestInit): Promise<Response> => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : (input as Request).url;
      const method = (init?.method ?? "GET").toUpperCase();
      let body: Record<string, unknown> | null = null;
      if (typeof init?.body === "string") {
        try {
          body = JSON.parse(init.body) as Record<string, unknown>;
        } catch {
          body = null;
        }
      }
      calls.push({ url, method, body });
      if (url.startsWith("/api/properties/details")) return detailsPostHandler(body);
      if (url.startsWith("/api/properties") && method === "POST") return propertiesPostHandler(body);
      if (url.startsWith("/api/properties")) return propertiesGetHandler(body);
      if (url === "/api/preferences" && method === "GET") return preferencesGetHandler(body);
      if (url === "/api/preferences" && method === "POST") return preferencesPostHandler(body);
      if (url.startsWith("/api/scrape/status")) return scrapeStatusHandler(body);
      if (url.startsWith("/api/scrape/run")) return scrapeRunHandler(body);
      if (url.startsWith("/api/qa") && method === "POST") return qaPostHandler(body);
      if (url.startsWith("/api/qa")) return qaGetHandler(body);
      return jsonRes({ ok: true });
    },
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// Initial state & derived data
// ---------------------------------------------------------------------------

describe("usePortalController — initial state", () => {
  it("exposes default filters, weights, tabs and the initial page without refetching it", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    expect(result.current.selectedCities).toEqual([]);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.sortBy).toBe("score_desc");
    // parseExplorerFiltersObject defaults maxTotalMonthly to 5000 when absent.
    expect(result.current.maxTotalMonthly).toBe(5000);
    expect(result.current.activeTab).toBe("properties");
    expect(result.current.activePresetId).toBe("balanced-original");
    expect(result.current.weights).toEqual(DEFAULT_WEIGHTS);
    expect(result.current.favoriteKeys).toEqual([]);
    // Comparator removed (bffc444): the controller exposes no compare surface.
    expect(result.current).not.toHaveProperty("compareKeys");
    expect(result.current).not.toHaveProperty("comparedProperties");
    expect(result.current).not.toHaveProperty("toggleCompare");
    expect(result.current.filteredItems.map((p) => p.id)).toEqual(["1", "2"]);
    expect(result.current.filteredTotal).toBe(2);
    expect(result.current.displayedProperties.map((p) => p.id)).toEqual(["1", "2"]);
    expect(result.current.mapProperties.map((p) => p.id)).toEqual(["1", "2"]);
    expect(result.current.listMatchesQuery).toBe(true);
    expect(result.current.isQueryLoading).toBe(false);
    expect(result.current.totalBasePoolCount).toBe(2);
    expect(result.current.ineligibleActiveCount).toBe(1);
    expect(result.current.deactivatedTotalCount).toBe(3);
    expect(result.current.recentListingsCount).toBe(1);
    expect(result.current.availableNeighborhoodOptions).toEqual(
      DEFAULT_FACETS.neighborhoodOptions,
    );
    expect(result.current.bsbBenchmarkStats).toBeTruthy();
    expect(result.current.enabledHiddenCities).toEqual([]);
    expect(result.current.enableBsbBenchmark).toBe(false);
    expect(result.current.selectableCityList).toEqual(["BH", "CP", "RJ"]);
    // SP neighborhoods are hidden by default, so only the 2 BH entries rank.
    expect(result.current.dynamicNeighborhoods.length).toBe(2);
    // The ranking tab adds the visible extras (BH Bairro Extra); the SP extra stays hidden with SP.
    // Both top rows clamp to 10.00: the score tie keeps the catalog row first.
    expect(result.current.neighborhoodRanking.map((n) => n.neighborhood)).toEqual([
      "Funcionários",
      "Bairro Extra",
      "Savassi",
    ]);
    expect(result.current.dynamicNeighborhoods.map((n) => n.neighborhood)).toEqual([
      "Funcionários",
      "Savassi",
    ]);
    expect(result.current.cityTop3ByCode.get("BH")?.top3Names).toContain("Funcionários");
    // The parsed default maxTotalMonthly (5000) counts as one price filter.
    expect(result.current.activeAdvancedFilterCount).toBe(1);
    expect(result.current.activeFilterPills.map((p) => p.id)).toEqual(["price"]);
    // The cached initial page satisfies the query: no POST /api/properties on mount.
    expect(
      calls.filter((c) => c.url === "/api/properties" && c.method === "POST"),
    ).toHaveLength(0);
    // Mount-time external reads did happen.
    expect(callsTo("/api/preferences", "GET").length).toBeGreaterThanOrEqual(1);
    expect(callsTo("/api/scrape/status", "GET").length).toBeGreaterThanOrEqual(1);
    expect(callsTo("/api/qa", "GET").length).toBeGreaterThanOrEqual(1);
    expect(result.current.scrapeStatus.status).toBe("idle");
    expect(result.current.qaItems).toEqual([]);
  });

  it("seeds filters, weights and favorites from server preferences", async () => {
    const prefs = makePrefs({
      filters: {
        selectedCities: ["BH"],
        searchQuery: "func",
        maxTotalMonthly: 4000,
        sortBy: "price_asc",
      },
      weights: { budgetIdeal: 4000 },
      activePresetId: "custom-preset",
      favorites: ["quintoandar:1"],
      updatedAt: "2026-10-01T12:00:00.000Z",
    });
    const { result } = renderPortal(buildProps({ prefs, total: 99 }));
    await flush();

    expect(result.current.selectedCities).toEqual(["BH"]);
    expect(result.current.searchQuery).toBe("func");
    expect(result.current.maxTotalMonthly).toBe(4000);
    expect(result.current.sortBy).toBe("price_asc");
    expect(result.current.weights.budgetIdeal).toBe(4000);
    expect(result.current.weights.budgetMax).toBe(DEFAULT_WEIGHTS.budgetMax);
    expect(result.current.activePresetId).toBe("custom-preset");
    expect(result.current.favoriteKeys).toEqual(["quintoandar:1"]);
    expect(result.current.filteredTotal).toBe(99);
    // Comparator removed (bffc444): server prefs no longer seed any compare state.
    expect(result.current).not.toHaveProperty("compareKeys");
    expect(result.current).not.toHaveProperty("comparedProperties");
    // Applying server prefs mirrors them into localStorage.
    const storedFilters = JSON.parse(
      localStorage.getItem("housing_explorer_filters_v1") ?? "{}",
    ) as Record<string, unknown>;
    expect(storedFilters.searchQuery).toBe("func");
    expect(JSON.parse(localStorage.getItem("housing_favorites_v1") ?? "[]")).toEqual([
      "quintoandar:1",
    ]);
  });

  it("hydrates weights, filters and favorites from localStorage when the server has none and clears the legacy compare key", async () => {
    localStorage.setItem(
      "housing_weights_v2",
      JSON.stringify({ presetId: "local-preset", weights: { budgetIdeal: 4100 } }),
    );
    localStorage.setItem(
      "housing_explorer_filters_v1",
      JSON.stringify({ selectedCities: ["SP"], enabledHiddenCities: ["SP"], searchQuery: "pinheiros", sortBy: "price_asc", maxTotalMonthly: 4200 }),
    );
    localStorage.setItem("housing_favorites_v1", JSON.stringify(["quintoandar:2", ""]));
    localStorage.setItem("housing_compare_v1", JSON.stringify(["quintoandar:2"]));

    const { result } = renderPortal(buildProps());
    await flush(60);

    expect(result.current.selectedCities).toEqual(["SP"]);
    expect(result.current.enabledHiddenCities).toEqual(["SP"]);
    expect(result.current.searchQuery).toBe("pinheiros");
    expect(result.current.sortBy).toBe("price_asc");
    expect(result.current.activePresetId).toBe("local-preset");
    expect(result.current.weights.budgetIdeal).toBe(4100);
    expect(result.current.favoriteKeys).toEqual(["quintoandar:2"]);
    // Comparator removed (bffc444): the seeded legacy key is not hydrated and
    // the persist effect removes it (use-portal-controller.ts: localStorage.removeItem("housing_compare_v1")).
    expect(result.current).not.toHaveProperty("compareKeys");
    expect(localStorage.getItem("housing_compare_v1")).toBeNull();
  });

  it("ignores malformed localStorage payloads and still hydrates", async () => {
    localStorage.setItem("housing_weights_v2", "{not-json");
    localStorage.setItem("housing_explorer_filters_v1", "{not-json");
    const { result } = renderPortal(buildProps());
    await flush();
    expect(result.current.weights).toEqual(DEFAULT_WEIGHTS);
    expect(result.current.selectedCities).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Dataset querying
// ---------------------------------------------------------------------------

describe("usePortalController — dataset querying", () => {
  it("refetches the first page when a filter changes and exposes the new page", async () => {
    propertiesPostHandler = async () =>
      jsonRes({
        ok: true,
        datasetHash: "hash-1",
        total: 1,
        offset: 0,
        items: [P3],
        facets: {
          counts: { totalBasePoolCount: 1, ineligibleActiveCount: 0, deactivatedTotalCount: 0, recentCount: 0 },
          neighborhoodOptions: [],
          benchmark: null,
        },
      });
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.setSortBy("price_asc");
    });
    await flush(60);

    expect(result.current.filteredItems.map((p) => p.id)).toEqual(["3"]);
    expect(result.current.filteredTotal).toBe(1);
    expect(result.current.listMatchesQuery).toBe(true);
    expect(result.current.isQueryLoading).toBe(false);
    expect(result.current.totalBasePoolCount).toBe(1);
    const posts = callsTo("/api/properties", "POST");
    expect(posts.length).toBeGreaterThanOrEqual(1);
    const body = posts[posts.length - 1]!.body as unknown as {
      filters: { sortBy: string };
      offset: number;
      limit: number;
      includeFacets: boolean;
    };
    expect(body.filters.sortBy).toBe("price_asc");
    expect(body.offset).toBe(0);
    expect(body.includeFacets).toBe(true);
  });

  it("debounces search changes before querying", async () => {
    const { result } = renderPortal(buildProps());
    await flush();
    act(() => {
      result.current.setSearchQuery("savassi");
    });
    // Search uses the 120ms debounce path.
    await flush(200);
    const posts = callsTo("/api/properties", "POST");
    expect(posts.length).toBeGreaterThanOrEqual(1);
    const body = posts[posts.length - 1]!.body as unknown as {
      filters: { searchQuery: string };
    };
    expect(body.filters.searchQuery).toBe("savassi");
    expect(result.current.queryFilters.searchQuery).toBe("savassi");
  });

  it("keeps the previous page and flags a mismatch when the query fails", async () => {
    propertiesPostHandler = async () => jsonRes({ ok: false }, 500);
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.setSortBy("price_desc");
    });
    await flush(60);

    expect(result.current.filteredItems.map((p) => p.id)).toEqual(["1", "2"]);
    expect(result.current.listMatchesQuery).toBe(false);
    expect(result.current.isQueryLoading).toBe(false);
  });

  it("appends the next page when visibleCount grows beyond the loaded slice", async () => {
    const many = Array.from({ length: 35 }, (_, i) =>
      makeProperty(String(100 + i)),
    );
    propertiesPostHandler = async (body) => {
      const offset = typeof body?.offset === "number" ? body.offset : 0;
      const limit = typeof body?.limit === "number" ? body.limit : 30;
      return jsonRes({
        ok: true,
        datasetHash: "hash-1",
        total: many.length,
        offset,
        items: many.slice(offset, offset + limit),
        facets: DEFAULT_FACETS,
      });
    };
    const { result } = renderPortal(
      buildProps({ items: many.slice(0, 30), total: many.length }),
    );
    await flush();
    expect(result.current.displayedProperties).toHaveLength(30);

    act(() => {
      result.current.setVisibleCount(35);
    });
    await flush(60);

    expect(result.current.filteredItems).toHaveLength(35);
    expect(result.current.displayedProperties).toHaveLength(35);
    const posts = callsTo("/api/properties", "POST");
    const append = posts[posts.length - 1]!.body as unknown as {
      offset: number;
      limit: number;
      includeFacets: boolean;
    };
    expect(append.offset).toBe(30);
    expect(append.limit).toBe(5);
    expect(append.includeFacets).toBe(false);
  });

  it("reuses the cached page when returning to a previous query key", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.setSortBy("price_asc");
    });
    await flush(60);
    const afterFirstChange = callsTo("/api/properties", "POST").length;
    expect(afterFirstChange).toBeGreaterThanOrEqual(1);

    act(() => {
      result.current.setSortBy("score_desc");
    });
    await flush(60);

    expect(result.current.listMatchesQuery).toBe(true);
    expect(result.current.filteredItems.map((p) => p.id)).toEqual(["1", "2"]);
    expect(callsTo("/api/properties", "POST")).toHaveLength(afterFirstChange);
  });

  it("refreshDatasetFromServer applies remote preferences and refetches with meta", async () => {
    const remote = makePrefs({
      filters: { searchQuery: "remote-search" },
      weights: { budgetMax: 9000 },
      activePresetId: "remote-preset",
      favorites: ["quintoandar:2"],
      updatedAt: "2027-01-01T00:00:00.000Z",
    });
    let serveRemote = false;
    preferencesGetHandler = async () =>
      serveRemote ? jsonRes({ ok: true, preferences: remote }) : jsonRes({ ok: true });
    propertiesPostHandler = async (body) =>
      jsonRes({
        ok: true,
        datasetHash: "hash-1",
        total: serverTotal,
        offset: 0,
        items: serverItems,
        facets: DEFAULT_FACETS,
        ...(body?.includeMeta === true
          ? {
              meta: {
                ...META,
                updatedAt: "2027-01-02T00:00:00.000Z",
                totalCount: 777,
              },
            }
          : {}),
      });

    const { result } = renderPortal(buildProps({ prefs: makePrefs() }));
    await flush();
    serveRemote = true;

    await act(async () => {
      await result.current.refreshDatasetFromServer();
    });
    // The remote search term goes through the 120ms search debounce.
    await flush(250);

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.searchQuery).toBe("remote-search");
    expect(result.current.weights.budgetMax).toBe(9000);
    expect(result.current.activePresetId).toBe("remote-preset");
    expect(result.current.favoriteKeys).toEqual(["quintoandar:2"]);
    expect(result.current.meta.updatedAt).toBe("2027-01-02T00:00:00.000Z");
    expect(result.current.meta.totalCount).toBe(777);
    const metaPost = callsTo("/api/properties", "POST").find(
      (c) => (c.body as { includeMeta?: boolean } | null)?.includeMeta === true,
    );
    expect(metaPost).toBeTruthy();
  });

  it("postPropertyQuery returns parsed JSON and throws on HTTP errors", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    const ok = await result.current.postPropertyQuery({
      filters: result.current.queryFilters,
      weights: result.current.weights,
      favorites: [],
    });
    expect(ok.total).toBe(2);

    propertiesPostHandler = async () => jsonRes({ ok: false }, 503);
    await expect(
      result.current.postPropertyQuery({
        filters: result.current.queryFilters,
        weights: result.current.weights,
        favorites: [],
      }),
    ).rejects.toThrow("properties query failed (503)");
  });
});

// ---------------------------------------------------------------------------
// Filters, presets and pills
// ---------------------------------------------------------------------------

describe("usePortalController — filters and presets", () => {
  it("handleCitySelect toggles cities, prunes neighborhoods, collapses the full set and resets on ALL", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.handleCitySelect("BH");
    });
    expect(result.current.selectedCities).toEqual(["BH"]);
    expect(result.current.scrapeCities).toEqual(["BH"]);

    act(() => {
      result.current.setSelectedNeighborhoods([
        "BH:Funcionários",
        "SP:Pinheiros",
        "Funcionários",
      ]);
    });
    act(() => {
      result.current.handleCitySelect("SP");
    });
    expect(result.current.selectedCities).toEqual(["BH", "SP"]);
    expect(result.current.selectedNeighborhoods).toEqual([
      "BH:Funcionários",
      "SP:Pinheiros",
      "Funcionários",
    ]);

    act(() => {
      result.current.handleCitySelect("BH");
    });
    expect(result.current.selectedCities).toEqual(["SP"]);
    // City-qualified BH entry and the plain BH neighborhood are pruned.
    expect(result.current.selectedNeighborhoods).toEqual(["SP:Pinheiros"]);

    act(() => {
      result.current.handleCitySelect("ALL");
    });
    expect(result.current.selectedCities).toEqual([]);
    expect(result.current.selectedNeighborhoods).toEqual([]);
    expect(result.current.scrapeCities).toEqual(["BH", "RJ", "CP", "SP"]);

    // Selecting every selectable city collapses back to "all" ([]).
    // SP is hidden by default, so enable it first to make it selectable.
    act(() => {
      result.current.handleToggleHiddenCity("SP");
    });
    expect(result.current.enabledHiddenCities).toEqual(["SP"]);
    expect(result.current.selectableCityList).toEqual(["BH", "CP", "RJ", "SP"]);
    act(() => {
      result.current.handleCitySelect("BH");
    });
    act(() => {
      result.current.handleCitySelect("RJ");
    });
    act(() => {
      result.current.handleCitySelect("CP");
    });
    act(() => {
      result.current.handleCitySelect("SP");
    });
    expect(result.current.selectedCities).toEqual([]);
  });

  it("handleToggleHiddenCity enables the BSB benchmark and prunes BSB selections when disabled", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.setBenchmarkPanelCollapsed(true);
    });
    act(() => {
      result.current.handleToggleHiddenCity("BSB");
    });
    expect(result.current.enabledHiddenCities).toEqual(["BSB"]);
    expect(result.current.enableBsbBenchmark).toBe(true);
    expect(result.current.benchmarkPanelCollapsed).toBe(false);

    act(() => {
      result.current.setSelectedCities(["BH", "BSB"]);
      result.current.setSelectedNeighborhoods([
        "BSB:Águas Claras Norte",
        "BH:Funcionários",
      ]);
    });
    act(() => {
      result.current.handleToggleHiddenCity("BSB");
    });
    expect(result.current.enabledHiddenCities).toEqual([]);
    expect(result.current.enableBsbBenchmark).toBe(false);
    expect(result.current.selectedCities).toEqual(["BH"]);
    expect(result.current.selectedNeighborhoods).toEqual(["BH:Funcionários"]);
  });

  it("resetAllFilters restores the default filter state", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.setSearchQuery("rua");
      result.current.handleCitySelect("RJ");
      result.current.setMinScore(70);
      result.current.setSortBy("price_asc");
      result.current.setHideMegaCondo(true);
      result.current.setMinAreaM2(80);
      result.current.setVisibleCount(90);
    });
    expect(result.current.searchQuery).toBe("rua");
    expect(result.current.visibleCount).toBe(90);

    act(() => {
      result.current.resetAllFilters();
    });

    expect(result.current.selectedCities).toEqual([]);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.minScore).toBeNull();
    // Sort is ordering, not a filter: clearFilters preserves it
    // (filter-state.ts NON_FILTER_KEYS includes "sortBy"), so the
    // price_asc chosen above survives the reset.
    expect(result.current.sortBy).toBe("price_asc");
    expect(result.current.hideMegaCondo).toBe(false);
    expect(result.current.minAreaM2).toBeNull();
    // CLEARED_FILTERS has no R$ cap (filter-state.ts: "no R$ 5.000 cap:
    // that default only applies to first-time users").
    expect(result.current.maxTotalMonthly).toBeNull();
    expect(result.current.minTotalMonthly).toBeNull();
    expect(result.current.deactivatedFilter).toBe("ACTIVE_ONLY");
    expect(result.current.visibleCount).toBe(30);
    expect(result.current.activeFilterPills.map((p) => p.id)).not.toContain("search");
  });

  it("applyPerfeitoFilterPreset applies the ideal filters and toggles back off", async () => {
    const { result } = renderPortal(buildProps());
    await flush();
    expect(result.current.isPerfeitoPresetActive).toBe(false);

    act(() => {
      result.current.applyPerfeitoFilterPreset();
    });
    expect(result.current.requiredFeatures).toContain("ac");
    expect(result.current.floorFilters).toEqual(["HIGH_OR_TOP"]);
    expect(result.current.maxTotalMonthly).toBe(4500);
    expect(result.current.queryFilters.maxCommuteMinutes).toBe(25);
    expect(result.current.selectedFurnitureTiers).toEqual(["UNFURNISHED"]);
    expect(result.current.onlySafeStreets).toBe(true);
    expect(result.current.isPerfeitoPresetActive).toBe(true);

    act(() => {
      result.current.applyPerfeitoFilterPreset();
    });
    expect(result.current.isPerfeitoPresetActive).toBe(false);
    expect(result.current.requiredFeatures).toEqual([]);
    expect(result.current.maxTotalMonthly).toBe(5000);
  });

  it("applyPreset and updateWeight manage scoring weights", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.applyPreset("economia-4k");
    });
    expect(result.current.activePresetId).toBe("economia-4k");
    expect(result.current.weights.budgetIdeal).toBe(3800);
    expect(result.current.weights.budgetMax).toBe(4200);

    act(() => {
      result.current.applyPreset("does-not-exist");
    });
    expect(result.current.activePresetId).toBe("economia-4k");

    act(() => {
      result.current.updateWeight("budgetIdeal", 4321);
    });
    expect(result.current.activePresetId).toBe("custom");
    expect(result.current.weights.budgetIdeal).toBe(4321);
    expect(result.current.weights.budgetMax).toBe(4200);

    act(() => {
      result.current.applyPreset("perfeito");
    });
    expect(result.current.activePresetId).toBe("perfeito");
    expect(result.current.requiredFeatures).toContain("ac");
    expect(result.current.floorFilters).toEqual(["HIGH_OR_TOP"]);
    expect(result.current.maxTotalMonthly).toBe(4500);
  });

  it("builds active filter pills for a heavily filtered state and clears them individually", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.handleCitySelect("BH");
      result.current.setSearchQuery("rua x");
      result.current.setFloorFilters(["HIGH_OR_TOP", "EPIC"]);
      result.current.setMinTotalMonthly(2000);
      result.current.setMaxTotalMonthly(4000);
      result.current.setMaxCommuteMinutes(20);
      result.current.setMinScore(75);
      result.current.setSortBy("price_asc");
      result.current.setSelectedNeighborhoods(["BH:Funcionários"]);
      result.current.setMinAreaM2(40);
      result.current.setMaxAreaM2(90);
      result.current.setMinListingAgeDays(1);
      result.current.setMaxListingAgeDays(30);
      result.current.setListingDateFrom("2026-01-01");
      result.current.setListingDateTo("2026-02-01");
      result.current.setSelectedBedrooms([2, 3]);
      result.current.setSelectedBathrooms([1]);
      result.current.setSelectedParking([1, 2]);
      result.current.setModernityTiers(["MODERN_OR_RENOVATED", "DATED"]);
      result.current.setMinModernityScore(70);
      result.current.setSelectedFurnitureTiers(["UNFURNISHED", "FULLY_FURNISHED"]);
      result.current.setRequiredFeatures(["ac", "balcony"]);
      result.current.setHideMegaCondo(true);
      // setHideForSale is not part of the returned controller; drive it via the store.
      result.current.filterStore.setState({ hideForSale: true });
      result.current.setOnlyNewEntries(true);
      result.current.setShowIneligible(true);
      result.current.setProviderFilter("quintoandar");
      result.current.setOnlyTop20Neighborhoods(true);
      result.current.setOnlySafeStreets(true);
      result.current.setDeactivatedFilter("ALL");
    });

    const ids = result.current.activeFilterPills.map((p) => p.id);
    for (const expected of [
      "city-BH",
      "search",
      "floor-HIGH_OR_TOP",
      "price",
      "commute",
      "score",
      "nb-BH:Funcionários",
      "area",
      "listing-age",
      "listing-date",
      "bedrooms",
      "bathrooms",
      "parking",
      "tier-MODERN_OR_RENOVATED",
      "min-modernity",
      "furn-UNFURNISHED",
      "feat-ac",
      "feat-balcony",
      "safe-streets",
      "no-megacondo",
      "no-forsale",
      "new-entries",
      "ineligible",
      "provider",
      "top-neighborhoods",
      "deactivated",
    ]) {
      expect(ids).toContain(expected);
    }
    // Sort and view mode are not filters (filter-state.ts describeActiveFilters):
    // a non-default sort produces no removable pill.
    expect(ids).not.toContain("sort");
    expect(result.current.activeAdvancedFilterCount).toBeGreaterThan(10);
    const pricePill = result.current.activeFilterPills.find((p) => p.id === "price");
    expect(pricePill?.label).toContain("2.000");
    expect(pricePill?.label).toContain("4.000");
    const bedroomsPill = result.current.activeFilterPills.find((p) => p.id === "bedrooms");
    expect(bedroomsPill?.label).toContain("3+");

    const clear = (id: string) => {
      const pill = result.current.activeFilterPills.find((p) => p.id === id);
      expect(pill, `pill ${id}`).toBeTruthy();
      act(() => {
        pill!.onClear();
      });
    };

    clear("search");
    expect(result.current.searchQuery).toBe("");
    clear("price");
    expect(result.current.minTotalMonthly).toBeNull();
    expect(result.current.maxTotalMonthly).toBeNull();
    clear("floor-HIGH_OR_TOP");
    expect(result.current.floorFilters).toEqual(["EPIC"]);
    clear("bedrooms");
    expect(result.current.selectedBedrooms).toEqual([]);
    clear("furn-UNFURNISHED");
    expect(result.current.selectedFurnitureTiers).toEqual(["FULLY_FURNISHED"]);
    clear("feat-ac");
    expect(result.current.requiredFeatures).toEqual(["balcony"]);
    clear("city-BH");
    expect(result.current.selectedCities).toEqual([]);
    // No sort pill exists to clear: the chosen ordering is untouched.
    expect(result.current.sortBy).toBe("price_asc");
    clear("area");
    expect(result.current.minAreaM2).toBeNull();
    expect(result.current.maxAreaM2).toBeNull();
    clear("listing-date");
    expect(result.current.listingDateFrom).toBe("");
    expect(result.current.listingDateTo).toBe("");
    clear("safe-streets");
    expect(result.current.onlySafeStreets).toBe(false);

    // Min-only variants produce their own pill labels once the multi-selects are empty.
    act(() => {
      result.current.setMinBedrooms(2);
      result.current.setMinBathrooms(2);
      result.current.setMinParking(1);
      result.current.setFurnishedFilter("FURNISHED");
      result.current.setOnlyIneligible(true);
    });
    const ids2 = result.current.activeFilterPills.map((p) => p.id);
    expect(ids2).toContain("ineligible");
    const bedroomMin = result.current.activeFilterPills.find((p) => p.id === "bedrooms");
    expect(bedroomMin?.label).toContain("2+ quartos");
    clear("bedrooms");
    expect(result.current.queryFilters.minBedrooms ?? null).toBeNull();
    clear("ineligible");
    expect(result.current.onlyIneligible).toBe(false);
    expect(result.current.showIneligible).toBe(false);
  });

  it("focusCardInList pins out-of-window cards, focuses in-window cards and leaves map mode", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.setViewMode("map");
    });
    act(() => {
      result.current.focusCardInList("quintoandar:2");
    });
    expect(result.current.activeTab).toBe("properties");
    expect(result.current.viewMode).toBe("split");
    expect(result.current.expandedId).toBe("quintoandar:2");
    expect(result.current.selectedMapPropertyKey).toBe("quintoandar:2");
    // Index 1 is inside the first window: no pinning needed.
    expect(result.current.focusedPropertyKey).toBeNull();

    act(() => {
      result.current.focusCardInList("quintoandar:unknown");
    });
    expect(result.current.focusedPropertyKey).toBe("quintoandar:unknown");
    expect(result.current.mountedWindow).toEqual({ start: 0, end: 16 });
    // Unknown target cannot be resolved, so the displayed slice is unchanged.
    expect(result.current.displayedProperties.map((p) => p.id)).toEqual(["1", "2"]);
    await flush(120);
  });

  it("focusCardInList prepends a resolvable card that sits beyond the first window", async () => {
    const many = Array.from({ length: 35 }, (_, i) =>
      makeProperty(String(200 + i)),
    );
    propertiesPostHandler = async (body) => {
      const offset = typeof body?.offset === "number" ? body.offset : 0;
      const limit = typeof body?.limit === "number" ? body.limit : 30;
      return jsonRes({
        ok: true,
        datasetHash: "hash-1",
        total: many.length,
        offset,
        items: many.slice(offset, offset + limit),
        facets: DEFAULT_FACETS,
      });
    };
    const { result } = renderPortal(
      buildProps({ items: many.slice(0, 30), total: many.length }),
    );
    await flush();
    // Load the remaining page so the target is resolvable in the full list.
    act(() => {
      result.current.setVisibleCount(35);
    });
    await flush(60);
    expect(result.current.filteredItems).toHaveLength(35);

    act(() => {
      result.current.setVisibleCount(30);
    });
    const targetKey = `quintoandar:${many[34]!.id}`;
    act(() => {
      result.current.focusCardInList(targetKey);
    });
    // Index 34 is outside the initial 30-card window: it gets pinned at the top.
    expect(result.current.focusedPropertyKey).toBe(targetKey);
    expect(result.current.displayedProperties[0]?.id).toBe(many[34]!.id);
    expect(result.current.displayedProperties).toHaveLength(31);
    await flush(120);
  });

  it("exposes simple UI state setters (tabs, drawers, gallery, hover, search url)", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.setActiveTab("neighborhoods");
      result.current.setShowSlidersDrawer(true);
      result.current.setShowScrapeDrawer(true);
      result.current.setShowChatDrawer(true);
      result.current.setCustomSearchUrl("https://example.com/search");
      result.current.setGalleryState({ property: P1, initialIndex: 1 });
      result.current.setHoveredPropertyKey("quintoandar:1");
      result.current.setSelectedMapPropertyKey("quintoandar:1");
      result.current.setShowAdvancedFilters(true);
    });

    expect(result.current.activeTab).toBe("neighborhoods");
    expect(result.current.showSlidersDrawer).toBe(true);
    expect(result.current.showScrapeDrawer).toBe(true);
    expect(result.current.showChatDrawer).toBe(true);
    expect(result.current.customSearchUrl).toBe("https://example.com/search");
    expect(result.current.galleryState?.initialIndex).toBe(1);
    expect(result.current.galleryState?.property.id).toBe("1");
    expect(result.current.hoveredPropertyKey).toBe("quintoandar:1");
    expect(result.current.selectedMapPropertyKey).toBe("quintoandar:1");
    expect(result.current.showAdvancedFilters).toBe(true);
    expect(result.current.upsertBoundedRecord({ a: 1 }, "b", 2)).toEqual({ a: 1, b: 2 });

    act(() => {
      result.current.setGalleryState(null);
      result.current.setActiveTab("properties");
    });
    expect(result.current.galleryState).toBeNull();
    expect(result.current.activeTab).toBe("properties");
    await flush();
  });

  it("updates the mounted window from scroll position over the cards list", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    const container = document.createElement("div");
    for (let i = 0; i < 20; i++) {
      const article = document.createElement("article");
      article.dataset.cardIndex = String(i);
      const bottom = i < 5 ? -500 : 120;
      article.getBoundingClientRect = () =>
        ({
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          top: bottom - 100,
          left: 0,
          right: 100,
          bottom,
          toJSON: () => ({}),
        }) as DOMRect;
      container.appendChild(article);
    }
    document.body.appendChild(container);
    result.current.cardsListRef.current = container;

    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => {
        setTimeout(resolve, 60);
      });
    });

    expect(result.current.mountedWindow).toEqual({ start: 3, end: 19 });
    document.body.removeChild(container);
    result.current.cardsListRef.current = null;
  });
});

// ---------------------------------------------------------------------------
// Preferences persistence & sync
// ---------------------------------------------------------------------------

describe("usePortalController — preferences", () => {
  it("toggleFavorite updates state, localStorage and the debounced server save", async () => {
    const { result } = renderPortal(buildProps({ prefs: makePrefs() }));
    await flush();

    act(() => {
      result.current.toggleFavorite("quintoandar:1");
    });
    expect(result.current.favoriteKeys).toEqual(["quintoandar:1"]);
    expect(JSON.parse(localStorage.getItem("housing_favorites_v1") ?? "[]")).toEqual([
      "quintoandar:1",
    ]);

    await flush(900);
    const posts = callsTo("/api/preferences", "POST");
    expect(posts.length).toBeGreaterThanOrEqual(1);
    const saved = posts[posts.length - 1]!.body as unknown as {
      favorites: string[];
      activePresetId: string;
    };
    expect(saved.favorites).toEqual(["quintoandar:1"]);
    expect(saved.activePresetId).toBe("balanced-original");
    expect(localStorage.getItem("housing_preferences_updated_at_v1")).toBe(
      "2026-10-02T00:00:00.000Z",
    );

    act(() => {
      result.current.toggleFavorite("quintoandar:1");
    });
    expect(result.current.favoriteKeys).toEqual([]);
    expect(JSON.parse(localStorage.getItem("housing_favorites_v1") ?? "[]")).toEqual([]);
  });

  it("exposes no comparator surface and only feeds favorites into the query when the favorites filter is on", async () => {
    const { result } = renderPortal(buildProps({ prefs: makePrefs() }));
    await flush();
    // Comparator removed (bffc444): no compare state, handler or derived list.
    expect(result.current).not.toHaveProperty("compareKeys");
    expect(result.current).not.toHaveProperty("toggleCompare");
    expect(result.current).not.toHaveProperty("comparedProperties");
    expect(result.current).not.toHaveProperty("setCompareKeys");

    // Only favorites feed the query key when the favorites filter is on.
    act(() => {
      result.current.toggleFavorite("k:2");
      result.current.setOnlyFavorites(true);
    });
    expect(result.current.queryFavorites).toEqual(["k:2"]);
  });

  it("syncs newer server preferences when the window regains focus", async () => {
    const remote = makePrefs({
      filters: { searchQuery: "from-server" },
      weights: { budgetMax: 9100 },
      activePresetId: "server-preset",
      favorites: ["quintoandar:9"],
      updatedAt: "2027-02-01T00:00:00.000Z",
    });
    let serveRemote = false;
    preferencesGetHandler = async () =>
      serveRemote
        ? jsonRes({ ok: true, preferences: remote })
        : jsonRes({ ok: true });

    const { result } = renderPortal(buildProps({ prefs: makePrefs() }));
    await flush();
    expect(result.current.searchQuery).toBe("");

    serveRemote = true;
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await new Promise((resolve) => {
        setTimeout(resolve, 30);
      });
    });

    expect(result.current.searchQuery).toBe("from-server");
    expect(result.current.weights.budgetMax).toBe(9100);
    expect(result.current.activePresetId).toBe("server-preset");
    expect(result.current.favoriteKeys).toEqual(["quintoandar:9"]);
  });

  it("does not POST preferences back when the save endpoint is the source of the change", async () => {
    // Server prefs applied on mount must not echo back as a save.
    const prefs = makePrefs({
      filters: { searchQuery: "server-only" },
      updatedAt: "2026-10-01T12:00:00.000Z",
    });
    const { result } = renderPortal(buildProps({ prefs }));
    await flush(900);
    expect(result.current.searchQuery).toBe("server-only");
    expect(callsTo("/api/preferences", "POST")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Chat / QA
// ---------------------------------------------------------------------------

describe("usePortalController — chat and QA", () => {
  it("loads QA items, groups them by property and flags awaiting detailed answers", async () => {
    const awaiting = makeQaItem({
      id: "qa-await",
      status: "pending",
      answer: null,
      answeredAt: null,
      awaitingDetailedAnswer: true,
      answerSource: "instant_diagnostic",
    });
    const answered = makeQaItem({ id: "qa-done" });
    const general = makeQaItem({ id: "qa-general", propertyKey: "general" });
    qaGetHandler = async () => jsonRes({ ok: true, items: [awaiting, answered, general] });

    const { result } = renderPortal(buildProps());
    await flush(60);

    expect(result.current.qaItems.map((i) => i.id)).toEqual([
      "qa-await",
      "qa-done",
      "qa-general",
    ]);
    expect(result.current.qaItemsByPropertyKey.get("quintoandar:1")).toHaveLength(2);
    expect(result.current.qaItemsByPropertyKey.get("general")).toHaveLength(1);
    expect(result.current.hasAwaitingDetailedQa).toBe(true);
  });

  it("opens the chat drawer for a property and manages scroll targets and threads", async () => {
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.openChatForProperty("quintoandar:1");
    });
    expect(result.current.pinnedChatPropertyKey).toBe("quintoandar:1");
    expect(result.current.showChatDrawer).toBe(true);
    expect(result.current.chatScrollTargetKey).toBeNull();

    act(() => {
      result.current.openChatForProperty("quintoandar:2", true);
    });
    expect(result.current.chatScrollTargetKey).toBe("quintoandar:2");

    act(() => {
      result.current.handleConsumeChatScrollTarget();
      result.current.handleSelectChatThread(null);
    });
    expect(result.current.chatScrollTargetKey).toBeNull();
    expect(result.current.pinnedChatPropertyKey).toBeNull();

    act(() => {
      result.current.handleSelectChatThread("general");
    });
    expect(result.current.pinnedChatPropertyKey).toBe("general");
    await flush();
  });

  it("submitChatQuestion ignores blank questions and replaces the optimistic item on success", async () => {
    const serverItem = makeQaItem({ id: "srv-1", question: "Vale a pena?" });
    qaPostHandler = async (body) =>
      body?.action === "ask"
        ? jsonRes({ ok: true, item: serverItem })
        : jsonRes({ ok: true, items: [] });
    const { result } = renderPortal(buildProps());
    await flush();

    const asksBefore = callsTo("/api/qa", "POST").length;
    await act(async () => {
      const out = await result.current.submitChatQuestion({
        question: "   ",
        property: null,
      });
      expect(out).toBeUndefined();
    });
    expect(callsTo("/api/qa", "POST")).toHaveLength(asksBefore);

    let returned: unknown;
    await act(async () => {
      returned = await result.current.submitChatQuestion({
        question: "  Vale a pena? ",
        property: null,
      });
    });
    expect(returned).toBe(true);
    expect(result.current.isSubmittingChatQuestion).toBe(false);
    expect(result.current.qaItems.map((i) => i.id)).toEqual(["srv-1"]);
    const ask = callsTo("/api/qa", "POST").find((c) => c.body?.action === "ask");
    expect(ask?.body?.question).toBe("Vale a pena?");
    expect(ask?.body?.propertyKey).toBe("general");
  });

  it("submitChatQuestion loads full details for a slim property before asking", async () => {
    const full = { ...P1, detailsLoaded: true, description: "Descrição completa" };
    // Key-aware: the real endpoint only returns details for the requested keys.
    detailsPostHandler = async (body) =>
      jsonRes({
        items: (body?.keys as string[] | undefined)?.includes("quintoandar:1")
          ? [full]
          : [],
      });
    qaPostHandler = async (body) =>
      body?.action === "ask"
        ? jsonRes({ ok: true, items: [makeQaItem({ id: "srv-2" })] })
        : jsonRes({ ok: true, items: [] });
    const { result } = renderPortal(buildProps());
    await flush();

    await act(async () => {
      await result.current.submitChatQuestion({
        question: "Tem AC?",
        property: P1,
      });
    });

    // The submit-time details call must request exactly this property's key.
    const detailsCall = callsTo("/api/properties/details", "POST").find((c) =>
      (c.body?.keys as string[] | undefined)?.includes("quintoandar:1"),
    );
    expect(detailsCall?.body?.keys).toEqual(["quintoandar:1"]);
    const ask = callsTo("/api/qa", "POST").find((c) => c.body?.action === "ask");
    const snapshot = ask?.body?.propertySnapshot as { title?: string; description?: string } | undefined;
    expect(snapshot?.title).toBe(P1.title);
    expect(snapshot?.description).toBe("Descrição completa");
    expect(result.current.qaItems.map((i) => i.id)).toEqual(["srv-2"]);
  });

  it("submitChatQuestion removes the optimistic item and rethrows on server errors", async () => {
    qaPostHandler = async () => jsonRes({ ok: false, error: "Falha QA" });
    const { result } = renderPortal(buildProps());
    await flush();

    await act(async () => {
      await expect(
        result.current.submitChatQuestion({ question: "Oi?", property: null }),
      ).rejects.toThrow("Falha QA");
    });
    expect(result.current.qaItems).toEqual([]);
    expect(result.current.isSubmittingChatQuestion).toBe(false);
  });

  it("deletePropertyQuestion and clearChatHistory update QA state via the API", async () => {
    const a = makeQaItem({ id: "qa-a" });
    const b = makeQaItem({ id: "qa-b", propertyKey: "general" });
    qaGetHandler = async () => jsonRes({ ok: true, items: [a, b] });
    qaPostHandler = async (body) => {
      if (body?.action === "delete") return jsonRes({ ok: true, items: [b] });
      return jsonRes({ ok: true, items: [] });
    };
    const { result } = renderPortal(buildProps());
    await flush(60);
    expect(result.current.qaItems).toHaveLength(2);

    await act(async () => {
      await result.current.deletePropertyQuestion("qa-a");
    });
    expect(result.current.qaItems.map((i) => i.id)).toEqual(["qa-b"]);

    await act(async () => {
      await result.current.clearChatHistory();
    });
    expect(result.current.qaItems).toEqual([]);
    const actions = callsTo("/api/qa", "POST").map((c) => c.body?.action);
    expect(actions).toContain("delete");
    expect(actions).toContain("clear");
  });
});

// ---------------------------------------------------------------------------
// Scrape jobs
// ---------------------------------------------------------------------------

describe("usePortalController — scrape jobs", () => {
  it("toggleScrapeCity keeps at least one city and start/cancel update status", async () => {
    scrapeRunHandler = async (body) => {
      if (body?.action === "cancel") {
        return jsonRes({ ok: true, status: { jobId: "none", status: "idle" } });
      }
      return jsonRes({
        ok: true,
        status: { jobId: "job-9", status: "running", mode: "full_sync" },
      });
    };
    const { result } = renderPortal(buildProps());
    await flush();
    expect(result.current.scrapeCities).toEqual(["BH", "RJ", "CP", "SP"]);
    expect(result.current.scrapeStatus.status).toBe("idle");

    act(() => {
      result.current.toggleScrapeCity("SP");
    });
    expect(result.current.scrapeCities).toEqual(["BH", "RJ", "CP"]);
    act(() => {
      result.current.toggleScrapeCity("BH");
      result.current.toggleScrapeCity("RJ");
    });
    expect(result.current.scrapeCities).toEqual(["CP"]);
    act(() => {
      result.current.toggleScrapeCity("CP");
    });
    // The last remaining city cannot be removed.
    expect(result.current.scrapeCities).toEqual(["CP"]);
    act(() => {
      result.current.toggleScrapeCity("SP");
    });
    expect(result.current.scrapeCities).toEqual(["CP", "SP"]);

    await act(async () => {
      await result.current.startScrapeJob({ mode: "full_sync", cities: ["BH"] });
    });
    expect(result.current.scrapeStatus).toMatchObject({ jobId: "job-9", status: "running" });
    expect(result.current.isStartingScrape).toBe(false);
    const run = callsTo("/api/scrape/run", "POST")[0];
    expect(run?.body?.action).toBe("start");
    expect(run?.body?.mode).toBe("full_sync");

    await act(async () => {
      await result.current.cancelScrapeJob();
    });
    expect(result.current.scrapeStatus.status).toBe("idle");
  });

  it("polls a running scrape job and refreshes the dataset when it completes", async () => {
    let statusCalls = 0;
    scrapeStatusHandler = async () => {
      statusCalls += 1;
      // First mount poll is idle; subsequent polls report completion.
      return jsonRes({
        jobId: "job-9",
        status: statusCalls <= 1 ? "idle" : "completed",
      });
    };
    scrapeRunHandler = async () =>
      jsonRes({ ok: true, status: { jobId: "job-9", status: "running" } });

    const { result } = renderPortal(buildProps());
    await flush();

    await act(async () => {
      await result.current.startScrapeJob({ mode: "verify_only" });
    });
    expect(result.current.scrapeStatus.status).toBe("running");

    await flush(1800);
    expect(result.current.scrapeStatus.status).toBe("completed");
  });
});

// ---------------------------------------------------------------------------
// Details, photos and copy
// ---------------------------------------------------------------------------

describe("usePortalController — details, photos and copy", () => {
  it("loads full details and extra photos for the expanded property and reuses them for the pinned chat property", async () => {
    const full = { ...P1, detailsLoaded: true, description: "Descrição completa" };
    detailsPostHandler = async () => jsonRes({ items: [full] });
    const manyPhotos = Array.from({ length: 8 }, (_, i) => ({
      room: null,
      url: `https://example.com/extra-${i}.jpg`,
    }));
    mockedFetchPhotos.mockResolvedValue(manyPhotos);
    mockedCachedDescription.mockReturnValue("Descrição em cache");

    const { result } = renderPortal(buildProps({ prefs: makePrefs() }));
    await flush();

    act(() => {
      result.current.setExpandedId("quintoandar:1");
    });
    await flush(80);

    expect(callsTo("/api/properties/details", "POST").length).toBeGreaterThanOrEqual(1);
    expect(result.current.displayedProperties[0]?.description).toBe("Descrição completa");
    expect(result.current.extraPhotosByKey["quintoandar:1"]).toHaveLength(8);
    expect(result.current.extraDescriptionsByKey["quintoandar:1"]).toBe("Descrição em cache");
    expect(mockedFetchPhotos).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "quintoandar", id: "1" }),
    );

    act(() => {
      result.current.openChatForProperty("quintoandar:1");
    });
    // Pinned property prefers the longer extra-photo set.
    expect(result.current.pinnedChatProperty?.samplePhotos).toHaveLength(8);
    await flush();
  });

  it("tolerates empty detail responses for unknown expanded keys", async () => {
    detailsPostHandler = async () => jsonRes({ items: [] });
    const { result } = renderPortal(buildProps());
    await flush();

    act(() => {
      result.current.setExpandedId("quintoandar:missing");
    });
    await flush(60);
    expect(callsTo("/api/properties/details", "POST").length).toBeGreaterThanOrEqual(1);
    expect(result.current.displayedProperties.map((p) => p.id)).toEqual(["1", "2"]);
  });

  it("handleCopyTop50ForAi copies the server-built text and flags the copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    propertiesPostHandler = async (body) => {
      if (body?.mode === "copyTop50") {
        return jsonRes({
          ok: true,
          datasetHash: "hash-1",
          total: 2,
          offset: 0,
          items: [],
          text: "TOP50 TEXT",
        });
      }
      return defaultPropertiesPost(body);
    };
    const { result } = renderPortal(buildProps());
    await flush();

    await act(async () => {
      await result.current.handleCopyTop50ForAi();
    });
    expect(writeText).toHaveBeenCalledWith("TOP50 TEXT");
    expect(result.current.copiedTop50Count).toBe(2);
    const copyCall = callsTo("/api/properties", "POST").find(
      (c) => c.body?.mode === "copyTop50",
    );
    expect(copyCall).toBeTruthy();
  });

  it("handleCopyTop50ForAi falls back to a textarea copy and does nothing for an empty result set", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    const execCommand = vi.fn(() => true);
    (document as unknown as { execCommand: unknown }).execCommand = execCommand;
    propertiesPostHandler = async (body) => {
      if (body?.mode === "copyTop50") {
        return jsonRes({
          ok: true,
          datasetHash: "hash-1",
          total: 2,
          offset: 0,
          items: [],
          text: "FALLBACK TEXT",
        });
      }
      return defaultPropertiesPost(body);
    };
    const { result } = renderPortal(buildProps());
    await flush();

    await act(async () => {
      await result.current.handleCopyTop50ForAi();
    });
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(result.current.copiedTop50Count).toBe(2);

    // Empty result set: early return, no extra server copy request.
    const empty = renderPortal(buildProps({ items: [], total: 0 }));
    await flush();
    const before = callsTo("/api/properties", "POST").filter(
      (c) => c.body?.mode === "copyTop50",
    ).length;
    await act(async () => {
      await empty.result.current.handleCopyTop50ForAi();
    });
    expect(
      callsTo("/api/properties", "POST").filter((c) => c.body?.mode === "copyTop50"),
    ).toHaveLength(before);
    expect(empty.result.current.copiedTop50Count).toBeNull();
  });

  it("keeps serializeExplorerFilters round-trip visible through queryFilters", async () => {
    const prefs = makePrefs({
      filters: serializeExplorerFilters(
        parseExplorerFiltersObject({ selectedCities: ["RJ"], maxTotalMonthly: 6000 }),
      ) as unknown as Record<string, unknown>,
    });
    const { result } = renderPortal(buildProps({ prefs }));
    await flush();
    expect(result.current.queryFilters.selectedCities).toEqual(["RJ"]);
    expect(result.current.queryFilters.maxTotalMonthly).toBe(6000);
  });
});
