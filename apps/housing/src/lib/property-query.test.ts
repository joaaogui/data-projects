import { describe, expect, it } from "vitest";
import {
  getCardPhotoUrl,
  getHighResPhotoUrl,
  getThumbPhotoUrl,
} from "@/components/property-photo-showcase";
import {
  filterAndSortProperties,
  formatTopPropertiesForAiPrompt,
  parseExplorerFiltersObject,
} from "@/lib/property-filters";
import {
  buildQueryKey,
  coerceWeights,
  runPropertyQuery,
  toExplorerFilters,
  toQueryFilters,
  type PropertyQueryRequest,
  type ScoredSet,
} from "@/lib/property-query";
import {
  computeDynamicNeighborhoods,
  computeDynamicProperties,
  DEFAULT_WEIGHTS,
} from "@/lib/scoring-engine";
import type { NeighborhoodEntry, SlimPropertyRecord } from "@/types/housing";

const NBS: NeighborhoodEntry[] = [
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
    shortRationale: "Casamento perfeito.",
    detailedJustification: "A 10 min do Nubank.",
    pros: ["Perto"],
    cons: ["Flats antigos"],
  },
];

function listing(i: number, overrides: Partial<SlimPropertyRecord> = {}): SlimPropertyRecord {
  return {
    provider: "quintoandar",
    id: String(1000 + i),
    cityCode: "BH",
    city: "Belo Horizonte",
    neighborhood: "Funcionários",
    street: `Rua ${i}`,
    streetNumber: String(i),
    condominiumName: null,
    doorman: null,
    url: `https://www.quintoandar.com.br/imovel/${1000 + i}/alugar`,
    title: "Apartamento",
    rent: 2500 + i * 100,
    condoFee: 500,
    iptu: 150,
    totalMonthly: 3150 + i * 100,
    salePrice: null,
    areaM2: 50 + i,
    bedrooms: 2,
    suites: 1,
    bathrooms: 1,
    parkingSpaces: i % 3 === 0 ? 0 : 1,
    floor: 5 + i,
    floorRange: null,
    totalFloors: 20,
    furnished: false,
    acceptsPets: true,
    nearSubway: false,
    constructionYear: 2015,
    condition: null,
    installations: ["Elevador"],
    amenities: [],
    comfortCommodities: [],
    practicalityCommodities: [],
    placesNearby: [],
    photoCaptions: [],
    photosCount: 6,
    modernityScore: 80,
    modernityTier: "MODERN_OR_RENOVATED",
    positiveSignals: [],
    negativeSignals: [],
    samplePhotos: Array.from({ length: 6 }, (_, k) => ({ room: null, url: `https://x/${i}/${k}.jpg` })),
    description: `Apartamento ${i} com varanda e piscina no condomínio.`,
    generatedDescription: null,
    sourceSearch: null,
    isNewEntry: false,
    ...overrides,
  };
}

function scoredSet(props: SlimPropertyRecord[]): ScoredSet {
  const { ranked } = computeDynamicNeighborhoods(NBS, DEFAULT_WEIGHTS);
  return {
    datasetHash: "test",
    properties: computeDynamicProperties(props, ranked, DEFAULT_WEIGHTS),
    ranked,
    filtered: new Map(),
  };
}

const PROPS = Array.from({ length: 12 }, (_, i) => listing(i));

function request(raw: Record<string, unknown>, extra: Partial<PropertyQueryRequest> = {}): PropertyQueryRequest {
  return {
    filters: toQueryFilters(parseExplorerFiltersObject(raw)),
    weights: DEFAULT_WEIGHTS,
    favorites: [],
    ...extra,
  };
}

describe("server-side property query", () => {
  it("pages through exactly the client-side filter/sort result", () => {
    const set = scoredSet(PROPS);
    const req = request({ showIneligible: true, maxTotalMonthly: null, sortBy: "price_desc" });
    const expected = filterAndSortProperties(set.properties, toExplorerFilters(req.filters, [])).map(
      (p) => p.id,
    );
    const page1 = runPropertyQuery(set, { ...req, offset: 0, limit: 5 });
    const page2 = runPropertyQuery(set, { ...req, offset: 5, limit: 5 });
    const page3 = runPropertyQuery(set, { ...req, offset: 10, limit: 5 });
    expect(page1.total).toBe(expected.length);
    expect([...page1.items, ...page2.items, ...page3.items].map((p) => p.id)).toEqual(expected);
  });

  it("ships slim cards: heavy text stripped, 3 photos, score fields intact", () => {
    const set = scoredSet(PROPS);
    const [card] = runPropertyQuery(set, request({ maxTotalMonthly: null }, { limit: 1 })).items;
    const full = set.properties.find((p) => p.id === card!.id)!;
    expect(card!.description).toBeNull();
    expect(card!.amenities).toEqual([]);
    expect(card!.narrativeJustification).toBe("");
    expect(card!.samplePhotos).toHaveLength(3);
    expect(card!.shortJustification).toBe(full.shortJustification);
    expect(card!.finalScore).toBe(full.finalScore);
    expect(card!.cardTags).toEqual(full.cardTags);
    expect(card!.breakdown).toEqual(full.breakdown);
  });

  it("only uses favorites (and only keys on them) when filtering by favorites", () => {
    const set = scoredSet(PROPS);
    const fav = [`quintoandar:${PROPS[4]!.id}`];
    const withFav = runPropertyQuery(set, request({ onlyFavorites: true }, { favorites: fav }));
    expect(withFav.items.map((p) => p.id)).toEqual([PROPS[4]!.id]);
    const base = request({});
    expect(buildQueryKey({ ...base, favorites: fav })).toBe(buildQueryKey(base));
  });

  it("builds Copy Top 50 text on the server from the same ranking", () => {
    const set = scoredSet(PROPS);
    const req = request({ maxTotalMonthly: null }, { mode: "copyTop50", activeFilterLabels: ["X"] });
    const res = runPropertyQuery(set, req);
    const expected = formatTopPropertiesForAiPrompt(
      filterAndSortProperties(set.properties, toExplorerFilters(req.filters, [])),
      { activeFilterLabels: ["X"], favoriteKeys: new Set(), limit: 50 },
    );
    expect(res.text).toBe(expected);
  });

  it("keeps client weights verbatim (no migration) and drops invalid values", () => {
    const w = coerceWeights({ ...DEFAULT_WEIGHTS, minAreaM2: 40, budgetIdeal: "x", bogus: 1 });
    expect(w.minAreaM2).toBe(40);
    expect(w.budgetIdeal).toBe(DEFAULT_WEIGHTS.budgetIdeal);
    expect("bogus" in w).toBe(false);
  });
});

describe("card photo URLs", () => {
  it("requests QuintoAndar photos on www directly (the bare host answers with a 301)", () => {
    const bare = "https://quintoandar.com.br/img/xxl/original895534031-751.jpg";
    expect(getCardPhotoUrl(bare)).toBe("https://www.quintoandar.com.br/img/med/original895534031-751.jpg");
    expect(getThumbPhotoUrl(bare)).toBe("https://www.quintoandar.com.br/img/med/original895534031-751.jpg");
    expect(getHighResPhotoUrl(bare)).toBe("https://www.quintoandar.com.br/img/xxl/original895534031-751.jpg");
    const zap = "https://resizedimgs.zapimoveis.com.br/img/vr-listing/x/foto.webp?action=fit-in&dimension=1920x1440";
    expect(getCardPhotoUrl(zap)).toContain("dimension=480x360");
  });
});
