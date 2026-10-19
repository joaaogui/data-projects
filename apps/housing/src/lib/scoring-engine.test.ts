import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AC_ABSENT_TAG,
  AC_INFRA_ONLY_TAG,
  AC_UNCONFIRMED_TAG,
  AC_WINDOW_TAG,
  BUILTIN_PRESETS,
  computeCpFarCommutePenalty,
  DUPLEX_LAYOUT_TAG,
  SERVICED_FLAT_TAG,
  STUDIO_LAYOUT_TAG,
  canNegotiateFurnitureRemoval,
  categorizePropertyFeatures,
  classifyFurnitureTier,
  computeDynamicNeighborhoods,
  computeDynamicProperties,
  computeListingAge,
  computeWeightedNeighborhoodScore,
  DEFAULT_WEIGHTS,
  describeFurnitureInText,
  detectArterialOrBorderBunker,
  evaluateStreetMicroEnvironment,
  extractExplicitFloorFromText,
  FURNITURE_CONFLICT_TAG,
  hasActiveSaleListing,
  HOSPITAL_NOISE_TAG,
  PRICE_MISMATCH_TAG,
  isApartHotelListing,
  parseCommuteMinutes,
  precomputeListingFeatures,
  resolveCpFarCommute,
  resolveCurrentPublicationIso,
  sanitizeAndMigrateWeights,
  scorePrecomputedListings,
  TAQUARAL_FAR_FROM_LAGOA_TAG,
  TAQUARAL_FAR_FROM_LAGOA_URBAN_BREATHING,
  TAQUARAL_NEAR_LAGOA_TAG,
} from "./scoring-engine";
import {
  buildBenchmarkStats,
  DEFAULT_EXPLORER_FILTERS,
  filterAndSortProperties,
  formatTopPropertiesForAiPrompt,
  isStrictlyInTop20Neighborhoods,
  matchesFloorFilter,
  matchesPropertyFeature,
  parseExplorerFiltersObject,
} from "@/components/housing-portal";
import {
  getCardPhotoUrl,
  getFallbackPhotoUrl,
  getHighResPhotoUrl,
} from "@/components/property-photo-showcase";
import {
  extractPhotosFromHtml,
  isValidAllowedListingUrl,
} from "@/app/api/photos/route";
import {
  formatPinPriceCompact,
  resolveDisplayPoints,
} from "@/components/property-map-view";
import {
  ALL_NUBANK_HUB_LOCATIONS,
  computeDistanceToNubankHubKm,
  findHospitalNoiseCluster,
  isCoordinateInsideCityBox,
  isNearTaquaralLagoa,
  NUBANK_HUBS,
  resolveInstantPropertyCoordinate,
} from "@/lib/geocoding";
import {
  applyListingDeactivations,
  isQuintoAndarUnavailableHtml,
} from "@/lib/listing-deactivations";
import {
  cleanListingText,
  extractDescriptionRent,
  findCrossPortalDuplicateGroups,
  prepareListingsForScoring,
} from "@/lib/listing-normalization";
import {
  PHOTO_AUDIT_OVERRIDES,
  type PhotoAuditOverride,
} from "@/lib/photo-audit-overrides";
import type { NeighborhoodEntry, SlimPropertyRecord } from "@/types/housing";

const SAMPLE_NEIGHBORHOODS: NeighborhoodEntry[] = [
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
  {
    cityCode: "CP",
    cityName: "Campinas",
    neighborhood: "Taquaral",
    overallPosition: 3,
    cityPosition: 1,
    baseScore: 8.9,
    idhm: 0.93,
    commuteTime: "35-40 min",
    nubankHub: "Bresco Viracopos",
    urbanBreathingScore: 9.8,
    commuteLogisticsScore: 6.5,
    buildingStockFitScore: 9.2,
    budgetFitScore: 9.4,
    safetyCarScore: 9.2,
    shortRationale: "Lagoa do Taquaral.",
    detailedJustification: "35 min via rodovia.",
    pros: ["Parque"],
    cons: ["Longe"],
  },
];

const SAMPLE_PROPERTIES: SlimPropertyRecord[] = [
  {
    provider: "quintoandar",
    id: "893127481",
    cityCode: "BH",
    city: "Belo Horizonte",
    neighborhood: "Santa Efigênia",
    street: "Rua Padre Marinho",
    streetNumber: "318",
    condominiumName: "Ed. Home Residence",
    url: "https://www.quintoandar.com.br/imovel/893127481/alugar",
    title: "Apto novo",
    rent: 3190,
    condoFee: 586,
    iptu: 267,
    totalMonthly: 4168,
    areaM2: 47,
    bedrooms: 1,
    suites: 1,
    bathrooms: 1,
    parkingSpaces: 1,
    floor: 17,
    floorRange: { min: 16, max: 19 },
    totalFloors: 20,
    furnished: false,
    acceptsPets: true,
    nearSubway: true,
    constructionYear: 2019,
    condition: "NEW_OR_RENOVATED",
    doorman: "NightAndDayShift",
    salePrice: null,
    installations: ["Elevador", "Piscina", "Academia", "PORTARIA_24H"],
    amenities: ["Box", "Varanda", "Área de serviço"],
    comfortCommodities: ["Sol da manhã", "Vista livre", "Rua silenciosa"],
    practicalityCommodities: ["Fogão cooktop", "Fechadura eletrônica"],
    placesNearby: [{ name: "Praça da Liberdade", type: "PARK_OR_GREEN_AREA" }],
    photoCaptions: ["Sala", "Cozinha", "Varanda"],
    photosCount: 34,
    modernityScore: 100,
    modernityTier: "MODERN_OR_RENOVATED",
    positiveSignals: ["Construção recente (2019)", "Fechadura eletrônica / USB"],
    negativeSignals: [],
    samplePhotos: [],
    description: "Imóvel novo com 1 vaga livre.",
    generatedDescription: "Próximo à Praça da Liberdade.",
    sourceSearch: "Santa Efigênia",
    isNewEntry: false,
  },
  {
    provider: "quintoandar",
    id: "895740524",
    cityCode: "BH",
    city: "Belo Horizonte",
    neighborhood: "Funcionários",
    street: "Rua São Paulo",
    streetNumber: "1654",
    condominiumName: "Alcione",
    doorman: null,
    url: "https://www.quintoandar.com.br/imovel/895740524/alugar",
    title: "Apto antigo",
    rent: 3100,
    condoFee: 900,
    iptu: 190,
    totalMonthly: 4312,
    salePrice: null,
    areaM2: 70,
    bedrooms: 1,
    suites: 1,
    bathrooms: 1,
    parkingSpaces: 1,
    floor: 2,
    floorRange: null,
    totalFloors: 10,
    furnished: false,
    acceptsPets: true,
    nearSubway: false,
    constructionYear: 1978,
    condition: null,
    installations: [],
    amenities: [],
    comfortCommodities: [],
    practicalityCommodities: [],
    placesNearby: [],
    photoCaptions: [],
    photosCount: 8,
    modernityScore: 26,
    modernityTier: "DATED",
    positiveSignals: [],
    negativeSignals: ["Construção antiga (1978)"],
    samplePhotos: [],
    description: "Apto amplo.",
    generatedDescription: null,
    sourceSearch: "Lourdes",
    isNewEntry: false,
  },
];

