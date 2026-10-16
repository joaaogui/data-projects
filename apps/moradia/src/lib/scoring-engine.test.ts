import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BUILTIN_PRESETS,
  categorizePropertyFeatures,
  classifyFurnitureTier,
  computeDynamicNeighborhoods,
  computeDynamicProperties,
  DEFAULT_WEIGHTS,
  detectArterialOrBorderBunker,
  evaluateStreetMicroEnvironment,
  parseCommuteMinutes,
} from "./scoring-engine";
import {
  DEFAULT_EXPLORER_FILTERS,
  filterAndSortProperties,
  formatTopPropertiesForAiPrompt,
  isStrictlyInTop20Neighborhoods,
  matchesFloorFilter,
  matchesPropertyFeature,
  parseExplorerFiltersObject,
} from "@/components/moradia-portal";
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
  isCoordinateInsideCityBox,
  NUBANK_HUBS,
  resolveInstantPropertyCoordinate,
} from "@/lib/geocoding";
import type { NeighborhoodEntry, SlimPropertyRecord } from "@/types/moradia";

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
    areaM2: 43,
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

describe("Moradia Dynamic Scoring Engine", () => {
  it("recalculates neighborhood rankings and justifications when sub-weights change", () => {
    const { ranked } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    expect(ranked[0]?.neighborhood).toBe("Funcionários");
    expect(ranked[0]?.dynamicJustification).toContain("Nota Dinâmica");

    // Zero out commute weight and maximize urban breathing -> Taquaral (9.8) beats Funcionários (9.5)
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
    expect(parkRanked[0]?.neighborhood).toBe("Taquaral");
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
    expect(top.shortJustification).toContain("sem ar-condicionado instalado");
    expect(top.shortJustification).toMatch(/metragem mais enxuta para acomodar toda a mudança/i);
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
    expect(top.cardTags.greenTags).toContain("Vista livre");
    expect(top.cardTags.greenTags).toContain("Prédio Novo (2019)");

    expect(dated.eligible).toBe(false);
    expect(dated.exclusionReason).toContain("Modernidade 26/100");
    expect(dated.exclusionReason).toContain("Sem elevador (eliminado)");
    expect(dated.shortJustification).toContain("10 min do escritório do Nubank");
    expect(dated.shortJustification).not.toMatch(/\b(Por outro lado,|Em contrapartida,)/i);
    expect(dated.shortJustification).toMatch(/Retido pelos filtros/i);
    expect(dated.shortJustification).toContain("fica em andar baixo");
    expect(dated.shortJustification).not.toContain("Funcionários");
    expect(dated.shortJustification).not.toMatch(/R\$/);
    expect(dated.shortJustification).not.toMatch(/\d+\s*m²/);
    expect(dated.cardTags.lowFloorLabel).toBe("Andar baixo (2º andar)");
    expect(dated.cardTags.floorTag).toEqual({
      label: "Andar baixo (2º andar)",
      rarity: "uncommon",
    });
    expect(dated.cardTags.redTags).not.toContain("Andar baixo (2º andar)");
    expect(dated.cardTags.redTags).toContain("Sem elevador");
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
    const trappedParkingProp: SlimPropertyRecord = {
      ...baseProp,
      id: "trapped-park-1",
      salePrice: 650000,
      description: "Imóvel novo com 1 vaga presa e torre única.",
    };

    const results = computeDynamicProperties(
      [noElevatorProp, trappedParkingProp],
      nbs,
      DEFAULT_WEIGHTS,
    );

    const evalNoElev = results.find((p) => p.id === "no-elev-1")!;
    expect(evalNoElev.eligible).toBe(false);
    expect(evalNoElev.exclusionReason).toContain("Sem elevador (eliminado)");
    expect(evalNoElev.cardTags.redTags).toContain("Sem elevador");

    const evalTrapped = results.find((p) => p.id === "trapped-park-1")!;
    expect(evalTrapped.eligible).toBe(false);
    expect(evalTrapped.exclusionReason).toContain("Vaga presa (eliminado)");
    expect(evalTrapped.cardTags.redTags).toContain("Vaga presa");
    expect(evalTrapped.cardTags.redTags).not.toContain("À venda (Risco de visitas)");
    expect(evalTrapped.cardTags.greenTags).toContain("Torre única / Reservado");
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
      neighborhood: "Taquaral",
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
      comfortCommodities: [],
      positiveSignals: [],
      description: "Apartamento mobiliado em andar médio.",
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
      minScore: 170,
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
    expect(ALL_NUBANK_HUB_LOCATIONS).toHaveLength(5);
    const bhBelvedere = ALL_NUBANK_HUB_LOCATIONS.find(
      (h) => h.id === "bh-terraco-jardim",
    );
    expect(bhBelvedere?.lat).toBeCloseTo(-19.971, 3);
    expect(bhBelvedere?.lng).toBeCloseTo(-43.9423, 3);

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
    expect(getCardPhotoUrl(qaMed)).toBe(
      "https://www.quintoandar.com.br/img/xxl/894364593-534.1740932910197AlvarengaPeixoto1450401SantoAgostinho19.jpg",
    );

    const zapLow =
      "https://resizedimgs.zapimoveis.com.br/img/vr-listing/504a7a27dfaaba41ec5b0f854e532f49/foto.webp?action=fit-in&dimension=800x600";
    expect(getHighResPhotoUrl(zapLow)).toContain("dimension=1920x1440");
    expect(getCardPhotoUrl(zapLow)).toContain("dimension=1280x960");

    const iwLow =
      "https://imgbr.imovelwebcdn.com/avisos/2/30/47/93/96/37/720x532/7332859386.jpg?isFirstImage=true";
    expect(getHighResPhotoUrl(iwLow)).toContain("/1200x1200/");
    expect(getCardPhotoUrl(iwLow)).toContain("/1200x1200/");

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
    expect(byId.get("budget-tier-4")?.shortJustification).toMatch(/retido pelos filtros/i);

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
    expect(sionRes.shortJustification).toMatch(/sem ar-condicionado instalado/i);
    expect(sionRes.shortJustification).toContain("planta sem varanda");
    expect(sionRes.shortJustification).toContain("ladeiras íngremes nas ruas internas");
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
        expect(safeProp.finalScore - unsafeProp.finalScore).toBeGreaterThan(60);
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
      "active-unfav",
      "active-fav",
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
      "active-unfav",
      "active-fav",
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
      [vrProp, niProp, iwProp],
      nbs,
      DEFAULT_WEIGHTS,
    );

    expect(evaluated.every((p) => p.eligible)).toBe(true);

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
    ).toEqual(["vr-1"]);

    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        selectedNeighborhoods: ["Jd. Guanabara"],
      }).map((p) => p.id),
    ).toEqual(["iw-1"]);
  });

  it("formats compact map pin prices and de-collides overlapping neighborhood/hub pins via resolveDisplayPoints", () => {
    expect(formatPinPriceCompact(4120)).toBe("4,1k");
    expect(formatPinPriceCompact(3980)).toBe("4,0k");

    const { ranked: nbs } = computeDynamicNeighborhoods(
      SAMPLE_NEIGHBORHOODS,
      DEFAULT_WEIGHTS,
    );
    const baseProp = SAMPLE_PROPERTIES[0]!;
    // Create 8 apartments on the exact same street near Nubank BH
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

    expect(displayPoints).toHaveLength(8);
    // Verify no two pins share identical coordinates or stack within minimum separation
    for (let i = 0; i < displayPoints.length; i++) {
      const a = displayPoints[i]!;
      const dHubLat = Math.abs(a.coord.lat - NUBANK_HUBS.BH.lat);
      const dHubLng = Math.abs(a.coord.lng - NUBANK_HUBS.BH.lng);
      expect(dHubLat > 0.001 || dHubLng > 0.002).toBe(true);

      for (let j = i + 1; j < displayPoints.length; j++) {
        const b = displayPoints[j]!;
        const dLat = Math.abs(b.coord.lat - a.coord.lat);
        const dLng = Math.abs(b.coord.lng - a.coord.lng);
        expect(dLat > 0.0012 || dLng > 0.0022).toBe(true);
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
      neighborhood: "Taquaral",
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

    // Empty selectedCities or all 4 selected returns all 4 cities
    const allFourSelected = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
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
        id: "top20-rj-jd-oceanico",
        cityCode: "RJ",
        city: "Rio de Janeiro",
        neighborhood: "Barra da Tijuca",
        street: "Avenida Lúcio Costa",
      },
      {
        ...baseProp,
        id: "non-top20-bh-savassi",
        cityCode: "BH",
        city: "Belo Horizonte",
        neighborhood: "Savassi",
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
    });

    const keptIds = strictTop20.map((p) => p.id);
    expect(keptIds).toContain("top20-bh-funcionarios");
    expect(keptIds).toContain("top20-bh-lourdes");
    expect(keptIds).toContain("top20-cp-taquaral");
    expect(keptIds).toContain("top20-rj-flamengo");
    expect(keptIds).toContain("top20-rj-jd-oceanico");

    expect(keptIds).not.toContain("non-top20-bh-savassi");
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

  it("classifies properties into 3 furniture tiers (UNFURNISHED, SEMI_FURNISHED, FULLY_FURNISHED) and applies 3-tier scoring and filtering", () => {
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
      practicalityCommodities: ["Fogão", "Geladeira", "Microondas"],
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
    expect(classifyFurnitureTier(semiAppliancesProp)).toBe("SEMI_FURNISHED");
    expect(classifyFurnitureTier(semiExplicitTextProp)).toBe("SEMI_FURNISHED");
    expect(classifyFurnitureTier(fullyBedSofaProp)).toBe("FULLY_FURNISHED");
    expect(classifyFurnitureTier(fullyPhotoDetectedProp)).toBe(
      "FULLY_FURNISHED",
    );
    expect(classifyFurnitureTier(fullyHotelFlatProp)).toBe("FULLY_FURNISHED");

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

    expect(evalSemi.furnitureTier).toBe("SEMI_FURNISHED");
    expect(evalSemi.breakdown.furniturePoints).toBe(
      Math.round(DEFAULT_WEIGHTS.furnishedPenalty * 0.35),
    );
    expect(evalSemi.shortJustification).toMatch(
      /semi-mobiliado com eletrodomésticos \(verificar se conflita com seus eletros de Brasília\)/i,
    );

    expect(evalFull.furnitureTier).toBe("FULLY_FURNISHED");
    expect(evalFull.breakdown.furniturePoints).toBe(
      DEFAULT_WEIGHTS.furnishedPenalty,
    );
    expect(evalFull.shortJustification).toMatch(
      /já mobiliado com cama\/sofá \(exige negociar retirada ou adaptar sua mudança de Brasília\)/i,
    );

    // Filter options: UNFURNISHED, UNFURNISHED_OR_SEMI, SEMI_FURNISHED, FURNISHED
    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        furnishedFilter: "UNFURNISHED",
      }).map((p) => p.id),
    ).toEqual(["furn-unfurnished"]);

    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        furnishedFilter: "UNFURNISHED_OR_SEMI",
      }).map((p) => p.id),
    ).toEqual([
      "furn-unfurnished",
      "furn-semi-appliances",
      "furn-semi-text",
    ]);

    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        furnishedFilter: "SEMI_FURNISHED",
      }).map((p) => p.id),
    ).toEqual(["furn-semi-appliances", "furn-semi-text"]);

    expect(
      filterAndSortProperties(evaluated, {
        ...DEFAULT_EXPLORER_FILTERS,
        furnishedFilter: "FURNISHED",
      }).map((p) => p.id),
    ).toEqual([
      "furn-semi-appliances",
      "furn-semi-text",
      "furn-full-bed-sofa",
    ]);
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
      minutes: 11,
      label: "10–12 min",
    });
    expect(parseCommuteMinutes("12–15 min")).toEqual({
      minutes: 14,
      label: "12–15 min",
    });
    expect(parseCommuteMinutes("15 a 20 min")).toEqual({
      minutes: 18,
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
    expect(byId.get("commute-14-carmo")?.commuteMinutes).toBe(14);
    expect(byId.get("commute-15-lourdes")?.commuteMinutes).toBe(15);
    expect(byId.get("commute-18-sion")?.commuteMinutes).toBe(18);
    expect(byId.get("commute-38-taquaral")?.commuteMinutes).toBe(38);
    expect(byId.get("commute-85-barra-olimpica")?.commuteMinutes).toBe(85);
    expect(byId.get("commute-85-barra-olimpica")?.commuteLabel).toBe("75–100 min");

    // Filter maxCommuteMinutes: 15 keeps <= 15 min (5, 14, 15) and excludes 18, 38, 85
    const under15 = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      maxCommuteMinutes: 15,
    });
    expect(under15.map((p) => p.id).sort()).toEqual([
      "commute-14-carmo",
      "commute-15-lourdes",
      "commute-5-santa-efigenia",
    ]);

    // Sort by commute_asc orders from fastest commute to slowest commute
    const sortedByCommute = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      sortBy: "commute_asc",
    });
    expect(sortedByCommute.map((p) => p.id)).toEqual([
      "commute-5-santa-efigenia",
      "commute-14-carmo",
      "commute-15-lourdes",
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

    // 3. Duplex internal levels ("1º andar sala, 2º andar quartos") -> Legendary Duplex, NOT Andar baixo
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
    expect(byId.get("duplex-levels")?.cardTags.floorTag).toEqual({
      label: "Duplex / Pé-direito duplo",
      rarity: "legendary",
    });
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
      "# Top 3 Imóveis Selecionados — Housing (BH · CP · RJ · SP)",
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
      "# Top 50 Imóveis Selecionados — Housing (BH · CP · RJ · SP)",
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
      enableBsbBenchmark: true,
    });
    expect(filteredOn.map((p) => p.id)).toContain("bsb-aguas-claras-1");
    expect(filteredOn.map((p) => p.id)).toContain("bh-ref-1");

    const filteredOnlyBsb = filterAndSortProperties(evalWithBenchmark, {
      ...DEFAULT_EXPLORER_FILTERS,
      enableBsbBenchmark: true,
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
    expect(DEFAULT_WEIGHTS.urbanBreathingWeight).toBe(2.0);
    expect(DEFAULT_WEIGHTS.modernityMultiplier).toBe(0.85);

    const taquaralNb = nbs.find((n) => n.neighborhood === "Taquaral")!;
    const bosqueNb = nbs.find((n) => n.neighborhood === "Bosque")!;
    const guanabaraNb = nbs.find((n) => n.neighborhood === "Jd. Guanabara")!;

    // Recalibrated CP:Bosque (7.4) and CP:Jd. Guanabara (7.2) stay below 8.0 and score well below Taquaral (9.8)
    expect(bosqueNb.urbanBreathingScore).toBe(7.4);
    expect(guanabaraNb.urbanBreathingScore).toBe(7.2);
    expect(taquaralNb.dynamicScore - bosqueNb.dynamicScore).toBeGreaterThan(1.0);
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
      modernityScore: 85,
      modernityTier: "MODERN_OR_RENOVATED",
    };
    const mod62Prop: SlimPropertyRecord = {
      ...mod85Prop,
      id: "mod-62",
      modernityScore: 62,
      modernityTier: "WELL_MAINTAINED",
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

    // Modernity 85 vs 62 creates ~38-point spread (80.3 vs 42.7 = 37.6 pts)
    const evalMod85 = byId.get("mod-85")!;
    const evalMod62 = byId.get("mod-62")!;
    expect(
      evalMod85.breakdown.modernityPoints - evalMod62.breakdown.modernityPoints,
    ).toBeCloseTo(37.6, 1);

    // Area points follow the exact Brasília furniture curve
    expect(evalMod85.breakdown.areaPoints).toBe(10);
    expect(byId.get("area-80")!.breakdown.areaPoints).toBe(6);
    expect(byId.get("area-47")!.breakdown.areaPoints).toBe(0);
    expect(byId.get("area-42")!.breakdown.areaPoints).toBe(-10);
    expect(byId.get("area-35")!.breakdown.areaPoints).toBe(-18);
    expect(byId.get("area-35")!.eligible).toBe(false);
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
        p.cardTags.floorTag?.rarity === "uncommon" ||
        Boolean(p.cardTags.floorTag?.label.startsWith("Andar baixo")),
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
    expect(classifyFurnitureTier(perClauseNegationProp)).toBe("SEMI_FURNISHED");

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
});
