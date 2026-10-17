import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { filterForeignQuintoAndarPhotos } from "@/app/api/photos/route";
import { buildInstantGroundedAnswer } from "@/app/api/qa/route";
import {
  DEFAULT_EXPLORER_FILTERS,
  filterAndSortProperties,
  hasNoSafetyProblems,
  isRecentlyPublishedListing,
  matchesFloorFilter,
  matchesPropertyFeature,
  MAX_EXTRA_PHOTOS_CACHE_ENTRIES,
  parseExplorerFiltersObject,
  PERFEITO_EXPLORER_FILTERS,
  upsertBoundedRecord,
} from "@/components/housing-portal";
import {
  getClientPhotosCached,
  getClientPhotosCacheSize,
  getThumbPhotoUrl,
  MAX_CLIENT_PHOTOS_CACHE_ENTRIES,
  setClientPhotosCached,
} from "@/components/property-photo-showcase";
import { normalizePreferences } from "@/lib/preferences-store";
import {
  classifyFurnitureTier,
  computeDynamicNeighborhoods,
  computeDynamicProperties,
  DEFAULT_WEIGHTS,
  evaluateStreetMicroEnvironment,
  parseCommuteMinutes,
} from "@/lib/scoring-engine";
import type { NeighborhoodEntry, SlimPropertyRecord } from "@/types/housing";
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

  it("requests true small thumbnails (360x270 / 360x266 / med) and bounds LRU photo caches", () => {
    expect(
      getThumbPhotoUrl(
        "https://resizedimgs.zapimoveis.com.br/img/vr-listing/abc/foto.webp?action=fit-in&dimension=1920x1440",
      ),
    ).toContain("dimension=360x270");
    expect(
      getThumbPhotoUrl(
        "https://imgbr.imovelwebcdn.com/avisos/2/30/1200x1200/733.jpg",
      ),
    ).toContain("/360x266/");
    expect(
      getThumbPhotoUrl(
        "https://www.quintoandar.com.br/img/xxl/original123.jpg",
      ),
    ).toContain("/img/med/");

    // Bounded LRU clientPhotosCache (cap = 35)
    for (let i = 0; i < MAX_CLIENT_PHOTOS_CACHE_ENTRIES + 10; i++) {
      setClientPhotosCached(`quintoandar:test-${i}`, [
        { room: "Sala", url: `https://example.com/${i}.jpg` },
      ]);
    }
    expect(getClientPhotosCacheSize()).toBeLessThanOrEqual(
      MAX_CLIENT_PHOTOS_CACHE_ENTRIES,
    );
    expect(getClientPhotosCached("quintoandar:test-0")).toBeUndefined();
    expect(
      getClientPhotosCached(
        `quintoandar:test-${MAX_CLIENT_PHOTOS_CACHE_ENTRIES + 9}`,
      ),
    ).toBeDefined();

    // Bounded extraPhotosByKey record helper (cap = 25)
    let record: Record<string, number> = {};
    for (let i = 0; i < MAX_EXTRA_PHOTOS_CACHE_ENTRIES + 8; i++) {
      record = upsertBoundedRecord(record, `k-${i}`, i);
    }
    expect(Object.keys(record).length).toBe(MAX_EXTRA_PHOTOS_CACHE_ENTRIES);
    expect(record["k-0"]).toBeUndefined();
    expect(record[`k-${MAX_EXTRA_PHOTOS_CACHE_ENTRIES + 7}`]).toBe(
      MAX_EXTRA_PHOTOS_CACHE_ENTRIES + 7,
    );
  });

  it("answers safety/danger and locality questions directly in buildInstantGroundedAnswer", () => {
    const unsafeProp = makeProperty({
      id: "895685385",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Vila Isabel",
      street: "Rua Teodoro da Silva",
      streetNumber: "706",
      description: "MR. #instalarplaca",
    });
    const safeProp = makeProperty({
      id: "safe-lourdes",
      cityCode: "BH",
      city: "Belo Horizonte",
      neighborhood: "Lourdes",
      street: "Rua Marília de Dirceu",
      streetNumber: "200",
    });

    const evaluated = computeDynamicProperties(
      [unsafeProp, safeProp],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    const evalUnsafe = evaluated.find((p) => p.id === "895685385")!;
    const evalSafe = evaluated.find((p) => p.id === "safe-lourdes")!;

    const unsafeAnswer = buildInstantGroundedAnswer({
      question: "essa é uma area perigosa ?",
      propertyKey: "quintoandar:895685385",
      snapshot: {
        title: evalUnsafe.title,
        neighborhood: evalUnsafe.neighborhood,
        cityCode: evalUnsafe.cityCode,
        street: evalUnsafe.street,
        streetNumber: evalUnsafe.streetNumber,
        condominiumName: evalUnsafe.condominiumName,
        totalMonthly: evalUnsafe.totalMonthly,
        rent: evalUnsafe.rent,
        condoFee: evalUnsafe.condoFee,
        iptu: evalUnsafe.iptu,
        areaM2: evalUnsafe.areaM2,
        bedrooms: evalUnsafe.bedrooms,
        bathrooms: evalUnsafe.bathrooms,
        parkingSpaces: evalUnsafe.parkingSpaces,
        floor: evalUnsafe.floor,
        floorLabel: evalUnsafe.cardTags.floorTag?.label ?? null,
        furnished: evalUnsafe.furnished,
        modernityScore: evalUnsafe.modernityScore,
        finalScore: evalUnsafe.finalScore,
        overallRank: evalUnsafe.overallRank,
        breakdown: evalUnsafe.breakdown,
        redTags: evalUnsafe.cardTags.redTags,
        url: evalUnsafe.url,
        shortJustification: evalUnsafe.shortJustification,
        description: evalUnsafe.description,
      },
      evaluated: evalUnsafe,
      rawListing: null,
      topEvaluated: evaluated,
    });

    expect(unsafeAnswer).toContain("Diagnóstico de Segurança");
    expect(unsafeAnswer).toContain("Área de Atenção / Risco Elevado");
    expect(unsafeAnswer).toContain("efeito bunker");
    expect(unsafeAnswer).not.toContain("MR. #instalarplaca");

    const safeAnswer = buildInstantGroundedAnswer({
      question: "Essa rua é segura para andar a pé?",
      propertyKey: "quintoandar:safe-lourdes",
      snapshot: {
        title: evalSafe.title,
        neighborhood: evalSafe.neighborhood,
        cityCode: evalSafe.cityCode,
        street: evalSafe.street,
        streetNumber: evalSafe.streetNumber,
        condominiumName: evalSafe.condominiumName,
        totalMonthly: evalSafe.totalMonthly,
        rent: evalSafe.rent,
        condoFee: evalSafe.condoFee,
        iptu: evalSafe.iptu,
        areaM2: evalSafe.areaM2,
        bedrooms: evalSafe.bedrooms,
        bathrooms: evalSafe.bathrooms,
        parkingSpaces: evalSafe.parkingSpaces,
        floor: evalSafe.floor,
        floorLabel: evalSafe.cardTags.floorTag?.label ?? null,
        furnished: evalSafe.furnished,
        modernityScore: evalSafe.modernityScore,
        finalScore: evalSafe.finalScore,
        overallRank: evalSafe.overallRank,
        breakdown: evalSafe.breakdown,
        greenTags: evalSafe.cardTags.greenTags,
        url: evalSafe.url,
        shortJustification: evalSafe.shortJustification,
        description: evalSafe.description,
      },
      evaluated: evalSafe,
      rawListing: null,
      topEvaluated: evaluated,
    });

    expect(safeAnswer).toContain("Diagnóstico de Segurança");
    expect(safeAnswer).toContain("Bolha Residencial Segura & Caminhável");
  });

  it("answers retention, air-conditioning, furniture and city-scoped general questions in buildInstantGroundedAnswer", () => {
    const tiny = makeProperty({ id: "tiny", areaM2: 25 });
    const withAc = makeProperty({
      id: "with-ac",
      description:
        "Apartamento reformado com elevador. Ar-condicionado split na sala e no quarto. Entregue com geladeira e cama.",
    });
    const campinas = makeProperty({
      id: "cp-1",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Botafogo",
    });
    const evaluated = computeDynamicProperties(
      [tiny, withAc, campinas],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    const byId = (id: string) => evaluated.find((p) => p.id === id)!;
    const ask = (question: string, id: string | null) => {
      const prop = id ? byId(id) : null;
      return buildInstantGroundedAnswer({
        question,
        propertyKey: prop ? `quintoandar:${prop.id}` : "general",
        snapshot: {
          title: prop?.title ?? "",
          neighborhood: prop?.neighborhood ?? "",
          cityCode: prop?.cityCode ?? "",
          street: prop?.street ?? "",
          streetNumber: null,
          condominiumName: null,
          totalMonthly: prop?.totalMonthly ?? 0,
          rent: prop?.rent ?? 0,
          condoFee: prop?.condoFee ?? 0,
          iptu: prop?.iptu ?? 0,
          areaM2: prop?.areaM2 ?? 0,
          bedrooms: prop?.bedrooms ?? 0,
          bathrooms: prop?.bathrooms ?? 0,
          parkingSpaces: prop?.parkingSpaces ?? 0,
          floor: null,
          floorLabel: null,
          furnished: null,
          modernityScore: prop?.modernityScore ?? 0,
          finalScore: prop?.finalScore ?? 0,
          overallRank: prop?.overallRank ?? null,
          url: "",
          shortJustification: "",
          description: null,
        },
        evaluated: prop,
        rawListing: null,
        topEvaluated: evaluated,
        rankedEligible: evaluated.filter((p) => p.eligible),
      });
    };

    expect(byId("tiny").eligible).toBe(false);
    const retained = ask("por que esse foi retido?", "tiny");
    expect(retained).toContain("Sim, está retido");
    expect(retained).toContain("abaixo do mínimo");
    expect(retained).not.toContain("Decomposição da Nota");

    expect(ask("por que esse foi retido?", "with-ac")).toContain("Não está retido");

    const ac = ask("tem ar-condicionado mesmo?", "with-ac");
    expect(ac).toContain("Ar-condicionado: **sim");
    expect(ac).toContain("split na sala");
    expect(ask("tem ar-condicionado mesmo?", "tiny")).toContain("Ar-condicionado: **não**");

    const furniture = ask("é mobiliado?", "with-ac");
    expect(furniture).toContain("Mobília: **Não mobiliado**");
    expect(furniture).toContain("Geladeira ✅ · Sofá ❌ · Cama ✅");
    expect(furniture).not.toContain("Semi-mobiliado");

    const general = ask("qual o melhor bairro de Campinas pra mim?", null);
    expect(general).toContain("Melhores bairros para o seu perfil — Campinas");
    expect(general).toContain("Botafogo");
    expect(general).not.toContain("(RJ)");
  });

  it("enforces hasNoSafetyProblems and the Perfeito preset (AC, HIGH_OR_TOP, <= 4500, <= 25 min, UNFURNISHED/SEMI_FURNISHED, onlySafeStreets)", () => {
    const perfectMatch = makeProperty({
      id: "perfect-1",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Botafogo",
      street: "Rua Bambina",
      streetNumber: "120",
      totalMonthly: 4300,
      floor: 10,
      totalFloors: 12,
      furnished: false,
      comfortCommodities: ["Ar condicionado"],
      description:
        "Apartamento andar alto em rua silenciosa com ar-condicionado split e armários.",
    });

    const unsafeStreet = makeProperty({
      id: "unsafe-1",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Vila Isabel",
      street: "Rua Teodoro da Silva",
      streetNumber: "706",
      totalMonthly: 3500,
      floor: 11,
      totalFloors: 12,
      furnished: false,
      comfortCommodities: ["Ar condicionado"],
      description: "Apartamento com ar-condicionado em andar alto.",
    });

    const noAc = makeProperty({
      id: "no-ac-1",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Botafogo",
      street: "Rua Bambina",
      streetNumber: "122",
      totalMonthly: 4100,
      floor: 9,
      totalFloors: 12,
      furnished: false,
      comfortCommodities: [],
      description: "Apartamento reformado em andar alto.",
    });

    const lowFloor = makeProperty({
      id: "low-floor-1",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Botafogo",
      street: "Rua Bambina",
      streetNumber: "124",
      totalMonthly: 4100,
      floor: 2,
      totalFloors: 10,
      furnished: false,
      comfortCommodities: ["Ar condicionado"],
      description: "Apartamento com ar-condicionado no 2º andar.",
    });

    const overBudget = makeProperty({
      id: "over-budget-1",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Botafogo",
      street: "Rua Bambina",
      streetNumber: "126",
      rent: 3800,
      condoFee: 700,
      iptu: 200,
      totalMonthly: 4700,
      floor: 10,
      totalFloors: 12,
      furnished: false,
      comfortCommodities: ["Ar condicionado"],
      description: "Apartamento com ar-condicionado no 10º andar.",
    });

    const farCommute = makeProperty({
      id: "far-commute-1",
      cityCode: "CP",
      city: "Campinas",
      neighborhood: "Taquaral",
      street: "Rua Padre Almeida",
      streetNumber: "200",
      totalMonthly: 3900,
      floor: 12,
      totalFloors: 15,
      furnished: false,
      comfortCommodities: ["Ar condicionado"],
      description: "Apartamento andar alto com ar-condicionado no Taquaral.",
    });

    const fullyFurnished = makeProperty({
      id: "furnished-1",
      cityCode: "RJ",
      city: "Rio de Janeiro",
      neighborhood: "Botafogo",
      street: "Rua Bambina",
      streetNumber: "128",
      totalMonthly: 4200,
      floor: 10,
      totalFloors: 12,
      furnished: true,
      comfortCommodities: ["Ar condicionado"],
      description:
        "Apartamento totalmente mobiliado, porteira fechada com cama, sofá, TV e geladeira.",
    });

    const evaluated = computeDynamicProperties(
      [
        perfectMatch,
        unsafeStreet,
        noAc,
        lowFloor,
        overBudget,
        farCommute,
        fullyFurnished,
      ],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );

    const evalPerfect = evaluated.find((p) => p.id === "perfect-1")!;
    const evalUnsafe = evaluated.find((p) => p.id === "unsafe-1")!;

    expect(hasNoSafetyProblems(evalPerfect)).toBe(true);
    expect(matchesPropertyFeature(evalPerfect, "safe_street")).toBe(true);
    expect(hasNoSafetyProblems(evalUnsafe)).toBe(false);
    expect(matchesPropertyFeature(evalUnsafe, "safe_street")).toBe(false);

    const parsedPerfeito = parseExplorerFiltersObject(
      PERFEITO_EXPLORER_FILTERS as Record<string, unknown>,
    );
    expect(parsedPerfeito.onlySafeStreets).toBe(true);
    expect(parsedPerfeito.maxTotalMonthly).toBe(4500);
    expect(parsedPerfeito.maxCommuteMinutes).toBe(25);
    expect(parsedPerfeito.floorFilters).toEqual(["HIGH_OR_TOP"]);
    expect(parsedPerfeito.requiredFeatures).toEqual(["ac"]);
    expect(parsedPerfeito.selectedFurnitureTiers).toEqual(["UNFURNISHED"]);

    const filtered = filterAndSortProperties(evaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      ...PERFEITO_EXPLORER_FILTERS,
    });

    expect(filtered.map((p) => p.id)).toEqual(["perfect-1"]);

    // Verify against real seed-snapshot.json
    const seedRaw = readFileSync(
      resolve(__dirname, "../data/seed-snapshot.json"),
      "utf8",
    );
    const seed = JSON.parse(seedRaw) as {
      neighborhoods: NeighborhoodEntry[];
      properties: SlimPropertyRecord[];
    };
    const { ranked: seedRankedNbs } = computeDynamicNeighborhoods(
      seed.neighborhoods,
      DEFAULT_WEIGHTS,
    );
    const seedEvaluated = computeDynamicProperties(
      seed.properties,
      seedRankedNbs,
      DEFAULT_WEIGHTS,
    );
    const seedPerfeito = filterAndSortProperties(seedEvaluated, {
      ...DEFAULT_EXPLORER_FILTERS,
      ...PERFEITO_EXPLORER_FILTERS,
    });

    expect(seedPerfeito.length).toBeGreaterThan(0);
    for (const p of seedPerfeito) {
      expect(matchesPropertyFeature(p, "ac")).toBe(true);
      expect(matchesFloorFilter(p, "HIGH_OR_TOP")).toBe(true);
      expect(p.totalMonthly).toBeLessThanOrEqual(4500);
      expect(p.commuteMinutes ?? 0).toBeLessThanOrEqual(25);
      expect(p.furnitureTier).toBe("UNFURNISHED");
      expect(hasNoSafetyProblems(p)).toBe(true);
    }
  });

  it("verifies FE-11, SCORE-01, SCORE-02, SCORE-03, SCORE-05, SCORE-07, SCORE-08, SCORE-10, SCORE-12, UX-03, and DATA-06 fixes", () => {
    // 1. FE-11: Object spread `{ ...prop }` preserves own enumerable justification getters
    const [evalProp] = computeDynamicProperties(
      [makeProperty({ id: "spread-test" })],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    const spreadCopy = {
      ...evalProp!,
      samplePhotos: [{ room: "Cozinha", url: "https://example.com/2.jpg" }],
    };
    expect(typeof spreadCopy.shortJustification).toBe("string");
    expect(spreadCopy.shortJustification.length).toBeGreaterThan(10);
    expect(typeof spreadCopy.narrativeJustification).toBe("string");
    expect(spreadCopy.narrativeJustification.length).toBeGreaterThan(10);
    expect(typeof spreadCopy.detailedJustification).toBe("string");
    expect(spreadCopy.detailedJustification.length).toBeGreaterThan(10);

    // 2. SCORE-01: SP / RJ / CP corridor rules only fire on actual street, not description/placesNearby mentions
    const spQuietStreetWithNearbyHospital = makeProperty({
      id: "sp-quiet",
      cityCode: "SP",
      city: "São Paulo",
      neighborhood: "Indianópolis",
      street: "Alameda dos Jurupis",
      streetNumber: "900",
      description:
        "Excelente apartamento com fácil acesso à Av. Santo Amaro, Av. dos Bandeirantes e Av. 23 de Maio.",
      placesNearby: [{ type: "HOSPITAL", name: "Hospital 9 de Julho" }],
    });
    expect(
      evaluateStreetMicroEnvironment(spQuietStreetWithNearbyHospital).category,
    ).not.toBe("BUNKER_OR_SPOOF");

    const spActualCorridorStreet = makeProperty({
      id: "sp-corridor",
      cityCode: "SP",
      city: "São Paulo",
      neighborhood: "Indianópolis",
      street: "Avenida Santo Amaro",
      streetNumber: "1500",
      description: "Apartamento amplo.",
    });
    expect(evaluateStreetMicroEnvironment(spActualCorridorStreet).category).toBe(
      "BUNKER_OR_SPOOF",
    );

    // 3. SCORE-02: Accented Portuguese words match properly with Unicode-safe boundaries
    const accentedProp = makeProperty({
      id: "accent-test",
      floor: null,
      totalFloors: null,
      amenities: [],
      comfortCommodities: [],
      practicalityCommodities: [],
      description:
        "Apartamento no último andar com área de serviço separada, água e gás inclusos e sol da manhã.",
    });
    const [evalAccented] = computeDynamicProperties(
      [accentedProp],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    expect(evalAccented!.cardTags.floorTag?.label).toContain("Último andar");
    expect(evalAccented!.nuanceHighlights).toContain(
      "Área de serviço p/ máquinas",
    );
    expect(evalAccented!.nuanceHighlights).toContain(
      "Água/gás inclusos no condomínio",
    );
    expect(evalAccented!.nuanceHighlights).toContain("Sol da manhã");

    // 4. SCORE-03: Furniture negations & unknown null furniture partial bonus
    const negatedFurnProp = makeProperty({
      id: "neg-furn",
      furnished: false,
      description:
        "O apartamento será alugado sem mobília, não está mobiliado, sem cama e sem sofá.",
    });
    expect(classifyFurnitureTier(negatedFurnProp)).toBe("UNFURNISHED");

    const unknownNullFurnProp = makeProperty({
      id: "null-furn",
      title: "Apartamento",
      furnished: null,
      amenities: [],
      comfortCommodities: [],
      practicalityCommodities: [],
      positiveSignals: [],
      description: "Apartamento de 2 quartos bem localizado.",
    });
    const confirmedUnfProp = makeProperty({
      id: "conf-unf",
      furnished: false,
      description: "Apartamento sem mobília com armários planejados.",
    });
    const evalNullFurn = computeDynamicProperties(
      [unknownNullFurnProp, confirmedUnfProp],
      rankedNbs,
      DEFAULT_WEIGHTS,
    ).find((p) => p.id === "null-furn");
    const evalConfUnf = computeDynamicProperties(
      [unknownNullFurnProp, confirmedUnfProp],
      rankedNbs,
      DEFAULT_WEIGHTS,
    ).find((p) => p.id === "conf-unf");
    expect(evalNullFurn!.breakdown.furniturePoints).toBe(
      Math.round(DEFAULT_WEIGHTS.unfurnishedBonus * 0.6),
    );
    expect(evalConfUnf!.breakdown.furniturePoints).toBe(
      DEFAULT_WEIGHTS.unfurnishedBonus,
    );

    // 5. SCORE-05 & SCORE-08: comfortFloor when budgetIdeal < 3500 & RJ effectiveMinMod when minModernityScore < 56
    const lowBudgetWeights = {
      ...DEFAULT_WEIGHTS,
      budgetIdeal: 3200,
      budgetMax: 3800,
      budgetHardCap: 4500,
      minModernityScore: 40,
    };
    const rjMod45Prop = makeProperty({
      id: "rj-mod-45",
      cityCode: "RJ",
      totalMonthly: 2600,
      modernityScore: 45,
    });
    const rjMod3200Prop = makeProperty({
      id: "rj-mod-3200",
      cityCode: "RJ",
      totalMonthly: 3000,
      modernityScore: 45,
    });
    const [eval2600, eval3000] = computeDynamicProperties(
      [rjMod45Prop, rjMod3200Prop],
      rankedNbs,
      lowBudgetWeights,
    );
    expect(eval2600!.eligible).toBe(true);
    expect(eval2600!.breakdown.budgetPoints).toBeGreaterThan(
      eval3000!.breakdown.budgetPoints,
    );

    // 6. SCORE-07 & SCORE-10: Cobertura boilerplate & "sem elevador de serviço"
    const boilerplateProp = makeProperty({
      id: "boiler-prop",
      floor: 4,
      totalFloors: 8,
      installations: ["Elevador"],
      description:
        "Ótima cobertura de celular e internet. O condomínio conta com cobertura coletiva e área de lazer na cobertura. Prédio com elevador social, sem elevador de serviço.",
    });
    const [evalBoiler] = computeDynamicProperties(
      [boilerplateProp],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    expect(evalBoiler!.cardTags.floorTag?.label).not.toContain("Cobertura");
    expect(evalBoiler!.cardTags.redTags).not.toContain("Sem elevador");
    expect(evalBoiler!.eligible).toBe(true);

    // 7. SCORE-12: parseCommuteMinutes hour notation
    expect(parseCommuteMinutes("1h 20min").minutes).toBe(80);
    expect(parseCommuteMinutes("1h30").minutes).toBe(90);
    expect(parseCommuteMinutes("1 hora").minutes).toBe(60);

    // 8. UX-03: Accent-insensitive free-text search
    const searchProps = computeDynamicProperties(
      [
        makeProperty({
          id: "acc-search-1",
          cityCode: "BH",
          neighborhood: "Funcionários",
          title: "Suíte com água aquecida em São Paulo",
        }),
      ],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    for (const query of ["funcionarios", "agua", "sao paulo", "suite"]) {
      const hits = filterAndSortProperties(searchProps, {
        ...DEFAULT_EXPLORER_FILTERS,
        onlyTop20Neighborhoods: false,
        searchQuery: query,
      });
      expect(hits).toHaveLength(1);
    }

    // 9. DATA-06: filterForeignQuintoAndarPhotos removes cross-listing similarHouses photos
    const cleaned = filterForeignQuintoAndarPhotos(
      [
        {
          room: "Sala",
          url: "https://www.quintoandar.com.br/img/xxl/893127481-111.jpg",
        },
        {
          room: "Quarto",
          url: "https://www.quintoandar.com.br/img/xxl/895686374-222.jpg",
        },
      ],
      "893127481",
    );
    expect(cleaned).toEqual([
      {
        room: "Sala",
        url: "https://www.quintoandar.com.br/img/xxl/893127481-111.jpg",
      },
    ]);

    // 10. isRecentlyPublishedListing & onlyNewEntries filter & empty compareKeys preservation
    expect(
      isRecentlyPublishedListing({ listingAgeDays: 3, isNewEntry: false }),
    ).toBe(true);
    expect(
      isRecentlyPublishedListing({ listingAgeDays: 14, isNewEntry: true }),
    ).toBe(false);
    expect(
      isRecentlyPublishedListing({ listingAgeDays: null, isNewEntry: true }),
    ).toBe(true);
    expect(
      isRecentlyPublishedListing({ listingAgeDays: null, isNewEntry: false }),
    ).toBe(false);

    const recentAndOldProps = computeDynamicProperties(
      [
        makeProperty({
          id: "recent-3d",
          isNewEntry: true,
          publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        }),
        makeProperty({
          id: "stale-20d",
          isNewEntry: true,
          publishedAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
        }),
      ],
      rankedNbs,
      DEFAULT_WEIGHTS,
    );
    const onlyNewFiltered = filterAndSortProperties(recentAndOldProps, {
      ...DEFAULT_EXPLORER_FILTERS,
      onlyTop20Neighborhoods: false,
      onlyNewEntries: true,
    });
    expect(onlyNewFiltered.map((p) => p.id)).toEqual(["recent-3d"]);

    const emptiedPrefs = normalizePreferences({ compareKeys: [] });
    expect(emptiedPrefs.compareKeys).toEqual([]);
    const defaultPrefs = normalizePreferences({});
    expect(defaultPrefs.compareKeys.length).toBeGreaterThan(0);
  });
});
