import {
  DEFAULT_EXPLORER_FILTERS,
  filterAndSortProperties,
  matchesPropertyFeature,
} from "@/components/moradia-portal";
import {
  computeDynamicNeighborhoods,
  computeDynamicProperties,
  DEFAULT_WEIGHTS,
} from "@/lib/scoring-engine";
import type { NeighborhoodEntry, SlimPropertyRecord } from "@/types/moradia";
import { describe, expect, it } from "vitest";

const sampleNeighborhoods: NeighborhoodEntry[] = [
  {
    cityCode: "RJ",
    cityName: "Rio de Janeiro - RJ",
    neighborhood: "Botafogo (Orla)",
    overallPosition: 1,
    cityPosition: 1,
    baseScore: 8.6,
    idhm: 0.95,
    commuteTime: "20 min",
    nubankHub: "Porto Maravilha",
    urbanBreathingScore: 8.5,
    commuteLogisticsScore: 8.5,
    buildingStockFitScore: 8.0,
    budgetFitScore: 8.0,
    safetyCarScore: 8.2,
    shortRationale: "Zona Sul RJ",
    detailedJustification: "Excelente",
    pros: [],
    cons: [],
  },
  {
    cityCode: "CP",
    cityName: "Campinas - SP",
    neighborhood: "Botafogo",
    overallPosition: 10,
    cityPosition: 5,
    baseScore: 7.4,
    idhm: 0.88,
    commuteTime: "25 min",
    nubankHub: "Viracopos",
    urbanBreathingScore: 7.2,
    commuteLogisticsScore: 7.5,
    buildingStockFitScore: 7.5,
    budgetFitScore: 8.0,
    safetyCarScore: 7.2,
    shortRationale: "Centro Campinas",
    detailedJustification: "Bom",
    pros: [],
    cons: [],
  },
];

function makeProperty(
  overrides: Partial<SlimPropertyRecord>,
): SlimPropertyRecord {
  return {
    provider: "quintoandar",
    id: "prop-1",
    cityCode: "RJ",
    city: "Rio de Janeiro",
    neighborhood: "Botafogo",
    street: "Rua Voluntários da Pátria",
    streetNumber: "100",
    condominiumName: "Ed. Teste",
    doorman: null,
    url: "https://www.quintoandar.com.br/imovel/1/alugar",
    title: "Apartamento reformado",
    rent: 3200,
    condoFee: 700,
    iptu: 200,
    totalMonthly: 4100,
    salePrice: null,
    areaM2: 56,
    bedrooms: 2,
    suites: 1,
    bathrooms: 2,
    parkingSpaces: 1,
    floor: 8,
    floorRange: null,
    totalFloors: 12,
    furnished: false,
    acceptsPets: true,
    nearSubway: true,
    constructionYear: 2018,
    condition: "NEW_OR_RENOVATED",
    installations: ["Elevador"],
    amenities: [],
    comfortCommodities: [],
    practicalityCommodities: [],
    placesNearby: [],
    photoCaptions: ["Sala"],
    photosCount: 10,
    modernityScore: 85,
    modernityTier: "MODERN_OR_RENOVATED",
    positiveSignals: ["Reformado / Moderno"],
    negativeSignals: [],
    samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    description: "Apartamento amplo e reformado com elevador.",
    generatedDescription: null,
    sourceSearch: "Botafogo",
    isNewEntry: false,
    isActive: true,
    deactivatedAt: null,
    ...overrides,
  };
}

describe("Portal Filters & Feature Matching", () => {
  const { ranked: rankedNbs } = computeDynamicNeighborhoods(
    sampleNeighborhoods,
    DEFAULT_WEIGHTS,
  );

  it("distinguishes city-qualified neighborhood filters (RJ:Botafogo vs CP:Botafogo) while keeping plain neighborhood strings backwards-compatible", () => {
    const rjBotafogo = makeProperty({
      id: "rj-botafogo-1",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Botafogo",
    });
    const cpBotafogo = makeProperty({
      id: "cp-botafogo-1",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Botafogo",
    });

    const evaluated = computeDynamicProperties(
      [rjBotafogo, cpBotafogo],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );

    const onlyRj = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      onlyTop20Neighborhoods: false,
      selectedNeighborhoods: ["RJ:Botafogo"],
    });
    expect(onlyRj.map((p) => p.id)).toEqual(["rj-botafogo-1"]);

    const onlyCp = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      onlyTop20Neighborhoods: false,
      selectedNeighborhoods: ["CP:Botafogo"],
    });
    expect(onlyCp.map((p) => p.id)).toEqual(["cp-botafogo-1"]);

    const plainBackwardsCompat = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      onlyTop20Neighborhoods: false,
      selectedNeighborhoods: ["Botafogo"],
    });
    expect(plainBackwardsCompat.map((p) => p.id).sort()).toEqual([
      "cp-botafogo-1",
      "rj-botafogo-1",
    ]);
  });

  it("enforces strict 24h doorman evidence in matchesPropertyFeature('doorman_24h') without matching biometria or portaria virtual alone", () => {
    const biometriaOnly = makeProperty({
      id: "bio-only",
      doorman: null,
      description: "Acesso com fechadura biométrica, biometria e portaria virtual.",
      practicalityCommodities: ["Fechadura biométrica"],
    });
    const real24hDoorman = makeProperty({
      id: "doorman-24h",
      doorman: "24h",
      description: "Condomínio com portaria 24 horas.",
    });
    const textPortaria24 = makeProperty({
      id: "text-24h",
      doorman: null,
      description: "Prédio excelente com guarita 24h e elevador.",
    });

    const evaluated = computeDynamicProperties(
      [biometriaOnly, real24hDoorman, textPortaria24],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );

    const evalBio = evaluated.find((p) => p.id === "bio-only")!;
    const evalReal = evaluated.find((p) => p.id === "doorman-24h")!;
    const evalText = evaluated.find((p) => p.id === "text-24h")!;

    expect(matchesPropertyFeature(evalBio, "doorman_24h")).toBe(false);
    expect(matchesPropertyFeature(evalReal, "doorman_24h")).toBe(true);
    expect(matchesPropertyFeature(evalText, "doorman_24h")).toBe(true);
  });
});