describe("Housing Dynamic Scoring Engine", () => {
  it("recalculates neighborhood rankings and justifications when sub-weights change", () => {
    const { ranked } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    expect(ranked[0]?.neighborhood).toBe("Funcionários");
    expect(ranked[0]?.dynamicJustification).toContain("Nota Dinâmica");

    // Breathing-only weights: the calibration table caps Taquaral's catalog 9.8 at 6.3, so Funcionários (9.5) stays first
    const parkWeights = {
      ...DEFAULT_WEIGHTS,
      urbanBreathingWeight: 2.5,
      commuteLogisticsWeight: 0,
      buildingStockWeight: 0,
      budgetFitWeight: 0,
      safetyCarWeight: 0,
    };
    const { ranked: parkRanked } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      parkWeights,
    );
    expect(parkRanked[0]?.neighborhood).toBe("Funcionários");
    const taquaral = (list: typeof ranked) =>
      list.find((n) => n.neighborhood === "Taquaral")!.dynamicScore;
    expect(taquaral(parkRanked)).not.toBe(taquaral(ranked));
    expect(taquaral(parkRanked)).toBeLessThan(taquaral(ranked));
  });

  it("evaluates properties with full score breakdown and eligibility", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const results = computeDynamicProperties(
      SAMPLE_PROPERTIES,
      nbs,
      DEFAULT_WEIGHTS,
    );

    const top = results.find((p) => p.id === "893127481")!;
    const dated = results.find((p) => p.id === "895740524")!;

    expect(top.eligible).toBe(true);
    expect(top.overallRank).toBe(1);
    // shortJustification always produces 2 sentences: 1 positive sentence + 1 negative/caveat sentence
    expect(top.shortJustification).toContain("fechadura eletrônica");
    expect(top.shortJustification).toContain("cooktop");
    expect(top.shortJustification).toContain("varanda");
    expect(top.shortJustification).toContain("portaria 24h");
    expect(top.shortJustification).toContain("Praça da Liberdade");
    expect(top.shortJustification).toContain("5 min do escritório do Nubank");
    expect(top.shortJustification).toContain("folga confortável no orçamento.");
    expect(top.shortJustification).not.toMatch(/\b(Por outro lado,|Em contrapartida,)/i);
    expect(top.shortJustification).not.toContain("sem ar-condicionado instalado");
    expect(top.shortJustification).toMatch(/fluxo intenso do entorno hospitalar durante o dia/i);
    // Must NOT repeat neighborhood, price, area, room/parking counts, or badge labels already on the card
    expect(top.shortJustification).not.toContain("Santa Efigênia");
    expect(top.shortJustification).not.toMatch(/R\$/);
    expect(top.shortJustification).not.toMatch(/\d+\s*m²/);
    expect(top.shortJustification).not.toContain("1 quarto");
    expect(top.shortJustification).not.toContain("1 vaga");
    expect(top.shortJustification).not.toContain("Andar alto");
    expect(top.shortJustification).not.toContain("Vista livre");
    expect(top.shortJustification).not.toContain("Prédio Novo");
    expect(top.shortJustification).not.toContain("100/100");

    // narrativeJustification focuses on analytical synthesis & trade-offs without repeating raw specs/badges
    expect(top.narrativeJustification).toContain("5 min do escritório do Nubank");
    expect(top.narrativeJustification).toContain("fechadura eletrônica");
    expect(top.narrativeJustification).toContain("mudança de Brasília");
    expect(top.narrativeJustification).toContain("Checklist para visita:");
    expect(top.narrativeJustification).not.toContain("Santa Efigênia");
    expect(top.narrativeJustification).not.toMatch(/R\$/);
    expect(top.narrativeJustification).not.toMatch(/\d+\s*m²/);
    expect(top.narrativeJustification).not.toContain("1 quarto");
    expect(top.narrativeJustification).not.toContain("1 vaga");
    expect(top.narrativeJustification).not.toContain("[Bairro");
    expect(top.narrativeJustification).not.toContain("× peso");

    expect(top.detailedJustification).toContain("[Bairro");
    expect(top.detailedJustification).toContain("Fechadura eletrônica / USB");
    expect(top.cardTags.highFloorLabel).toBe("Andar alto (17º andar)");
    expect(top.cardTags.lowFloorLabel).toBeNull();
    expect(top.cardTags.floorTag).toEqual({
      label: "Andar alto (17º andar)",
      rarity: "epic",
    });
    expect(top.cardTags.greenTags).not.toContain("Andar alto (17º andar)");
    // "Vista livre" is only a checkbox here (no text confirmation), so morning sun takes the pill.
    expect(top.cardTags.greenTags).not.toContain("Vista livre");
    expect(top.cardTags.greenTags).toContain("Sol da manhã");
    expect(top.cardTags.greenTags).toContain("Prédio Novo (2019)");

    expect(dated.eligible).toBe(true);
    expect(dated.exclusionReason).toBeNull();
    expect(dated.breakdown.modernityPoints).toBeLessThan(0);
    expect(dated.shortJustification).toContain("10 min do escritório do Nubank");
    expect(dated.shortJustification).not.toMatch(/\b(Por outro lado,|Em contrapartida,)/i);
    expect(dated.shortJustification).toMatch(/fica em andar baixo/i);
    expect(dated.shortJustification).not.toContain("Funcionários");
    expect(dated.shortJustification).not.toMatch(/R\$/);
    expect(dated.shortJustification).not.toMatch(/\d+\s*m²/);
    expect(dated.cardTags.lowFloorLabel).toBe("Andar baixo (2º andar)");
    expect(dated.cardTags.floorTag).toEqual({
      label: "Andar baixo (2º andar)",
      rarity: "uncommon",
    });
    expect(dated.cardTags.redTags).not.toContain("Andar baixo (2º andar)");
    expect(dated.cardTags.redTags).not.toContain("Sem elevador");
    expect(BUILTIN_PRESETS.length).toBeGreaterThanOrEqual(4);
  });

  it("normalizes and deduplicates interior vs. condominium features without repeating card pills", () => {
    const sampleWithOverlap: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      installations: ["Elevador", "ELEVADOR", "PORTARIA_24H", "Piscina"],
      amenities: [
        "Box",
        "Armários na cozinha",
        "Ar condicionado",
        "POOL",
        "CONCIERGE_24H",
        "GARAGE",
        "FURNISHED",
        "GOURMET_BALCONY",
      ],
      comfortCommodities: ["Sol da manhã", "Vista livre", "Rua silenciosa"],
      practicalityCommodities: ["Box", "Armários na cozinha", "Fogão cooktop"],
    };

    const { interiorFeatures, condoFeatures } =
      categorizePropertyFeatures(sampleWithOverlap);

    expect(interiorFeatures).toContain("Rua silenciosa");
    expect(interiorFeatures).toContain("Armários na cozinha");
    expect(interiorFeatures).toContain("Fogão cooktop");
    expect(interiorFeatures).toContain("Varanda gourmet");
    // Top-level card pills (Sol da manhã, Vista livre, Ar-condicionado) and raw spec tokens (GARAGE, FURNISHED) are omitted
    expect(interiorFeatures).not.toContain("Sol da manhã");
    expect(interiorFeatures).not.toContain("Vista livre");
    expect(interiorFeatures).not.toContain("Ar condicionado");
    expect(interiorFeatures).not.toContain("Garagem");

    // Condo features are deduplicated across case/underscore/English variants and don't overlap with interiorFeatures
    expect(condoFeatures).toContain("Elevador");
    expect(condoFeatures.filter((x) => x.toLowerCase() === "elevador")).toHaveLength(1);
    expect(condoFeatures).toContain("Portaria 24h");
    expect(condoFeatures.filter((x) => x.toLowerCase().includes("portaria"))).toHaveLength(1);
    expect(condoFeatures).toContain("Piscina");
    expect(condoFeatures.filter((x) => x.toLowerCase() === "piscina")).toHaveLength(1);
    for (const item of interiorFeatures) {
      expect(condoFeatures).not.toContain(item);
    }
  });

  it("assigns Fortnite rarity floor badges across all 5 floor tiers without duplicating in green/red tags", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp = SAMPLE_PROPERTIES[0]!;

    const legendaryProp: SlimPropertyRecord = {
      ...baseProp,
      id: "floor-legendary",
      floor: 20,
      floorRange: null,
      totalFloors: 20,
      description: "Cobertura duplex incrível no último andar.",
    };
    const epicProp: SlimPropertyRecord = {
      ...baseProp,
      id: "floor-epic",
      floor: null,
      floorRange: { min: 16, max: 19 },
      totalFloors: 25,
      description: "Imóvel claro.",
    };
    const rareProp: SlimPropertyRecord = {
      ...baseProp,
      id: "floor-rare",
      floor: 5,
      floorRange: null,
      totalFloors: 12,
      description: "Imóvel ventilado.",
    };
    const uncommonProp: SlimPropertyRecord = {
      ...baseProp,
      id: "floor-uncommon",
      floor: null,
      floorRange: { min: 1, max: 3 },
      totalFloors: 10,
      description: "Imóvel silencioso.",
    };
    const commonProp: SlimPropertyRecord = {
      ...baseProp,
      id: "floor-common",
      floor: 0,
      floorRange: null,
      totalFloors: 8,
      description: "Apartamento no térreo.",
    };

    const results = computeDynamicProperties(
      [legendaryProp, epicProp, rareProp, uncommonProp, commonProp],
      nbs,
      DEFAULT_WEIGHTS,
    );

    const byId = new Map(results.map((r) => [r.id, r]));

    expect(byId.get("floor-legendary")?.cardTags.floorTag).toEqual({
      label: "Cobertura / Duplex (Último andar)",
      rarity: "legendary",
    });
    expect(byId.get("floor-epic")?.cardTags.floorTag).toEqual({
      label: "Andar alto (16º–19º andar)",
      rarity: "epic",
    });
    expect(byId.get("floor-rare")?.cardTags.floorTag).toEqual({
      label: "Andar médio (5º andar)",
      rarity: "rare",
    });
    expect(byId.get("floor-uncommon")?.cardTags.floorTag).toEqual({
      label: "Andar baixo (1º–3º andar)",
      rarity: "uncommon",
    });
    expect(byId.get("floor-common")?.cardTags.floorTag).toEqual({
      label: "Térreo",
      rarity: "common",
    });

    for (const r of results) {
      const floorLabel = r.cardTags.floorTag?.label;
      expect(floorLabel).toBeTruthy();
      expect(r.cardTags.greenTags).not.toContain(floorLabel);
      expect(r.cardTags.redTags).not.toContain(floorLabel);
    }
  });

  it("hard-excludes properties with no elevator or trapped parking and populates green/red tags", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp = SAMPLE_PROPERTIES[0]!;
    const noElevatorProp: SlimPropertyRecord = {
      ...baseProp,
      id: "no-elev-1",
      installations: ["Piscina"],
      amenities: ["Varanda"],
      description: "Lindo apto em prédio escada sem elevador.",
    };
    const missingElevatorTextProp: SlimPropertyRecord = {
      ...baseProp,
      id: "missing-elev-text-1",
      installations: ["Piscina"],
      amenities: ["Varanda"],
      floor: 8,
      totalFloors: null,
      description: "Apartamento amplo e reformado.",
    };
    const trappedParkingProp: SlimPropertyRecord = {
      ...baseProp,
      id: "trapped-park-1",
      salePrice: 650000,
      description: "Imóvel novo com 1 vaga presa e torre única.",
    };
    const negatedTrappedProp: SlimPropertyRecord = {
      ...baseProp,
      id: "negated-trapped-1",
      description: "Imóvel com 1 vaga de garagem ( não é presa).",
    };

    const results = computeDynamicProperties(
      [
        noElevatorProp,
        missingElevatorTextProp,
        trappedParkingProp,
        negatedTrappedProp,
      ],
      nbs,
      DEFAULT_WEIGHTS,
    );

    const evalNoElev = results.find((p) => p.id === "no-elev-1")!;
    expect(evalNoElev.eligible).toBe(false);
    expect(evalNoElev.exclusionReason).toContain("Sem elevador (eliminado)");
    expect(evalNoElev.cardTags.redTags).toContain("Sem elevador");

    const evalMissingElev = results.find((p) => p.id === "missing-elev-text-1")!;
    expect(evalMissingElev.eligible).toBe(true);
    expect(evalMissingElev.cardTags.redTags).not.toContain("Sem elevador");

    const evalTrapped = results.find((p) => p.id === "trapped-park-1")!;
    expect(evalTrapped.eligible).toBe(false);
    expect(evalTrapped.exclusionReason).toContain(
      "Vaga presa, gaveta ou rotativa (eliminado)",
    );
    expect(evalTrapped.cardTags.redTags).toContain("Vaga presa / gaveta");
    expect(evalTrapped.cardTags.redTags).not.toContain("À venda (Risco de visitas)");
    expect(evalTrapped.cardTags.greenTags).toContain("Torre única / Reservado");

    const evalNegatedTrapped = results.find((p) => p.id === "negated-trapped-1")!;
    expect(evalNegatedTrapped.eligible).toBe(true);
    expect(evalNegatedTrapped.cardTags.redTags).not.toContain(
      "Vaga presa / gaveta",
    );
  });

  it("filters and sorts properties across all Level 1 and Level 2 filter dimensions", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp = SAMPLE_PROPERTIES[0]!;

    const penthouseProp: SlimPropertyRecord = {
      ...baseProp,
      id: "penthouse-1",
      provider: "zapimoveis",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Jd. Guanabara",
      totalMonthly: 4600,
      areaM2: 78,
      bedrooms: 2,
      suites: 1,
      bathrooms: 2,
      parkingSpaces: 2,
      floor: 18,
      floorRange: null,
      totalFloors: 18,
      furnished: false,
      acceptsPets: true,
      modernityScore: 95,
      modernityTier: "MODERN_OR_RENOVATED",
      description:
        "Cobertura duplex no último andar com ar-condicionado split, torre única e varanda gourmet.",
    };

    const midFloorFurnishedProp: SlimPropertyRecord = {
      ...baseProp,
      id: "mid-furnished-1",
      provider: "quintoandar",
      cityCode: "BH",
      neighborhood: "Funcionários",
      totalMonthly: 3400,
      areaM2: 52,
      bedrooms: 1,
      suites: 0,
      bathrooms: 1,
      parkingSpaces: 1,
      floor: 5,
      floorRange: null,
      totalFloors: 12,
      furnished: true,
      acceptsPets: false,
      salePrice: 580000,
      modernityScore: 76,
      modernityTier: "WELL_MAINTAINED",
      installations: [
        "Elevador",
        "Brinquedoteca",
        "Playground",
        "Quadra esportiva",
        "Salão de jogos",
      ],
      amenities: ["Mobiliado"],
      comfortCommodities: ["Sofá", "Cama de casal"],
      practicalityCommodities: ["Geladeira"],
      positiveSignals: [],
      description:
        "Apartamento mobiliado com cama, sofá e geladeira em andar médio (possível retirar a mobília).",
    };

    const groundFloorProp: SlimPropertyRecord = {
      ...baseProp,
      id: "ground-1",
      totalMonthly: 3900,
      areaM2: 46,
      floor: 0,
      floorRange: null,
      totalFloors: 8,
      description: "Apartamento térreo com elevador.",
    };

    const evaluated = computeDynamicProperties(
      [penthouseProp, midFloorFurnishedProp, groundFloorProp],
      nbs,
      DEFAULT_WEIGHTS,
    );

    // 1. Floor filter: HIGH_OR_TOP, LEGENDARY, RARE, NO_GROUND
    const onlyHighOrTop = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      floorFilter: "HIGH_OR_TOP",
    });
    expect(onlyHighOrTop.map((p) => p.id)).toEqual(["penthouse-1"]);

    const onlyLegendary = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      floorFilter: "LEGENDARY",
    });
    expect(onlyLegendary.map((p) => p.id)).toEqual(["penthouse-1"]);

    const noGround = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      floorFilter: "NO_GROUND",
    });
    expect(noGround.map((p) => p.id)).not.toContain("ground-1");
    expect(matchesFloorFilter(evaluated.find((p) => p.id === "ground-1")!, "NO_GROUND")).toBe(false);

    // 2. Price filter (maxTotalMonthly)
    const under3500 = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      maxTotalMonthly: 3500,
    });
    expect(under3500.map((p) => p.id)).toEqual(["mid-furnished-1"]);

    // 3. Score filter (minScore)
    const highScoreOnly = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      minScore: 200,
    });
    expect(highScoreOnly.map((p) => p.id)).toContain("penthouse-1");
    expect(highScoreOnly.map((p) => p.id)).not.toContain("mid-furnished-1");

    // 4. Cumulative requiredFeatures + hideMegaCondo + hideForSale
    const penthouseEval = evaluated.find((p) => p.id === "penthouse-1")!;
    expect(matchesPropertyFeature(penthouseEval, "ac")).toBe(true);
    expect(matchesPropertyFeature(penthouseEval, "reserved_building")).toBe(true);
    expect(matchesPropertyFeature(penthouseEval, "balcony")).toBe(true);
    expect(matchesPropertyFeature(penthouseEval, "suite")).toBe(true);
    expect(matchesPropertyFeature(penthouseEval, "pets")).toBe(true);

    const noMegaNoSale = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      hideMegaCondo: true,
      hideForSale: true,
    });
    expect(noMegaNoSale.map((p) => p.id)).not.toContain("mid-furnished-1");

    // 5. Sort by floor_desc, price_asc, price_desc, rent_asc, rent_desc, score_asc
    const byFloorDesc = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      sortBy: "floor_desc",
    });
    expect(byFloorDesc[0]?.id).toBe("penthouse-1");
    expect(byFloorDesc[byFloorDesc.length - 1]?.id).toBe("ground-1");

    const byPriceAsc = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      sortBy: "price_asc",
    });
    expect(byPriceAsc[0]?.id).toBe("mid-furnished-1");
    expect(byPriceAsc[byPriceAsc.length - 1]?.id).toBe("penthouse-1");

    const byPriceDesc = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      sortBy: "price_desc",
    });
    expect(byPriceDesc[0]?.id).toBe("penthouse-1");
    expect(byPriceDesc[byPriceDesc.length - 1]?.id).toBe("mid-furnished-1");

    const byScoreAsc = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      sortBy: "score_asc",
    });
    expect(byScoreAsc[0]?.finalScore).toBeLessThanOrEqual(
      byScoreAsc[byScoreAsc.length - 1]!.finalScore,
    );
  });

  it("resolves accurate property coordinates and Nubank hub distances across BH, RJ, CP, and SP", () => {
    expect(NUBANK_HUBS.BH.lat).toBeCloseTo(-19.9207, 3);
    expect(NUBANK_HUBS.BH.lng).toBeCloseTo(-43.9201, 3);
    expect(NUBANK_HUBS.RJ.lat).toBeCloseTo(-22.8983, 3);
    expect(NUBANK_HUBS.RJ.lng).toBeCloseTo(-43.1794, 3);
    expect(NUBANK_HUBS.SP.lat).toBeCloseTo(-23.561, 3);
    expect(NUBANK_HUBS.SP.lng).toBeCloseTo(-46.6735, 3);
    expect(NUBANK_HUBS.CP.lat).toBeCloseTo(-23.0061, 3);
    expect(NUBANK_HUBS.CP.lng).toBeCloseTo(-47.1178, 3);
    expect(ALL_NUBANK_HUB_LOCATIONS).toHaveLength(4);
    const bhBoulevard = ALL_NUBANK_HUB_LOCATIONS.find(
      (h) => h.id === "bh-boulevard",
    );
    expect(bhBoulevard?.lat).toBeCloseTo(-19.9207, 3);
    expect(bhBoulevard?.lng).toBeCloseTo(-43.9201, 3);

    const bhKnownStreet = resolveInstantPropertyCoordinate({
      cityCode: "BH",
      neighborhood: "Santa Efigênia",
      street: "Rua Padre Marinho",
      streetNumber: "318",
      id: "893127481",
    });
    expect(bhKnownStreet.source).toBe("street");
    expect(
      isCoordinateInsideCityBox("BH", bhKnownStreet.lat, bhKnownStreet.lng),
    ).toBe(true);
    expect(
      computeDistanceToNubankHubKm("BH", bhKnownStreet.lat, bhKnownStreet.lng),
    ).toBeLessThan(2.5);

    const rjNbFallback = resolveInstantPropertyCoordinate({
      cityCode: "RJ",
      neighborhood: "Flamengo",
      street: "Rua Silveira Martins",
      streetNumber: "120",
      id: "rj-1",
    });
    expect(
      isCoordinateInsideCityBox("RJ", rjNbFallback.lat, rjNbFallback.lng),
    ).toBe(true);
    expect(
      computeDistanceToNubankHubKm("RJ", rjNbFallback.lat, rjNbFallback.lng),
    ).toBeGreaterThan(2);
    expect(
      computeDistanceToNubankHubKm("RJ", rjNbFallback.lat, rjNbFallback.lng),
    ).toBeLessThan(8);
  });

  it("upgrades QuintoAndar, Zap/VivaReal, and ImovelWeb photo URLs to high resolution", () => {
    const qaMed =
      "https://www.quintoandar.com.br/img/med/894364593-534.1740932910197AlvarengaPeixoto1450401SantoAgostinho19.jpg";
    expect(getHighResPhotoUrl(qaMed)).toBe(
      "https://www.quintoandar.com.br/img/xxl/894364593-534.1740932910197AlvarengaPeixoto1450401SantoAgostinho19.jpg",
    );
    expect(
      getCardPhotoUrl(
        "https://www.quintoandar.com.br/img/xxl/894364593-534.1740932910197AlvarengaPeixoto1450401SantoAgostinho19.jpg",
      ),
    ).toBe(qaMed);

    const zapLow =
      "https://resizedimgs.zapimoveis.com.br/img/vr-listing/504a7a27dfaaba41ec5b0f854e532f49/foto.webp?action=fit-in&dimension=800x600";
    expect(getHighResPhotoUrl(zapLow)).toContain("dimension=1920x1440");
    expect(getCardPhotoUrl(getHighResPhotoUrl(zapLow))).toContain(
      "dimension=480x360",
    );

    const iwLow =
      "https://imgbr.imovelwebcdn.com/avisos/2/30/47/93/96/37/720x532/7332859386.jpg?isFirstImage=true";
    expect(getHighResPhotoUrl(iwLow)).toContain("/1200x1200/");
    expect(getCardPhotoUrl(iwLow)).toContain("/360x266/");

    // Multi-step fallback chain
    const zap1920 = getHighResPhotoUrl(zapLow);
    const zap1280 = getFallbackPhotoUrl(zap1920, zapLow)!;
    expect(zap1280).toContain("dimension=1280x960");
    const zap870 = getFallbackPhotoUrl(zap1280, zapLow)!;
    expect(zap870).toContain("dimension=870x707");
    const zap800 = getFallbackPhotoUrl(zap870, zapLow)!;
    expect(zap800).toContain("dimension=800x600");
  });

  it("produces natural Portuguese grammar and two balanced sentences in shortJustification across all budget tiers and drawback categories", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      [
        ...SAMPLE_NEIGHBORHOODS,
        {
          cityCode: "BH",
          cityName: "Belo Horizonte",
          neighborhood: "Sion",
          overallPosition: 5,
          cityPosition: 3,
          baseScore: 8.5,
          idhm: 0.95,
          commuteTime: "15-20 min",
          nubankHub: "Santa Efigênia",
          urbanBreathingScore: 8.8,
          commuteLogisticsScore: 8.4,
          buildingStockFitScore: 8.5,
          budgetFitScore: 9.4,
          safetyCarScore: 8.9,
          shortRationale: "Muito verde na Praça JK.",
          detailedJustification: "Excelente custo-benefício.",
          pros: ["Praça JK"],
          cons: ["Ladeiras íngremes nas ruas internas"],
        },
      ],
      DEFAULT_WEIGHTS,
    );
    const baseProp = SAMPLE_PROPERTIES[0]!;
    const tiers = [
      DEFAULT_WEIGHTS.budgetIdeal - 600,
      DEFAULT_WEIGHTS.budgetIdeal - 50,
      DEFAULT_WEIGHTS.budgetIdeal + 400,
      DEFAULT_WEIGHTS.budgetMax + 200,
      DEFAULT_WEIGHTS.budgetHardCap + 1000,
    ].map((totalMonthly, i) => ({
      ...baseProp,
      id: `budget-tier-${i}`,
      totalMonthly,
    }));

    const evaluated = computeDynamicProperties(tiers, nbs, DEFAULT_WEIGHTS);
    for (const item of evaluated) {
      expect(item.shortJustification).not.toMatch(/\bcom\s+(na|no|acima|enquadrado|dentro)\b/i);
      expect(item.shortJustification).not.toMatch(/\b(Por outro lado,|Em contrapartida,)/i);
      expect(item.shortJustification).not.toMatch(/R\$/);
      expect(item.shortJustification).not.toMatch(/\d+\s*m²/);
    }
    const byId = new Map(evaluated.map((p) => [p.id, p]));
    expect(byId.get("budget-tier-0")?.shortJustification).toContain("com folga confortável no orçamento.");
    expect(byId.get("budget-tier-1")?.shortJustification).toContain("enquadrado na meta financeira.");
    expect(byId.get("budget-tier-2")?.shortJustification).toMatch(/custo mensal consome a faixa de tolerância acima da meta ideal/i);
    expect(byId.get("budget-tier-3")?.shortJustification).toMatch(/pacote mensal acima da faixa ideal \(exige negociação\)/i);
    expect(byId.get("budget-tier-4")?.shortJustification).toMatch(/pacote mensal acima da faixa ideal \(exige negociação\)/i);
    expect(byId.get("budget-tier-4")?.eligible).toBe(true);

    // Verify specific negative signals: SP/CP penalties, street safety, ground floor, for-sale, megacondo, furnished, neighborhood cons
    const spGroundForSaleProp: SlimPropertyRecord = {
      ...baseProp,
      id: "sp-ground-forsale",
      cityCode: "SP",
      city: "São Paulo",
      neighborhood: "Bela Vista",
      floor: 0,
      floorRange: null,
      salePrice: 750000,
      furnished: true,
      comfortCommodities: ["Sofá", "Cama de casal"],
      practicalityCommodities: ["Geladeira"],
      areaM2: 55,
      totalMonthly: 4200,
    };
    const sionNoBalconyProp: SlimPropertyRecord = {
      ...baseProp,
      id: "sion-no-balcony",
      cityCode: "BH",
      neighborhood: "Sion",
      areaM2: 56,
      amenities: ["Box", "Área de serviço"],
      photoCaptions: ["Sala", "Cozinha"],
      description: "Apartamento reformado em andar alto.",
    };

    const extraEval = computeDynamicProperties(
      [spGroundForSaleProp, sionNoBalconyProp],
      nbs,
      DEFAULT_WEIGHTS,
    );
    const spRes = extraEval.find((p) => p.id === "sp-ground-forsale")!;
    expect(spRes.shortJustification).not.toContain("Por outro lado,");
    expect(spRes.shortJustification).toMatch(/exige maior atenção na rua no período noturno/i);
    expect(spRes.shortJustification).toContain("penalizado pelo trânsito, custo de vida e caos urbano de São Paulo Capital");
    expect(spRes.shortJustification).toContain("fica no térreo (maior exposição a ruído de calçada e menor privacidade)");
    expect(spRes.shortJustification).toContain("já mobiliado com cama/sofá (exige negociar retirada ou adaptar sua mudança de Brasília)");

    const sionRes = extraEval.find((p) => p.id === "sion-no-balcony")!;
    expect(sionRes.shortJustification).not.toContain("Por outro lado,");
    expect(sionRes.shortJustification).not.toMatch(/sem ar-condicionado instalado/i);
    expect(sionRes.shortJustification).not.toContain("planta sem varanda");
    expect(sionRes.shortJustification).toMatch(/ladeiras íngremes nas ruas internas/i);
  });

  it("heavily penalizes unsafe street neighborhoods (Tijuca, Santo Cristo, Maracanã) vs safe walkable bubbles (Lourdes, Funcionários, Ipanema, Leblon, Nova Campinas)", () => {
    const rjAndSafeCatalog: NeighborhoodEntry[] = [
      ...SAMPLE_NEIGHBORHOODS,
      {
        cityCode: "RJ",
        cityName: "Rio de Janeiro",
        neighborhood: "Tijuca (Pç Uruguai)",
        overallPosition: 18,
        cityPosition: 4,
        baseScore: 3.8,
        idhm: 0.921,
        commuteTime: "20-30 min",
        nubankHub: "Porto Maravilha / Centro",
        urbanBreathingScore: 6.8,
        commuteLogisticsScore: 8.0,
        buildingStockFitScore: 7.2,
        budgetFitScore: 8.8,
        safetyCarScore: 4.8,
        shortRationale: "Insegurança ao sair do condomínio na Zona Norte do RJ.",
        detailedJustification: "Penalizada por Segurança de Rua 4.8/10.",
        pros: ["Oferta c/ garagem"],
        cons: ["Insegurança ao sair na rua"],
      },
    ];

    const { ranked: nbs } = computeDynamicNeighborhoods(
      rjAndSafeCatalog,
      DEFAULT_WEIGHTS,
    );
    const tijucaNb = nbs.find((n) => n.neighborhood === "Tijuca (Pç Uruguai)")!;
    const funcNb = nbs.find((n) => n.neighborhood === "Funcionários")!;

    expect(tijucaNb.dynamicScore).toBeLessThan(3.5);
    expect(funcNb.dynamicScore).toBeGreaterThan(9.5);

    const baseApt = SAMPLE_PROPERTIES[0]!;
    const mkProp = (
      id: string,
      cityCode: "BH" | "RJ" | "CP",
      neighborhood: string,
    ): SlimPropertyRecord => ({
      ...baseApt,
      id,
      cityCode,
      city:
        cityCode === "RJ"
          ? "Rio de Janeiro"
          : cityCode === "CP"
            ? "Campinas"
            : "Belo Horizonte",
      neighborhood,
    });

    const props = [
      mkProp("safe-lourdes", "BH", "Lourdes"),
      mkProp("safe-funcionarios", "BH", "Funcionários"),
      mkProp("safe-ipanema", "RJ", "Ipanema"),
      mkProp("safe-leblon", "RJ", "Leblon"),
      mkProp("safe-nova-campinas", "CP", "Nova Campinas"),
      mkProp("unsafe-tijuca", "RJ", "Tijuca"),
      mkProp("unsafe-santo-cristo", "RJ", "Santo Cristo"),
      mkProp("unsafe-maracana", "RJ", "Maracanã"),
    ];

    const evaluated = computeDynamicProperties(props, nbs, DEFAULT_WEIGHTS);
    const byId = new Map(evaluated.map((p) => [p.id, p]));

    for (const unsafeId of [
      "unsafe-tijuca",
      "unsafe-santo-cristo",
      "unsafe-maracana",
    ]) {
      const unsafeProp = byId.get(unsafeId)!;
      expect(unsafeProp.cardTags.redTags).toContain(
        "Alerta de Segurança na Rua",
      );
      expect(unsafeProp.neighborhoodDynamicScore).toBeLessThan(3.5);

      for (const safeId of [
        "safe-lourdes",
        "safe-funcionarios",
        "safe-ipanema",
        "safe-leblon",
        "safe-nova-campinas",
      ]) {
        const safeProp = byId.get(safeId)!;
        expect(safeProp.cardTags.redTags).not.toContain(
          "Alerta de Segurança na Rua",
        );
        // Nova Campinas is safe but has low urban breathing (6.1), so its lead is smaller.
        const minGap = safeId === "safe-nova-campinas" ? 40 : 60;
        expect(safeProp.finalScore - unsafeProp.finalScore).toBeGreaterThan(minGap);
      }
    }
  });

  it("handles deactivated listings and favorites filtering (onlyFavorites & deactivatedFilter)", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp = SAMPLE_PROPERTIES[0]!;

    const activeUnfavProp: SlimPropertyRecord = {
      ...baseProp,
      id: "active-unfav",
      isActive: true,
      deactivatedAt: null,
    };
    const activeFavProp: SlimPropertyRecord = {
      ...baseProp,
      id: "active-fav",
      isActive: true,
      deactivatedAt: null,
    };
    const deactivatedFavProp: SlimPropertyRecord = {
      ...baseProp,
      id: "deactivated-fav",
      isActive: false,
      deactivatedAt: "2026-10-16T12:00:00.000Z",
    };
    const deactivatedUnfavProp: SlimPropertyRecord = {
      ...baseProp,
      id: "deactivated-unfav",
      isActive: false,
      deactivatedAt: "2026-10-16T12:00:00.000Z",
    };

    const evaluated = computeDynamicProperties(
      [activeUnfavProp, activeFavProp, deactivatedFavProp, deactivatedUnfavProp],
      nbs,
      DEFAULT_WEIGHTS,
    );

    const favKeys = ["quintoandar:active-fav", "quintoandar:deactivated-fav"];

    // 1. Default search (onlyFavorites: false, deactivatedFilter: "ACTIVE_ONLY") hides deactivated listings
    const defaultActiveOnly = filterAndSortProperties(
      evaluated,
      DEFAULT_EXPLORER_FILTERS,
      favKeys,
    );
    expect(defaultActiveOnly.map((p) => p.id)).toEqual([
      "active-fav",
      "active-unfav",
    ]);

    // 2. deactivatedFilter: "ALL" includes both active and deactivated listings
    const allStatuses = filterAndSortProperties(
      evaluated,
      {
        ...DEFAULT_EXPLORER_FILTERS,
        deactivatedFilter: "ALL",
      },
      favKeys,
    );
    expect(allStatuses.map((p) => p.id)).toEqual([
      "active-fav",
      "active-unfav",
      "deactivated-fav",
      "deactivated-unfav",
    ]);

    // 3. deactivatedFilter: "DEACTIVATED_ONLY" shows only deactivated listings
    const deactivatedOnly = filterAndSortProperties(
      evaluated,
      {
        ...DEFAULT_EXPLORER_FILTERS,
        deactivatedFilter: "DEACTIVATED_ONLY",
      },
      favKeys,
    );
    expect(deactivatedOnly.map((p) => p.id)).toEqual([
      "deactivated-fav",
      "deactivated-unfav",
    ]);

    // 4. onlyFavorites: true shows ALL favorited properties INCLUDING deactivated ones by default
    const favoritesView = filterAndSortProperties(
      evaluated,
      {
        ...DEFAULT_EXPLORER_FILTERS,
        onlyFavorites: true,
      },
      favKeys,
    );
    expect(favoritesView.map((p) => p.id)).toEqual([
      "active-fav",
      "deactivated-fav",
    ]);
  });

  it("supports all 5 rental providers, R$ 6.500 ceiling eligibility, and normalized catalog neighborhood filters", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp = SAMPLE_PROPERTIES[0]!;

    const vrProp: SlimPropertyRecord = {
      ...baseProp,
      id: "vr-1",
      provider: "vivareal",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Flamengo",
      totalMonthly: 6200,
      areaM2: 88,
    };
    const vrBarraProp: SlimPropertyRecord = {
      ...baseProp,
      id: "vr-barra-1",
      provider: "vivareal",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Barra da Tijuca",
      totalMonthly: 6200,
      areaM2: 88,
    };
    const niProp: SlimPropertyRecord = {
      ...baseProp,
      id: "ni-1",
      provider: "netimoveis",
      cityCode: "BH",
      neighborhood: "Lourdes",
      totalMonthly: 5900,
      areaM2: 72,
    };
    const iwProp: SlimPropertyRecord = {
      ...baseProp,
      id: "iw-1",
      provider: "imovelweb",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Jardim Guanabara",
      totalMonthly: 6450,
      areaM2: 92,
    };

    const evaluated = computeDynamicProperties(
      [vrProp, vrBarraProp, niProp, iwProp],
      nbs,
      DEFAULT_WEIGHTS,
    );

    expect(
      evaluated.filter((p) => p.id !== "vr-barra-1").every((p) => p.eligible),
    ).toBe(true);
    expect(evaluated.find((p) => p.id === "vr-barra-1")?.eligible).toBe(false);

    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        providerFilter: "vivareal",
      }).map((p) => p.id),
    ).toEqual(["vr-1"]);

    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        providerFilter: "netimoveis",
      }).map((p) => p.id),
    ).toEqual(["ni-1"]);

    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        providerFilter: "imovelweb",
      }).map((p) => p.id),
    ).toEqual(["iw-1"]);

    // Clicking "Jd. Oceânico" or "Jd. Guanabara" in the 20-neighborhoods table matches "Barra da Tijuca" and "Jardim Guanabara"
    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        selectedNeighborhoods: ["Jd. Oceânico"],
      }).map((p) => p.id),
    ).toEqual(["vr-barra-1"]);

    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        selectedNeighborhoods: ["Jd. Guanabara"],
      }).map((p) => p.id),
    ).toEqual(["iw-1"]);
  });

  it("formats compact map pin prices and applies deterministic micro-fan while preserving true coordinates via resolveDisplayPoints", () => {
    expect(formatPinPriceCompact(4120)).toBe("4,1k");
    expect(formatPinPriceCompact(3980)).toBe("4,0k");

    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp = SAMPLE_PROPERTIES[0]!;
    // Create 8 apartments on the exact same street/address near Nubank BH
    const clusteredProps = Array.from({ length: 8 }, (_, idx) => ({
      ...baseProp,
      id: `cluster-bh-${idx + 1}`,
      street: "Avenida Brasil",
      streetNumber: "2023",
    }));

    const evaluated = computeDynamicProperties(
      clusteredProps,
      nbs,
      DEFAULT_WEIGHTS,
    );
    const displayPoints = resolveDisplayPoints(evaluated);
    const reversedPoints = resolveDisplayPoints([...evaluated].reverse());
    const reversedByKey = new Map(reversedPoints.map((p) => [p.key, p]));

    expect(displayPoints).toHaveLength(8);
    // Verify true coordinates (rawLat/rawLng) are preserved, micro-fan stays within ~20-35m,
    // no two pins share identical coordinates, and positions are invariant to sort order
    for (let i = 0; i < displayPoints.length; i++) {
      const a = displayPoints[i]!;
      expect(Number.isFinite(a.rawLat)).toBe(true);
      expect(Number.isFinite(a.rawLng)).toBe(true);
      expect(Math.hypot(a.coord.lat - a.rawLat, a.coord.lng - a.rawLng)).toBeLessThan(0.0006);

      const rev = reversedByKey.get(a.key)!;
      expect(rev.coord.lat).toBe(a.coord.lat);
      expect(rev.coord.lng).toBe(a.coord.lng);

      const dHubLat = Math.abs(a.coord.lat - NUBANK_HUBS.BH.lat);
      const dHubLng = Math.abs(a.coord.lng - NUBANK_HUBS.BH.lng);
      expect(dHubLat > 0.001 || dHubLng > 0.002).toBe(true);

      for (let j = i + 1; j < displayPoints.length; j++) {
        const b = displayPoints[j]!;
        const dLat = Math.abs(b.coord.lat - a.coord.lat);
        const dLng = Math.abs(b.coord.lng - a.coord.lng);
        expect(Math.hypot(dLat, dLng)).toBeGreaterThan(0.0001);
      }
    }
  });

  it("extracts full photo galleries from QuintoAndar and Zap Imóveis HTML payloads via extractPhotosFromHtml", () => {
    const qaPhotos = Array.from({ length: 12 }, (_, idx) => ({
      subtitle: idx === 3 ? "Cozinha" : idx === 6 ? "Sala" : `Ambiente ${idx + 1}`,
      url: `photo-${idx + 1}.jpg`,
    }));
    const qaHtml = `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          initialState: {
            house: {
              houseInfo: {
                id: 893127481,
                photos: qaPhotos,
                condominium: {
                  images: [{ subtitle: "Fachada", url: "condo-fachada.jpg" }],
                },
              },
            },
          },
        },
      },
    })}</script></body></html>`;

    const extractedQa = extractPhotosFromHtml(
      "quintoandar",
      qaHtml,
      "https://www.quintoandar.com.br/imovel/893127481/alugar",
    );
    expect(extractedQa).toHaveLength(13);
    expect(extractedQa[0]?.room).toBe("Cozinha");
    expect(extractedQa[1]?.room).toBe("Sala");
    expect(extractedQa[2]?.room).toBe("Fachada");
    expect(extractedQa[0]?.url).toContain("/img/xxl/photo-4.jpg");
  });

  it("supports multi-select city hubs (selectedCities) in filterAndSortProperties while preserving selectedCity backwards compatibility", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp = {
      ...SAMPLE_PROPERTIES[0]!,
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    };

    const bhProp: SlimPropertyRecord = {
      ...baseProp,
      id: "multi-city-bh",
      cityCode: "BH",
      city: "Belo Horizonte",
      neighborhood: "Santa Efigênia",
    };
    const rjProp: SlimPropertyRecord = {
      ...baseProp,
      id: "multi-city-rj",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Flamengo",
    };
    const cpProp: SlimPropertyRecord = {
      ...baseProp,
      id: "multi-city-cp",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Jd. Guanabara",
    };
    const spProp: SlimPropertyRecord = {
      ...baseProp,
      id: "multi-city-sp",
      cityCode: "SP",
      city: "São Paulo",
      neighborhood: "Pinheiros",
    };

    const evaluated = computeDynamicProperties(
      [bhProp, rjProp, cpProp, spProp],
      nbs,
      DEFAULT_WEIGHTS,
    );

    const bhAndRj = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      selectedCities: ["BH", "RJ"],
    });
    expect(bhAndRj.map((p) => p.cityCode).sort()).toEqual(["BH", "RJ"]);
    expect(bhAndRj.map((p) => p.id)).toContain("multi-city-bh");
    expect(bhAndRj.map((p) => p.id)).toContain("multi-city-rj");
    expect(bhAndRj.map((p) => p.id)).not.toContain("multi-city-cp");
    expect(bhAndRj.map((p) => p.id)).not.toContain("multi-city-sp");

    // SP is hidden by default: even an explicit selection never returns it
    const allVisibleSelected = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      selectedCities: ["BH", "CP", "RJ", "SP"],
    });
    expect(allVisibleSelected.map((p) => p.cityCode).sort()).toEqual(["BH", "CP", "RJ"]);

    // Once SP is enabled it behaves like any other city
    const allFourSelected = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      enabledHiddenCities: ["SP"],
      selectedCities: ["BH", "CP", "RJ", "SP"],
    });
    expect(allFourSelected).toHaveLength(4);

    // Backwards compatibility with legacy selectedCity
    const legacySingleCity = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      selectedCity: "CP",
      selectedCities: [],
    });
    expect(legacySingleCity.map((p) => p.id)).toEqual(["multi-city-cp"]);
  });

  it("parses and sanitizes shared DB explorer filters across devices via parseExplorerFiltersObject", () => {
    const parsed = parseExplorerFiltersObject({
      selectedCities: ["BH", "RJ", "BH", "INVALID"],
      selectedNeighborhoods: ["Lourdes", "Flamengo"],
      searchQuery: "cobertura",
      floorFilter: "HIGH_OR_TOP",
      minTotalMonthly: 2500,
      maxTotalMonthly: 4800,
      minScore: 140,
      sortBy: "floor_desc",
      minAreaM2: 45,
      maxAreaM2: 90,
      minBedrooms: 2,
      minBathrooms: 2,
      minParking: 1,
      modernityTiers: ["MODERN_OR_RENOVATED", "WELL_MAINTAINED"],
      minModernityScore: 80,
      furnishedFilter: "UNFURNISHED",
      requiredFeatures: ["ac", "balcony", "invalid_feature"],
      hideMegaCondo: true,
      hideForSale: true,
      onlyNewEntries: false,
      showIneligible: false,
      providerFilter: "quintoandar",
      onlyFavorites: true,
      onlyTop20Neighborhoods: true,
      deactivatedFilter: "ACTIVE_ONLY",
      showAdvancedFilters: true,
      viewMode: "split",
    });

    expect(parsed.selectedCities).toEqual(["BH", "RJ"]);
    expect(parsed.selectedNeighborhoods).toEqual(["Lourdes", "Flamengo"]);
    expect(parsed.searchQuery).toBe("cobertura");
    expect(parsed.floorFilter).toBe("HIGH_OR_TOP");
    expect(parsed.minTotalMonthly).toBe(2500);
    expect(parsed.maxTotalMonthly).toBe(4800);
    expect(parsed.minScore).toBe(140);
    expect(parsed.sortBy).toBe("floor_desc");
    expect(parsed.minAreaM2).toBe(45);
    expect(parsed.maxAreaM2).toBe(90);
    expect(parsed.minBedrooms).toBe(2);
    expect(parsed.minBathrooms).toBe(2);
    expect(parsed.minParking).toBe(1);
    expect(parsed.modernityTiers).toEqual([
      "MODERN_OR_RENOVATED",
      "WELL_MAINTAINED",
    ]);
    expect(parsed.minModernityScore).toBe(80);
    expect(parsed.furnishedFilter).toBe("UNFURNISHED");
    expect(parsed.requiredFeatures).toEqual(["ac", "balcony"]);
    expect(parsed.hideMegaCondo).toBe(true);
    expect(parsed.hideForSale).toBe(true);
    expect(parsed.providerFilter).toBe("quintoandar");
    expect(parsed.onlyFavorites).toBe(true);
    expect(parsed.onlyTop20Neighborhoods).toBe(true);
    expect(parsed.showAdvancedFilters).toBe(true);
    expect(parsed.viewMode).toBe("split");
  });

  it("strictly filters units inside the Top 20 catalog neighborhoods when onlyTop20Neighborhoods is true", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    };

    const props: SlimPropertyRecord[] = [
      {
        ...baseProp,
        id: "top20-bh-funcionarios",
        cityCode: "BH",
        city: "Belo Horizonte",
        neighborhood: "Funcionários",
      },
      {
        ...baseProp,
        id: "top20-bh-lourdes",
        cityCode: "BH",
        city: "Belo Horizonte",
        neighborhood: "Lourdes",
      },
      {
        ...baseProp,
        id: "top20-cp-taquaral",
        cityCode: "CP",
        city: "Campinas",
        neighborhood: "Taquaral",
      },
      {
        ...baseProp,
        id: "top20-rj-flamengo",
        cityCode: "RJ",
        city: "Rio de Janeiro",
        neighborhood: "Flamengo",
      },
      {
        ...baseProp,
        id: "top20-rj-botafogo",
        cityCode: "RJ",
        city: "Rio de Janeiro",
        neighborhood: "Botafogo",
        street: "Rua Paulo Barreto",
      },
      {
        ...baseProp,
        id: "non-top20-bh-anchieta",
        cityCode: "BH",
        city: "Belo Horizonte",
        neighborhood: "Anchieta",
      },
      {
        ...baseProp,
        id: "non-top20-rj-catete",
        cityCode: "RJ",
        city: "Rio de Janeiro",
        neighborhood: "Catete",
      },
      {
        ...baseProp,
        id: "non-top20-cp-cambui",
        cityCode: "CP",
        city: "Campinas",
        neighborhood: "Cambuí",
      },
      {
        ...baseProp,
        id: "non-top20-cp-botafogo",
        cityCode: "CP",
        city: "Campinas",
        neighborhood: "Botafogo",
      },
      {
        ...baseProp,
        id: "non-top20-rj-barra-olimpica",
        cityCode: "RJ",
        city: "Rio de Janeiro",
        neighborhood: "Barra da Tijuca",
        street: "Avenida Embaixador Abelardo Bueno",
        description: "Apartamento na Barra Olímpica próximo ao Parque Olímpico.",
      },
    ];

    const evaluated = computeDynamicProperties(props, nbs, DEFAULT_WEIGHTS);

    const strictTop20 = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      onlyTop20Neighborhoods: true,
      maxCommuteMinutes: 90,
    });

    const keptIds = strictTop20.map((p) => p.id);
    expect(keptIds).toContain("top20-bh-funcionarios");
    expect(keptIds).toContain("top20-bh-lourdes");
    expect(keptIds).toContain("top20-cp-taquaral");
    expect(keptIds).toContain("top20-rj-flamengo");
    expect(keptIds).toContain("top20-rj-botafogo");

    expect(keptIds).not.toContain("non-top20-bh-anchieta");
    expect(keptIds).not.toContain("non-top20-rj-catete");
    expect(keptIds).not.toContain("non-top20-cp-cambui");
    expect(keptIds).not.toContain("non-top20-cp-botafogo");
    expect(keptIds).not.toContain("non-top20-rj-barra-olimpica");

    expect(
      isStrictlyInTop20Neighborhoods(
        evaluated.find((p) => p.id === "non-top20-rj-barra-olimpica")!,
      ),
    ).toBe(false);
  });

  it("supports multi-select floor filters (floorFilters) combining multiple floor tiers and NO_GROUND", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    };

    const legendaryProp: SlimPropertyRecord = {
      ...baseProp,
      id: "floor-legendary",
      floor: 15,
      totalFloors: 15,
      title: "Cobertura",
      description: "Cobertura no último andar.",
    };
    const epicProp: SlimPropertyRecord = {
      ...baseProp,
      id: "floor-epic",
      floor: 10,
      floorRange: null,
      totalFloors: 15,
      title: "Andar alto",
      description: "Apartamento em andar alto.",
    };
    const rareProp: SlimPropertyRecord = {
      ...baseProp,
      id: "floor-rare",
      floor: 5,
      floorRange: null,
      totalFloors: 12,
      title: "Andar médio",
      description: "Apartamento no 5º andar.",
    };
    const uncommonProp: SlimPropertyRecord = {
      ...baseProp,
      id: "floor-uncommon",
      floor: 2,
      floorRange: null,
      totalFloors: 10,
      title: "Andar baixo",
      description: "Apartamento no 2º andar.",
    };
    const groundProp: SlimPropertyRecord = {
      ...baseProp,
      id: "floor-ground",
      floor: 0,
      floorRange: null,
      totalFloors: 8,
      title: "Térreo",
      description: "Apartamento térreo.",
    };

    const evaluated = computeDynamicProperties(
      [legendaryProp, epicProp, rareProp, uncommonProp, groundProp],
      nbs,
      DEFAULT_WEIGHTS,
    );

    // Selecting LEGENDARY + RARE returns both Cobertura and Médio while excluding EPIC, UNCOMMON, and ground
    const legendaryOrRare = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      floorFilters: ["LEGENDARY", "RARE"],
    });
    expect(legendaryOrRare.map((p) => p.id)).toEqual([
      "floor-legendary",
      "floor-rare",
    ]);

    // Selecting LEGENDARY + EPIC + RARE returns Cobertura, Alto (8º+), and Médio (4º–7º)
    const topHighOrMid = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      floorFilters: ["LEGENDARY", "EPIC", "RARE"],
    });
    expect(topHighOrMid.map((p) => p.id)).toEqual([
      "floor-legendary",
      "floor-epic",
      "floor-rare",
    ]);

    // Parsing multi-select floorFilters from persisted preferences
    const parsedMulti = parseExplorerFiltersObject({
      floorFilters: ["LEGENDARY", "EPIC", "RARE", "ALL", "INVALID"],
    });
    expect(parsedMulti.floorFilters).toEqual(["LEGENDARY", "EPIC", "RARE"]);
  });

  it("classifies properties into 2 furniture tiers (UNFURNISHED vs FULLY_FURNISHED requiring geladeira + sofá + cama) and applies 2-tier scoring and filtering without retaining by furniture", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    };

    const unfurnishedProp: SlimPropertyRecord = {
      ...baseProp,
      id: "furn-unfurnished",
      furnished: false,
      comfortCommodities: ["Sol da manhã", "Vista livre"],
      practicalityCommodities: ["Armários na cozinha", "Box blindex"],
      description:
        "Apartamento amplo com armários planejados na cozinha e quarto, sem mobília solta.",
    };

    const semiAppliancesProp: SlimPropertyRecord = {
      ...baseProp,
      id: "furn-semi-appliances",
      furnished: false,
      comfortCommodities: [],
      practicalityCommodities: ["Fogão", "Geladeira", "Microondas", "Armários na cozinha"],
      description:
        "Apartamento com cozinha equipada (fogão, geladeira e micro-ondas), pronto para morar.",
    };

    const semiExplicitTextProp: SlimPropertyRecord = {
      ...baseProp,
      id: "furn-semi-text",
      furnished: true,
      comfortCommodities: [],
      practicalityCommodities: [],
      description:
        "Excelente apartamento semi-mobiliado com armários e eletrodomésticos na cozinha.",
    };

    const fullyBedSofaProp: SlimPropertyRecord = {
      ...baseProp,
      id: "furn-full-bed-sofa",
      furnished: false,
      comfortCommodities: ["Sofá", "Cama de casal"],
      practicalityCommodities: ["Geladeira", "Fogão", "Máquina de lavar"],
      description:
        "Apartamento completo com cama de casal, sofá, mesa com cadeiras e eletrodomésticos.",
    };

    const fullyPhotoDetectedProp: SlimPropertyRecord = {
      ...baseProp,
      provider: "zapimoveis",
      id: "2917412160",
      furnished: null,
      comfortCommodities: [],
      practicalityCommodities: [],
      description: "Loft moderno.",
    };

    const fullyHotelFlatProp: SlimPropertyRecord = {
      ...baseProp,
      id: "furn-full-flat",
      condominiumName: "Max Savassi Apart Service",
      furnished: null,
      comfortCommodities: [],
      practicalityCommodities: [],
      description: "Unidade em apart-hotel.",
    };

    expect(classifyFurnitureTier(unfurnishedProp)).toBe("UNFURNISHED");
    expect(classifyFurnitureTier(semiAppliancesProp)).toBe("UNFURNISHED");
    expect(classifyFurnitureTier(semiExplicitTextProp)).toBe("UNFURNISHED");
    expect(classifyFurnitureTier(fullyBedSofaProp)).toBe("FULLY_FURNISHED");
    expect(classifyFurnitureTier(fullyPhotoDetectedProp)).toBe(
      "FULLY_FURNISHED",
    );
    // Apart-hotel alone is not furniture evidence.
    expect(classifyFurnitureTier(fullyHotelFlatProp)).toBe("UNFURNISHED");

    const evaluated = computeDynamicProperties(
      [
        unfurnishedProp,
        semiAppliancesProp,
        semiExplicitTextProp,
        fullyBedSofaProp,
      ],
      nbs,
      DEFAULT_WEIGHTS,
    );
    const byId = new Map(evaluated.map((p) => [p.id, p]));

    const evalUnf = byId.get("furn-unfurnished")!;
    const evalSemi = byId.get("furn-semi-appliances")!;
    const evalFull = byId.get("furn-full-bed-sofa")!;

    expect(evalUnf.furnitureTier).toBe("UNFURNISHED");
    expect(evalUnf.breakdown.furniturePoints).toBe(
      DEFAULT_WEIGHTS.unfurnishedBonus,
    );

    expect(evalSemi.furnitureTier).toBe("UNFURNISHED");
    expect(evalSemi.breakdown.furniturePoints).toBe(
      DEFAULT_WEIGHTS.unfurnishedBonus,
    );

    expect(evalFull.furnitureTier).toBe("FULLY_FURNISHED");
    expect(evalFull.eligible).toBe(true);
    expect(evalFull.exclusionReason).toBeNull();
    expect(evalFull.cardTags.redTags).toContain("Totalmente mobiliado");
    expect(evalFull.breakdown.furniturePoints).toBe(
      DEFAULT_WEIGHTS.furnishedPenalty,
    );
    expect(evalFull.shortJustification).toMatch(
      /já mobiliado com cama\/sofá \(exige negociar retirada ou adaptar sua mudança de Brasília\)/i,
    );

    // Filter options: UNFURNISHED vs FURNISHED
    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        furnishedFilter: "UNFURNISHED",
      })
        .map((p) => p.id)
        .sort(),
    ).toEqual([
      "furn-semi-appliances",
      "furn-semi-text",
      "furn-unfurnished",
    ]);

    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        furnishedFilter: "FURNISHED",
      })
        .map((p) => p.id)
        .sort(),
    ).toEqual(["furn-full-bed-sofa"]);
  });

  it("does not retain FULLY_FURNISHED apartments (score penalty only) and supports selectedFurnitureTiers", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    };

    const fullNoRemovalProp: SlimPropertyRecord = {
      ...baseProp,
      id: "full-no-removal",
      furnished: true,
      comfortCommodities: ["Sofá", "Cama de casal"],
      practicalityCommodities: ["Geladeira", "Fogão"],
      description:
        "Apartamento completamente mobiliado com cama de casal, sofá e geladeira.",
    };

    const fullWithRemovalProp: SlimPropertyRecord = {
      ...baseProp,
      id: "full-with-removal",
      furnished: true,
      comfortCommodities: ["Sofá", "Cama de casal"],
      practicalityCommodities: ["Geladeira", "Fogão"],
      description:
        "Apartamento mobiliado com cama, sofá e geladeira. Proprietário pode retirar os móveis / possível retirar a mobília.",
    };

    const unfurnishedProp: SlimPropertyRecord = {
      ...baseProp,
      id: "unf-clean",
      furnished: false,
      comfortCommodities: [],
      practicalityCommodities: ["Armários na cozinha"],
      description: "Apartamento com armários planejados, sem mobília.",
    };

    const semiProp: SlimPropertyRecord = {
      ...baseProp,
      id: "semi-eletros",
      furnished: false,
      comfortCommodities: [],
      practicalityCommodities: ["Geladeira", "Fogão"],
      description: "Apartamento semi-mobiliado com geladeira e fogão.",
    };

    expect(canNegotiateFurnitureRemoval(fullNoRemovalProp)).toBe(false);
    expect(canNegotiateFurnitureRemoval(fullWithRemovalProp)).toBe(true);

    const evaluated = computeDynamicProperties(
      [fullNoRemovalProp, fullWithRemovalProp, unfurnishedProp, semiProp],
      nbs,
      DEFAULT_WEIGHTS,
    );
    const byId = new Map(evaluated.map((p) => [p.id, p]));

    const evalNoRemoval = byId.get("full-no-removal")!;
    const evalWithRemoval = byId.get("full-with-removal")!;

    expect(evalNoRemoval.furnitureTier).toBe("FULLY_FURNISHED");
    expect(evalNoRemoval.eligible).toBe(true);
    expect(evalNoRemoval.exclusionReason).toBeNull();
    expect(evalNoRemoval.cardTags.redTags).toContain("Totalmente mobiliado");

    expect(evalWithRemoval.furnitureTier).toBe("FULLY_FURNISHED");
    expect(evalWithRemoval.eligible).toBe(true);
    expect(evalWithRemoval.exclusionReason).toBeNull();

    // Default filter (showIneligible: false, selectedFurnitureTiers: []) keeps all 4 since furniture never retains
    expect(
      filterAndSortProperties(evaluated, DEFAULT_EXPLORER_FILTERS)
        .map((p) => p.id)
        .sort(),
    ).toEqual([
      "full-no-removal",
      "full-with-removal",
      "semi-eletros",
      "unf-clean",
    ]);

    // Selecting UNFURNISHED keeps unf-clean and semi-eletros
    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        selectedFurnitureTiers: ["UNFURNISHED"],
      })
        .map((p) => p.id)
        .sort(),
    ).toEqual(["semi-eletros", "unf-clean"]);

    // Explicitly selecting FULLY_FURNISHED shows both fullWithRemovalProp and fullNoRemovalProp
    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        selectedFurnitureTiers: ["FULLY_FURNISHED"],
      })
        .map((p) => p.id)
        .sort(),
    ).toEqual(["full-no-removal", "full-with-removal"]);

    // A legacy three-tier selection (SEMI_FURNISHED is dropped) still normalizes back to [] (Todos)
    const parsedAllThree = parseExplorerFiltersObject({
      selectedFurnitureTiers: [
        "UNFURNISHED",
        "SEMI_FURNISHED",
        "FULLY_FURNISHED",
      ],
    });
    expect(parsedAllThree.selectedFurnitureTiers).toEqual([]);
    expect(parsedAllThree.furnishedFilter).toBe("ALL");
  });

  it("supports multi-select exact counts for bedrooms (selectedBedrooms), bathrooms (selectedBathrooms), and parking (selectedParking)", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    };

    const oneBedProp: SlimPropertyRecord = {
      ...baseProp,
      id: "bed-1",
      bedrooms: 1,
      bathrooms: 1,
      parkingSpaces: 1,
    };
    const twoBedProp: SlimPropertyRecord = {
      ...baseProp,
      id: "bed-2",
      bedrooms: 2,
      bathrooms: 2,
      parkingSpaces: 1,
    };
    const threeBedProp: SlimPropertyRecord = {
      ...baseProp,
      id: "bed-3",
      bedrooms: 3,
      bathrooms: 3,
      parkingSpaces: 2,
    };
    const fourBedProp: SlimPropertyRecord = {
      ...baseProp,
      id: "bed-4",
      bedrooms: 4,
      bathrooms: 4,
      parkingSpaces: 3,
    };

    const evaluated = computeDynamicProperties(
      [oneBedProp, twoBedProp, threeBedProp, fourBedProp],
      nbs,
      DEFAULT_WEIGHTS,
    );

    // selectedBedrooms: [1] keeps ONLY 1-bedroom apartments and filters out 2+ bedroom apartments
    const onlyOneBed = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      selectedBedrooms: [1],
    });
    expect(onlyOneBed.map((p) => p.id)).toEqual(["bed-1"]);

    // selectedBedrooms: [1, 2] keeps both 1-bedroom and 2-bedroom apartments while filtering out 3+ bedroom apartments
    const oneAndTwoBeds = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      selectedBedrooms: [1, 2],
    });
    expect(oneAndTwoBeds.map((p) => p.id)).toEqual(["bed-1", "bed-2"]);

    // selectedBedrooms: [3] keeps 3+ bedroom apartments (3 and 4 bedrooms)
    const threePlusBeds = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      selectedBedrooms: [3],
    });
    expect(threePlusBeds.map((p) => p.id)).toEqual(["bed-3", "bed-4"]);

    // selectedBathrooms: [1] keeps ONLY 1-bathroom apartments
    const onlyOneBath = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      selectedBathrooms: [1],
    });
    expect(onlyOneBath.map((p) => p.id)).toEqual(["bed-1"]);

    // selectedBathrooms: [1, 2] keeps 1 and 2 bathroom apartments
    const oneAndTwoBaths = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      selectedBathrooms: [1, 2],
    });
    expect(oneAndTwoBaths.map((p) => p.id)).toEqual(["bed-1", "bed-2"]);

    // selectedParking: [1] keeps ONLY 1-parking apartments, [2] keeps 2+ parking apartments
    const onlyOnePark = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      selectedParking: [1],
    });
    expect(onlyOnePark.map((p) => p.id)).toEqual(["bed-1", "bed-2"]);

    const twoPlusPark = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      selectedParking: [2],
    });
    expect(twoPlusPark.map((p) => p.id)).toEqual(["bed-3", "bed-4"]);

    // parseExplorerFiltersObject sanitizes and deduplicates selectedBedrooms, selectedBathrooms, selectedParking
    const parsedMultiCounts = parseExplorerFiltersObject({
      selectedBedrooms: [2, 1, 2, 5, "invalid"],
      selectedBathrooms: [1, 3, 0],
      selectedParking: [1, 2, 3],
    });
    expect(parsedMultiCounts.selectedBedrooms).toEqual([1, 2]);
    expect(parsedMultiCounts.selectedBathrooms).toEqual([1, 3]);
    expect(parsedMultiCounts.selectedParking).toEqual([1, 2]);
  });

  it("computes commuteMinutes and commuteLabel and filters/sorts by maxCommuteMinutes and commute_asc", () => {
    expect(parseCommuteMinutes("5 min")).toEqual({
      minutes: 5,
      label: "5 min",
    });
    expect(parseCommuteMinutes("10-12 min do Nubank")).toEqual({
      minutes: 12,
      label: "10–12 min",
    });
    expect(parseCommuteMinutes("12–15 min")).toEqual({
      minutes: 15,
      label: "12–15 min",
    });
    expect(parseCommuteMinutes("15 a 20 min")).toEqual({
      minutes: 20,
      label: "15–20 min",
    });
    expect(parseCommuteMinutes("60-90 min do Nubank", true)).toEqual({
      minutes: 85,
      label: "75–100 min",
    });

    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    };

    const props: SlimPropertyRecord[] = [
      {
        ...baseProp,
        id: "commute-5-santa-efigenia",
        cityCode: "BH",
        neighborhood: "Santa Efigênia",
      },
      {
        ...baseProp,
        id: "commute-14-carmo",
        cityCode: "BH",
        neighborhood: "Carmo",
      },
      {
        ...baseProp,
        id: "commute-15-lourdes",
        cityCode: "BH",
        neighborhood: "Lourdes",
      },
      {
        ...baseProp,
        id: "commute-18-sion",
        cityCode: "BH",
        neighborhood: "Sion",
      },
      {
        ...baseProp,
        id: "commute-38-taquaral",
        cityCode: "CP",
        city: "Campinas",
        neighborhood: "Taquaral",
      },
      {
        ...baseProp,
        id: "commute-85-barra-olimpica",
        cityCode: "RJ",
        city: "Rio de Janeiro",
        neighborhood: "Barra da Tijuca",
        street: "Avenida Embaixador Abelardo Bueno",
        description: "Apartamento na Barra Olímpica.",
      },
    ];

    const evaluated = computeDynamicProperties(props, nbs, DEFAULT_WEIGHTS);
    const byId = new Map(evaluated.map((p) => [p.id, p]));

    expect(byId.get("commute-5-santa-efigenia")?.commuteMinutes).toBe(5);
    expect(byId.get("commute-14-carmo")?.commuteMinutes).toBe(15);
    expect(byId.get("commute-15-lourdes")?.commuteMinutes).toBe(15);
    expect(byId.get("commute-18-sion")?.commuteMinutes).toBe(20);
    expect(byId.get("commute-38-taquaral")?.commuteMinutes).toBe(40);
    expect(byId.get("commute-85-barra-olimpica")?.commuteMinutes).toBe(85);
    expect(byId.get("commute-85-barra-olimpica")?.commuteLabel).toBe("75–100 min");

    // Filter maxCommuteMinutes: 15 keeps <= 15 min (5, 15, 15) and excludes 20, 40, 85 (ranges count as their worst case)
    const under15 = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      maxCommuteMinutes: 15,
    });
    expect(under15.map((p) => p.id).sort()).toEqual([
      "commute-14-carmo",
      "commute-15-lourdes",
      "commute-5-santa-efigenia",
    ]);

    // Sort by commute_asc orders from fastest commute to slowest commute (with maxCommuteMinutes >= 40 revealing >35min properties)
    const sortedByCommute = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      maxCommuteMinutes: 90,
      sortBy: "commute_asc",
    });
    // Carmo (12-15) and Lourdes (15) tie at 15 min; the tie keeps the score order.
    expect(sortedByCommute.map((p) => p.id)).toEqual([
      "commute-5-santa-efigenia",
      "commute-15-lourdes",
      "commute-14-carmo",
      "commute-18-sion",
      "commute-38-taquaral",
      "commute-85-barra-olimpica",
    ]);

    // parseExplorerFiltersObject preserves maxCommuteMinutes and commute_asc
    const parsedCommuteFilter = parseExplorerFiltersObject({
      maxCommuteMinutes: 15,
      sortBy: "commute_asc",
    });
    expect(parsedCommuteFilter.maxCommuteMinutes).toBe(15);
    expect(parsedCommuteFilter.sortBy).toBe("commute_asc");
  });

  it("prevents false-positive Térreo and Andar baixo classifications and extracts explicit floor numbers from text", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      streetNumber: null,
      floor: null,
      floorRange: null,
      totalFloors: 15,
      comfortCommodities: [],
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    };

    // 1. Zap/VivaReal floor: 0 placeholder without explicit unit ground floor in description -> null floorTag
    const zapZeroPlaceholder: SlimPropertyRecord = {
      ...baseProp,
      id: "zap-zero-placeholder",
      provider: "zapimoveis",
      floor: 0,
      description: "Apartamento amplo com 1 quarto, sala para 2 ambientes e varanda.",
    };

    // 2. Descriptions mentioning "vaga no térreo", "lazer no térreo", or "portaria no térreo" -> NOT Térreo
    const vagaNoTerreo: SlimPropertyRecord = {
      ...baseProp,
      id: "condo-vaga-terreo",
      provider: "zapimoveis",
      floor: 0,
      description:
        "Excelente apartamento reformado com 1 vaga de garagem fixa no térreo, lazer no térreo com piscina e portaria no térreo.",
    };

    // 3. Duplex internal levels ("1º andar sala, 2º andar quartos") -> NOT Andar baixo; unknown unit floor gets only the loft +3
    const duplexInternalLevels: SlimPropertyRecord = {
      ...baseProp,
      id: "duplex-levels",
      provider: "quintoandar",
      floor: null,
      floorRange: null,
      description:
        "Lindo loft duplex: 1º andar sala ampla e cozinha americana; 2º andar quartos com suíte e closet.",
    };

    // 4. Explicit floor mentions in text ("apartamento no 9º andar", "6º andar") when prop.floor === null
    const explicitHighFloor9: SlimPropertyRecord = {
      ...baseProp,
      id: "text-9-andar",
      provider: "netimoveis",
      floor: null,
      description: "Excelente apartamento no 9º andar, claro, ventilado e silencioso.",
    };
    const explicitMidFloor6: SlimPropertyRecord = {
      ...baseProp,
      id: "text-6-andar",
      provider: "imovelweb",
      floor: null,
      description: "Apartamento reformado situado no 6º andar com armários planejados.",
    };

    // 5. Low floor with free view in sloped BH neighborhood (Sion) has attenuated low-floor penalty
    const slopedLowFloorFreeView: SlimPropertyRecord = {
      ...baseProp,
      id: "sion-low-floor-free-view",
      cityCode: "BH",
      neighborhood: "Sion",
      floor: 2,
      comfortCommodities: ["Vista livre"],
      description: "Apartamento no 2º andar com vista definitiva e panorâmica.",
    };
    const flatLowFloorNoView: SlimPropertyRecord = {
      ...baseProp,
      id: "sion-low-floor-no-view",
      cityCode: "BH",
      neighborhood: "Sion",
      floor: 2,
      comfortCommodities: [],
      description: "Apartamento no 2º andar.",
    };

    const evaluated = computeDynamicProperties(
      [
        zapZeroPlaceholder,
        vagaNoTerreo,
        duplexInternalLevels,
        explicitHighFloor9,
        explicitMidFloor6,
        slopedLowFloorFreeView,
        flatLowFloorNoView,
      ],
      nbs,
      DEFAULT_WEIGHTS,
    );
    const byId = new Map(evaluated.map((p) => [p.id, p]));

    expect(byId.get("zap-zero-placeholder")?.cardTags.floorTag).toBeNull();
    expect(byId.get("condo-vaga-terreo")?.cardTags.floorTag).toBeNull();
    expect(byId.get("duplex-levels")?.cardTags.floorTag).toBeNull();
    expect(byId.get("duplex-levels")?.cardTags.lowFloorLabel).toBeNull();
    expect(byId.get("duplex-levels")?.nuanceHighlights).toContain("Pé-direito duplo (loft)");
    expect(byId.get("text-9-andar")?.cardTags.floorTag).toEqual({
      label: "Andar alto (9º andar)",
      rarity: "epic",
    });
    expect(byId.get("text-6-andar")?.cardTags.floorTag).toEqual({
      label: "Andar médio (6º andar)",
      rarity: "rare",
    });

    const evalSlopedFV = byId.get("sion-low-floor-free-view")!;
    const evalNoFV = byId.get("sion-low-floor-no-view")!;
    expect(evalSlopedFV.cardTags.floorTag?.rarity).toBe("uncommon");
    expect(evalSlopedFV.breakdown.nuancesPoints).toBeGreaterThan(
      evalNoFV.breakdown.nuancesPoints + 12,
    );
  });

  it("formats top properties (up to 50 or fewer when < 50) as AI-ready Markdown via formatTopPropertiesForAiPrompt", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    };

    // Case 1: Fewer than 50 properties (e.g. 3 items)
    const threeProps = [1, 2, 3].map((i) => ({
      ...baseProp,
      id: `ai-prop-${i}`,
      totalMonthly: 4100 + i * 100,
    }));
    const evaluatedThree = computeDynamicProperties(
      threeProps,
      nbs,
      DEFAULT_WEIGHTS,
    );

    const mdThree = formatTopPropertiesForAiPrompt(evaluatedThree, {
      activeFilterLabels: ["Praça: BH", "Andar Alto / Cobertura"],
      favoriteKeys: new Set(["quintoandar:ai-prop-2"]),
    });

    expect(mdThree).toContain(
      "# Top 3 Imóveis Selecionados — Housing",
    );
    expect(mdThree).toContain(
      "- **Filtros ativos**: Praça: BH · Andar Alto / Cobertura",
    );
    expect(mdThree).toContain(
      "- **Total filtrado**: Exibindo top 3 de 3 imóveis",
    );
    expect(mdThree).toContain("### 1. [#1 Geral | #1 BH] Santa Efigênia");
    expect(mdThree).toContain("[★ FAVORITO]");
    expect(mdThree).toContain("Score & Custos");
    expect(mdThree).toContain("Planta & Andar");
    expect(mdThree).toContain("Logística Nubank & Tags");
    expect(mdThree).toContain("Prós & Ressalvas");
    expect(mdThree).toContain("quintoandar:ai-prop-1");

    // Case 2: More than 50 properties (e.g. 65 items) -> caps at 50
    const sixtyFiveProps = Array.from({ length: 65 }, (_, idx) => ({
      ...baseProp,
      id: `bulk-prop-${idx + 1}`,
      totalMonthly: 3800 + idx * 10,
    }));
    const evaluatedSixtyFive = computeDynamicProperties(
      sixtyFiveProps,
      nbs,
      DEFAULT_WEIGHTS,
    );

    const mdFifty = formatTopPropertiesForAiPrompt(evaluatedSixtyFive);
    expect(mdFifty).toContain(
      "# Top 50 Imóveis Selecionados — Housing",
    );
    expect(mdFifty).toContain(
      "- **Total filtrado**: Exibindo top 50 de 65 imóveis",
    );
    expect(mdFifty).toContain("### 50.");
    expect(mdFifty).not.toContain("### 51.");
  });

  it("keeps BSB (Águas Claras) excluded from permanent ranking and default filters unless Benchmark Mode is toggled ON", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const bhProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      id: "bh-ref-1",
      cityCode: "BH",
      neighborhood: "Santa Efigênia",
      totalMonthly: 4200,
      samplePhotos: [{ room: "Sala", url: "https://example.com/bh.jpg" }],
    };
    const bsbProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      id: "bsb-aguas-claras-1",
      cityCode: "BSB",
      city: "Brasília",
      neighborhood: "Águas Claras",
      street: "Avenida das Castanheiras",
      totalMonthly: 3400,
      modernityScore: 88,
      samplePhotos: [{ room: "Sala", url: "https://example.com/bsb.jpg" }],
    };

    // 1. Default (includeBsbBenchmark = false): BSB never takes an overallRank and is filtered out by default
    const evalDefault = computeDynamicProperties(
      [bsbProp, bhProp],
      nbs,
      DEFAULT_WEIGHTS,
    );
    const evalBhDefault = evalDefault.find((p) => p.id === "bh-ref-1")!;
    const evalBsbDefault = evalDefault.find(
      (p) => p.id === "bsb-aguas-claras-1",
    )!;
    expect(evalBhDefault.overallRank).toBe(1);
    expect(evalBsbDefault.overallRank).toBeNull();
    expect(evalBsbDefault.cityRank).toBe(1);

    const filteredOff = filterAndSortProperties(
      evalDefault,
      DEFAULT_EXPLORER_FILTERS,
    );
    expect(filteredOff.map((p) => p.id)).toEqual(["bh-ref-1"]);

    // 2. Benchmark ON (includeBsbBenchmark = true & enableBsbBenchmark = true): BSB is included and ranked
    const evalWithBenchmark = computeDynamicProperties(
      [bsbProp, bhProp],
      nbs,
      DEFAULT_WEIGHTS,
      { includeBsbBenchmark: true },
    );
    const evalBsbOn = evalWithBenchmark.find(
      (p) => p.id === "bsb-aguas-claras-1",
    )!;
    expect(evalBsbOn.overallRank).not.toBeNull();

    const filteredOn = filterAndSortProperties(evalWithBenchmark, {
      ...DEFAULT_EXPLORER_FILTERS,
      enabledHiddenCities: ["BSB"],
    });
    expect(filteredOn.map((p) => p.id)).toContain("bsb-aguas-claras-1");
    expect(filteredOn.map((p) => p.id)).toContain("bh-ref-1");

    const filteredOnlyBsb = filterAndSortProperties(evalWithBenchmark, {
      ...DEFAULT_EXPLORER_FILTERS,
      enabledHiddenCities: ["BSB"],
      selectedCities: ["BSB"],
    });
    expect(filteredOnlyBsb.map((p) => p.id)).toEqual(["bsb-aguas-claras-1"]);
  });

  it("penalizes arterial/downtown-border bunkers (Efeito Bunker), rewards Setor Marista walkable axes, and widens modernity and area spreads", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      [
        ...SAMPLE_NEIGHBORHOODS,
        {
          cityCode: "CP",
          cityName: "Campinas",
          neighborhood: "Bosque",
          overallPosition: 8,
          cityPosition: 2,
          baseScore: 8.2,
          idhm: 0.91,
          commuteTime: "15-20 min",
          nubankHub: "Bresco Viracopos",
          urbanBreathingScore: 8.0,
          commuteLogisticsScore: 9.0,
          buildingStockFitScore: 7.8,
          budgetFitScore: 8.2,
          safetyCarScore: 8.2,
          shortRationale: "Bosque dos Jequitibás.",
          detailedJustification: "Fácil saída para Viracopos.",
          pros: ["Saída fácil"],
          cons: ["Pouca vida noturna e gastronomia a pé no entorno"],
        },
        {
          cityCode: "CP",
          cityName: "Campinas",
          neighborhood: "Jd. Guanabara",
          overallPosition: 9,
          cityPosition: 3,
          baseScore: 8.0,
          idhm: 0.91,
          commuteTime: "20-25 min",
          nubankHub: "Bresco Viracopos",
          urbanBreathingScore: 7.5,
          commuteLogisticsScore: 8.0,
          buildingStockFitScore: 8.5,
          budgetFitScore: 8.8,
          safetyCarScore: 8.5,
          shortRationale: "Bairro residencial tradicional.",
          detailedJustification: "Quadras tranquilas.",
          pros: ["Tranquilo"],
          cons: ["Pouca vida de calçada vibrante no próprio quarteirão"],
        },
      ],
      DEFAULT_WEIGHTS,
    );

    // 1. Default weights reflect new calibration
    expect(DEFAULT_WEIGHTS.urbanBreathingWeight).toBe(3.0);
    expect(DEFAULT_WEIGHTS.modernityMultiplier).toBe(0.85);

    const taquaralNb = nbs.find((n) => n.neighborhood === "Taquaral")!;
    const bosqueNb = nbs.find((n) => n.neighborhood === "Bosque")!;
    const guanabaraNb = nbs.find((n) => n.neighborhood === "Jd. Guanabara")!;

    // Calibration caps: CP:Bosque 6.3, CP:Jd. Guanabara 5.0 and Taquaral 6.3 (rubric); Taquaral still leads on stock/budget
    expect(taquaralNb.urbanBreathingScore).toBe(6.3);
    expect(bosqueNb.urbanBreathingScore).toBe(6.3);
    expect(guanabaraNb.urbanBreathingScore).toBe(5.0);
    expect(taquaralNb.dynamicScore - bosqueNb.dynamicScore).toBeGreaterThan(0.3);
    expect(taquaralNb.dynamicScore - guanabaraNb.dynamicScore).toBeGreaterThan(1.0);

    const baseProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      furnished: false,
      comfortCommodities: ["Sol da manhã"],
      practicalityCommodities: ["Armários na cozinha"],
      amenities: ["Varanda", "Área de serviço"],
      installations: ["Elevador", "PORTARIA_24H"],
      placesNearby: [],
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    };

    // Category A: Campinas Av. Aquidabã spoofed as Bosque
    const cpBunkerAquidaba: SlimPropertyRecord = {
      ...baseProp,
      id: "cp-bunker-aquidaba",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Bosque",
      street: "Avenida Aquidabã",
      streetNumber: "635",
      floor: 12,
      floorRange: null,
      areaM2: 46,
      totalMonthly: 3980,
      modernityScore: 85,
      modernityTier: "MODERN_OR_RENOVATED",
    };

    // Category A: BH Lourdes border spoofing near Shopping Cidade / Mercado Central
    const bhBunkerSpoof: SlimPropertyRecord = {
      ...baseProp,
      id: "bh-bunker-spoof",
      cityCode: "BH",
      city: "Belo Horizonte",
      neighborhood: "Lourdes",
      street: "Rua São Paulo",
      streetNumber: "1091",
      floor: 10,
      floorRange: null,
      areaM2: 48,
      totalMonthly: 4100,
      modernityScore: 84,
      modernityTier: "MODERN_OR_RENOVATED",
      description: "Excelente localização próximo ao Shopping Cidade e Mercado Central.",
    };

    // Category B: Heavy arterial avenue (Av. Barão de Itapura in Campinas)
    const cpHeavyArterial: SlimPropertyRecord = {
      ...baseProp,
      id: "cp-heavy-arterial",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Jd. Guanabara",
      street: "Avenida Barão de Itapura",
      streetNumber: "1972",
      floor: 6,
      floorRange: null,
      areaM2: 55,
      totalMonthly: 3900,
      modernityScore: 75,
      modernityTier: "WELL_MAINTAINED",
    };

    // Category C: Prime walkable Setor Marista axis (Taquaral high-floor modern vs Funcionários tree-lined)
    const cpTaquaralPrime: SlimPropertyRecord = {
      ...baseProp,
      id: "cp-taquaral-prime",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Taquaral",
      street: "Rua Paula Bueno",
      streetNumber: "520",
      floor: 14,
      floorRange: null,
      areaM2: 60,
      totalMonthly: 4100,
      modernityScore: 88,
      modernityTier: "MODERN_OR_RENOVATED",
    };

    const bhFuncionariosPrime: SlimPropertyRecord = {
      ...baseProp,
      id: "bh-funcionarios-prime",
      cityCode: "BH",
      city: "Belo Horizonte",
      neighborhood: "Funcionários",
      street: "Rua Maranhão",
      streetNumber: "450",
      floor: 11,
      floorRange: null,
      areaM2: 58,
      totalMonthly: 4300,
      modernityScore: 86,
      modernityTier: "MODERN_OR_RENOVATED",
    };

    // Modernity spread check: 85/100 modern vs 62/100 unrenovated on identical street/floor/area
    const mod85Prop: SlimPropertyRecord = {
      ...baseProp,
      id: "mod-85",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Taquaral",
      street: "Rua Castro Alves",
      floor: 8,
      floorRange: null,
      areaM2: 58,
      totalMonthly: 4000,
      // No condo leisure: the engine takes the scraper's leisure points back out of modernityScore.
      installations: ["Elevador"],
      modernityScore: 85,
      modernityTier: "MODERN_OR_RENOVATED",
    };
    const mod62Prop: SlimPropertyRecord = {
      ...mod85Prop,
      id: "mod-62",
      modernityScore: 62,
      modernityTier: "STANDARD",
      negativeSignals: ["Piso antigo (cerâmica / tábua corrida / taco)"],
    };
    const mod62NeutralProp: SlimPropertyRecord = {
      ...mod85Prop,
      id: "mod-62-neutral",
      modernityScore: 62,
      modernityTier: "STANDARD",
      positiveSignals: [],
      negativeSignals: [],
    };

    // Area curve check: 58 m² (+10), 80 m² (+6), 47 m² (0), 42 m² (-10), 35 m² (-18)
    const area42Prop: SlimPropertyRecord = {
      ...mod85Prop,
      id: "area-42",
      areaM2: 42,
    };
    const area47Prop: SlimPropertyRecord = {
      ...mod85Prop,
      id: "area-47",
      areaM2: 47,
    };
    const area80Prop: SlimPropertyRecord = {
      ...mod85Prop,
      id: "area-80",
      areaM2: 80,
    };
    const area35Prop: SlimPropertyRecord = {
      ...mod85Prop,
      id: "area-35",
      areaM2: 35,
    };

    expect(detectArterialOrBorderBunker(cpBunkerAquidaba).category).toBe(
      "BUNKER_OR_SPOOF",
    );
    expect(evaluateStreetMicroEnvironment(bhBunkerSpoof).category).toBe(
      "BUNKER_OR_SPOOF",
    );
    expect(evaluateStreetMicroEnvironment(cpHeavyArterial).category).toBe(
      "HEAVY_ARTERIAL",
    );
    expect(evaluateStreetMicroEnvironment(cpTaquaralPrime).category).toBe(
      "PRIME_WALKABLE",
    );
    expect(evaluateStreetMicroEnvironment(bhFuncionariosPrime).category).toBe(
      "PRIME_WALKABLE",
    );

    const evaluated = computeDynamicProperties(
      [
        cpBunkerAquidaba,
        bhBunkerSpoof,
        cpHeavyArterial,
        cpTaquaralPrime,
        bhFuncionariosPrime,
        mod85Prop,
        mod62Prop,
        mod62NeutralProp,
        area42Prop,
        area47Prop,
        area80Prop,
        area35Prop,
      ],
      nbs,
      DEFAULT_WEIGHTS,
    );
    const byId = new Map(evaluated.map((p) => [p.id, p]));

    const evalAquidaba = byId.get("cp-bunker-aquidaba")!;
    const evalBhSpoof = byId.get("bh-bunker-spoof")!;
    const evalHeavyArt = byId.get("cp-heavy-arterial")!;
    const evalTaqPrime = byId.get("cp-taquaral-prime")!;
    const evalBhPrime = byId.get("bh-funcionarios-prime")!;

    expect(evalAquidaba.cardTags.redTags).toContain(
      "Via Arterial / Efeito Bunker",
    );
    expect(evalAquidaba.shortJustification.split("\n")[1]).toMatch(
      /^Fica em corredor viário intenso \/ divisa de centro \(efeito bunker: barulho de trânsito e calçada hostil a pé\)/,
    );
    expect(evalBhSpoof.cardTags.redTags).toContain(
      "Via Arterial / Efeito Bunker",
    );
    expect(evalHeavyArt.nuanceWarnings).toContain(
      "Avenida de tráfego intenso (ruído e menor caminhabilidade)",
    );

    expect(evalTaqPrime.cardTags.greenTags).toContain(
      "Eixo Caminhável / Respiro Urbano",
    );
    expect(evalTaqPrime.shortJustification).toContain(
      "quadra arborizada com vida a pé (estilo Setor Marista)",
    );
    expect(evalBhPrime.cardTags.greenTags).toContain(
      "Eixo Caminhável / Respiro Urbano",
    );
    expect(evalBhPrime.shortJustification).toContain(
      "quadra arborizada com vida a pé (estilo Setor Marista)",
    );

    // Prime Taquaral & Funcionários decisively beat Aquidabã bunker by > 65 pts
    expect(evalTaqPrime.finalScore - evalAquidaba.finalScore).toBeGreaterThan(
      65,
    );
    expect(evalBhPrime.finalScore - evalBhSpoof.finalScore).toBeGreaterThan(75);

    // The unconfirmed "Construção recente" signal keeps only 14 of its 20 pts: 85 -> 79 (ramp +0.5) vs 62 -> 56
    // with negative conservation evidence (penalty ramp -22.5): 67.6 vs 25.1 = 42.5 pts,
    // while neutral 62 without signals sits on the penalty ramp at -7.5 (52.7 - 7.5 = 45.2 pts)
    const evalMod85 = byId.get("mod-85")!;
    const evalMod62 = byId.get("mod-62")!;
    const evalMod62Neutral = byId.get("mod-62-neutral")!;
    expect(
      evalMod85.breakdown.modernityPoints - evalMod62.breakdown.modernityPoints,
    ).toBeCloseTo(42.5, 1);
    expect(evalMod62Neutral.breakdown.modernityPoints).toBeCloseTo(45.2, 1);
    expect(evalMod62Neutral.shortJustification).not.toContain(
      "acabamento padrão sem reforma moderna recente",
    );

    // Area points follow the exact Brasília furniture curve (45–72 m² sweet spot gets full +10 pts, only < 35 m² is retained)
    const area32Prop: SlimPropertyRecord = {
      ...mod85Prop,
      id: "area-32",
      areaM2: 32,
    };
    const [evalArea32] = computeDynamicProperties(
      [area32Prop],
      nbs,
      DEFAULT_WEIGHTS,
    );
    expect(evalMod85.breakdown.areaPoints).toBe(10);
    expect(byId.get("area-80")!.breakdown.areaPoints).toBe(6);
    expect(byId.get("area-47")!.breakdown.areaPoints).toBe(10);
    expect(byId.get("area-42")!.breakdown.areaPoints).toBe(-10);
    expect(byId.get("area-42")!.eligible).toBe(true);
    expect(byId.get("area-35")!.breakdown.areaPoints).toBe(-18);
    expect(byId.get("area-35")!.eligible).toBe(true);
    expect(evalArea32!.breakdown.areaPoints).toBe(-18);
    expect(evalArea32!.eligible).toBe(false);
  });

  it("enforces the objective hard-exclusion barrier clauses (area < 35 m², commute > 50 min, trapped parking, no elevator, no parking) without retaining for furniture, budget, bunker, or modernity", () => {
    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseCleanProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      id: "clean-baseline",
      cityCode: "BH",
      city: "Belo Horizonte",
      neighborhood: "Funcionários",
      street: "Rua Maranhão",
      streetNumber: "450",
      areaM2: 56,
      totalMonthly: 4200,
      furnished: false,
      floor: 9,
      floorRange: null,
      totalFloors: 15,
      modernityScore: 86,
      modernityTier: "MODERN_OR_RENOVATED",
      description: "Apartamento reformado com 1 vaga livre e demarcada.",
      samplePhotos: [{ room: "Sala", url: "https://example.com/1.jpg" }],
    };

    // Clause 1: Micro-studios < 35 m² are retained; 42 m² and 120 m² are NOT retained
    const clause1Micro32: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause1-micro-32",
      areaM2: 32,
    };
    const clause1Compact42: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause1-compact-42",
      areaM2: 42,
    };
    const clause1Large120: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause1-large-120",
      areaM2: 120,
    };

    // Clause 2: 100% mobiliado (geladeira + sofá + cama) is NOT retained (scored with penalty)
    const clause2Furnished: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause2-furnished",
      furnished: true,
      comfortCommodities: ["Sofá", "Cama de casal"],
      practicalityCommodities: ["Geladeira"],
      description: "Apartamento totalmente mobiliado com cama de casal, sofá e geladeira.",
    };

    // Clause 3: Efeito Bunker / corredor viário expresso (Av. Aquidabã) is NOT retained (scored with -26 pts penalty)
    const clause3BunkerAquidaba: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause3-bunker-aquidaba",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Bosque",
      street: "Avenida Aquidabã",
      streetNumber: "635",
    };

    // Clause 4: Vaga gaveta, rotativa, coletiva ou com manobrista IS retained
    const clause4Gaveta: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause4-vaga-gaveta",
      description: "Apartamento reformado com 2 vagas tipo gaveta.",
    };
    const clause4Rotativa: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause4-vaga-rotativa",
      description: "Apartamento amplo com vaga de garagem rotativa no condomínio.",
    };
    const clause4Manobrista: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause4-vaga-manobrista",
      description: "Prédio com garagem com manobrista 24h.",
    };
    const clause4FreeNegatedGaveta: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause4-negated-gaveta",
      description: "Apartamento com 2 vagas livres (não são gaveta).",
    };

    // Clause 5: Commute > 50 min (Barra da Tijuca 75m) IS retained; Buritis (40m) and Taquaral (38m) are NOT retained
    const clause5Barra: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause5-barra",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Barra da Tijuca",
      street: "Avenida Lúcio Costa",
    };
    const clause5Buritis: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause5-buritis",
      cityCode: "BH",
      city: "Belo Horizonte",
      neighborhood: "Buritis",
      street: "Rua Eli Seabra Filho",
    };
    const clause5Taquaral: SlimPropertyRecord = {
      ...baseCleanProp,
      id: "clause5-taquaral",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Taquaral",
      street: "Rua Paula Bueno",
    };

    const evaluated = computeDynamicProperties(
      [
        baseCleanProp,
        clause1Micro32,
        clause1Compact42,
        clause1Large120,
        clause2Furnished,
        clause3BunkerAquidaba,
        clause4Gaveta,
        clause4Rotativa,
        clause4Manobrista,
        clause4FreeNegatedGaveta,
        clause5Barra,
        clause5Buritis,
        clause5Taquaral,
      ],
      nbs,
      DEFAULT_WEIGHTS,
    );
    const byId = new Map(evaluated.map((p) => [p.id, p]));

    expect(byId.get("clean-baseline")!.eligible).toBe(true);

    // Verify Clause 1 (< 35 m² retained; 42 m² and 120 m² eligible)
    const c1 = byId.get("clause1-micro-32")!;
    expect(c1.eligible).toBe(false);
    expect(c1.exclusionReason).toContain(
      "Área 32 m² abaixo do mínimo de 35 m²",
    );
    expect(byId.get("clause1-compact-42")!.eligible).toBe(true);
    expect(byId.get("clause1-large-120")!.eligible).toBe(true);

    // Verify Clause 2 (Furnished is eligible, not retained)
    const c2 = byId.get("clause2-furnished")!;
    expect(c2.eligible).toBe(true);
    expect(c2.furnitureTier).toBe("FULLY_FURNISHED");

    // Verify Clause 3 (Bunker is eligible, not retained, but carries redTag)
    const c3 = byId.get("clause3-bunker-aquidaba")!;
    expect(c3.eligible).toBe(true);
    expect(c3.cardTags.redTags).toContain("Via Arterial / Efeito Bunker");

    // Verify Clause 4 (Trapped parking is retained)
    for (const id of [
      "clause4-vaga-gaveta",
      "clause4-vaga-rotativa",
      "clause4-vaga-manobrista",
    ]) {
      const c4 = byId.get(id)!;
      expect(c4.eligible).toBe(false);
      expect(c4.exclusionReason).toContain(
        "Vaga presa, gaveta ou rotativa (eliminado)",
      );
      expect(c4.cardTags.redTags).toContain("Vaga presa / gaveta");
    }
    expect(byId.get("clause4-negated-gaveta")!.eligible).toBe(true);

    // Verify Clause 5 (Barra 60-90 min counts as 90 > 50 min and is retained; Buritis and Taquaral <= 50 min are eligible)
    const c5Barra = byId.get("clause5-barra")!;
    const c5Buritis = byId.get("clause5-buritis")!;
    const c5Taquaral = byId.get("clause5-taquaral")!;
    expect(c5Barra.commuteMinutes).toBe(90);
    expect(c5Buritis.commuteMinutes).toBe(45);
    expect(c5Taquaral.commuteMinutes).toBe(40);

    expect(c5Barra.eligible).toBe(false);
    expect(c5Barra.exclusionReason).toContain(
      "Tempo até o escritório (90 min) acima do limite de 50 min (eliminado)",
    );
    expect(c5Buritis.eligible).toBe(true);
    expect(c5Taquaral.eligible).toBe(true);
    expect(c5Taquaral.breakdown.commutePoints).toBe(-11);

    // Smart UX Exception: explicitly selecting Barra da Tijuca reveals that neighborhood's >50 min unit
    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        selectedNeighborhoods: ["Barra da Tijuca"],
      }).map((p) => p.id),
    ).toEqual(["clause5-barra"]);
  });
});

describe("dataset sanity checks (seed-snapshot.json)", () => {
  const snapshotPath = resolve(__dirname, "../data/seed-snapshot.json");
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as {
    neighborhoods: NeighborhoodEntry[];
    properties: SlimPropertyRecord[];
  };
  const { ranked: rankedNbs } = computeDynamicNeighborhoods(
    snapshot.neighborhoods,
    DEFAULT_WEIGHTS,
  );
  const evaluated = computeDynamicProperties(
    snapshot.properties,
    rankedNbs,
    DEFAULT_WEIGHTS,
    { includeBsbBenchmark: false },
  );

  it("ensures 0 active properties have samplePhotos.length === 0", () => {
    const activeWithoutPhotos = snapshot.properties.filter(
      (p) => p.isActive !== false && (!p.samplePhotos || p.samplePhotos.length === 0),
    );
    expect(activeWithoutPhotos).toHaveLength(0);
  });

  it("ensures 0 properties have raw RSC pointer descriptions ($29, $1f, etc.)", () => {
    const rscPointers = snapshot.properties.filter(
      (p) => p.description !== null && /^\$[0-9a-z]+$/i.test(p.description.trim()),
    );
    expect(rscPointers).toHaveLength(0);
  });

  it("ensures 0 properties have annual-IPTU bugs (iptu > 1500 or iptu > rent * 0.4)", () => {
    const annualIptuBugs = snapshot.properties.filter(
      (p) => p.iptu > 1500 || (p.rent > 0 && p.iptu > p.rent * 0.4),
    );
    expect(annualIptuBugs).toHaveLength(0);
  });

  it("ensures 0 properties have spec anomalies (bedrooms, bathrooms, parkingSpaces, or floor > totalFloors)", () => {
    const specAnomalies = snapshot.properties.filter(
      (p) =>
        p.bedrooms < 1 ||
        p.bedrooms > 5 ||
        p.bathrooms < 1 ||
        p.bathrooms > 6 ||
        p.parkingSpaces > 6 ||
        (p.floor !== null && p.totalFloors !== null && p.floor > p.totalFloors),
    );
    expect(specAnomalies).toHaveLength(0);
  });

  it("verifies macro-economic R$/m² hierarchy for unfurnished 48–75 m² units: RJ (Zona Sul) & SP > BH > CP / BSB", () => {
    const rjZonaSulNbs = new Set([
      "Flamengo",
      "Leme",
      "Botafogo",
      "Botafogo (Orla)",
      "Glória",
      "Catete",
      "Laranjeiras",
      "Humaitá",
      "Urca",
      "Copacabana",
      "Arpoador",
      "Cosme Velho",
      "Leblon",
      "Ipanema",
      "Lagoa",
      "Jardim Botânico",
      "Gávea",
    ]);

    const median = (values: number[]): number => {
      const sorted = [...values].sort((a, b) => a - b);
      if (sorted.length === 0) return 0;
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1]! + sorted[mid]!) / 2
        : sorted[mid]!;
    };

    const rjZsPerM2: number[] = [];
    const spPerM2: number[] = [];
    const bhPerM2: number[] = [];
    const cpPerM2: number[] = [];
    const bsbPerM2: number[] = [];

    for (const p of evaluated) {
      if (p.isActive === false) continue;
      if (p.areaM2 < 48 || p.areaM2 > 75) continue;
      if (p.furnitureTier !== "UNFURNISHED") continue;

      const pricePerM2 = p.totalMonthly / p.areaM2;
      if (p.cityCode === "RJ" && rjZonaSulNbs.has(p.neighborhood)) {
        rjZsPerM2.push(pricePerM2);
      } else if (p.cityCode === "SP") {
        spPerM2.push(pricePerM2);
      } else if (p.cityCode === "BH") {
        bhPerM2.push(pricePerM2);
      } else if (p.cityCode === "CP") {
        cpPerM2.push(pricePerM2);
      } else if (p.cityCode === "BSB") {
        bsbPerM2.push(pricePerM2);
      }
    }

    const medRjZs = median(rjZsPerM2);
    const medSp = median(spPerM2);
    const medBh = median(bhPerM2);
    const medCp = median(cpPerM2);
    const medBsb = median(bsbPerM2);

    expect(medRjZs).toBeGreaterThan(medBh);
    expect(medSp).toBeGreaterThan(medBh);
    expect(medBh).toBeGreaterThan(medCp);
    expect(medBh).toBeGreaterThan(medBsb);
  });

  it("ensures Top 25 overall ranked properties contain 0 ground-floor, 0 low-floor, and 0 street-insecurity alert units", () => {
    const top25 = evaluated.filter(
      (p) => p.overallRank !== null && p.overallRank <= 25,
    );
    expect(top25).toHaveLength(25);

    const groundFloorInTop25 = top25.filter(
      (p) =>
        p.cardTags.floorTag?.rarity === "common" ||
        p.cardTags.floorTag?.label === "Térreo",
    );
    const lowFloorInTop25 = top25.filter(
      (p) =>
        (p.cardTags.floorTag?.rarity === "uncommon" ||
          Boolean(p.cardTags.floorTag?.label.startsWith("Andar baixo"))) &&
        !p.cardTags.greenTags.includes("Vista livre") &&
        // Photo-audited units keep the low-floor penalty but may outrank unaudited ones.
        !PHOTO_AUDIT_OVERRIDES[`${p.provider}:${p.id}`],
    );
    const streetUnsafeInTop25 = top25.filter((p) =>
      p.cardTags.redTags.includes("Alerta de Segurança na Rua"),
    );

    expect(groundFloorInTop25).toHaveLength(0);
    expect(lowFloorInTop25).toHaveLength(0);
    expect(streetUnsafeInTop25).toHaveLength(0);
  });

  it("verifies technical review fixes: SSRF allowlist, inactive rank exclusion, breakdown reconciliation, continuous area curve, per-clause furniture negation, and provider elevator rules", () => {
    // 1. SSRF URL allowlist
    expect(
      isValidAllowedListingUrl(
        "https://www.quintoandar.com.br/imovel/893127481/alugar",
      ),
    ).toBe(true);
    expect(
      isValidAllowedListingUrl(
        "https://www.netimoveis.com/imovel/locacao-apartamento/12345",
      ),
    ).toBe(true);
    expect(isValidAllowedListingUrl("http://localhost:3005/api/sync")).toBe(
      false,
    );
    expect(isValidAllowedListingUrl("https://127.0.0.1/internal")).toBe(false);
    expect(isValidAllowedListingUrl("https://evil.example.com/imovel/1")).toBe(
      false,
    );

    // 2. Inactive properties never steal overallRank / cityRank / neighborhoodRank
    const inactiveRanked = evaluated.filter(
      (p) =>
        p.isActive === false &&
        (p.overallRank !== null ||
          p.cityRank !== null ||
          p.neighborhoodRank !== null),
    );
    expect(inactiveRanked).toHaveLength(0);

    // 3. Breakdown sum reconciles with finalScore within 0.1
    for (const p of evaluated.slice(0, 100)) {
      const sum =
        p.breakdown.neighborhoodPoints +
        p.breakdown.modernityPoints +
        p.breakdown.nuancesPoints +
        p.breakdown.budgetPoints +
        p.breakdown.furniturePoints +
        p.breakdown.areaPoints +
        p.breakdown.parkingPoints +
        p.breakdown.safetyPoints +
        p.breakdown.commutePoints +
        p.breakdown.cityPreferencePoints;
      expect(Math.abs(sum - p.finalScore)).toBeLessThanOrEqual(0.11);
    }

    // 4. Continuous area boundaries (e.g. 72.5 m²) and custom sweetSpotMinM2 / sweetSpotMaxM2
    const base = SAMPLE_PROPERTIES[0]!;
    const decimalAreaProp: SlimPropertyRecord = {
      ...base,
      id: "area-72-5",
      areaM2: 72.5,
    };
    const [evalDecArea] = computeDynamicProperties(
      [decimalAreaProp],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    expect(evalDecArea!.breakdown.areaPoints).toBe(6);

    // 5. Per-clause furniture negation and space/capacity placeholder stripping
    const placeholderProp: SlimPropertyRecord = {
      ...base,
      id: "furn-placeholder",
      furnished: false,
      comfortCommodities: [],
      practicalityCommodities: [],
      photoCaptions: [],
      description:
        "Quarto amplo que cabe uma cama de casal e sala que comporta sofá retrátil e espaço para máquina de lavar.",
    };
    expect(classifyFurnitureTier(placeholderProp)).toBe("UNFURNISHED");

    const perClauseNegationProp: SlimPropertyRecord = {
      ...base,
      id: "furn-clause-neg",
      furnished: null,
      comfortCommodities: [],
      practicalityCommodities: [],
      photoCaptions: [],
      description:
        "Cama e sofá serão removidos pelo proprietário. Cozinha equipada com geladeira, cooktop e micro-ondas que permanecem.",
    };
    expect(classifyFurnitureTier(perClauseNegationProp)).toBe("UNFURNISHED");

    // 6. Netimoveis / Imovelweb 10-story building without explicit "elevador" word is not falsely eliminated
    const netimoveisTower: SlimPropertyRecord = {
      ...base,
      provider: "netimoveis",
      id: "ni-tower-10",
      floor: 6,
      totalFloors: 10,
      installations: [],
      amenities: ["Portaria 24h"],
      description: "Excelente apartamento reformado em andar alto.",
    };
    const [evalNiTower] = computeDynamicProperties(
      [netimoveisTower],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    expect(evalNiTower!.cardTags.redTags).not.toContain("Sem elevador");
    expect(evalNiTower!.eligible).toBe(true);
  });

  it("enforces second-pass scoring invariants: exact breakdown reconciliation, permutation-invariant ranks, monotonic positive evidence on 0-3 floor range, continuous decimal area bands, weight sanitization, and uniform benchmark cohorts", () => {
    const base = SAMPLE_PROPERTIES[0]!;

    // 1. Rounded breakdown component sum equals finalScore for every single property in the dataset
    for (const p of evaluated) {
      const exactRoundedSum =
        Math.round(
          Object.values(p.breakdown).reduce((sum, val) => sum + val, 0) * 10,
        ) / 10;
      expect(exactRoundedSum).toBe(p.finalScore);
    }

    // 2. Input array permutation cannot change overallRank, cityRank, or neighborhoodRank, and aliases share neighborhoodRank
    const aliasA: SlimPropertyRecord = {
      ...base,
      id: "alias-a",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Jd. Guanabara",
      totalMonthly: 4100,
    };
    const aliasB: SlimPropertyRecord = {
      ...base,
      id: "alias-b",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Jardim Guanabara",
      totalMonthly: 4100,
    };
    const aliasC: SlimPropertyRecord = {
      ...base,
      id: "alias-c",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Guanabara",
      totalMonthly: 4250,
    };
    const forwardEval = computeDynamicProperties(
      [aliasA, aliasB, aliasC],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    const reverseEval = computeDynamicProperties(
      [aliasC, aliasB, aliasA],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    const forwardByKey = new Map(
      forwardEval.map((p) => [`${p.provider}:${p.id}`, p]),
    );
    const reverseByKey = new Map(
      reverseEval.map((p) => [`${p.provider}:${p.id}`, p]),
    );
    for (const [k, fProp] of forwardByKey.entries()) {
      const rProp = reverseByKey.get(k)!;
      expect(fProp.overallRank).toBe(rProp.overallRank);
      expect(fProp.cityRank).toBe(rProp.cityRank);
      expect(fProp.neighborhoodRank).toBe(rProp.neighborhoodRank);
    }
    expect(
      forwardEval.map((p) => p.neighborhoodRank).sort((a, b) => a! - b!),
    ).toEqual([1, 2, 3]);

    // 3. Inactive records (isActive: false) never receive or affect active ranks
    const withInactive = computeDynamicProperties(
      [
        { ...aliasA, id: "inactive-top", totalMonthly: 3500, isActive: false },
        aliasA,
        aliasB,
        aliasC,
      ],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    const inactiveItem = withInactive.find((p) => p.id === "inactive-top")!;
    expect(inactiveItem.overallRank).toBeNull();
    expect(inactiveItem.cityRank).toBeNull();
    expect(inactiveItem.neighborhoodRank).toBeNull();
    for (const activeId of ["alias-a", "alias-b", "alias-c"]) {
      const a1 = forwardEval.find((p) => p.id === activeId)!;
      const a2 = withInactive.find((p) => p.id === activeId)!;
      expect(a2.overallRank).toBe(a1.overallRank);
      expect(a2.cityRank).toBe(a1.cityRank);
      expect(a2.neighborhoodRank).toBe(a1.neighborhoodRank);
    }

    // 4. Adding verified positive evidence (Vista livre) on a 0–3 floor range increases (never reduces) finalScore in both sloped and flat neighborhoods
    const range03NoViewSloped: SlimPropertyRecord = {
      ...base,
      id: "range03-no-view-sloped",
      cityCode: "BH",
      neighborhood: "Sion",
      floor: null,
      floorRange: { min: 0, max: 3 },
      comfortCommodities: [],
      description: "Apartamento silencioso.",
    };
    const range03WithViewSloped: SlimPropertyRecord = {
      ...range03NoViewSloped,
      id: "range03-with-view-sloped",
      description: "Apartamento silencioso com vista livre.",
    };
    const range03NoViewFlat: SlimPropertyRecord = {
      ...range03NoViewSloped,
      id: "range03-no-view-flat",
      neighborhood: "Funcionários",
      comfortCommodities: [],
    };
    const range03WithViewFlat: SlimPropertyRecord = {
      ...range03NoViewFlat,
      id: "range03-with-view-flat",
      description: "Apartamento silencioso com vista livre.",
    };
    const evalRange03 = computeDynamicProperties(
      [
        range03NoViewSloped,
        range03WithViewSloped,
        range03NoViewFlat,
        range03WithViewFlat,
      ],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    const r03Map = new Map(evalRange03.map((p) => [p.id, p]));
    expect(r03Map.get("range03-with-view-sloped")!.finalScore).toBeGreaterThan(
      r03Map.get("range03-no-view-sloped")!.finalScore,
    );
    expect(r03Map.get("range03-with-view-flat")!.finalScore).toBeGreaterThan(
      r03Map.get("range03-no-view-flat")!.finalScore,
    );

    // 5. Every valid decimal area (including 49.5 and 72.5) belongs to a continuous band and respects custom sweetSpotMinM2/sweetSpotMaxM2
    const area495: SlimPropertyRecord = { ...base, id: "area-49-5", areaM2: 49.5 };
    const area725: SlimPropertyRecord = { ...base, id: "area-72-5", areaM2: 72.5 };
    const defaultAreaEval = computeDynamicProperties(
      [area495, area725],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    expect(
      defaultAreaEval.find((p) => p.id === "area-49-5")!.breakdown.areaPoints,
    ).toBe(10);
    expect(
      defaultAreaEval.find((p) => p.id === "area-72-5")!.breakdown.areaPoints,
    ).toBe(6);

    const customAreaWeights = sanitizeAndMigrateWeights(
      {
        ...DEFAULT_WEIGHTS,
        sweetSpotMinM2: 48,
        sweetSpotMaxM2: 75,
      },
      2,
    );
    const customAreaEval = computeDynamicProperties(
      [area495, area725],
      rankedNbs,
      customAreaWeights,
    );
    expect(
      customAreaEval.find((p) => p.id === "area-49-5")!.breakdown.areaPoints,
    ).toBe(10);
    expect(
      customAreaEval.find((p) => p.id === "area-72-5")!.breakdown.areaPoints,
    ).toBe(10);

    // 6. sanitizeAndMigrateWeights rejects invalid strings/NaN and preserves custom v2 overrides
    const sanitizedInvalid = sanitizeAndMigrateWeights(
      {
        modernityMultiplier: "invalid" as unknown as number,
        urbanBreathingWeight: Number.NaN,
        requireParking: "yes" as unknown as boolean,
        minAreaM2: 80,
        maxAreaM2: 50,
        budgetIdeal: 7000,
        budgetMax: 5000,
        budgetHardCap: 4500,
      },
      2,
    );
    expect(sanitizedInvalid.modernityMultiplier).toBe(
      DEFAULT_WEIGHTS.modernityMultiplier,
    );
    expect(sanitizedInvalid.urbanBreathingWeight).toBe(
      DEFAULT_WEIGHTS.urbanBreathingWeight,
    );
    expect(sanitizedInvalid.requireParking).toBe(
      DEFAULT_WEIGHTS.requireParking,
    );
    expect(sanitizedInvalid.minAreaM2).toBeLessThanOrEqual(
      sanitizedInvalid.sweetSpotMinM2,
    );
    expect(sanitizedInvalid.sweetSpotMinM2).toBeLessThanOrEqual(
      sanitizedInvalid.sweetSpotMaxM2,
    );
    expect(sanitizedInvalid.sweetSpotMaxM2).toBeLessThanOrEqual(
      sanitizedInvalid.maxAreaM2,
    );
    expect(sanitizedInvalid.budgetIdeal).toBeLessThanOrEqual(
      sanitizedInvalid.budgetMax,
    );
    expect(sanitizedInvalid.budgetMax).toBeLessThanOrEqual(
      sanitizedInvalid.budgetHardCap,
    );

    const preservedV2 = sanitizeAndMigrateWeights(
      {
        furnishedPenalty: -5,
        urbanBreathingWeight: 1,
        modernityMultiplier: 0.65,
        sweetSpotMinM2: 48,
        sweetSpotMaxM2: 68,
      },
      2,
    );
    expect(preservedV2.furnishedPenalty).toBe(-5);
    expect(preservedV2.urbanBreathingWeight).toBe(1);
    expect(preservedV2.modernityMultiplier).toBe(0.65);
    expect(preservedV2.sweetSpotMinM2).toBe(48);
    expect(preservedV2.sweetSpotMaxM2).toBe(68);

    const migratedV1 = sanitizeAndMigrateWeights(
      {
        furnishedPenalty: -5,
        urbanBreathingWeight: 1,
        modernityMultiplier: 0.65,
        sweetSpotMinM2: 48,
        sweetSpotMaxM2: 68,
      },
      1,
    );
    expect(migratedV1.furnishedPenalty).toBe(-22);
    expect(migratedV1.urbanBreathingWeight).toBe(2.0);
    expect(migratedV1.modernityMultiplier).toBe(0.85);
    expect(migratedV1.sweetSpotMinM2).toBe(50);
    expect(migratedV1.sweetSpotMaxM2).toBe(72);

    // 7. buildBenchmarkStats treats "semi-mobiliado" records identically regardless of raw furnished boolean, and cohortCount matches the population used by its statistics
    const semiFurnTrue: SlimPropertyRecord = {
      ...base,
      id: "bench-semi-true",
      cityCode: "BH",
      neighborhood: "Funcionários",
      areaM2: 58,
      modernityScore: 80,
      totalMonthly: 4200,
      furnished: true,
      comfortCommodities: [],
      practicalityCommodities: ["Geladeira", "Fogão"],
      description: "Apartamento semi-mobiliado com geladeira e fogão.",
    };
    const semiFurnFalse: SlimPropertyRecord = {
      ...semiFurnTrue,
      id: "bench-semi-false",
      furnished: false,
    };
    const evalBenchPair = computeDynamicProperties(
      [semiFurnTrue, semiFurnFalse],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    const statsTrue = buildBenchmarkStats([evalBenchPair[0]!]);
    const statsFalse = buildBenchmarkStats([evalBenchPair[1]!]);
    const bhTrue = statsTrue.cityComparisons.find((c) => c.code === "BH")!;
    const bhFalse = statsFalse.cityComparisons.find((c) => c.code === "BH")!;
    expect(bhTrue.cohortCount).toBe(1);
    expect(bhFalse.cohortCount).toBe(1);
    expect(bhTrue.medianMonthly).toBe(bhFalse.medianMonthly);
    expect(bhTrue.medianPm2).toBe(bhFalse.medianPm2);
    expect(bhTrue.medianScore).toBe(bhFalse.medianScore);

    // 8. buildBenchmarkStats on full seed-snapshot produces monotonic, distortion-free medians across all 5 cities
    const snapshotRaw = JSON.parse(
      readFileSync(resolve(__dirname, "../data/seed-snapshot.json"), "utf8"),
    ) as {
      neighborhoods: NeighborhoodEntry[];
      properties: SlimPropertyRecord[];
    };
    const { ranked: snapNbs } = computeDynamicNeighborhoods(
      snapshotRaw.neighborhoods,
      DEFAULT_WEIGHTS,
    );
    const snapEval = computeDynamicProperties(
      snapshotRaw.properties,
      snapNbs,
      DEFAULT_WEIGHTS,
    );
    const fullBench = buildBenchmarkStats(snapEval);
    const byCode = Object.fromEntries(
      fullBench.cityComparisons.map((c) => [c.code, c]),
    ) as Record<string, (typeof fullBench.cityComparisons)[number]>;

    expect(byCode.BSB!.medianMonthly!).toBeGreaterThanOrEqual(3900);
    expect(byCode.BSB!.medianMonthly!).toBeLessThanOrEqual(4200);
    expect(byCode.BSB!.medianPm2!).toBeGreaterThanOrEqual(64);
    expect(byCode.BSB!.medianPm2!).toBeLessThanOrEqual(69);

    expect(byCode.CP!.medianMonthly!).toBeGreaterThanOrEqual(4000);
    expect(byCode.CP!.medianMonthly!).toBeLessThanOrEqual(4350);
    expect(byCode.CP!.medianPm2!).toBeGreaterThanOrEqual(68);
    expect(byCode.CP!.medianPm2!).toBeLessThanOrEqual(79);

    expect(byCode.BH!.medianMonthly!).toBeGreaterThanOrEqual(4300);
    expect(byCode.BH!.medianMonthly!).toBeLessThanOrEqual(4850);
    expect(byCode.BH!.medianPm2!).toBeGreaterThanOrEqual(75);
    expect(byCode.BH!.medianPm2!).toBeLessThanOrEqual(82);

    expect(byCode.RJ!.medianMonthly!).toBeGreaterThanOrEqual(4800);
    expect(byCode.RJ!.medianMonthly!).toBeLessThanOrEqual(5200);
    expect(byCode.RJ!.medianPm2!).toBeGreaterThanOrEqual(86);
    expect(byCode.RJ!.medianPm2!).toBeLessThanOrEqual(96);

    // Portal "furnished" flags now classify more SP units as furnished, which leave the cohort.
    expect(byCode.SP!.medianMonthly!).toBeGreaterThanOrEqual(4750);
    expect(byCode.SP!.medianMonthly!).toBeLessThanOrEqual(5300);
    expect(byCode.SP!.medianPm2!).toBeGreaterThanOrEqual(88);
    expect(byCode.SP!.medianPm2!).toBeLessThanOrEqual(100);

    for (const c of fullBench.cityComparisons) {
      expect(c.cohortCount).toBe(c.totalEligible);
      expect(c.cohortCount).toBeGreaterThan(0);
    }

    // Also verify commuteMinutes is null for non-duration BSB strings
    expect(
      parseCommuteMinutes("Benchmark Referência Atual (Águas Claras - DF)"),
    ).toEqual({
      minutes: null,
      label: "Ref. BSB",
    });
  });

  it("computes listingAgeDays and listingAgeLabel without affecting finalScore and supports age_asc / age_desc sorting", () => {
    const refMs = Date.parse("2026-10-16T15:00:00.000Z");

    expect(computeListingAge("2026-10-16T10:00:00.000Z", null, refMs)).toEqual({
      days: 0,
      label: "Hoje",
    });
    expect(computeListingAge("2026-10-15T10:00:00.000Z", null, refMs)).toEqual({
      days: 1,
      label: "Há 1 dia",
    });
    expect(computeListingAge("2026-10-04T10:00:00.000Z", null, refMs)).toEqual({
      days: 12,
      label: "Há 12 dias",
    });
    expect(computeListingAge("2026-09-01T10:00:00.000Z", null, refMs)).toEqual({
      days: 45,
      label: "Há 1 mês (45d)",
    });
    expect(
      computeListingAge(null, "2026-07-13T10:00:00.000Z", refMs),
    ).toEqual({
      days: 95,
      label: "Há 3 meses (95d)",
    });
    expect(computeListingAge(null, null, refMs)).toEqual({
      days: null,
      label: null,
    });
    expect(computeListingAge("invalid-date", undefined, refMs)).toEqual({
      days: null,
      label: null,
    });

    const { ranked } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp: SlimPropertyRecord = {
      ...SAMPLE_PROPERTIES[0]!,
      id: "age-base",
      cityCode: "BH",
      neighborhood: "Funcionários",
      totalMonthly: 4200,
      areaM2: 60,
      modernityScore: 84,
      publishedAt: null,
      listingUpdatedAt: null,
    };
    const newProp: SlimPropertyRecord = {
      ...baseProp,
      id: "age-new",
      publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    };
    const oldProp: SlimPropertyRecord = {
      ...baseProp,
      id: "age-old",
      publishedAt: new Date(Date.now() - 120 * 86_400_000).toISOString(),
    };
    const midHighScoreProp: SlimPropertyRecord = {
      ...baseProp,
      id: "age-mid-high",
      modernityScore: 92,
      publishedAt: new Date(Date.now() - 15 * 86_400_000).toISOString(),
    };
    const midLowScoreProp: SlimPropertyRecord = {
      ...baseProp,
      id: "age-mid-low",
      modernityScore: 76,
      publishedAt: new Date(Date.now() - 15 * 86_400_000).toISOString(),
    };

    const evaluated = computeDynamicProperties(
      [baseProp, newProp, oldProp, midHighScoreProp, midLowScoreProp],
      ranked,
      DEFAULT_WEIGHTS,
    );
    const byId = new Map(evaluated.map((p) => [p.id, p]));

    // Listing age does NOT enter finalScore
    expect(byId.get("age-new")!.finalScore).toBe(
      byId.get("age-old")!.finalScore,
    );
    expect(byId.get("age-new")!.finalScore).toBe(
      byId.get("age-base")!.finalScore,
    );
    expect(byId.get("age-new")!.listingAgeDays).toBe(2);
    expect(byId.get("age-new")!.listingAgeLabel).toBe("Há 2 dias");
    expect(byId.get("age-old")!.listingAgeDays).toBe(120);
    expect(byId.get("age-old")!.listingAgeLabel).toBe("Há 4 meses (120d)");
    expect(byId.get("age-base")!.listingAgeDays).toBeNull();
    expect(byId.get("age-base")!.listingAgeLabel).toBeNull();

    const sortedNewest = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      sortBy: "age_asc",
    });
    expect(sortedNewest.map((p) => p.id)).toEqual([
      "age-new",
      "age-mid-high",
      "age-mid-low",
      "age-old",
      "age-base",
    ]);

    const sortedOldest = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      sortBy: "age_desc",
    });
    expect(sortedOldest.map((p) => p.id)).toEqual([
      "age-old",
      "age-mid-high",
      "age-mid-low",
      "age-new",
      "age-base",
    ]);

    const snapshotRaw = JSON.parse(
      readFileSync(resolve(__dirname, "../data/seed-snapshot.json"), "utf8"),
    ) as {
      neighborhoods: NeighborhoodEntry[];
      properties: SlimPropertyRecord[];
    };
    const withPubAt = snapshotRaw.properties.filter(
      (p) => Boolean(p.publishedAt) || Boolean(p.listingUpdatedAt),
    );
    expect(withPubAt.length).toBe(snapshotRaw.properties.length);
  });

  it("calibrates the Top 20 Bairros ranking with 30/30/20/10/10 pillar weights, BH internal order, Laranjeiras/Humaitá in RJ, and SP Capital discount", () => {
    expect(DEFAULT_WEIGHTS.safetyCarWeight).toBe(3.0);
    expect(DEFAULT_WEIGHTS.urbanBreathingWeight).toBe(3.0);
    expect(DEFAULT_WEIGHTS.buildingStockWeight).toBe(2.0);
    expect(DEFAULT_WEIGHTS.commuteLogisticsWeight).toBe(1.0);
    expect(DEFAULT_WEIGHTS.budgetFitWeight).toBe(1.0);

    const snapshotRaw = JSON.parse(
      readFileSync(resolve(__dirname, "../data/seed-snapshot.json"), "utf8"),
    ) as {
      neighborhoods: NeighborhoodEntry[];
      properties: SlimPropertyRecord[];
    };

    const { ranked } = computeDynamicNeighborhoods(
      snapshotRaw.neighborhoods,
      DEFAULT_WEIGHTS,
    );
    expect(ranked).toHaveLength(20);

    // 1. BH holds the overall top 4 (Lourdes, Funcionários, Savassi, Santo Agostinho); Sion (urban breathing 6.2) is BH #5.
    // Exact top-4 order depends on whether the seed carries the rubric urban breathing scores.
    const bhRanked = ranked
      .filter((n) => n.cityCode === "BH")
      .map((n) => n.neighborhood);
    expect(new Set(bhRanked.slice(0, 4))).toEqual(
      new Set(["Lourdes", "Funcionários", "Savassi", "Santo Agostinho"]),
    );
    expect(bhRanked[4]).toBe("Sion");
    expect(ranked.slice(0, 4).every((n) => n.cityCode === "BH")).toBe(true);

    // 2. RJ slots include Laranjeiras and Humaitá instead of Tijuca and Jd. Oceânico
    const rjRanked = ranked
      .filter((n) => n.cityCode === "RJ")
      .map((n) => n.neighborhood);
    expect(rjRanked).toEqual([
      "Botafogo (Orla)",
      "Flamengo",
      "Humaitá",
      "Leme",
      "Laranjeiras",
    ]);

    // 3. SP Capital neighborhoods receive -1.50 discount; Moema (urban breathing 9.2) still ranks below the BH top 4 and Botafogo (Orla)
    const rankOf = (city: string, nb: string) =>
      ranked.find((n) => n.cityCode === city && n.neighborhood === nb)!
        .dynamicOverallRank;
    const spMoema = ranked.find(
      (n) => n.cityCode === "SP" && n.neighborhood === "Moema",
    )!;
    expect(spMoema.dynamicJustification).toContain(
      "[Desconto SP Capital: -1.50]",
    );
    for (const [city, nb] of [
      ["BH", "Lourdes"],
      ["BH", "Funcionários"],
      ["BH", "Savassi"],
      ["BH", "Santo Agostinho"],
      ["RJ", "Botafogo (Orla)"],
    ] as const) {
      expect(rankOf(city, nb)).toBeLessThan(spMoema.dynamicOverallRank);
    }
  });

  it("enforces photo-audit overrides (quintoandar:895702014 Parque Prado & quintoandar:895694297), prevents uncorroborated NEW_OR_RENOVATED inflation, and penalizes unrenovated DCE without retaining by modernity", () => {
    // 1. quintoandar:895702014 (Parque Prado) stays eligible === true (never retained by modernity) but receives severe modernity/maintenance score penalty + false AC/gourmet stripped
    const parquePrado = evaluated.find(
      (p) => p.provider === "quintoandar" && p.id === "895702014",
    );
    expect(parquePrado).toBeDefined();
    expect(parquePrado!.eligible).toBe(true);
    expect(parquePrado!.exclusionReason).toBeNull();
    expect(parquePrado!.modernityScore).toBe(42);
    expect(parquePrado!.modernityTier).toBe("DATED");
    expect(parquePrado!.cardTags.acLabel).toBeNull();
    expect(parquePrado!.nuanceHighlights).not.toContain("Varanda gourmet");
    expect(parquePrado!.breakdown.modernityPoints).toBeLessThan(0);

    // 2. Self-reported condition: "NEW_OR_RENOVATED" alone without interior modernity signals does NOT reach MODERN_OR_RENOVATED
    const base = SAMPLE_PROPERTIES[0]!;
    const uncorroboratedFlagProp: SlimPropertyRecord = {
      ...base,
      id: "uncorroborated-flag-only",
      constructionYear: null,
      condition: "NEW_OR_RENOVATED",
      installations: ["Elevador", "Piscina", "Academia"],
      amenities: ["Área de serviço"],
      comfortCommodities: ["Sol da manhã"],
      practicalityCommodities: [],
      positiveSignals: ["Flag Novo/Reformado", "Lazer com piscina e academia"],
      negativeSignals: [],
      modernityScore: 84,
      modernityTier: "MODERN_OR_RENOVATED",
      title: "Apartamento amplo para alugar",
      description: "Excelente apartamento com 2 quartos, sala ampla e vaga de garagem.",
      generatedDescription: null,
    };

    // 3. Pre-2000s DCE / quarto de serviço without renovation is penalized in modernityScore & modernityPoints while remaining eligible
    const dceUnrenovatedProp: SlimPropertyRecord = {
      ...base,
      id: "dce-unrenovated-1",
      constructionYear: 1992,
      condition: "USED",
      installations: ["Elevador"],
      amenities: ["Área de serviço"],
      comfortCommodities: [],
      practicalityCommodities: [],
      positiveSignals: ["Flag Novo/Reformado"],
      negativeSignals: [],
      modernityScore: 68,
      modernityTier: "WELL_MAINTAINED",
      title: "Apartamento com dependência completa de empregada",
      description:
        "Apartamento amplo com 2 quartos, dependência de empregada (DCE) e banheiro de serviço.",
      generatedDescription: null,
    };

    const [evalUncorroborated, evalDce] = computeDynamicProperties(
      [uncorroboratedFlagProp, dceUnrenovatedProp],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );

    expect(evalUncorroborated!.modernityScore).toBeLessThanOrEqual(74);
    expect(evalUncorroborated!.modernityTier).not.toBe("MODERN_OR_RENOVATED");

    expect(evalDce!.modernityScore).toBeLessThan(60);
    expect(evalDce!.eligible).toBe(true);
    expect(evalDce!.exclusionReason).toBeNull();
  });
});

describe("Calibration fixes: CP far commute, sale status, modernity ramp, no city-specific neighborhood boost", () => {
  const rankedNbs = computeDynamicNeighborhoods(SAMPLE_NEIGHBORHOODS, DEFAULT_WEIGHTS).ranked;
  const base = SAMPLE_PROPERTIES[0]!;
  const cpProp = (overrides: Partial<SlimPropertyRecord>): SlimPropertyRecord => ({
    ...base,
    cityCode: "CP",
    city: "Campinas",
    street: "Rua Hermantino Coelho",
    description: null,
    generatedDescription: null,
    ...overrides,
  });

  it("gives north/NE Campinas at least Taquaral's distance-scaled commute treatment without retaining them", () => {
    const taquaral = resolveCpFarCommute("CP", "Taquaral")!;
    const mansoes = resolveCpFarCommute("CP", "Mansões Santo Antônio")!;
    expect(taquaral.commuteText).toMatch(/^35-40 min/);
    expect(taquaral.penaltyPts).toBeCloseTo(-11, 1);
    expect(mansoes.commuteText).toMatch(/^40-45 min/);
    expect(mansoes.penaltyPts).toBeLessThan(taquaral.penaltyPts);
    expect(resolveCpFarCommute("CP", "Chácara Primavera")).not.toBeNull();
    expect(resolveCpFarCommute("CP", "Nova Campinas")).toBeNull();
    expect(resolveCpFarCommute("BH", "Funcionários")).toBeNull();

    const byId = new Map(
      computeDynamicProperties(
        [
          cpProp({ id: "cp-taq", neighborhood: "Taquaral" }),
          cpProp({ id: "cp-mansoes", neighborhood: "Mansões Santo Antônio" }),
        ],
        rankedNbs,
        DEFAULT_WEIGHTS,
      ).map((p) => [p.id, p]),
    );
    const evTaq = byId.get("cp-taq");
    const evMansoes = byId.get("cp-mansoes");
    expect(evTaq!.breakdown.commutePoints).toBeCloseTo(-11, 1);
    expect(evMansoes!.breakdown.commutePoints).toBeLessThanOrEqual(evTaq!.breakdown.commutePoints);
    expect(evMansoes!.commuteLabel).toBe("40–45 min");
    expect(evMansoes!.commuteMinutes).toBeLessThanOrEqual(50);
    expect(evMansoes!.eligible).toBe(true);
  });

  it("only applies the for-sale penalty with evidence the sale ad is live", () => {
    const qaWithStaleSalePrice = cpProp({ id: "qa-sale", provider: "quintoandar", salePrice: 925000 });
    const zapWithSale = cpProp({ id: "zap-sale", provider: "zapimoveis", salePrice: 925000 });
    const qaWithSaleText = cpProp({
      id: "qa-sale-text",
      provider: "quintoandar",
      salePrice: 925000,
      description: "Imóvel está à venda, visitas com agendamento.",
    });
    expect(hasActiveSaleListing(qaWithStaleSalePrice)).toBe(false);
    expect(hasActiveSaleListing(zapWithSale)).toBe(true);
    expect(hasActiveSaleListing(qaWithSaleText)).toBe(true);

    const byId = new Map(
      computeDynamicProperties(
        [qaWithStaleSalePrice, zapWithSale, cpProp({ id: "qa-nosale", salePrice: null })],
        rankedNbs,
        DEFAULT_WEIGHTS,
      ).map((p) => [p.id, p]),
    );
    expect(byId.get("qa-sale")!.nuanceWarnings.join(" ")).not.toMatch(/à venda/);
    expect(byId.get("qa-sale")!.breakdown.nuancesPoints).toBe(byId.get("qa-nosale")!.breakdown.nuancesPoints);
    expect(byId.get("zap-sale")!.breakdown.nuancesPoints).toBeCloseTo(
      byId.get("qa-nosale")!.breakdown.nuancesPoints - 4,
      1,
    );
    expect(
      filterAndSortProperties(Array.from(byId.values()), { ...DEFAULT_EXPLORER_FILTERS, hideForSale: true }).map(
        (p) => p.id,
      ),
    ).not.toContain("zap-sale");
  });

  it("ramps the modern-unit bonus linearly instead of jumping +8 at 82", () => {
    const scores = Array.from({ length: 19 }, (_, i) => 76 + i);
    const evaluated = computeDynamicProperties(
      scores.map((s) =>
        cpProp({
          id: `mod-${s}`,
          neighborhood: "Cambuí",
          installations: ["Elevador"],
          positiveSignals: [],
          modernityScore: s,
          modernityTier: "MODERN_OR_RENOVATED",
        }),
      ),
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    const pts = new Map(evaluated.map((p) => [p.id, p.breakdown.modernityPoints]));
    for (let s = 77; s <= 94; s++) {
      const step = pts.get(`mod-${s}`)! - pts.get(`mod-${s - 1}`)!;
      expect(step).toBeLessThanOrEqual(0.85 + 0.5 + 0.11);
    }
    expect(pts.get("mod-82")).toBeCloseTo(82 * 0.85 + 2, 1);
    expect(pts.get("mod-94")).toBeCloseTo(94 * 0.85 + 8, 1);
  });

  it("does not lift the neighborhood score of modern CP/RJ units (modernity is scored separately)", () => {
    const [a, b] = computeDynamicProperties(
      [
        cpProp({ id: "nb-mod-95", neighborhood: "Mansões Santo Antônio", modernityScore: 95 }),
        cpProp({ id: "nb-mod-60", neighborhood: "Mansões Santo Antônio", modernityScore: 60, modernityTier: "STANDARD" }),
      ],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    expect(a!.neighborhoodDynamicScore).toBe(b!.neighborhoodDynamicScore);
    expect(a!.neighborhoodDynamicScore).toBeCloseTo(8.73, 2);
  });

  it("dates QuintoAndar relistings by their current publication and keeps the first one as a hint", () => {
    const now = Date.now();
    const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
    const byId = new Map(
      computeDynamicProperties(
        [
          cpProp({ id: "qa-relisted", provider: "quintoandar", publishedAt: iso(1023), listingUpdatedAt: iso(20) }),
          cpProp({ id: "zap-bumped", provider: "zapimoveis", streetNumber: "999", publishedAt: iso(200), listingUpdatedAt: iso(2) }),
        ],
        rankedNbs,
        DEFAULT_WEIGHTS,
      ).map((p) => [p.id, p]),
    );
    expect(byId.get("qa-relisted")!.listingAgeDays).toBe(20);
    expect(byId.get("qa-relisted")!.firstPublicationAgeLabel).toBe("Há 34 meses (1023d)");
    expect(byId.get("zap-bumped")!.listingAgeDays).toBe(200);
    expect(byId.get("zap-bumped")!.firstPublicationAgeLabel).toBeNull();
    expect(resolveCurrentPublicationIso({ provider: "quintoandar", publishedAt: "2023-12-29", listingUpdatedAt: "2026-09-27" })).toBe(
      "2026-09-27",
    );
  });
});

describe("Retention false positives: ground floor, CRM floor noise, public rotativo parking", () => {
  const rankedNbs = computeDynamicNeighborhoods(SAMPLE_NEIGHBORHOODS, DEFAULT_WEIGHTS).ranked;
  const walkUp = (overrides: Partial<SlimPropertyRecord>): SlimPropertyRecord => ({
    ...SAMPLE_PROPERTIES[0]!,
    provider: "zapimoveis",
    cityCode: "RJ",
    city: "Rio de Janeiro",
    neighborhood: "Tijuca",
    street: "Rua Santa Carolina",
    installations: [],
    amenities: ["SERVICE_AREA"],
    comfortCommodities: [],
    practicalityCommodities: [],
    description: "Apartamento amplo e ventilado, 2 quartos.",
    generatedDescription: null,
    floor: 1,
    floorRange: null,
    totalFloors: 3,
    condoFee: 500,
    ...overrides,
  });
  const evaluate = (props: SlimPropertyRecord[]) =>
    new Map(computeDynamicProperties(props, rankedNbs, DEFAULT_WEIGHTS).map((p) => [p.id, p]));

  it("exempts explicit ground-floor units from the no-elevator barrier unless stairs to the unit are stated", () => {
    const byId = evaluate([
      walkUp({ id: "ground-floor0", floor: 0, description: "Apartamento térreo Vazio sem mobilha, ambientes amplos." }),
      walkUp({ id: "ground-text", floor: null, description: "Apartamento térreo, prédio sem elevador." }),
      walkUp({
        id: "ground-stairs",
        floor: 0,
        description: "Apartamento térreo elevado, para chegar à unidade é preciso subir 2 lances de escada.",
      }),
      walkUp({ id: "walkup-1st", floor: 1 }),
    ]);
    expect(byId.get("ground-floor0")!.eligible).toBe(true);
    expect(byId.get("ground-text")!.eligible).toBe(true);
    expect(byId.get("ground-stairs")!.exclusionReason).toContain("Sem elevador");
    expect(byId.get("walkup-1st")!.exclusionReason).toContain("Sem elevador");
  });

  it("ignores floor === totalFloors CRM noise in pricey condos but keeps cheap real 3-story walk-ups retained", () => {
    const byId = evaluate([
      walkUp({ id: "crm-noise", neighborhood: "Laranjeiras", floor: 3, totalFloors: 3, condoFee: 1024 }),
      walkUp({ id: "real-3-story", neighborhood: "Sion", floor: 3, totalFloors: 3, condoFee: 605 }),
      walkUp({ id: "pricey-floor-null", floor: null, totalFloors: 3, condoFee: 1250 }),
      walkUp({ id: "crm-noise-explicit", floor: 3, totalFloors: 3, condoFee: 1024, description: "Prédio sem elevador." }),
    ]);
    expect(byId.get("crm-noise")!.eligible).toBe(true);
    expect(byId.get("real-3-story")!.exclusionReason).toContain("Sem elevador");
    expect(byId.get("pricey-floor-null")!.exclusionReason).toContain("Sem elevador");
    expect(byId.get("crm-noise-explicit")!.exclusionReason).toContain("Sem elevador");
  });

  it("does not treat public street rotativo parking as a trapped garage spot", () => {
    const parking = (id: string, description: string) =>
      walkUp({ id, floor: 5, totalFloors: 12, installations: ["Elevador"], description });
    const byId = evaluate([
      parking("street-rotativa", "Possui 1 vaga, além de vagas rotativas em frente ao edifício."),
      parking("street-zona-azul", "Estacionamento rotativo na rua e zona azul próxima."),
      parking("garage-rotativa", "Vagas de garagem rotativas no subsolo."),
      parking("garage-manobrista", "Vaga com manobrista 24h."),
    ]);
    expect(byId.get("street-rotativa")!.eligible).toBe(true);
    expect(byId.get("street-zona-azul")!.eligible).toBe(true);
    expect(byId.get("garage-rotativa")!.exclusionReason).toContain("Vaga presa");
    expect(byId.get("garage-manobrista")!.exclusionReason).toContain("Vaga presa");
  });
});

describe("Top-20 photo audit rules: AC evidence, doorman field, Zap 1st floor, partial views, apart-hotels, inactive listings", () => {
  const rankedNbs = computeDynamicNeighborhoods(SAMPLE_NEIGHBORHOODS, DEFAULT_WEIGHTS).ranked;
  const rule = (overrides: Partial<SlimPropertyRecord>): SlimPropertyRecord => ({
    ...SAMPLE_PROPERTIES[0]!,
    id: "rule-base",
    streetNumber: null,
    title: "Apartamento 1 quarto",
    description: "Apartamento com 1 vaga.",
    generatedDescription: null,
    installations: ["Elevador"],
    amenities: ["Box"],
    comfortCommodities: [],
    practicalityCommodities: [],
    photoCaptions: [],
    positiveSignals: [],
    ...overrides,
  });
  const evaluate = (props: SlimPropertyRecord[]) =>
    new Map(computeDynamicProperties(props, rankedNbs, DEFAULT_WEIGHTS).map((p) => [p.id, p]));
  const withOverrides = (entries: Record<string, PhotoAuditOverride>, run: () => void) => {
    Object.assign(PHOTO_AUDIT_OVERRIDES, entries);
    try {
      run();
    } finally {
      for (const key of Object.keys(entries)) delete PHOTO_AUDIT_OVERRIDES[key];
    }
  };
  const modernOverride: PhotoAuditOverride = { modernityScore: 90, modernityTier: "MODERN_OR_RENOVATED" };

  it("scores portal-checkbox-only AC as unconfirmed (0 pts, amber tag) and keeps +12 / -20 for confirmed / absent AC", () => {
    const used = (overrides: Partial<SlimPropertyRecord>) =>
      rule({ condition: "USED", constructionYear: null, modernityScore: 80, ...overrides });
    withOverrides({ "quintoandar:ac-photo": { ...modernOverride, verifiedAC: true } }, () => {
      const byId = evaluate([
        used({ id: "ac-none" }),
        used({ id: "ac-qa-checkbox", comfortCommodities: ["Ar condicionado"], amenities: ["Box", "Ar condicionado"] }),
        used({ id: "ac-zap-checkbox", provider: "zapimoveis", amenities: ["AIR_CONDITIONING"] }),
        used({ id: "ac-signal-only", positiveSignals: ["Ar-condicionado"] }),
        used({ id: "ac-infra-text", description: "Sala com ponto para ar-condicionado split." }),
        used({ id: "ac-text", comfortCommodities: ["Ar condicionado"], description: "Sala e quarto com ares condicionados." }),
        used({ id: "ac-split", description: "Split inverter na suíte." }),
        used({ id: "ac-photo", comfortCommodities: ["Ar condicionado"] }),
        used({ id: "ac-negated", comfortCommodities: ["Ar condicionado"], description: "Imóvel sem ar-condicionado." }),
      ]);
      const pts = (id: string) => byId.get(id)!.breakdown.nuancesPoints;

      for (const id of ["ac-qa-checkbox", "ac-zap-checkbox", "ac-signal-only", "ac-infra-text"]) {
        const ev = byId.get(id)!;
        expect(ev.cardTags.acLabel).toBeNull();
        expect(ev.cardTags.warningTags).toContain(id === "ac-infra-text" ? AC_INFRA_ONLY_TAG : AC_UNCONFIRMED_TAG);
        expect(ev.cardTags.redTags).not.toContain(AC_ABSENT_TAG);
        expect(ev.cardTags.greenTags.some((t) => t.startsWith("Ar-condicionado"))).toBe(false);
        expect(matchesPropertyFeature(ev, "ac")).toBe(false);
      }
      expect(pts("ac-qa-checkbox")).toBeCloseTo(pts("ac-none") + 20, 1);
      expect(byId.get("ac-none")!.nuanceWarnings).toContain("Sem ar-condicionado (-20 pts base)");

      expect(byId.get("ac-text")!.cardTags.acLabel).toBe("Ar-condicionado");
      expect(byId.get("ac-split")!.cardTags.acLabel).toBe("Ar-condicionado Split");
      expect(byId.get("ac-photo")!.cardTags.acLabel).toBe("Ar-condicionado");
      expect(pts("ac-text")).toBeCloseTo(pts("ac-qa-checkbox") + 12, 1);
      expect(byId.get("ac-text")!.cardTags.warningTags).not.toContain(AC_UNCONFIRMED_TAG);
      expect(matchesPropertyFeature(byId.get("ac-text")!, "ac")).toBe(true);

      for (const id of ["ac-none", "ac-negated"]) {
        expect(byId.get(id)!.cardTags.redTags).toContain(AC_ABSENT_TAG);
        expect(byId.get(id)!.cardTags.warningTags).not.toContain(AC_UNCONFIRMED_TAG);
      }
      expect(pts("ac-negated")).toBeCloseTo(pts("ac-none"), 1);
    });
  });

  it("shows the red 'Sem ar-condicionado' tag when a photo audit marks the AC as false", () => {
    withOverrides({ "quintoandar:ac-false": { ...modernOverride, falseAC: true } }, () => {
      const ev = evaluate([rule({ id: "ac-false", description: "Split na sala e no quarto." })]).get("ac-false")!;
      expect(ev.cardTags.acLabel).toBeNull();
      expect(ev.cardTags.redTags).toContain(AC_ABSENT_TAG);
    });
  });

  it("lets an explicit 'no doorman' structured field beat biometria / app-access text", () => {
    const description = "Portaria totalmente automatizada (biometria e acesso remoto por aplicativo).";
    const byId = evaluate([
      rule({ id: "door-none", doorman: "NotAvailable", description }),
      rule({ id: "door-none-24h-text", doorman: "NotAvailable", description: "Portaria 24h." }),
      rule({ id: "door-24h", doorman: "NightAndDayShift", description }),
      rule({ id: "door-unknown", doorman: null, description }),
    ]);
    for (const id of ["door-none", "door-none-24h-text"]) {
      expect(byId.get(id)!.nuanceHighlights).not.toContain("Portaria 24h / Biometria");
      expect(byId.get(id)!.nuanceWarnings.join(" ")).toMatch(/Sem portaria 24h/);
      expect(matchesPropertyFeature(byId.get(id)!, "doorman_24h")).toBe(false);
    }
    expect(byId.get("door-24h")!.nuanceHighlights).toContain("Portaria 24h / Biometria");
    expect(byId.get("door-unknown")!.nuanceHighlights).toContain("Portaria 24h / Biometria");
    expect(byId.get("door-24h")!.breakdown.nuancesPoints).toBeCloseTo(
      byId.get("door-none")!.breakdown.nuancesPoints + 12,
      1,
    );
  });

  it("does not treat 'sol da manhã' as evidence that a Zap floor=1 is a placeholder", () => {
    const zap = (overrides: Partial<SlimPropertyRecord>) =>
      rule({ provider: "zapimoveis", floor: 1, floorRange: null, totalFloors: null, ...overrides });
    const byId = evaluate([
      zap({ id: "zap-1-sun", description: "Apartamento com vista sol da manhã." }),
      zap({ id: "zap-1-tall", totalFloors: 12, description: "Apartamento com vista sol da manhã." }),
      zap({ id: "zap-1-andar-alto", description: "Andar alto, sol da manhã." }),
    ]);
    expect(byId.get("zap-1-sun")!.cardTags.floorTag?.label).toBe("Andar baixo (1º andar)");
    expect(byId.get("zap-1-sun")!.nuanceWarnings).toContain("Andar baixo (1º andar) (-22 pts base)");
    expect(byId.get("zap-1-tall")!.cardTags.lowFloorLabel).toBeNull();
    expect(byId.get("zap-1-andar-alto")!.cardTags.lowFloorLabel).toBeNull();
  });

  it("gives the open-view bonus only for text confirmation (not a checkbox alone) and lets a photo audit cancel it", () => {
    const megaInstalls = ["Elevador", "Brinquedoteca", "Playground", "Quadra esportiva", "Salão de jogos"];
    withOverrides({ "quintoandar:view-false": { ...modernOverride, falseFreeView: true } }, () => {
      const byId = evaluate([
        rule({ id: "view-mega-none", installations: megaInstalls }),
        rule({ id: "view-mega-checkbox", installations: megaInstalls, comfortCommodities: ["Vista livre"] }),
        rule({ id: "view-mega-text", installations: megaInstalls, description: "Vista livre e definitiva." }),
        rule({ id: "view-single-none" }),
        rule({ id: "view-single-checkbox", comfortCommodities: ["Vista livre"] }),
        rule({ id: "view-zap-panoramic", provider: "zapimoveis", amenities: ["PANORAMIC_VIEW"] }),
        rule({ id: "view-checkbox-and-text", comfortCommodities: ["Vista livre"], description: "Andar alto com vista livre para a serra." }),
        rule({ id: "view-false", comfortCommodities: ["Vista livre"], description: "Vista livre e definitiva." }),
      ]);
      const pts = (id: string) => byId.get(id)!.breakdown.nuancesPoints;
      expect(pts("view-mega-checkbox")).toBeCloseTo(pts("view-mega-none"), 1);
      expect(pts("view-mega-text")).toBeCloseTo(pts("view-mega-none") + 8, 1);
      for (const id of ["view-single-checkbox", "view-zap-panoramic"]) {
        expect(pts(id), id).toBeCloseTo(pts("view-single-none"), 1);
        expect(byId.get(id)!.cardTags.greenTags, id).not.toContain("Vista livre");
        expect(byId.get(id)!.nuanceWarnings.join(" "), id).toMatch(/Vista livre só marcada no checklist/);
      }
      expect(byId.get("view-checkbox-and-text")!.cardTags.greenTags).toContain("Vista livre");
      expect(byId.get("view-false")!.cardTags.greenTags).not.toContain("Vista livre");
      expect(pts("view-false")).toBeCloseTo(pts("view-single-none"), 1);
    });
  });

  it("uses a photo-audit floorHint only when floor data is missing, and drops cabinet bonuses on noCabinets", () => {
    withOverrides(
      {
        "quintoandar:hint-high": { ...modernOverride, floorHint: "HIGH" },
        "quintoandar:hint-high-known-floor": { ...modernOverride, floorHint: "HIGH" },
        "quintoandar:hint-none": modernOverride,
        "quintoandar:cab-none": { ...modernOverride, noCabinets: true },
        "quintoandar:cab-ok": modernOverride,
      },
      () => {
        const byId = evaluate([
          rule({ id: "hint-high", floor: null, floorRange: null, totalFloors: null }),
          rule({ id: "hint-none", floor: null, floorRange: null, totalFloors: null }),
          rule({ id: "hint-high-known-floor", floor: 2, floorRange: null, totalFloors: 10 }),
          rule({ id: "cab-none", amenities: ["Box", "Armários na cozinha", "Armários no quarto"] }),
          rule({ id: "cab-ok", amenities: ["Box", "Armários na cozinha", "Armários no quarto"] }),
        ]);
        expect(byId.get("hint-high")!.cardTags.highFloorLabel).toBe("Andar alto");
        expect(byId.get("hint-high")!.breakdown.nuancesPoints).toBeCloseTo(
          byId.get("hint-none")!.breakdown.nuancesPoints + 9,
          1,
        );
        expect(byId.get("hint-high-known-floor")!.cardTags.lowFloorLabel).toBe("Andar baixo (2º andar)");
        expect(byId.get("cab-ok")!.nuanceHighlights).toContain("Marcenaria / armários planejados");
        expect(byId.get("cab-none")!.nuanceHighlights.join(" ")).not.toMatch(/arm[aá]rios/i);
      },
    );
  });

  it("detects apart-hotels by serviced signals plus a hotel-level condo fee, without flagging regular condos", () => {
    const flat = (overrides: Partial<SlimPropertyRecord>): SlimPropertyRecord =>
      rule({ condominiumName: null, furnished: true, rent: 2500, condoFee: 1400, ...overrides });
    const positives = [
      flat({ id: "ah-top-life", condominiumName: "Moema Top Life", rent: 2000, condoFee: 1470 }),
      flat({ id: "ah-flat-text", description: "Flat para alugar com 45 m², 1 quarto." }),
      flat({ id: "ah-camareira", rent: 4000, condoFee: 1490, description: "Incluído no condomínio: serviços de camareira." }),
      flat({ id: "ah-ratio", rent: 1800, condoFee: 950, furnished: null, description: "Apart-hotel com recepção." }),
      flat({ id: "ah-brand", condominiumName: "Mercure Lourdes", condoFee: 400, furnished: false }),
      flat({ id: "ah-name-low-fee", condominiumName: "Square Apart Hotel", rent: 3200, condoFee: 730 }),
    ];
    const negatives = [
      flat({ id: "nah-regular", condominiumName: "Residencial Jardins", condoFee: 1300, description: "Portaria 24h, piscina e academia." }),
      flat({ id: "nah-tv-flat", condoFee: 1500, description: "Sala com smart TV flat e sofá." }),
      flat({ id: "nah-low-fee", rent: 4400, condoFee: 700, description: "Flat duplex loft exclusivo." }),
      flat({ id: "nah-unfurnished", furnished: false, description: "Flat para alugar, sem mobília." }),
      flat({ id: "nah-reception", furnished: null, condoFee: 1300, description: "Recepção 24h e piscina." }),
    ];
    for (const p of positives) expect(isApartHotelListing(p), p.id).toBe(true);
    for (const p of negatives) expect(isApartHotelListing(p), p.id).toBe(false);
    expect(classifyFurnitureTier(positives[1]!)).toBe("FULLY_FURNISHED");
    // A QuintoAndar hasFurniture flag alone means furnished, so check the apart-hotel rule on a Zap listing.
    expect(classifyFurnitureTier({ ...negatives[0]!, provider: "zapimoveis" })).toBe("UNFURNISHED");
  });

  it("marks QuintoAndar listings found unavailable as inactive unless they were republished afterwards", () => {
    expect(isQuintoAndarUnavailableHtml("<h1>Esse imóvel está indisponível :(</h1>")).toBe(true);
    expect(isQuintoAndarUnavailableHtml("<h1>Apartamento com 1 quarto disponível</h1>")).toBe(false);

    const deactivations = {
      "quintoandar:gone": { deactivatedAt: "2026-10-17T12:00:00.000Z", reason: "QuintoAndar: imóvel indisponível" },
      "quintoandar:relisted": { deactivatedAt: "2026-10-01T12:00:00.000Z", reason: "QuintoAndar: imóvel indisponível" },
    };
    const [gone, relisted, live] = applyListingDeactivations(
      [
        rule({ id: "gone", isActive: true, deactivatedAt: null }),
        rule({ id: "relisted", isActive: true, listingUpdatedAt: "2026-10-10T00:00:00.000Z" }),
        rule({ id: "live", isActive: true }),
      ],
      deactivations,
    );
    expect(gone!.isActive).toBe(false);
    expect(gone!.deactivatedAt).toBe("2026-10-17T12:00:00.000Z");
    expect(relisted!.isActive).toBe(true);
    expect(live!.isActive).toBe(true);
    expect(evaluate([gone!, live!]).get("gone")!.overallRank).toBeNull();
  });
});

describe("Round-2 audit rules: duplicates, price/IPTU, lofts, furniture, cobertura/varanda, bare shell, AC, commute, noise", () => {
  const rankedNbs = computeDynamicNeighborhoods(SAMPLE_NEIGHBORHOODS, DEFAULT_WEIGHTS).ranked;
  const unit = (overrides: Partial<SlimPropertyRecord>): SlimPropertyRecord => ({
    ...SAMPLE_PROPERTIES[0]!,
    id: "r2-base",
    neighborhood: "Funcionários",
    street: "Rua Alagoas",
    streetNumber: null,
    title: "Apartamento 1 quarto",
    description: "Apartamento com 1 vaga.",
    generatedDescription: null,
    floor: null,
    floorRange: null,
    totalFloors: null,
    installations: ["Elevador"],
    amenities: ["Box", "Armários na cozinha"],
    comfortCommodities: [],
    practicalityCommodities: [],
    photoCaptions: [],
    positiveSignals: [],
    ...overrides,
  });
  const evaluate = (props: SlimPropertyRecord[]) =>
    new Map(computeDynamicProperties(props, rankedNbs, DEFAULT_WEIGHTS).map((p) => [p.id, p]));
  const withOverrides = (entries: Record<string, PhotoAuditOverride>, run: () => void) => {
    Object.assign(PHOTO_AUDIT_OVERRIDES, entries);
    try {
      run();
    } finally {
      for (const key of Object.keys(entries)) delete PHOTO_AUDIT_OVERRIDES[key];
    }
  };
  const modern: PhotoAuditOverride = { modernityScore: 90, modernityTier: "MODERN_OR_RENOVATED" };

  it("merges cross-portal duplicates: fills floor/doorman/description, takes the smaller area and earliest date, tags the twin", () => {
    const qa = unit({
      id: "dup-qa",
      streetNumber: "47",
      street: "Rua Dom Vital",
      rent: 3400,
      condoFee: 380,
      areaM2: 40,
      floorRange: { min: 0, max: 3 },
      doorman: "NotAvailable",
      description: null,
      publishedAt: "2026-09-11T03:23:58.000Z",
    });
    const iw = unit({
      id: "dup-iw",
      provider: "imovelweb",
      streetNumber: "47",
      street: "R. Dom Vital",
      rent: 3400,
      condoFee: 380,
      areaM2: 48,
      doorman: null,
      description: "Sala com ar condicionado e 1 vaga de garagem livre.",
      publishedAt: "2026-10-16T11:20:27.000Z",
    });
    const otherUnit = unit({ id: "dup-other", provider: "zapimoveis", streetNumber: "47", street: "Rua Dom Vital", rent: 4100 });
    const sameProvider = unit({ id: "dup-same-provider", streetNumber: "47", street: "Rua Dom Vital", rent: 3400, condoFee: 380 });
    expect(findCrossPortalDuplicateGroups([qa, iw, otherUnit, sameProvider]).map((g) => g.map((p) => p.id).sort())).toEqual([
      ["dup-iw", "dup-qa"],
    ]);

    const byId = evaluate([qa, iw, otherUnit]);
    const evIw = byId.get("dup-iw")!;
    const evQa = byId.get("dup-qa")!;
    expect(evIw.areaM2).toBe(40);
    expect(evIw.doorman).toBe("NotAvailable");
    expect(evIw.cardTags.lowFloorLabel).toBe("Andar baixo (1º–3º andar)");
    expect(evIw.publishedAt).toBe("2026-09-11T03:23:58.000Z");
    expect(evIw.cardTags.warningTags).toContain("Também anunciado em QuintoAndar");
    expect(evQa.description).toMatch(/ar condicionado/);
    expect(evQa.cardTags.acLabel).toBe("Ar-condicionado");
    expect(evQa.cardTags.warningTags).toContain("Também anunciado em Imovelweb");
    expect(byId.get("dup-other")!.alsoListedOn).toBeUndefined();

    const zapPlaceholder = unit({ id: "dup-zap", provider: "zapimoveis", streetNumber: "9", floor: 0, rent: 3000 });
    const qaNoFloor = unit({ id: "dup-qa-nofloor", streetNumber: "9", floor: null, rent: 3000 });
    const [, mergedQa] = prepareListingsForScoring([zapPlaceholder, qaNoFloor]);
    expect(mergedQa!.alsoListedOn).toEqual(["zapimoveis:dup-zap"]);
    expect(mergedQa!.floor).toBeNull();
  });

  it("uses a higher rent stated in the description for the total and flags the mismatch", () => {
    expect(extractDescriptionRent("Condomínio: R$ 800,00 | IPTU mensal: R$ 156,00 | Aluguel: R$ 4.200,00.")).toBe(4200);
    expect(extractDescriptionRent("O valor do aluguel R$ 3.900 já com desconto.")).toBe(3900);
    expect(extractDescriptionRent("Aluguel + condomínio: R$ 5.000")).toBeNull();
    expect(extractDescriptionRent("Valor total do aluguel R$ 5.156 (pacote)")).toBeNull();
    expect(extractDescriptionRent("Aluguel R$ 4.000 + condomínio")).toBeNull();

    const byId = evaluate([
      unit({ id: "price-higher", rent: 4000, totalMonthly: 4956, iptu: 156, description: "Aluguel: R$ 4.200,00." }),
      unit({ id: "price-lower", rent: 4000, totalMonthly: 4956, iptu: 156, description: "Aluguel: R$ 3.800,00." }),
      unit({ id: "price-sale", rent: 4000, totalMonthly: 4956, iptu: 156, description: "Aluguel R$ 650.000 (venda)." }),
    ]);
    const higher = byId.get("price-higher")!;
    expect(higher.rent).toBe(4200);
    expect(higher.listedRent).toBe(4000);
    expect(higher.totalMonthly).toBe(5156);
    expect(higher.cardTags.warningTags).toContain(PRICE_MISMATCH_TAG);
    for (const id of ["price-lower", "price-sale"]) {
      expect(byId.get(id)!.totalMonthly).toBe(4956);
      expect(byId.get(id)!.cardTags.warningTags).not.toContain(PRICE_MISMATCH_TAG);
    }
  });

  it("estimates IPTU at R$ 2,50/m² when missing, 'sob estimativa' or implausibly low", () => {
    const byId = evaluate([
      unit({ id: "iptu-low", areaM2: 66, iptu: 30, totalMonthly: 4825 }),
      unit({ id: "iptu-estimativa", areaM2: 60, iptu: 100, totalMonthly: 4000, description: "IPTU sob estimativa." }),
      unit({ id: "iptu-exempt", areaM2: 60, iptu: 0, totalMonthly: 4000, description: "Imóvel isento de IPTU." }),
      unit({ id: "iptu-ok", areaM2: 60, iptu: 200, totalMonthly: 4000 }),
    ]);
    expect(byId.get("iptu-low")!.iptu).toBe(165);
    expect(byId.get("iptu-low")!.listedIptu).toBe(30);
    expect(byId.get("iptu-low")!.totalMonthly).toBe(4960);
    expect(byId.get("iptu-low")!.nuanceWarnings.join(" ")).toMatch(/IPTU estimado em R\$ 165/);
    expect(byId.get("iptu-estimativa")!.iptu).toBe(150);
    expect(byId.get("iptu-estimativa")!.totalMonthly).toBe(4050);
    for (const id of ["iptu-exempt", "iptu-ok"]) {
      expect(byId.get(id)!.listedIptu).toBeUndefined();
      expect(byId.get(id)!.totalMonthly).toBe(4000);
    }
  });

  it("only gives duplex/cobertura bonuses on real elevation; lofts get +3 and keep the low-floor penalty", () => {
    expect(extractExplicitFloorFromText("A unidade está localizada no 3o andar, sol da manhã.")).toBe(3);
    expect(extractExplicitFloorFromText("Apartamento no 3° andar.")).toBe(3);
    expect(extractExplicitFloorFromText("Apartamento no 3º andar.")).toBe(3);

    const byId = evaluate([
      unit({
        id: "loft-lowrise-top",
        areaM2: 50,
        floorRange: { min: 4, max: 7 },
        amenities: ["Box", "Armários na cozinha", "Apartamento cobertura"],
        description: "Loft com área de 50 m². Último andar do prédio (4o andar).",
      }),
      unit({
        id: "loft-small-high",
        areaM2: 45,
        floorRange: { min: 8, max: 11 },
        description: "Imóvel com pé direito duplo de 45 m², varanda com vista.",
      }),
      unit({
        id: "loft-low",
        areaM2: 60,
        floorRange: { min: 0, max: 3 },
        description: "Duplex com suíte no mezanino superior. A unidade está localizada no 3o andar.",
      }),
      unit({ id: "duplex-big-mid", areaM2: 80, floor: 10, totalFloors: 20, description: "Apartamento duplex amplo." }),
      unit({ id: "cobertura-top", areaM2: 90, floor: 20, totalFloors: 20, description: "Cobertura com terraço." }),
      unit({ id: "plain-mid", areaM2: 50, floorRange: { min: 4, max: 7 } }),
      unit({ id: "plain-high", areaM2: 45, floorRange: { min: 8, max: 11 } }),
      unit({ id: "plain-low", areaM2: 60, floorRange: { min: 0, max: 3 }, description: "A unidade está localizada no 3o andar." }),
    ]);
    const pts = (id: string) => byId.get(id)!.breakdown.nuancesPoints;
    const lowriseTop = byId.get("loft-lowrise-top")!;
    expect(lowriseTop.cardTags.floorTag).toEqual({ label: "Andar médio (4º–7º andar)", rarity: "rare" });
    expect(lowriseTop.nuanceHighlights).toContain("Pé-direito duplo (loft)");
    expect(pts("loft-lowrise-top")).toBeCloseTo(pts("plain-mid") + 3, 1);

    expect(byId.get("loft-small-high")!.cardTags.floorTag?.rarity).toBe("epic");
    expect(byId.get("loft-small-high")!.nuanceHighlights).not.toContain("Duplex / Pé-direito duplo");

    const low = byId.get("loft-low")!;
    expect(low.cardTags.lowFloorLabel).toBe("Andar baixo (3º andar)");
    expect(pts("loft-low")).toBeCloseTo(pts("plain-low") + 3, 1);

    expect(byId.get("duplex-big-mid")!.cardTags.floorTag).toEqual({ label: "Duplex / Pé-direito duplo", rarity: "legendary" });
    expect(byId.get("cobertura-top")!.cardTags.floorTag).toEqual({
      label: "Cobertura / Duplex (Último andar)",
      rarity: "legendary",
    });
    expect(pts("plain-high")).toBeGreaterThan(0);
  });

  it("classifies 'mobiliado' text + portal flag as furnished, and warns on furniture conflicts without changing the score", () => {
    expect(describeFurnitureInText("Apartamento todo mobiliado, pronto para morar.")).toBe("furnished");
    expect(describeFurnitureInText("Alugado mobiliado, porteira fechada.")).toBe("furnished");
    expect(describeFurnitureInText("Apartamento semi-mobiliado.")).toBe("unfurnished");
    expect(describeFurnitureInText("Não mobiliado, apenas armários.")).toBe("unfurnished");
    expect(describeFurnitureInText("Pode ser alugado mobiliado ou sem mobília.")).toBeNull();
    expect(describeFurnitureInText("Apartamento com 1 vaga.")).toBeNull();

    expect(classifyFurnitureTier(unit({ id: "f-flag-text", furnished: true, description: "Todo reformado e mobiliado." }))).toBe(
      "FULLY_FURNISHED",
    );
    // QuintoAndar's hasFurniture flag counts as the full set; a bare Zap furnished=true still needs text or the amenity.
    expect(classifyFurnitureTier(unit({ id: "f-flag-only", furnished: true, description: "Apartamento reformado." }))).toBe(
      "FULLY_FURNISHED",
    );
    expect(
      classifyFurnitureTier(
        unit({ id: "f-zap-flag-only", provider: "zapimoveis", furnished: true, description: "Apartamento reformado." }),
      ),
    ).toBe("UNFURNISHED");
    expect(classifyFurnitureTier(unit({ id: "f-text-only", furnished: false, description: "Apartamento mobiliado." }))).toBe(
      "UNFURNISHED",
    );
    expect(
      classifyFurnitureTier(unit({ id: "f-semi", furnished: true, description: "Semi-mobiliado, só armários." })),
    ).toBe("UNFURNISHED");

    withOverrides({ "quintoandar:f-audit-unf": { ...modern, furnishedTier: "UNFURNISHED" } }, () => {
      const byId = evaluate([
        unit({ id: "f-audit-unf", furnished: true, description: "Elegante apartamento mobiliado, completíssimo." }),
        unit({ id: "f-text-only", furnished: false, description: "Apartamento mobiliado." }),
        unit({ id: "f-no-conflict", furnished: false, description: "Apartamento sem mobília." }),
      ]);
      expect(byId.get("f-audit-unf")!.furnitureTier).toBe("UNFURNISHED");
      for (const id of ["f-audit-unf", "f-text-only"]) {
        expect(byId.get(id)!.cardTags.warningTags).toContain(FURNITURE_CONFLICT_TAG);
      }
      expect(byId.get("f-no-conflict")!.cardTags.warningTags).not.toContain(FURNITURE_CONFLICT_TAG);
      expect(byId.get("f-text-only")!.finalScore).toBeCloseTo(byId.get("f-no-conflict")!.finalScore, 1);
    });
  });

  it("requires corroboration for cobertura checkboxes and drops integrated balconies unless a photo audit verifies one", () => {
    withOverrides({ "quintoandar:bal-verified": { ...modern, verifiedBalcony: true }, "quintoandar:bal-none": modern }, () => {
      const byId = evaluate([
        unit({ id: "cob-checkbox", areaM2: 45, floorRange: { min: 12, max: 15 }, amenities: ["Box", "Apartamento cobertura"] }),
        unit({ id: "cob-checkbox-big", areaM2: 75, floorRange: { min: 12, max: 15 }, amenities: ["Box", "Apartamento cobertura"] }),
        unit({ id: "bal-checkbox", amenities: ["Box", "Varanda"] }),
        unit({ id: "bal-integrated", amenities: ["Box", "Varanda"], description: "Sala ampla com varanda integrada." }),
        unit({ id: "bal-glass", description: "Varanda fechada com vidro." }),
        unit({ id: "bal-verified" }),
        unit({ id: "bal-none" }),
      ]);
      expect(byId.get("cob-checkbox")!.nuanceHighlights).not.toContain("Cobertura");
      expect(byId.get("cob-checkbox-big")!.cardTags.floorTag?.label).toBe("Cobertura");
      expect(byId.get("bal-checkbox")!.nuanceHighlights).toContain("Varanda");
      expect(byId.get("bal-integrated")!.nuanceHighlights).not.toContain("Varanda");
      expect(byId.get("bal-glass")!.nuanceHighlights).toContain("Varanda");
      expect(byId.get("bal-verified")!.nuanceHighlights).toContain("Varanda");
      expect(byId.get("bal-verified")!.breakdown.nuancesPoints).toBeCloseTo(byId.get("bal-none")!.breakdown.nuancesPoints + 5, 1);
    });
  });

  it("penalizes bare-shell units (no cabinets anywhere) in the nuances only, keeping the full unfurnished bonus", () => {
    const checklist = ["Varanda", "Cozinha americana", "Área de serviço", "Pode ter animais de estimação", "Quartos e corredores com portas amplas"];
    withOverrides({ "quintoandar:shell-audit": { ...modern, noCabinets: true } }, () => {
      const byId = evaluate([
        unit({ id: "shell-nobox", amenities: checklist, practicalityCommodities: ["Tanque"] }),
        unit({ id: "shell-box", amenities: ["Box", ...checklist], practicalityCommodities: ["Tanque"] }),
        unit({ id: "shell-audit" }),
        unit({ id: "shell-cabinets", amenities: ["Box", "Armários na cozinha", ...checklist], practicalityCommodities: ["Tanque"] }),
        unit({ id: "shell-sparse", amenities: ["Varanda"] }),
        unit({ id: "shell-zap", provider: "zapimoveis", amenities: ["POOL", "GYM", "BALCONY", "ELEVATOR", "PARTY_HALL", "GARDEN"] }),
      ]);
      const ev = (id: string) => byId.get(id)!;
      expect(ev("shell-nobox").nuanceWarnings.join(" ")).toMatch(/Sem nenhum armário[\s\S]*Banheiro sem box/);
      expect(ev("shell-nobox").breakdown.furniturePoints).toBe(DEFAULT_WEIGHTS.unfurnishedBonus);
      expect(ev("shell-box").breakdown.nuancesPoints).toBeCloseTo(ev("shell-nobox").breakdown.nuancesPoints + 2, 1);
      expect(ev("shell-audit").breakdown.furniturePoints).toBe(DEFAULT_WEIGHTS.unfurnishedBonus);
      expect(ev("shell-audit").nuanceWarnings.join(" ")).toMatch(/Sem nenhum armário[^|]*-6 pts/);
      for (const id of ["shell-cabinets", "shell-sparse", "shell-zap"]) {
        expect(ev(id).nuanceWarnings.join(" "), id).not.toMatch(/Sem nenhum armário/);
        expect(ev(id).breakdown.furniturePoints, id).toBe(DEFAULT_WEIGHTS.unfurnishedBonus);
      }
    });
  });

  it("trusts the AC checkbox on new/renovated units with modernity >= 85 unless an audit says there is no split", () => {
    const checkbox = { comfortCommodities: ["Ar condicionado"], condition: "NEW_OR_RENOVATED" as const };
    withOverrides(
      {
        "quintoandar:ac-trust-false": { ...modern, falseAC: true },
        "quintoandar:ac-trust-audit-nosplit": { ...modern, visualWarnings: ["Sem split instalado"] },
      },
      () => {
        const byId = evaluate([
          unit({ id: "ac-trust", ...checkbox, modernityScore: 90 }),
          unit({ id: "ac-trust-false", ...checkbox }),
          unit({ id: "ac-trust-audit-nosplit", ...checkbox }),
          unit({ id: "ac-trust-dated", ...checkbox, modernityScore: 80, constructionYear: null }),
          unit({ id: "ac-trust-used", ...checkbox, condition: "USED", constructionYear: null, modernityScore: 90 }),
          unit({ id: "ac-trust-infra", ...checkbox, modernityScore: 90, description: "Ponto para ar-condicionado na sala." }),
        ]);
        expect(byId.get("ac-trust")!.cardTags.acLabel).toBe("Ar-condicionado");
        expect(byId.get("ac-trust-false")!.cardTags.redTags).toContain(AC_ABSENT_TAG);
        for (const id of ["ac-trust-audit-nosplit", "ac-trust-dated", "ac-trust-used"]) {
          expect(byId.get(id)!.cardTags.warningTags, id).toContain(AC_UNCONFIRMED_TAG);
        }
        expect(byId.get("ac-trust-infra")!.cardTags.warningTags).toContain(AC_INFRA_ONLY_TAG);
      },
    );
  });

  it("treats the BH south axis (Vila da Serra, Vale do Sereno, Belvedere) as a 30–50 min BR-356 commute", () => {
    const byId = evaluate([
      unit({ id: "nb-vila-serra", neighborhood: "Vila da Serra" }),
      unit({ id: "nb-sereno", neighborhood: "Vale do Sereno" }),
      unit({ id: "nb-belvedere", neighborhood: "Belvedere" }),
    ]);
    expect(byId.get("nb-vila-serra")!.commuteLabel).toBe("30–50 min");
    expect(byId.get("nb-sereno")!.commuteLabel).toBe("30–50 min");
    expect(byId.get("nb-belvedere")!.commuteLabel).toBe("25–45 min");
    for (const p of byId.values()) {
      expect(p.eligible).toBe(true);
      expect(p.breakdown.commutePoints).toBeLessThan(-3);
    }
  });

  it("flags hospital-cluster noise (halved on high floors) and ignores 'Rua silenciosa' on busy streets", () => {
    const byId = evaluate([
      unit({ id: "hosp-low", neighborhood: "Santa Efigênia", street: "Rua Padre Marinho", floor: 5 }),
      unit({ id: "hosp-high", neighborhood: "Santa Efigênia", street: "Rua Padre Marinho", floor: 16 }),
      unit({ id: "hosp-none-low", neighborhood: "Santa Efigênia", street: "Rua Piauí", floor: 5 }),
      unit({ id: "hosp-none-high", neighborhood: "Santa Efigênia", street: "Rua Piauí", floor: 16 }),
      unit({ id: "hosp-sp", cityCode: "SP", city: "São Paulo", neighborhood: "Perdizes", street: "Rua Barão do Bananal" }),
      unit({ id: "quiet", comfortCommodities: ["Rua silenciosa"] }),
      unit({ id: "quiet-market", comfortCommodities: ["Rua silenciosa"], description: "Em frente a supermercados e a padaria Romana (24h)." }),
      unit({ id: "quiet-bars", comfortCommodities: ["Rua silenciosa"], description: "Perto dos bares e da vida noturna." }),
      unit({ id: "quiet-posto", comfortCommodities: ["Rua silenciosa"], description: "Ao lado do posto de gasolina." }),
    ]);
    const pts = (id: string) => byId.get(id)!.breakdown.nuancesPoints;
    expect(byId.get("hosp-low")!.cardTags.warningTags).toContain(HOSPITAL_NOISE_TAG);
    expect(pts("hosp-low")).toBeCloseTo(pts("hosp-none-low") - 3, 1);
    expect(pts("hosp-high")).toBeCloseTo(pts("hosp-none-high") - 1.5, 1);
    expect(byId.get("hosp-none-low")!.cardTags.warningTags).not.toContain(HOSPITAL_NOISE_TAG);
    expect(byId.get("hosp-sp")!.cardTags.warningTags).toContain(HOSPITAL_NOISE_TAG);
    expect(byId.get("quiet")!.nuanceHighlights).toContain("Rua silenciosa");
    for (const id of ["quiet-market", "quiet-bars", "quiet-posto"]) {
      expect(byId.get(id)!.nuanceHighlights, id).not.toContain("Rua silenciosa");
    }
  });

  it("keeps Taquaral's lagoa urban breathing only on streets near the lake; farther or unknown streets breathe like Jd. Guanabara", () => {
    const cp = { cityCode: "CP" as const, city: "Campinas", neighborhood: "Taquaral" };
    const byId = evaluate([
      unit({ id: "taq-near", ...cp, street: "Avenida Doutor Heitor Penteado" }),
      unit({ id: "taq-far", ...cp, street: "Rua Otávio Machado" }),
      unit({ id: "taq-unknown", ...cp, street: "Rua não informada" }),
      unit({ id: "bh-a", street: "Rua Alagoas" }),
      unit({ id: "bh-b", street: "Rua Otávio Machado" }),
    ]);
    const nbPts = (id: string) => byId.get(id)!.breakdown.neighborhoodPoints;
    const taquaral = rankedNbs.find((n) => n.neighborhood === "Taquaral")!;
    const farNbScore = computeWeightedNeighborhoodScore(
      {
        urbanBreathing: TAQUARAL_FAR_FROM_LAGOA_URBAN_BREATHING,
        commuteLogistics: taquaral.commuteLogisticsScore,
        buildingStock: taquaral.buildingStockFitScore,
        budgetFit: taquaral.budgetFitScore,
        safetyCar: taquaral.safetyCarScore,
      },
      DEFAULT_WEIGHTS,
    );

    expect(TAQUARAL_FAR_FROM_LAGOA_URBAN_BREATHING).toBe(5.0);
    const toPts = (nbScore: number) => Math.round(nbScore * DEFAULT_WEIGHTS.neighborhoodMultiplier * 10) / 10;
    expect(nbPts("taq-near")).toBe(toPts(taquaral.dynamicScore));
    expect(nbPts("taq-far")).toBe(toPts(farNbScore));
    expect(nbPts("taq-unknown")).toBe(nbPts("taq-far"));
    expect(nbPts("taq-far")).toBeLessThan(nbPts("taq-near") - 5);
    expect(byId.get("taq-near")!.cardTags.greenTags).toContain(TAQUARAL_NEAR_LAGOA_TAG);
    expect(byId.get("taq-near")!.cardTags.warningTags).not.toContain(TAQUARAL_FAR_FROM_LAGOA_TAG);
    for (const id of ["taq-far", "taq-unknown"]) {
      expect(byId.get(id)!.cardTags.warningTags, id).toContain(TAQUARAL_FAR_FROM_LAGOA_TAG);
      expect(byId.get(id)!.nuanceWarnings.join(" "), id).toMatch(/Longe da Lagoa do Taquaral/);
    }
    expect(nbPts("bh-a")).toBe(nbPts("bh-b"));
    expect(byId.get("bh-b")!.cardTags.warningTags).not.toContain(TAQUARAL_FAR_FROM_LAGOA_TAG);
    expect(computeDynamicNeighborhoods(SAMPLE_NEIGHBORHOODS, DEFAULT_WEIGHTS).ranked).toEqual(rankedNbs);
  });

  it("counts 'vaga fixa' as demarcated parking, rewards a guarita without doorman data, and skips individual utilities", () => {
    const byId = evaluate([
      unit({ id: "vaga-fixa", description: "1 vaga fixa na garagem." }),
      unit({ id: "vaga-coberta-fixa", description: "Vaga coberta e fixa." }),
      unit({ id: "vaga-plain", description: "1 vaga na garagem." }),
      unit({ id: "guarita", doorman: null, description: "Guarita de segurança e portão eletrônico." }),
      unit({ id: "guarita-no-doorman", doorman: "NotAvailable", description: "Guarita de segurança e portão eletrônico." }),
      unit({ id: "no-guarita", doorman: null, description: "Portão eletrônico." }),
      unit({ id: "agua-individual", description: "Consumos de água e gás individuais." }),
      unit({ id: "agua-individual-2", description: "Água e gás individualizados." }),
      unit({ id: "agua-inclusa", description: "Água e gás inclusos no condomínio." }),
    ]);
    const hl = (id: string) => byId.get(id)!.nuanceHighlights;
    expect(hl("vaga-fixa")).toContain("Vaga livre e demarcada");
    expect(hl("vaga-coberta-fixa")).toContain("Vaga livre e demarcada");
    expect(hl("vaga-plain")).not.toContain("Vaga livre e demarcada");
    expect(hl("guarita")).toContain("Guarita de segurança");
    expect(byId.get("guarita")!.breakdown.nuancesPoints).toBeCloseTo(byId.get("no-guarita")!.breakdown.nuancesPoints + 2.5, 1);
    expect(hl("guarita-no-doorman")).not.toContain("Guarita de segurança");
    expect(hl("agua-individual")).not.toContain("Água/gás inclusos no condomínio");
    expect(hl("agua-individual-2")).not.toContain("Água/gás inclusos no condomínio");
    expect(hl("agua-inclusa")).toContain("Água/gás inclusos no condomínio");
  });
});

describe("Round-3 audit rules: prepared AC, non-free parking wording, text-only modernity, nuance overlap, labels", () => {
  const rankedNbs = computeDynamicNeighborhoods(SAMPLE_NEIGHBORHOODS, DEFAULT_WEIGHTS).ranked;
  const unit = (overrides: Partial<SlimPropertyRecord>): SlimPropertyRecord => ({
    ...SAMPLE_PROPERTIES[0]!,
    id: "r3-base",
    neighborhood: "Funcionários",
    street: "Rua Alagoas",
    streetNumber: null,
    title: "Apartamento 1 quarto",
    description: "Apartamento com 1 vaga.",
    generatedDescription: null,
    condition: "USED",
    constructionYear: null,
    floor: null,
    floorRange: null,
    totalFloors: null,
    installations: ["Elevador"],
    amenities: ["Box", "Armários na cozinha"],
    comfortCommodities: [],
    practicalityCommodities: [],
    photoCaptions: [],
    positiveSignals: [],
    negativeSignals: [],
    modernityScore: 70,
    modernityTier: "WELL_MAINTAINED",
    ...overrides,
  });
  const evaluate = (props: SlimPropertyRecord[]) =>
    new Map(computeDynamicProperties(props, rankedNbs, DEFAULT_WEIGHTS).map((p) => [p.id, p]));
  const withOverrides = (entries: Record<string, PhotoAuditOverride>, run: () => void) => {
    Object.assign(PHOTO_AUDIT_OVERRIDES, entries);
    try {
      run();
    } finally {
      for (const key of Object.keys(entries)) delete PHOTO_AUDIT_OVERRIDES[key];
    }
  };

  it("treats AC infrastructure wording as 'not installed' (0 pts, amber) and ignores climatized shared areas", () => {
    const byId = evaluate([
      unit({ id: "ac-none" }),
      unit({ id: "infra-pronta", description: "Possui infraestrutura pronta para instalação de ar-condicionado na sala e no dormitório." }),
      unit({ id: "infra-preparado", description: "Apartamento preparado para receber ar condicionado." }),
      unit({ id: "infra-tubulacao", description: "Tubulação já instalada para ar split nos quartos." }),
      unit({ id: "infra-pontos", description: "Pontos de ar nos dois quartos." }),
      unit({ id: "academia-climatizada", description: "Condomínio com piscina com raia, academia equipada e climatizada e coworking." }),
      unit({ id: "piscina-climatizada", description: "Lazer com piscina climatizada e salão de festas." }),
      unit({ id: "unit-climatizado", description: "Apartamento todo climatizado." }),
      unit({ id: "split-and-gym", description: "Sala com split e academia climatizada." }),
      unit({ id: "infra-condo-and-ac", description: "Prédio com infraestrutura completa e ar-condicionado em todos os quartos." }),
      unit({ id: "ar-livre", description: "Ponto de encontro com área ao ar livre." }),
    ]);
    const ev = (id: string) => byId.get(id)!;
    for (const id of ["infra-pronta", "infra-preparado", "infra-tubulacao", "infra-pontos"]) {
      expect(ev(id).cardTags.acLabel, id).toBeNull();
      expect(ev(id).cardTags.warningTags, id).toContain(AC_INFRA_ONLY_TAG);
      expect(ev(id).cardTags.warningTags, id).not.toContain(AC_UNCONFIRMED_TAG);
      expect(ev(id).cardTags.redTags, id).not.toContain(AC_ABSENT_TAG);
      expect(ev(id).breakdown.nuancesPoints, id).toBeCloseTo(ev("ac-none").breakdown.nuancesPoints + 20, 1);
    }
    for (const id of ["academia-climatizada", "piscina-climatizada"]) {
      expect(ev(id).cardTags.acLabel, id).toBeNull();
      expect(ev(id).cardTags.redTags, id).toContain(AC_ABSENT_TAG);
    }
    expect(ev("unit-climatizado").cardTags.acLabel).toBe("Ar-condicionado");
    expect(ev("split-and-gym").cardTags.acLabel).toBe("Ar-condicionado Split");
    expect(ev("infra-condo-and-ac").cardTags.acLabel).toBe("Ar-condicionado");
    expect(ev("ar-livre").cardTags.warningTags).not.toContain(AC_INFRA_ONLY_TAG);
    expect(ev("ar-livre").cardTags.redTags).toContain(AC_ABSENT_TAG);
  });

  it("retains rotating and valet spots even with descriptive words in between, but not plain non-demarcated ones", () => {
    const byId = evaluate([
      unit({ id: "coberta-rotativa", description: "Conta ainda com 1 vaga de garagem coberta e rotativa no subsolo." }),
      unit({ id: "nao-demarcada-manobrista", description: "1 vaga de garagem, não demarcada, com serviço de manobrista." }),
      unit({ id: "nao-demarcada", description: "Uma vaga de garagem não demarcada." }),
      unit({ id: "livre-nao-demarcada", description: "1 vaga de garagem coberta, livre e não demarcada." }),
      unit({ id: "subsolo-manobrista", description: "1 vaga de garagem no subsolo com manobrista." }),
      unit({ id: "rua-rotativa", description: "1 vaga. Vagas rotativas em frente ao prédio e zona azul na rua." }),
      unit({ id: "nao-e-rotativa", description: "1 vaga demarcada, não é rotativa." }),
      unit({ id: "livre-nao-rotativa", description: "1 vaga de garagem livre, não rotativa." }),
      unit({ id: "sem-manobrista", description: "1 vaga de garagem coberta, sem manobrista." }),
      unit({ id: "livre-demarcada", description: "1 vaga livre e demarcada." }),
      unit({ id: "visitantes", description: "1 vaga livre. Estacionamento com vagas rotativas para visitantes." }),
    ]);
    for (const id of ["coberta-rotativa", "nao-demarcada-manobrista", "subsolo-manobrista"]) {
      expect(byId.get(id)!.eligible, id).toBe(false);
      expect(byId.get(id)!.exclusionReason, id).toContain("Vaga presa, gaveta ou rotativa (eliminado)");
    }
    for (const id of ["rua-rotativa", "nao-e-rotativa", "livre-nao-rotativa", "sem-manobrista", "livre-demarcada", "visitantes", "nao-demarcada", "livre-nao-demarcada"]) {
      expect(byId.get(id)!.eligible, id).toBe(true);
    }
  });

  it("caps text-only modernity at 80 for used units and does not count 'cooktop' alone as a modern kitchen", () => {
    const reformado = {
      modernityScore: 98,
      modernityTier: "MODERN_OR_RENOVATED" as const,
      positiveSignals: ["Reformado / Moderno", "Cooktop / Coifa / Forno embutido", "Marcenaria planejada / Painel"],
      description: "Apartamento reformado, sofisticado e elegante, com cooktop novo e forno embutido e armário planejado.",
    };
    withOverrides({ "quintoandar:cap-audited": { modernityScore: 95, modernityTier: "MODERN_OR_RENOVATED" } }, () => {
      const byId = evaluate([
        unit({ id: "cap-text-only", ...reformado }),
        unit({ id: "cap-year-2018", ...reformado, constructionYear: 2018 }),
        unit({ id: "cap-kitchen", ...reformado, description: `${reformado.description} Cozinha totalmente reformada.` }),
        unit({ id: "cap-porcelanato", ...reformado, description: `${reformado.description} Piso em porcelanato.` }),
        unit({ id: "cap-new", ...reformado, condition: "NEW_OR_RENOVATED" }),
        unit({ id: "cap-audited", ...reformado }),
        unit({ id: "cooktop-only", positiveSignals: ["Cooktop / Coifa / Forno embutido"], description: "Cozinha montada com cooktop." }),
        unit({ id: "cooktop-forno", positiveSignals: ["Cooktop / Coifa / Forno embutido"], description: "Cozinha com cooktop e forno embutido." }),
        unit({ id: "cooktop-checklist", positiveSignals: ["Cooktop / Coifa / Forno embutido"], practicalityCommodities: ["Fogão cooktop"] }),
      ]);
      const mod = (id: string) => byId.get(id)!.modernityScore;
      expect(mod("cap-text-only")).toBe(80);
      for (const id of ["cap-year-2018", "cap-kitchen", "cap-porcelanato", "cap-new"]) {
        expect(mod(id), id).toBeGreaterThan(80);
      }
      expect(mod("cap-audited")).toBe(95);
      // Back at the scraper base (60) only after the cooktop refund: it had a scraper signal, so no 55 reset.
      expect(mod("cooktop-only")).toBe(60);
      expect(mod("cooktop-forno")).toBe(70);
      expect(mod("cooktop-checklist")).toBe(70);
    });
  });

  it("takes AC, cabinetry, flooring and condo leisure points back out of modernity without flipping AC trust", () => {
    const overlap = ["Ar-condicionado Split", "Marcenaria planejada / Painel", "Porcelanato / Vinílico", "Lazer com piscina e academia"];
    withOverrides({ "quintoandar:overlap-audited": { modernityScore: 88, modernityTier: "MODERN_OR_RENOVATED" } }, () => {
      const byId = evaluate([
        unit({ id: "overlap-used", modernityScore: 90, positiveSignals: overlap, description: "Piso em porcelanato." }),
        unit({ id: "overlap-audited", modernityScore: 90, positiveSignals: overlap, description: "Piso em porcelanato." }),
        unit({ id: "overlap-generic-leisure", installations: ["Elevador", "Piscina"], modernityScore: 70 }),
        unit({
          id: "overlap-clamped-new",
          condition: "NEW_OR_RENOVATED",
          constructionYear: 2020,
          modernityScore: 100,
          positiveSignals: ["Construção recente (2020)", "Porcelanato / Vinílico", "Ar-condicionado", "Marcenaria planejada / Painel", "Lazer com piscina e academia", "Flag Novo/Reformado"],
        }),
        unit({
          id: "overlap-ac-trust",
          condition: "NEW_OR_RENOVATED",
          modernityScore: 90,
          comfortCommodities: ["Ar condicionado"],
          practicalityCommodities: ["Fogão cooktop"],
          positiveSignals: ["Cooktop / Coifa / Forno embutido", "Ar-condicionado", "Lazer com piscina e academia", "Flag Novo/Reformado"],
        }),
      ]);
      const ev = (id: string) => byId.get(id)!;
      expect(ev("overlap-used").modernityScore).toBe(90 - 8 - 5 - 8 - 6 + 12);
      expect(ev("overlap-used").nuanceHighlights).toEqual(
        expect.arrayContaining(["Marcenaria / armários planejados", "Piso moderno (porcelanato/vinílico)"]),
      );
      expect(ev("overlap-audited").modernityScore).toBe(88);
      expect(ev("overlap-generic-leisure").modernityScore).toBe(67);
      // Unconfirmed year (-6) and Novo/Reformado flag (-5) bring it below the concrete-evidence ceiling (88), which then caps it.
      expect(ev("overlap-clamped-new").modernityScore).toBe(88);
      expect(ev("overlap-ac-trust").modernityScore).toBe(90 - 4 - 6 - 5);
      expect(ev("overlap-ac-trust").cardTags.acLabel).toBe("Ar-condicionado");
    });
  });

  it("does not give the free-and-demarcated bonus to a free but non-demarcated spot", () => {
    const byId = evaluate([
      unit({ id: "livre-demarcada", description: "1 vaga livre e demarcada." }),
      unit({ id: "livre-nao-demarcada", description: "1 vaga livre, não demarcada." }),
      unit({ id: "sem-demarcacao-manobrista", description: "1 vaga de garagem, sem demarcação, com manobrista." }),
      unit({ id: "presa-nao-demarcada", description: "01 vaga de garagem descoberta, presa e não demarcada." }),
    ]);
    expect(byId.get("livre-demarcada")!.nuanceHighlights).toContain("Vaga livre e demarcada");
    expect(byId.get("livre-nao-demarcada")!.nuanceHighlights).not.toContain("Vaga livre e demarcada");
    expect(byId.get("livre-nao-demarcada")!.eligible).toBe(true);
    expect(byId.get("livre-nao-demarcada")!.nuanceWarnings).not.toContain("Vaga presa / gaveta");
    expect(byId.get("sem-demarcacao-manobrista")!.eligible).toBe(false);
    expect(byId.get("presa-nao-demarcada")!.eligible).toBe(false);
  });

  it("gives back part of the refunded modernity only for concrete modern-unit evidence", () => {
    const overlap = { modernityScore: 90, positiveSignals: ["Ar-condicionado Split", "Marcenaria planejada / Painel", "Lazer com piscina e academia"] };
    const base = 90 - 8 - 5 - 6;
    const byId = evaluate([
      unit({ id: "c-none", ...overlap, description: "Apartamento lindo, acabamento de alto padrão." }),
      unit({ id: "c-floor", ...overlap, description: "Sala e quartos com piso vinílico." }),
      unit({ id: "c-facade", ...overlap, description: "Prédio com fachada em porcelanato." }),
      unit({ id: "c-floor-kitchen", ...overlap, description: "Piso em porcelanato, cozinha e banheiro reformados." }),
      unit({
        id: "c-capped",
        modernityScore: 75,
        positiveSignals: [...overlap.positiveSignals, "Porcelanato / Vinílico"],
        description: "Piso em porcelanato, cozinha reformada.",
      }),
      unit({ id: "c-primeira-locacao", ...overlap, description: "Primeira locação." }),
      unit({ id: "c-negative", ...overlap, negativeSignals: ["Piso antigo"], description: "Primeira locação." }),
      unit({ id: "c-no-refund", modernityScore: 70, description: "Piso em porcelanato." }),
    ]);
    const mod = (id: string) => byId.get(id)!.modernityScore;
    expect(mod("c-none")).toBe(base);
    expect(mod("c-facade")).toBe(base);
    expect(mod("c-floor")).toBe(base + 12);
    expect(mod("c-primeira-locacao")).toBe(base + 12);
    expect(mod("c-floor-kitchen")).toBe(88);
    expect(mod("c-capped")).toBe(75 - 27 + 20);
    expect(mod("c-negative")).toBe(base);
    expect(mod("c-no-refund")).toBe(70);
  });

  it("ships the round-3 photo audits for the five re-audited Top-20 listings", () => {
    expect(PHOTO_AUDIT_OVERRIDES["zapimoveis:2913643725"]).toMatchObject({ falseAC: true });
    expect(PHOTO_AUDIT_OVERRIDES["zapimoveis:2909939228"]).toMatchObject({ modernityScore: 76, verifiedAC: true, furnishedTier: "UNFURNISHED" });
    expect(PHOTO_AUDIT_OVERRIDES["zapimoveis:2913737751"]).toMatchObject({
      modernityScore: 60,
      modernityTier: "STANDARD",
      falseAC: true,
      falseFreeView: true,
    });
    // The top-200 audit re-scored these three from newer photo checks.
    expect(PHOTO_AUDIT_OVERRIDES["zapimoveis:2914284775"]).toMatchObject({ modernityScore: 68, modernityTier: "STANDARD", floorHint: "HIGH" });
    expect(PHOTO_AUDIT_OVERRIDES["zapimoveis:2917501636"]).toMatchObject({ modernityScore: 40, modernityTier: "DATED", verifiedAC: true });
  });

  it("labels Jd. Guanabara at 30–35 min without changing commute points", () => {
    const nbs = computeDynamicNeighborhoods(
      [{ ...SAMPLE_NEIGHBORHOODS[0]!, cityCode: "CP", cityName: "Campinas", neighborhood: "Jd. Guanabara", commuteTime: "20-25 min" }],
      DEFAULT_WEIGHTS,
    ).ranked;
    expect(nbs[0]!.commuteTime).toBe("30-35 min");
    const [p] = computeDynamicProperties(
      [unit({ id: "guanabara", cityCode: "CP", city: "Campinas", neighborhood: "Jd. Guanabara", street: "Rua Barão Geraldo de Resende" })],
      nbs,
      DEFAULT_WEIGHTS,
    );
    expect(p!.commuteLabel).toBe("30–35 min");
    expect(p!.breakdown.commutePoints).toBe(0);
    expect(p!.eligible).toBe(true);
  });

  it("says 'semi-mobiliado' in the furniture-conflict warning when the description says so", () => {
    const byId = evaluate([
      unit({ id: "semi", furnished: true, description: "Apartamento semi mobiliado com armários planejados." }),
      unit({ id: "sem", furnished: true, description: "Apartamento sem mobília." }),
    ]);
    expect(byId.get("semi")!.nuanceWarnings.join(" ")).toContain("Descrição diz semi-mobiliado");
    expect(byId.get("sem")!.nuanceWarnings.join(" ")).toContain("Descrição diz sem mobília");
  });

  it("strips HTML tags and entities from descriptions before text rules run", () => {
    expect(cleanListingText("<b>Sala elegante</b>, com&nbsp;armário&nbsp;&amp; ar.<br/>Quarto &ccedil;&atilde;o &#186;")).toBe(
      "Sala elegante, com armário & ar.\nQuarto ção º",
    );
    expect(cleanListingText("Preço < 5 mil & ótimo")).toBe("Preço < 5 mil & ótimo");
    expect(cleanListingText(null)).toBeNull();
    const [p] = computeDynamicProperties(
      [unit({ id: "html", description: "•<b>1 vaga de garagem</b> coberta e&nbsp;rotativa." })],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    expect(p!.description).toBe("•1 vaga de garagem coberta e rotativa.");
    expect(p!.eligible).toBe(false);
  });
});

describe("Precomputed listing features (ingest) vs. weighted scoring step", () => {
  const { ranked } = computeDynamicNeighborhoods(SAMPLE_NEIGHBORHOODS, DEFAULT_WEIGHTS);

  it("scores precomputed listings exactly like the one-shot pipeline, for every preset", () => {
    const precomputed = precomputeListingFeatures(SAMPLE_PROPERTIES);
    for (const preset of BUILTIN_PRESETS) {
      const nbs = computeDynamicNeighborhoods(SAMPLE_NEIGHBORHOODS, preset.weights).ranked;
      const oneShot = computeDynamicProperties(SAMPLE_PROPERTIES, nbs, preset.weights);
      const split = scorePrecomputedListings(precomputed, nbs, preset.weights);
      expect(split.map((p) => [p.id, p.finalScore, p.eligible, p.overallRank, p.shortJustification])).toEqual(
        oneShot.map((p) => [p.id, p.finalScore, p.eligible, p.overallRank, p.shortJustification]),
      );
    }
  });

  it("keeps both megacondo nuance variants so toggling the weight needs no re-extraction", () => {
    const [listing] = precomputeListingFeatures([SAMPLE_PROPERTIES[0]!]);
    expect(listing!.features.nuancesPenalize).toBeDefined();
    expect(listing!.features.nuancesNoPenalize).toBeDefined();
    const on = scorePrecomputedListings([listing!], ranked, { ...DEFAULT_WEIGHTS, penalizeMegaCondo: true });
    const off = computeDynamicProperties([SAMPLE_PROPERTIES[0]!], ranked, { ...DEFAULT_WEIGHTS, penalizeMegaCondo: false });
    expect(on[0]!.breakdown.nuancesPoints).toBe(listing!.features.nuancesPenalize.rawNuancePoints);
    expect(scorePrecomputedListings([listing!], ranked, { ...DEFAULT_WEIGHTS, penalizeMegaCondo: false })[0]!.finalScore).toBe(off[0]!.finalScore);
  });

  it("re-extracts features from the current listing data (no stale per-object cache)", () => {
    const prop = { ...SAMPLE_PROPERTIES[0]!, description: "Apartamento sem ar-condicionado." };
    const before = computeDynamicProperties([prop], ranked, DEFAULT_WEIGHTS)[0]!;
    prop.description = "Apartamento com ar-condicionado split em todos os cômodos.";
    const after = computeDynamicProperties([prop], ranked, DEFAULT_WEIGHTS)[0]!;
    expect(before.cardTags.acLabel).toBeNull();
    expect(after.cardTags.acLabel).toBe("Ar-condicionado Split");
  });
});

describe("Top-200 audit rules: furniture flags, AC wording, continuous ramps, checkbox trust, layout signals", () => {
  const rankedNbs = computeDynamicNeighborhoods(SAMPLE_NEIGHBORHOODS, DEFAULT_WEIGHTS).ranked;
  const unit = (overrides: Partial<SlimPropertyRecord>): SlimPropertyRecord => ({
    ...SAMPLE_PROPERTIES[0]!,
    id: "t200-base",
    neighborhood: "Funcionários",
    street: "Rua Alagoas",
    streetNumber: null,
    title: "Apartamento 1 quarto",
    description: "Apartamento com 1 vaga.",
    generatedDescription: null,
    condition: "USED",
    constructionYear: null,
    floor: null,
    floorRange: null,
    totalFloors: null,
    furnished: null,
    installations: ["Elevador"],
    amenities: ["Box", "Armários na cozinha"],
    comfortCommodities: [],
    practicalityCommodities: [],
    photoCaptions: [],
    positiveSignals: [],
    negativeSignals: [],
    modernityScore: 70,
    modernityTier: "WELL_MAINTAINED",
    ...overrides,
  });
  const zap = (overrides: Partial<SlimPropertyRecord>) => unit({ provider: "zapimoveis", ...overrides });
  const evaluate = (props: SlimPropertyRecord[]) =>
    new Map(computeDynamicProperties(props, rankedNbs, DEFAULT_WEIGHTS).map((p) => [p.id, p]));

  it("counts portal furnished flags and 'todo/totalmente/100% mobiliado' as the full set, unless the text says unfurnished or semi", () => {
    const full = [
      zap({ id: "zap-amenity", furnished: false, amenities: ["FURNISHED", "KITCHEN"], description: "Excelente de 01 quarto, no bairro de Lourdes." }),
      zap({
        id: "zap-slug",
        url: "https://www.zapimoveis.com.br/imovel/aluguel-apartamento-1-quarto-mobiliado-savassi-belo-horizonte-mg-50m2-id-2907744516/",
        description: "Apartamento para locação no bairro Savassi com 50m².",
      }),
      zap({ id: "todo", description: "Excelente apartamento, todo mobiliado, com portaria 24 horas, lazer." }),
      zap({ id: "totalmente", description: "Apartamento moderno, totalmente mobiliado e pronto para morar." }),
      zap({ id: "cem", description: "Apartamento 100% mobiliado na Savassi." }),
      zap({ id: "ja-moveis", description: "O apartamento já está com os móveis, é só trazer a mala." }),
      zap({ id: "explicit-and-semi", description: "Apartamento totalmente mobiliado; antes era semi mobiliado." }),
      unit({ id: "qa-has-furniture", furnished: true, description: "Apartamento com sala e 1 quarto." }),
      unit({ id: "qa-checklist", furnished: false, amenities: ["Box", "Geladeira", "Sofá", "Cama de casal"] }),
    ];
    const unfurnished = [
      unit({
        id: "qa-flag-nao-mobiliado",
        furnished: true,
        description: "Alugue sem depender de ninguém! São 50m², com 1 banheiro e 1 vaga de garagem, não mobiliado, não aceita animais de estimação.",
      }),
      zap({ id: "zap-amenity-semi", furnished: true, amenities: ["FURNISHED"], description: "Apartamento semi mobiliado com elevador e 1 quarto no Funcionários – 40m²." }),
      zap({
        id: "zap-slug-semi",
        url: "https://www.zapimoveis.com.br/imovel/aluguel-apartamento-1-quarto-semi-mobiliado-savassi-belo-horizonte-mg-id-1/",
      }),
      zap({ id: "plain-mobiliado", description: "Apartamento mobiliado." }),
    ];
    for (const p of full) expect(classifyFurnitureTier(p), p.id).toBe("FULLY_FURNISHED");
    for (const p of unfurnished) expect(classifyFurnitureTier(p), p.id).toBe("UNFURNISHED");
    expect(describeFurnitureInText("Apartamento mobiliado, com cozinha semi mobiliada.")).toBe("furnished");
    expect(describeFurnitureInText("Apartamento semi mobiliado.")).toBe("unfurnished");
  });

  it("reads 'condicionador de ar' as AC, laje técnica / infraestrutura p/ / 'coloca e desconta' / espera as infrastructure, and window AC as a reduced credit", () => {
    const byId = evaluate([
      unit({ id: "none" }),
      unit({ id: "condicionador", description: "Apartamento 01 quarto com armário, sala com piso em porcelanato. Condicionador de ar e armários." }),
      unit({ id: "laje-condensador", description: "COZINHA C/ ARMÁRIOS - LAJE TÉCNICA P/ INSTALAÇAO DE CONDENSADOR DE AR CONDICIONADO - 2 VAGAS COBERTAS." }),
      unit({ id: "laje-instalar", description: "Laje técnica para instalar o ar condicionado, com saída nos 2 quartos e sala." }),
      unit({ id: "infra-p", description: "ARMÁRIOS NOS QUARTOS - INFRAESTRUTURA P/ AR CONDICIONADO NA SALA E NOS QUARTOS." }),
      unit({ id: "coloca-desconta", description: "Em caso de Locação coloca o ar condicionado e desconta no aluguel." }),
      unit({ id: "espera-split", description: "Espera para split na sala e no quarto." }),
      unit({ id: "janela", description: "Sala com sofá, ventilador de teto e ar condicionado de janela." }),
      unit({ id: "acj", description: "Quarto com ACJ e armários." }),
      unit({ id: "split", description: "Sala com split inverter." }),
    ]);
    const pts = (id: string) => byId.get(id)!.breakdown.nuancesPoints;
    expect(byId.get("condicionador")!.cardTags.acLabel).toBe("Ar-condicionado");
    for (const id of ["laje-condensador", "laje-instalar", "infra-p", "coloca-desconta", "espera-split"]) {
      expect(byId.get(id)!.cardTags.acLabel, id).toBeNull();
      expect(byId.get(id)!.cardTags.warningTags, id).toContain(AC_INFRA_ONLY_TAG);
      expect(byId.get(id)!.cardTags.redTags, id).not.toContain(AC_ABSENT_TAG);
    }
    for (const id of ["janela", "acj"]) {
      expect(byId.get(id)!.cardTags.acLabel, id).toBeNull();
      expect(byId.get(id)!.cardTags.warningTags, id).toContain(AC_WINDOW_TAG);
      expect(pts(id), id).toBeCloseTo(pts("none") + 20 + 4, 1);
      expect(pts(id), id).toBeLessThan(pts("split"));
    }
    expect(pts("split")).toBeCloseTo(pts("none") + 20 + 12, 1);
  });

  it("replaces the modernity -25/-40 steps with a continuous ramp (0 at 65, -25 at 55, -40 at 45) and defaults evidence-free units to 55", () => {
    const scores = Array.from({ length: 32 }, (_, i) => 44 + i).filter((s) => s !== 60);
    const byId = evaluate(scores.map((s) => unit({ id: `m-${s}`, modernityScore: s, modernityTier: "STANDARD" })));
    const curve = (s: number) => byId.get(`m-${s}`)!.breakdown.modernityPoints - s * 0.85;
    expect(curve(70)).toBeCloseTo(0, 0);
    expect(curve(65)).toBeCloseTo(0, 0);
    expect(curve(62)).toBeCloseTo(-7.5, 0);
    expect(curve(59)).toBeCloseTo(-15, 0);
    expect(curve(55)).toBeCloseTo(-25, 0);
    expect(curve(52)).toBeCloseTo(-29.5, 0);
    expect(curve(45)).toBeCloseTo(-40, 0);
    expect(curve(44)).toBeCloseTo(-40, 0);
    for (let i = 1; i < scores.length; i++) {
      const step = byId.get(`m-${scores[i]}`)!.breakdown.modernityPoints - byId.get(`m-${scores[i - 1]}`)!.breakdown.modernityPoints;
      expect(step, `${scores[i - 1]}->${scores[i]}`).toBeLessThanOrEqual((2.5 + 0.85) * (scores[i]! - scores[i - 1]!) + 0.1);
    }
    const [atBase] = computeDynamicProperties([unit({ id: "m-60", modernityScore: 60, modernityTier: "STANDARD" })], rankedNbs, DEFAULT_WEIGHTS);
    expect(atBase!.modernityScore).toBe(55);
    expect(atBase!.breakdown.modernityPoints).toBeCloseTo(55 * 0.85 - 25, 0);
  });

  it("ramps the CP far-commute penalty from 0 at ~33 min (15 km) to the Taquaral -11 at 16.1 km instead of a step", () => {
    expect(computeCpFarCommutePenalty(14.7)).toBe(0);
    expect(computeCpFarCommutePenalty(15.0)).toBeCloseTo(0, 1);
    expect(computeCpFarCommutePenalty(15.55)).toBeCloseTo(-5.5, 0);
    expect(computeCpFarCommutePenalty(16.1)).toBeCloseTo(-11, 1);
    expect(computeCpFarCommutePenalty(17.6)).toBeCloseTo(-12, 1);
    let prev = 0;
    for (let km = 15.0; km <= 16.1; km += 0.1) {
      const p = computeCpFarCommutePenalty(km);
      expect(p).toBeLessThanOrEqual(prev + 0.05);
      expect(prev - p).toBeLessThanOrEqual(1.1);
      prev = p;
    }
    expect(resolveCpFarCommute("CP", "Nova Campinas")).toBeNull();
    expect(resolveCpFarCommute("CP", "Taquaral")!.penaltyPts).toBeCloseTo(-11, 1);
  });

  it("keeps only part of the modernity points for an unconfirmed Novo/Reformado flag or construction year", () => {
    const flagged = {
      condition: "NEW_OR_RENOVATED" as const,
      modernityScore: 70,
      positiveSignals: ["Flag Novo/Reformado"],
    };
    const recent = { constructionYear: 2021, modernityScore: 80, positiveSignals: ["Construção recente (2021)"] };
    Object.assign(PHOTO_AUDIT_OVERRIDES, { "quintoandar:flag-audited": { modernityScore: 82, modernityTier: "MODERN_OR_RENOVATED" } });
    try {
      const byId = evaluate([
        unit({ id: "flag-only", ...flagged }),
        unit({ id: "year-only", ...recent }),
        unit({ id: "flag-audited", ...flagged }),
      ]);
      expect(byId.get("flag-only")!.modernityScore).toBe(70 - 5);
      expect(byId.get("year-only")!.modernityScore).toBe(80 - 6);
      expect(byId.get("flag-audited")!.modernityScore).toBe(82);
    } finally {
      delete PHOTO_AUDIT_OVERRIDES["quintoandar:flag-audited"];
    }
  });

  it("does not trust condo gourmet areas, a gourmet checkbox alone or a virtual doorman", () => {
    const byId = evaluate([
      zap({ id: "zap-gourmet-checkbox", amenities: ["Box", "GOURMET_BALCONY"] }),
      unit({ id: "qa-gourmet-checklist", amenities: ["Box", "Varanda gourmet"] }),
      zap({ id: "condo-espaco-gourmet", amenities: ["Box", "BALCONY"], description: "Área de lazer com espaço gourmet, quadra poliesportiva e churrasqueira." }),
      zap({ id: "condo-varanda-gourmet", description: "Condomínio com piscina, sauna e varanda gourmet no rooftop." }),
      zap({ id: "unit-varanda-gourmet", description: "São 76 m² com 2 quartos (1 suíte), 2 banheiros, 1 varanda gourmet e 1 vaga." }),
      unit({ id: "portaria-virtual", description: "Condominio conta com: Portaria virtual, 02 elevadores, agua individual, salão festas e academia." }),
      unit({ id: "portaria-virtual-24h", installations: ["Elevador", "PORTARIA_24H"], description: "Prédio com portaria virtual 24h, academia, lavanderia OMO." }),
      unit({ id: "portaria-remota", description: "Portaria remota e acesso por biometria." }),
      unit({ id: "portaria-fisica", description: "Portaria física 24 horas e portaria virtual na garagem." }),
      unit({ id: "portaria-default" }),
      unit({ id: "portaria-24h-same-text", description: "Condominio conta com: Portaria 24h, 02 elevadores, agua individual, salão festas e academia." }),
    ]);
    const hl = (id: string) => byId.get(id)!.nuanceHighlights;
    for (const id of ["zap-gourmet-checkbox", "qa-gourmet-checklist", "condo-espaco-gourmet"]) {
      expect(hl(id), id).toContain("Varanda");
      expect(hl(id), id).not.toContain("Varanda gourmet");
    }
    expect(hl("condo-varanda-gourmet")).not.toContain("Varanda gourmet");
    expect(hl("unit-varanda-gourmet")).toContain("Varanda gourmet");
    for (const id of ["portaria-virtual", "portaria-virtual-24h", "portaria-remota"]) {
      expect(hl(id), id).not.toContain("Portaria 24h / Biometria");
      expect(byId.get(id)!.nuanceWarnings.join(" "), id).toMatch(/Portaria virtual\/remota/);
    }
    expect(hl("portaria-fisica")).toContain("Portaria 24h / Biometria");
    expect(hl("portaria-default")).toContain("Portaria 24h / Biometria");
    expect(byId.get("portaria-24h-same-text")!.breakdown.nuancesPoints).toBeCloseTo(
      byId.get("portaria-virtual")!.breakdown.nuancesPoints + 6,
      1,
    );
  });

  it("retains 'vagas de garagem coberta de gaveta' and scores tandem ('em linha', 'uma atrás da outra') spots as a single spot", () => {
    const two = (id: string, description: string) => unit({ id, parkingSpaces: 2, description });
    const byId = evaluate([
      two("gaveta", "Área de serviço, aquecimento de água a gás, 2 vagas de garagem coberta de gaveta."),
      two("gaveta-upper", "2 QUARTOS SENDO 1 SUÍTE, 2 VAGAS DE GARAGEM COBERTAS DE GAVETA, PLANEJADOS EM TODO APARTAMENTO."),
      two("em-linha-demarcadas", "02 vagas de garagem cobertas, demarcadas em linha."),
      two("em-linha", "Conta ainda com 2 vagas de garagem em linha."),
      two("atras", "2 vagas cobertas, uma atrás da outra."),
      two("nao-em-linha", "2 vagas livres e independentes (não são em linha)."),
      two("control", "2 vagas de garagem cobertas."),
    ]);
    for (const id of ["gaveta", "gaveta-upper"]) {
      expect(byId.get(id)!.eligible, id).toBe(false);
      expect(byId.get(id)!.exclusionReason, id).toContain("Vaga presa, gaveta ou rotativa (eliminado)");
    }
    for (const id of ["em-linha-demarcadas", "em-linha", "atras"]) {
      expect(byId.get(id)!.eligible, id).toBe(true);
      expect(byId.get(id)!.breakdown.parkingPoints, id).toBe(DEFAULT_WEIGHTS.parkingBonus1);
      expect(byId.get(id)!.cardTags.warningTags, id).toContain("Vagas em linha");
    }
    for (const id of ["nao-em-linha", "control"]) {
      expect(byId.get(id)!.breakdown.parkingPoints, id).toBe(DEFAULT_WEIGHTS.parkingBonus2);
    }
  });

  it("detects 'também para venda' / 'alugo e vendo' / 'venda porteira fechada' / 'aceita proposta de venda' as also for sale", () => {
    const qa = (description: string) => ({
      provider: "quintoandar" as const,
      salePrice: null,
      title: "Apartamento para alugar",
      description,
      generatedDescription: null,
    });
    for (const text of [
      "Imóvel disponível para locação e também para venda.",
      "Alugo e vendo Flat 45 metros quadrados com 1 quarto 1 banheiro 1 vaga de garagem.",
      "VENDA PORTEIRA FECHADAApartamento Moderno 1 Dormitório Urban Design.",
      "Proprietário aceita proposta de venda.",
    ]) {
      expect(hasActiveSaleListing(qa(text)), text).toBe(true);
    }
    expect(hasActiveSaleListing(qa("Atendemos nossos clientes na compra, venda ou locação de imóveis."))).toBe(false);
  });

  it("does not stack the top-floor +15 with the high-floor bonus", () => {
    const byId = evaluate([
      unit({ id: "top-12", floor: 12, totalFloors: 12, description: "Apartamento no último andar." }),
      unit({ id: "high-10", floor: 10, totalFloors: 12 }),
      unit({ id: "top-7", floor: 7, totalFloors: 7, description: "Apartamento no último andar." }),
    ]);
    expect(byId.get("top-12")!.nuanceHighlights).toContain("Último andar (12º andar)");
    expect(byId.get("top-12")!.nuanceHighlights).not.toContain("Andar alto (12º andar)");
    expect(byId.get("top-12")!.breakdown.nuancesPoints).toBeCloseTo(byId.get("high-10")!.breakdown.nuancesPoints + 15 - 11, 1);
    expect(byId.get("top-7")!.nuanceHighlights).not.toContain("Andar médio (7º andar)");
  });

  it("treats granite as dated and drops 'Armários instalados' when the unit is delivered without cabinets", () => {
    const byId = evaluate([
      unit({ id: "granito", description: "Banheiro com box blindex e bancada em granito." }),
      unit({ id: "quartzo", description: "Cozinha com bancada em quartzo e box blindex." }),
      unit({ id: "sem-armarios", description: "Na área íntima, são dois quartos com piso Durafloor. Os cômodos são entregues sem armários, dando ao futuro morador a liberdade de escolher." }),
      unit({ id: "um-sem-armarios", description: "Todos os quartos com piso em vinílico e apenas um sem armários." }),
      unit({ id: "control" }),
    ]);
    expect(byId.get("granito")!.nuanceHighlights).not.toContain("Box blindex e bancada moderna");
    expect(byId.get("quartzo")!.nuanceHighlights).toContain("Box blindex e bancada moderna");
    expect(byId.get("control")!.nuanceHighlights).toContain("Armários instalados");
    expect(byId.get("sem-armarios")!.nuanceHighlights).not.toContain("Armários instalados");
    expect(byId.get("um-sem-armarios")!.nuanceHighlights).toContain("Armários instalados");
  });

  it("flags studio/kitnet, duplex and flat/apart-hotel layouts without points or retention", () => {
    const byId = evaluate([
      unit({ id: "studio", description: "Apartamento tipo studio – primeira locação, decorado com alto padrão de acabamento." }),
      unit({ id: "kitnet", description: "Kitnet reformada perto da Savassi." }),
      unit({ id: "pilates", description: "Condomínio com studio de pilates e academia." }),
      unit({ id: "sala-conjugada", description: "Ambiente funcional com sala conjugada, projeto de iluminação." }),
      unit({ id: "duplex", description: "Apartamento duplex para locação no melhor ponto de Lourdes." }),
      unit({ id: "geladeira-duplex", description: "Cozinha com geladeira duplex." }),
      zap({ id: "flat", title: "Flat para alugar com 42 m², 1 quarto, 1 banheiro, 1 vaga" }),
      zap({ id: "apto", title: "Apartamento para alugar com 42 m², 1 quarto, 1 banheiro, 1 vaga" }),
      unit({ id: "tv-flat", description: "Sala com smart TV flat." }),
    ]);
    const tags = (id: string) => byId.get(id)!.cardTags.warningTags;
    for (const id of ["studio", "kitnet"]) expect(tags(id), id).toContain(STUDIO_LAYOUT_TAG);
    for (const id of ["pilates", "sala-conjugada"]) expect(tags(id), id).not.toContain(STUDIO_LAYOUT_TAG);
    expect(tags("duplex")).toContain(DUPLEX_LAYOUT_TAG);
    expect(tags("geladeira-duplex")).not.toContain(DUPLEX_LAYOUT_TAG);
    expect(tags("flat")).toContain(SERVICED_FLAT_TAG);
    for (const id of ["apto", "tv-flat"]) expect(tags(id), id).not.toContain(SERVICED_FLAT_TAG);
    for (const id of ["studio", "kitnet", "duplex", "flat"]) expect(byId.get(id)!.eligible, id).toBe(true);
    expect(byId.get("flat")!.finalScore).toBe(byId.get("apto")!.finalScore);
  });
});

describe("Rules review fixes: retention text, area ceiling, weights migration, furniture, streets, commute, modernity, floors", () => {
  const rankedNbs = computeDynamicNeighborhoods(SAMPLE_NEIGHBORHOODS, DEFAULT_WEIGHTS).ranked;
  const unit = (overrides: Partial<SlimPropertyRecord>): SlimPropertyRecord => ({
    ...SAMPLE_PROPERTIES[0]!,
    id: "fix-base",
    neighborhood: "Funcionários",
    street: "Rua Alagoas",
    streetNumber: null,
    title: "Apartamento 1 quarto",
    description: "Apartamento com 1 vaga.",
    generatedDescription: null,
    condition: "USED",
    constructionYear: null,
    floor: null,
    floorRange: null,
    totalFloors: null,
    furnished: null,
    installations: ["Elevador"],
    amenities: ["Box", "Armários na cozinha"],
    comfortCommodities: [],
    practicalityCommodities: [],
    photoCaptions: [],
    positiveSignals: [],
    negativeSignals: [],
    modernityScore: 70,
    modernityTier: "WELL_MAINTAINED",
    ...overrides,
  });
  const zap = (overrides: Partial<SlimPropertyRecord>) => unit({ provider: "zapimoveis", ...overrides });
  const evaluate = (props: SlimPropertyRecord[]) =>
    new Map(computeDynamicProperties(props, rankedNbs, DEFAULT_WEIGHTS).map((p) => [p.id, p]));

  it("lists only the real eligibility checks as retention reasons, never dated finishes", () => {
    const byId = evaluate([
      unit({
        id: "small-dated",
        areaM2: 30,
        modernityScore: 30,
        modernityTier: "DATED",
        description: "Apartamento com acabamento original, piso de taco e 1 vaga.",
      }),
      unit({ id: "eligible-dated", areaM2: 50, modernityScore: 30, modernityTier: "DATED", description: "Apartamento original com piso de taco." }),
    ]);
    const small = byId.get("small-dated")!;
    expect(small.eligible).toBe(false);
    expect(small.shortJustification).toMatch(/retido pelos filtros \(planta abaixo da metragem mínima\)/i);
    expect(small.shortJustification).not.toContain("acabamento original sem reforma registrada");
    expect(byId.get("eligible-dated")!.eligible).toBe(true);
    expect(byId.get("eligible-dated")!.shortJustification).not.toMatch(/retido pelos filtros/i);
  });

  it("gives units above maxAreaM2 the same +6 as the sweetSpotMax..maxArea band", () => {
    const byId = evaluate([
      unit({ id: "a-80", areaM2: 80 }),
      unit({ id: "a-95", areaM2: DEFAULT_WEIGHTS.maxAreaM2 }),
      unit({ id: "a-130", areaM2: 130 }),
      unit({ id: "a-30", areaM2: 30 }),
    ]);
    for (const id of ["a-80", "a-95", "a-130"]) expect(byId.get(id)!.breakdown.areaPoints, id).toBe(6);
    expect(byId.get("a-30")!.breakdown.areaPoints).toBe(-18);
  });

  it("only resets minAreaM2 40/45 to 35 when migrating legacy (v1) preferences", () => {
    for (const minAreaM2 of [40, 45]) {
      expect(sanitizeAndMigrateWeights({ ...DEFAULT_WEIGHTS, minAreaM2 }, 2).minAreaM2).toBe(minAreaM2);
      expect(sanitizeAndMigrateWeights({ ...DEFAULT_WEIGHTS, minAreaM2, schemaVersion: 2 }).minAreaM2).toBe(minAreaM2);
      expect(sanitizeAndMigrateWeights({ ...DEFAULT_WEIGHTS, minAreaM2 }, 1).minAreaM2).toBe(35);
    }
  });

  it("scores 'semi-mobiliado' units as plain unfurnished (there is no semi tier)", () => {
    const byId = evaluate([
      zap({ id: "semi", furnished: false, description: "Apartamento semi mobiliado, com geladeira e fogão, armários na cozinha." }),
      zap({ id: "plain", furnished: false, description: "Apartamento com armários na cozinha." }),
    ]);
    const semi = byId.get("semi")!;
    expect(semi.furnitureTier).toBe("UNFURNISHED");
    expect(semi.breakdown.furniturePoints).toBe(byId.get("plain")!.breakdown.furniturePoints);
    expect(semi.shortJustification).not.toMatch(/semi-mobiliad/i);
  });

  it("does not furnish the whole unit from room-scoped phrases or from apart-hotel signals alone", () => {
    const roomScoped = [
      zap({ id: "cozinha-toda", description: "Cozinha toda mobiliada e armários nos quartos." }),
      zap({ id: "cozinha-mobiliada", description: "Apartamento de 1 quarto com cozinha mobiliada e área de serviço." }),
      zap({ id: "banheiro-todo", description: "Banheiro todo mobiliado com gabinete e espelheira." }),
      zap({ id: "armarios-toda", description: "Armários planejados na cozinha toda mobiliada." }),
      zap({ id: "cozinha-mobiliario", description: "Cozinha com mobiliário completo e cooktop." }),
      zap({
        id: "apart-hotel",
        condominiumName: "Moema Top Life",
        rent: 2000,
        condoFee: 1470,
        description: "Flat com serviço de camareira e recepção 24h.",
      }),
    ];
    const unitLevel = [
      zap({ id: "apto-todo", description: "Apartamento todo mobiliado, pronto para morar." }),
      zap({ id: "imovel-100", description: "Imóvel 100% mobiliado no Funcionários." }),
      zap({ id: "unidade-toda", description: "Unidade toda mobiliada com vista livre." }),
      zap({ id: "quartos-totalmente", description: "Apartamento com 2 quartos, totalmente mobiliado." }),
      zap({ id: "mobiliado-completo", description: "Studio mobiliado completo perto da Savassi." }),
      zap({
        id: "apart-hotel-furnished",
        condominiumName: "Moema Top Life",
        rent: 2000,
        condoFee: 1470,
        description: "Flat com camareira. Sala com sofá, cozinha com geladeira e quarto com cama de casal.",
      }),
    ];
    for (const p of roomScoped) expect(classifyFurnitureTier(p), p.id).toBe("UNFURNISHED");
    for (const p of unitLevel) expect(classifyFurnitureTier(p), p.id).toBe("FULLY_FURNISHED");
    expect(isApartHotelListing(roomScoped[5]!)).toBe(true);
  });

  it("matches hospital streets with abbreviations, titles and house numbers, and Taquaral streets with bare numbers and apostrophes", () => {
    const bh = { cityCode: "BH" as const, neighborhood: "Santa Efigênia" };
    for (const street of [
      "Av. Prof. Alfredo Balena, 190",
      "Avenida Professor Alfredo Balena 190",
      "AV ALFREDO BALENA",
      "R. Pe. Marinho 318",
      "Rua Padre Marinho, 318 - apto 1201",
    ]) {
      expect(findHospitalNoiseCluster({ ...bh, street }), street).not.toBeNull();
    }
    expect(findHospitalNoiseCluster({ ...bh, street: "Rua Piauí 1200" })).toBeNull();

    const cp = { cityCode: "CP" as const, neighborhood: "Taquaral" };
    for (const street of [
      "Rua Pedro Lopes 120",
      "R. Pedro Lopes, 120",
      "Rua João Ribas d'Ávila",
      "Rua João Ribas D´Ávila 55",
      "Av. Dr. Heitor Penteado nº 1500",
    ]) {
      expect(isNearTaquaralLagoa({ ...cp, street }), street).toBe(true);
    }
    expect(isNearTaquaralLagoa({ ...cp, street: "Rua Otávio Machado 120" })).toBe(false);
  });

  it("parses commute ranges as their worst case and honors a rush-hour time in parentheses", () => {
    expect(parseCommuteMinutes("40-60 min").minutes).toBe(60);
    expect(parseCommuteMinutes("45–50 min do Nubank").minutes).toBe(50);
    expect(parseCommuteMinutes("1h a 1h30").minutes).toBe(90);
    expect(parseCommuteMinutes("25 min (pico 55 min)")).toEqual({ minutes: 55, label: "25 min (pico 55 min)" });
    expect(parseCommuteMinutes("30 min do Nubank (no pico 45)").minutes).toBe(45);
    expect(parseCommuteMinutes("35 min (55 min no pico)").minutes).toBe(55);
    expect(parseCommuteMinutes("20-30 min (pico 1h10)").minutes).toBe(70);
    expect(parseCommuteMinutes("50 min (pico 40 min)").minutes).toBe(50);
    expect(parseCommuteMinutes("25 min (via Linha Amarela)").minutes).toBe(25);
  });

  it("treats a RJ listing as deep-west Barra only when its own neighborhood or street is there", () => {
    const rj = { cityCode: "RJ" as const, city: "Rio de Janeiro" };
    const byId = evaluate([
      unit({ id: "mentions", ...rj, neighborhood: "Botafogo", street: "Rua Voluntários da Pátria", description: "Fácil acesso ao Recreio, à Barra Olímpica e a Jacarepaguá." }),
      unit({ id: "recreio", ...rj, neighborhood: "Recreio dos Bandeirantes", street: "Avenida das Américas" }),
      unit({ id: "estrada", ...rj, neighborhood: "Barra da Tijuca", street: "Estrada dos Bandeirantes, 2000" }),
      unit({ id: "jacarepagua", ...rj, neighborhood: "Jacarepaguá", street: "Rua Ituverava" }),
    ]);
    expect(byId.get("mentions")!.commuteMinutes).not.toBe(85);
    for (const id of ["recreio", "estrada", "jacarepagua"]) expect(byId.get(id)!.commuteMinutes, id).toBe(85);
  });

  it("resets modernity 60 to 55 only for evidence-free units, not for units that land on 60 after refunds", () => {
    const byId = evaluate([
      unit({ id: "no-evidence", modernityScore: 60, modernityTier: "STANDARD" }),
      unit({ id: "split-refunded", modernityScore: 68, modernityTier: "WELL_MAINTAINED", positiveSignals: ["Ar-condicionado split"], positiveSignalKeys: ["SPLIT_AC"] }),
    ]);
    expect(byId.get("no-evidence")!.modernityScore).toBe(55);
    expect(byId.get("split-refunded")!.modernityScore).toBe(60);
  });

  it("does not read floors from non-floor equivalences, common-area levels or unit amenities", () => {
    expect(extractExplicitFloorFromText("Caução equivalente a 3 meses de aluguel.")).toBeNull();
    expect(extractExplicitFloorFromText("IPTU corresponde a 12 parcelas.")).toBeNull();
    expect(extractExplicitFloorFromText("Apartamento no 1º andar (equivalente ao 4º andar pela rua de trás).")).toBe(4);
    expect(extractExplicitFloorFromText("Apartamento no 2º andar. Salão de festas no 1º andar.")).toBe(2);
    expect(extractExplicitFloorFromText("Apartamento no 1º andar, portaria 24h no térreo.")).toBe(1);
    expect(extractExplicitFloorFromText("Duplex: 1º andar sala e cozinha; 2º andar suíte com closet.")).toBeNull();
    expect(extractExplicitFloorFromText("Apartamento no 12º andar com hall privativo.")).toBe(12);
    expect(extractExplicitFloorFromText("Apartamento no 9º andar com box blindex no banheiro.")).toBe(9);
    expect(extractExplicitFloorFromText("Vaga de garagem no 1º andar do prédio.")).toBeNull();
  });

  it("does not treat elevator or common-area 'último andar' mentions as the unit's top floor, nor 'pé-direito duplo' as a duplex", () => {
    const tower = { floor: null, floorRange: null, totalFloors: 12 };
    const byId = evaluate([
      unit({ id: "elevador", ...tower, description: "Prédio com elevador que vai até o último andar." }),
      unit({ id: "lavanderia", ...tower, description: "Lavanderia coletiva no último andar." }),
      unit({ id: "lazer-depois", ...tower, description: "No último andar: piscina e academia." }),
      unit({ id: "lazer-fica", ...tower, description: "No último andar fica o salão de festas." }),
      unit({ id: "top", ...tower, description: "Apartamento no último andar, com vista livre." }),
      unit({ id: "pe-direito", description: "Sala com pé-direito duplo e janelas amplas." }),
      unit({ id: "duplex", description: "Apartamento duplex com 2 suítes." }),
    ]);
    for (const id of ["elevador", "lavanderia", "lazer-depois", "lazer-fica"]) {
      expect(byId.get(id)!.cardTags.highFloorLabel ?? "", id).not.toMatch(/Último andar/);
    }
    expect(byId.get("top")!.cardTags.highFloorLabel).toMatch(/Último andar/);
    expect(byId.get("pe-direito")!.cardTags.warningTags).not.toContain(DUPLEX_LAYOUT_TAG);
    expect(byId.get("duplex")!.cardTags.warningTags).toContain(DUPLEX_LAYOUT_TAG);
  });
});

describe("computeWeightedNeighborhoodScore urban breathing curve", () => {
  const score = (urbanBreathing: number) =>
    computeWeightedNeighborhoodScore(
      { urbanBreathing, commuteLogistics: 8.0, buildingStock: 8.0, budgetFit: 8.0, safetyCar: 8.2 },
      DEFAULT_WEIGHTS,
    );

  it.each([7.5, 9.0])("is continuous around %s", (edge) => {
    expect(Math.abs(score(edge) - score(edge - 0.001))).toBeLessThanOrEqual(0.011);
    expect(Math.abs(score(edge + 0.001) - score(edge))).toBeLessThanOrEqual(0.011);
  });

  it("ramps the bonus from 0 at 7.5 to +0.45 at 9.0 and holds it above", () => {
    const weightedOnly = (ub: number) => (ub * 3 + 8 * 1 + 8 * 2 + 8 * 1 + 8.2 * 3) / 10;
    expect(score(7.5)).toBeCloseTo(weightedOnly(7.5), 2);
    expect(score(8.25)).toBeCloseTo(weightedOnly(8.25) + 0.225, 2);
    expect(score(9.0)).toBeCloseTo(weightedOnly(9.0) + 0.45, 2);
    expect(score(9.6)).toBeCloseTo(weightedOnly(9.6) + 0.45, 2);
    expect(score(7.0)).toBeCloseTo(weightedOnly(7.0) - 0.375, 2);
  });
});
