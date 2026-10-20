import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EvaluatedProperty,
  PropertyQuestionSnapshot,
} from "@/types/housing";

const { WEIGHTS_FIXTURE } = vi.hoisted(() => ({
  WEIGHTS_FIXTURE: {
  urbanBreathingWeight: 3.5,
  commuteLogisticsWeight: 2.0,
  safetyCarWeight: 3.0,
  neighborhoodMultiplier: 6.5,
  modernityMultiplier: 0.85,
  nuancesMultiplier: 1.0,
  minModernityScore: 60,
  budgetIdeal: 4500,
  budgetMax: 5000,
  budgetHardCap: 6500,
  budgetWeight: 1.0,
  unfurnishedBonus: 15,
  furnishedPenalty: -22,
  parkingBonus1: 5,
  parkingBonus2: 8,
  requireParking: true,
  penalizeMegaCondo: true,
  minAreaM2: 35,
  maxAreaM2: 95,
  sweetSpotMinM2: 45,
  sweetSpotMaxM2: 72,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
/**
 * qa-store.ts persists through getDb().execute(sql`...`) (one row of items). The fake keeps the
 * last INSERTed items so reads after the 4s in-memory TTL stay consistent, and never touches the
 * OS-temp fallback file the no-database path writes.
 */
const dbMocks = vi.hoisted(() => {
  const state = { items: [] as unknown[] };
  const queryText = (query: unknown): string =>
    ((query as { queryChunks?: unknown[] }).queryChunks ?? [])
      .map((c) => (c && typeof c === "object" && "value" in c ? (c as { value: string[] }).value.join("") : "?"))
      .join("");
  const insertedItems = (query: unknown): unknown[] => {
    const json = ((query as { queryChunks?: unknown[] }).queryChunks ?? []).find(
      (c): c is string => typeof c === "string" && c.startsWith("["),
    );
    return json ? (JSON.parse(json) as unknown[]) : [];
  };
  const defaultExecute = async (query: unknown) => {
    if (queryText(query).includes("INSERT")) {
      state.items = insertedItems(query);
      return { rows: [] };
    }
    return { rows: [{ items: state.items }] };
  };
  return {
    state,
    queryText,
    defaultExecute,
    execute: vi.fn(defaultExecute),
    getScoredProperties: vi.fn(),
    flags: { raw: false, queue: false },
    rawJson: JSON.stringify({
      listings: [
        {
          provider: "quintoandar",
          id: "888",
          amenities: ["POOL"],
          advertiser: { name: "Imobiliária Raw", whatsapp: "31000000000" },
          specs: { floor: 5, total_floors: 10 },
        },
      ],
    }),
  };
});

vi.mock("@/db", () => ({ getDb: () => ({ execute: dbMocks.execute }), schema: {} }));
vi.mock("@/lib/server-scoring", () => ({ getScoredProperties: dbMocks.getScoredProperties }));
vi.mock("@/lib/scoring-engine", () => ({
  AC_INFRA_ONLY_TAG: "AC não instalado (só infraestrutura)",
  AC_UNCONFIRMED_TAG: "AC não confirmado",
  DEFAULT_WEIGHTS: WEIGHTS_FIXTURE,
  classifyFurnitureTier: vi.fn(() => "UNFURNISHED"),
  evaluateStreetMicroEnvironment: vi.fn(() => ({
    category: "NEUTRAL",
    pointsDelta: 0,
    redTag: null,
    greenTag: null,
    warning: null,
    highlight: null,
    safetyCarCap: null,
    urbanBreathingCap: null,
  })),
  resolveNeighborhoodSafetyAndMetrics: vi.fn(
    (cityCode: string, neighborhood: string) => {
      if (neighborhood === "Lourdes") {
        return {
          cityCode,
          commute: "10 min do Nubank",
          urbanBreathing: 9.5,
          commuteLogistics: 9.8,
          buildingStock: 9.4,
          budgetFit: 9.5,
          safetyCar: 9.2,
        };
      }
      if (neighborhood === "Centro Perigoso") {
        return {
          cityCode,
          commute: "20 min do Nubank",
          urbanBreathing: 5.0,
          commuteLogistics: 6.0,
          buildingStock: 5.0,
          budgetFit: 6.0,
          safetyCar: 4.2,
        };
      }
      if (neighborhood === "Savassi Moderada") {
        return {
          cityCode,
          commute: "15 min do Nubank",
          urbanBreathing: 7.0,
          commuteLogistics: 7.5,
          buildingStock: 7.0,
          budgetFit: 7.0,
          safetyCar: 6.8,
        };
      }
      return undefined;
    },
  ),
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn((p: Parameters<typeof actual.existsSync>[0]) => {
      const s = String(p);
      if (s.includes("imoveis_")) return dbMocks.flags.raw;
      if (s.includes(".cursor")) return dbMocks.flags.queue;
      return actual.existsSync(p);
    }),
    readFileSync: vi.fn(((
      p: Parameters<typeof actual.readFileSync>[0],
      opts?: Parameters<typeof actual.readFileSync>[1],
    ) => {
      if (String(p).includes("imoveis_")) return dbMocks.rawJson;
      return actual.readFileSync(p, opts as never);
    }) as typeof actual.readFileSync),
    statSync: vi.fn((p: Parameters<typeof actual.statSync>[0]) => {
      if (String(p).includes("imoveis_")) {
        return { mtimeMs: 4242, size: 99 } as ReturnType<typeof actual.statSync>;
      }
      return actual.statSync(p);
    }),
    appendFileSync: vi.fn(),
  };
});

import { evaluateStreetMicroEnvironment } from "@/lib/scoring-engine";
import type { ScoredSet } from "@/lib/property-query";
import { buildInstantGroundedAnswer, GET, POST } from "./route";

function scoredSet(properties: EvaluatedProperty[]): ScoredSet {
  return { datasetHash: "test", properties, ranked: [], filtered: new Map() };
}

const BREAKDOWN = {
  neighborhoodPoints: 20,
  modernityPoints: 10,
  nuancesPoints: 5,
  budgetPoints: 8,
  furniturePoints: 15,
  areaPoints: 6,
  parkingPoints: 5,
  safetyPoints: 8,
  commutePoints: 4,
  cityPreferencePoints: 2,
};

function makeSnapshot(
  overrides: Partial<PropertyQuestionSnapshot> = {},
): PropertyQuestionSnapshot {
  return {
    title: "Apê Teste",
    neighborhood: "Lourdes",
    cityCode: "BH",
    street: "Rua Teste",
    streetNumber: "100",
    condominiumName: "Ed. Teste",
    totalMonthly: 4000,
    rent: 3000,
    condoFee: 800,
    iptu: 200,
    areaM2: 60,
    bedrooms: 2,
    bathrooms: 2,
    parkingSpaces: 1,
    floor: 5,
    floorLabel: "Andar alto",
    furnished: false,
    modernityScore: 85,
    finalScore: 88.5,
    overallRank: 3,
    cityRank: 1,
    furnitureTier: "UNFURNISHED",
    breakdown: { ...BREAKDOWN },
    url: "https://www.quintoandar.com.br/imovel/999",
    shortJustification: "Bom custo-benefício",
    description:
      "Apartamento com geladeira, sofá, cama e split de ar-condicionado instalado em todos os quartos.",
    thumbnailUrl: null,
    suites: 1,
    totalFloors: 10,
    floorRange: null,
    constructionYear: 2018,
    doorman: "NightAndDayShift",
    acLabel: "Ar-condicionado",
    greenTags: ["Rua Silenciosa"],
    redTags: [],
    nuanceHighlights: ["Varanda"],
    nuanceWarnings: [],
    eligible: true,
    exclusionReason: null,
    ...overrides,
  };
}

function makeEvaluated(
  overrides: Record<string, unknown> = {},
): EvaluatedProperty {
  const base = {
    provider: "quintoandar",
    id: "999",
    cityCode: "BH",
    city: "Belo Horizonte",
    neighborhood: "Lourdes",
    street: "Rua Teste",
    streetNumber: "100",
    condominiumName: "Ed. Teste",
    doorman: "NightAndDayShift",
    url: "https://www.quintoandar.com.br/imovel/999",
    title: "Apê Teste",
    rent: 3000,
    condoFee: 800,
    iptu: 200,
    totalMonthly: 4000,
    salePrice: null,
    areaM2: 60,
    bedrooms: 2,
    suites: 1,
    bathrooms: 2,
    parkingSpaces: 1,
    floor: 5,
    floorRange: null,
    totalFloors: 10,
    furnished: false,
    acceptsPets: true,
    nearSubway: false,
    constructionYear: 2018,
    condition: null,
    installations: [],
    amenities: ["POOL"],
    comfortCommodities: [],
    practicalityCommodities: [],
    placesNearby: [{ name: "Parque Municipal", type: "PARK_OR_GREEN_AREA" }],
    photoCaptions: ["Sala ampla"],
    photosCount: 8,
    modernityScore: 85,
    modernityTier: "MODERN_OR_RENOVATED",
    positiveSignals: ["Porcelanato"],
    negativeSignals: [],
    samplePhotos: [{ room: "Sala", url: "https://img.example/1.jpg" }],
    description:
      "Apartamento com geladeira, sofá, cama e split de ar-condicionado instalado.",
    generatedDescription: null,
    sourceSearch: null,
    isNewEntry: false,
    isActive: true,
    furnitureTier: "UNFURNISHED",
    commuteLabel: "10 min do Nubank",
    eligible: true,
    exclusionReason: null,
    finalScore: 88.5,
    cityRank: 1,
    overallRank: 3,
    neighborhoodRank: 1,
    neighborhoodDynamicScore: 9.4,
    breakdown: { ...BREAKDOWN },
    cardTags: {
      acLabel: "Ar-condicionado",
      floorTag: { label: "Andar alto", rarity: "rare" },
      highFloorLabel: null,
      lowFloorLabel: null,
      noParking: false,
      greenTags: ["Rua Silenciosa"],
      redTags: [],
      warningTags: [],
    },
    nuanceHighlights: ["Varanda"],
    nuanceWarnings: [],
    parksNearby: ["Parque Municipal"],
    mallsNearby: [],
    shortJustification: "Bom custo-benefício",
    narrativeJustification: "",
    detailedJustification: "",
  };
  return { ...base, ...overrides } as unknown as EvaluatedProperty;
}

function instant(
  params: Partial<Parameters<typeof buildInstantGroundedAnswer>[0]> = {},
): string {
  return buildInstantGroundedAnswer({
    question: "vale a pena?",
    propertyKey: "quintoandar:999",
    snapshot: makeSnapshot(),
    evaluated: makeEvaluated(),
    rawListing: null,
    topEvaluated: [makeEvaluated()],
    ...params,
  });
}

// Test-only token (not a real credential): POST now gates on requireAuth
// (src/lib/auth.ts) — 503 when HOUSING_AUTH_TOKEN is unset, 401 without it.
const QA_TEST_TOKEN = "test-housing-token-not-real";

beforeEach(() => {
  process.env.HOUSING_AUTH_TOKEN = QA_TEST_TOKEN;
  delete process.env.HOUSING_SCRAPER_DIR;
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.GROQ_API_KEY;
  delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  delete process.env.GOOGLE_AI_API_KEY;
  dbMocks.execute.mockReset().mockImplementation(dbMocks.defaultExecute);
  dbMocks.getScoredProperties.mockReset().mockResolvedValue(scoredSet([]));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("fetch not stubbed");
    }),
  );
});

describe("buildInstantGroundedAnswer — general questions", () => {
  it("ranks neighborhoods and top listings for a city-scoped general question", () => {
    const a = makeEvaluated();
    const b = makeEvaluated({ id: "1000", neighborhood: "Savassi Moderada", finalScore: 80 });
    const answer = instant({
      question: "quais os melhores bairros em BH?",
      propertyKey: "general",
      snapshot: makeSnapshot({ neighborhood: "" }),
      evaluated: null,
      rankedEligible: [a, b],
      topEvaluated: [a, b],
    });
    expect(answer).toContain("Melhores bairros");
    expect(answer).toContain("Lourdes");
    expect(answer).toContain("Top apartamentos elegíveis");
  });

  it("reports an empty eligible pool and uses contextSummary for screen questions", () => {
    const empty = instant({
      question: "o que há de bom?",
      propertyKey: "general",
      snapshot: makeSnapshot({ neighborhood: "" }),
      evaluated: null,
      rankedEligible: [],
      topEvaluated: [],
    });
    expect(empty).toContain("Não há imóveis elegíveis");

    const withCtx = instant({
      question: "o que está na tela filtrada?",
      propertyKey: "general",
      snapshot: makeSnapshot({ neighborhood: "" }),
      evaluated: null,
      rankedEligible: [makeEvaluated()],
      topEvaluated: [makeEvaluated()],
      contextSummary: "1. Apê da tela atual",
    });
    expect(withCtx).toContain("Top da sua tela");
    expect(withCtx).toContain("Apê da tela atual");
  });
});

describe("buildInstantGroundedAnswer — safety", () => {
  it("calls a high-safety neighborhood a safe walkable bubble", () => {
    const answer = instant({ question: "é perigoso andar a pé à noite?" });
    expect(answer).toContain("Bolha Residencial Segura");
    expect(answer).toContain("9.2/10");
  });

  it("flags a low-safety neighborhood as high risk", () => {
    const answer = instant({
      question: "é seguro? tenho medo de assalto",
      snapshot: makeSnapshot({
        neighborhood: "Centro Perigoso",
        breakdown: { ...BREAKDOWN, safetyPoints: -20 },
      }),
      evaluated: makeEvaluated({ neighborhood: "Centro Perigoso" }),
    });
    expect(answer).toContain("Risco Elevado");
    expect(answer).toContain("efeito bunker");
  });

  it("gives a moderate verdict for mid-range safety and honors a micro-env cap", () => {
    const moderate = instant({
      question: "é seguro caminhar?",
      snapshot: makeSnapshot({ neighborhood: "Savassi Moderada" }),
      evaluated: makeEvaluated({ neighborhood: "Savassi Moderada" }),
    });
    expect(moderate).toContain("Segurança Moderada");

    vi.mocked(evaluateStreetMicroEnvironment).mockReturnValueOnce({
      category: "BUNKER_OR_SPOOF",
      pointsDelta: -26,
      redTag: "Via Arterial / Efeito Bunker",
      greenTag: null,
      warning: "Corredor intenso",
      highlight: null,
      safetyCarCap: 5.0,
      urbanBreathingCap: 5.0,
    });
    const capped = instant({ question: "é perigoso?" });
    expect(capped).toContain("Risco Elevado");
    expect(capped).toContain("Corredor intenso");
  });
});

describe("buildInstantGroundedAnswer — floor, furniture, AC", () => {
  it("describes exact floor, floor range, ground floor and unknown floor", () => {
    expect(instant({ question: "qual o andar?" })).toContain("5º andar");
    expect(
      instant({
        question: "qual o andar?",
        snapshot: makeSnapshot({ floor: null, floorRange: { min: 2, max: 4 } }),
        evaluated: makeEvaluated({ floor: null, floorRange: { min: 2, max: 4 } }),
      }),
    ).toContain("2º ao 4º andar");
    expect(
      instant({
        question: "é térreo?",
        snapshot: makeSnapshot({ floor: 0 }),
        evaluated: makeEvaluated({ floor: 0 }),
      }),
    ).toContain("Térreo (andar 0)");
    expect(
      instant({
        question: "qual o andar?",
        snapshot: makeSnapshot({ floor: null, floorRange: null }),
        evaluated: makeEvaluated({
          floor: null,
          floorRange: null,
          cardTags: {
            acLabel: null,
            floorTag: null,
            highFloorLabel: null,
            lowFloorLabel: null,
            noParking: false,
            greenTags: [],
            redTags: [],
            warningTags: [],
          },
        }),
      }),
    ).toContain("Não informado pela imobiliária");
  });

  it("applies the geladeira+sofá+cama furniture rule both ways", () => {
    const furnished = instant({
      question: "é mobiliado? tem geladeira, sofá e cama?",
      snapshot: makeSnapshot({ furnitureTier: "FULLY_FURNISHED" }),
      evaluated: makeEvaluated({ furnitureTier: "FULLY_FURNISHED" }),
    });
    expect(furnished).toContain("Mobília: **Mobiliado**");
    expect(furnished).toContain("Geladeira ✅");

    const bare = instant({
      question: "é mobiliado?",
      snapshot: makeSnapshot({
        furnitureTier: "UNFURNISHED",
        description: "Apartamento vazio para locação.",
      }),
      evaluated: makeEvaluated({
        furnitureTier: "UNFURNISHED",
        description: "Apartamento vazio para locação.",
      }),
    });
    expect(bare).toContain("Mobília: **Não mobiliado**");
    expect(bare).toContain("Geladeira ❌");
  });

  it("answers AC confirmed, absent, infra-only, unconfirmed and photo-audit false-AC", () => {
    expect(instant({ question: "tem ar-condicionado?" })).toContain(
      "Ar-condicionado: **sim**",
    );
    const absent = instant({
      question: "tem ar-condicionado?",
      snapshot: makeSnapshot({ acLabel: null, description: "Apartamento arejado." }),
      evaluated: makeEvaluated({
        description: "Apartamento arejado.",
        amenities: [],
        cardTags: {
          acLabel: null,
          floorTag: null,
          highFloorLabel: null,
          lowFloorLabel: null,
          noParking: false,
          greenTags: [],
          redTags: [],
          warningTags: [],
        },
      }),
    });
    expect(absent).toContain("Ar-condicionado: **não**");

    const mkTagged = (tag: string) =>
      makeEvaluated({
        cardTags: {
          acLabel: null,
          floorTag: null,
          highFloorLabel: null,
          lowFloorLabel: null,
          noParking: false,
          greenTags: [],
          redTags: [],
          warningTags: [tag],
        },
      });
    expect(
      instant({
        question: "tem ar-condicionado?",
        evaluated: mkTagged("AC não instalado (só infraestrutura)"),
      }),
    ).toContain("só infraestrutura");
    expect(
      instant({
        question: "tem ar-condicionado?",
        evaluated: mkTagged("AC não confirmado"),
      }),
    ).toContain("Ar-condicionado: **não confirmado**");

    const audit = instant({
      question: "tem ar-condicionado?",
      propertyKey: "quintoandar:895706010",
    });
    expect(audit).toContain("não confirmado nas fotos");
  });
});

describe("buildInstantGroundedAnswer — retention, score, price, photos, BSB", () => {
  it("explains retention barriers for ineligible, eligible and unknown listings", () => {
    const held = instant({
      question: "por que foi retido?",
      snapshot: makeSnapshot({
        eligible: false,
        exclusionReason: "Área abaixo do mínimo · Sem vaga livre",
      }),
      evaluated: makeEvaluated({ eligible: false }),
    });
    expect(held).toContain("Sim, está retido");
    expect(held).toContain("Sem vaga livre");
    expect(held).toContain("35 m²");

    const free = instant({ question: "foi retido?" });
    expect(free).toContain("Não está retido");
    expect(free).toContain("#3 no ranking geral");

    const unknown = instant({
      question: "foi excluído?",
      snapshot: makeSnapshot({ eligible: undefined }),
      evaluated: null,
    });
    expect(unknown).toContain("não consigo confirmar");
  });

  it("breaks down the score, price and photo/condition sections", () => {
    const answer = instant({
      question: "qual a nota, o preço e como estão as fotos?",
    });
    expect(answer).toContain("Decomposição da Nota");
    expect(answer).toContain("88.5 pts");
    expect(answer).toContain("Custos & Condições");
    expect(answer).toContain("R$ 4.000");
    expect(answer).toContain("Acabamento, Modernidade & Fotos");
    expect(answer).toContain("Porcelanato");
  });

  it("compares against the Águas Claras benchmark when asked", () => {
    const answer = instant({
      question: "comparado com Águas Claras, vale?",
      bsbBenchmark: {
        count: 12,
        medianTotalMonthly: 3500,
        medianAreaM2: 55,
        medianPricePerM2: 64,
        medianFinalScore: 80,
      },
    });
    expect(answer).toContain("Comparado com Águas Claras (mediana de 12 anúncios)");
  });

  it("uses raw listing advertiser/amenities and notes Cursor queueing for bug reports", () => {
    const answer = instant({
      question: "qual o preço e o custo mensal? quem anuncia?",
      rawListing: {
        provider: "quintoandar",
        id: "999",
        amenities: ["POOL", "GYM"],
        advertiser: { name: "Imobiliária Teste", creci: "MG-123", whatsapp: "31000000000" },
        specs: { floor: 5 },
      } as never,
    });
    expect(answer).toContain("Imobiliária Teste");
    expect(answer).toContain("Piscina");

    const queued = instant({
      question: "isso deveria ser corrigido, é um bug",
      queuedToLocalCursor: true,
    });
    expect(queued).toContain("Encaminhado à Sessão do Cursor");
  });
});

/* ------------------------------ HTTP handlers ------------------------------ */

function postReq(body: unknown, raw = false): Request {
  return new Request("http://localhost/api/qa", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-housing-token": QA_TEST_TOKEN,
    },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

interface QaItem {
  id: string;
  propertyKey: string;
  status: string;
  answer: string | null;
  answerSource?: string;
  instantAnswer?: string | null;
  awaitingDetailedAnswer?: boolean;
}

describe("GET/POST /api/qa", () => {
  it("serves the last known (empty) items when the database load fails", async () => {
    dbMocks.execute.mockRejectedValueOnce(new Error("db down"));
    const res = await GET(new Request("http://localhost/api/qa"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, items: [] });
  });

  it("loads items from the database, answers via a DB-backed save, and surfaces save failures", async () => {
    const seedItem = {
      id: "db-1",
      propertyKey: "quintoandar:1",
      question: "pergunta do banco?",
      status: "pending",
      answer: null,
      propertySnapshot: { neighborhood: "Lourdes" },
    };
    dbMocks.state.items = [seedItem, { nope: true }, "junk"];
    const res = await GET(new Request("http://localhost/api/qa"));
    const json = (await res.json()) as { items: QaItem[] };
    expect(json.items).toHaveLength(1);
    expect(json.items[0]).toMatchObject({ id: "db-1", status: "pending" });

    const answered = await POST(
      postReq({ action: "answer", id: "db-1", answer: "resposta via banco" }),
    );
    expect(answered.status).toBe(200);
    expect(dbMocks.state.items).toMatchObject([{ id: "db-1", answer: "resposta via banco" }]);

    // qa-store.ts saveQaItems awaits the INSERT, so a failed write reaches the route's 500 catch-all.
    dbMocks.execute.mockImplementation(async (query: unknown) => {
      if (dbMocks.queryText(query).includes("INSERT")) throw new Error("insert failed");
      return dbMocks.defaultExecute(query);
    });
    const deleted = await POST(postReq({ action: "delete", id: "db-1" }));
    expect(deleted.status).toBe(500);
    await expect(deleted.json()).resolves.toEqual({ ok: false, error: "insert failed" });

    // The failed delete must not linger in this instance's cache.
    const afterFailure = (await (await GET(new Request("http://localhost/api/qa"))).json()) as {
      items: QaItem[];
    };
    expect(afterFailure.items).toMatchObject([{ id: "db-1", answer: "resposta via banco" }]);

    dbMocks.execute.mockImplementation(dbMocks.defaultExecute);
    await POST(postReq({ action: "clear" }));
  });

  it("clear empties the store and GET returns an ETag (304 on If-None-Match)", async () => {
    const cleared = await POST(postReq({ action: "clear" }));
    expect(cleared.status).toBe(200);
    await expect(cleared.json()).resolves.toEqual({ ok: true, items: [] });

    const res = await GET(new Request("http://localhost/api/qa"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const etag = res.headers.get("etag");
    expect(etag).toMatch(/^W\/"qa-/);
    await expect(res.json()).resolves.toEqual({ ok: true, items: [] });

    const cached = await GET(
      new Request("http://localhost/api/qa", { headers: { "if-none-match": etag! } }),
    );
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe("");
  });

  it("requires auth on POST: 503 when unconfigured, 401 without a token", async () => {
    // auth.ts:55-66 — the new readiness/auth precondition behind the 503s.
    delete process.env.HOUSING_AUTH_TOKEN;
    const unconfigured = await POST(postReq({ action: "clear" }));
    expect(unconfigured.status).toBe(503);
    await expect(unconfigured.json()).resolves.toEqual({
      ok: false,
      error: "Autenticação não configurada (HOUSING_AUTH_TOKEN).",
    });

    process.env.HOUSING_AUTH_TOKEN = QA_TEST_TOKEN;
    const unauthenticated = await POST(
      new Request("http://localhost/api/qa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      }),
    );
    expect(unauthenticated.status).toBe(401);
    await expect(unauthenticated.json()).resolves.toEqual({
      ok: false,
      error: "Não autenticado. Entre em /login.",
      login: "/login",
    });
  });

  it("rejects an empty question with 400 and invalid JSON with 400", async () => {
    const empty = await POST(postReq({ action: "ask", question: "   " }));
    expect(empty.status).toBe(400);
    await expect(empty.json()).resolves.toEqual({
      ok: false,
      error: "Digite uma pergunta para enviar ao chat.",
    });

    // api-guards.ts parseJsonBody now rejects malformed JSON with 400
    // (previously it fell through to the route's 500 catch-all).
    const bad = await POST(postReq("{not json", true));
    expect(bad.status).toBe(400);
    await expect(bad.json()).resolves.toEqual({
      ok: false,
      error: "Corpo JSON inválido.",
    });
  });

  it("ask (general) stores an instant-diagnostic answer; GET filters by key/status", async () => {
    const res = await POST(
      postReq({ action: "ask", propertyKey: "general", question: "quais os melhores imóveis?" }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      item: QaItem;
      items: QaItem[];
      queuedToLocalCursor: boolean;
    };
    expect(json.ok).toBe(true);
    expect(json.queuedToLocalCursor).toBe(false);
    expect(json.item.status).toBe("answered");
    expect(json.item.answerSource).toBe("instant_diagnostic");
    expect(json.item.answer).toContain("Não há imóveis elegíveis");
    expect(json.items).toHaveLength(1);

    const byKey = (await (
      await GET(new Request("http://localhost/api/qa?propertyKey=general"))
    ).json()) as { items: QaItem[] };
    expect(byKey.items).toHaveLength(1);
    const byOtherKey = (await (
      await GET(new Request("http://localhost/api/qa?propertyKey=nope:1"))
    ).json()) as { items: QaItem[] };
    expect(byOtherKey.items).toHaveLength(0);
    const pending = (await (
      await GET(new Request("http://localhost/api/qa?status=pending"))
    ).json()) as { items: QaItem[] };
    expect(pending.items).toHaveLength(0);
    const answered = (await (
      await GET(new Request("http://localhost/api/qa?status=answered"))
    ).json()) as { items: QaItem[] };
    expect(answered.items).toHaveLength(1);
  });

  it("ask (specific) sanitizes the snapshot and answers from it", async () => {
    const res = await POST(
      postReq({
        action: "ask",
        propertyKey: "quintoandar:999",
        question: "qual o andar?",
        propertySnapshot: {
          ...makeSnapshot({ floor: 7 }),
          bogusField: "drop-me",
        },
      }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      item: QaItem & { propertySnapshot: Record<string, unknown> };
    };
    expect(json.item.answer).toContain("7º andar");
    expect(json.item.propertySnapshot.neighborhood).toBe("Lourdes");
    expect(json.item.propertySnapshot).not.toHaveProperty("bogusField");
  });

  it("uses the Groq LLM when configured, and falls back when it errors", async () => {
    process.env.GROQ_API_KEY = "test-groq-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ choices: [{ message: { content: "Resposta do LLM" } }] }),
      })),
    );
    const llmRes = await POST(
      postReq({ action: "ask", propertyKey: "general", question: "resuma o ranking" }),
    );
    const llmJson = (await llmRes.json()) as { item: QaItem };
    expect(llmJson.item.answerSource).toBe("llm");
    expect(llmJson.item.answer).toBe("Resposta do LLM");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) })),
    );
    const fbRes = await POST(
      postReq({ action: "ask", propertyKey: "general", question: "resuma de novo" }),
    );
    const fbJson = (await fbRes.json()) as { item: QaItem };
    expect(fbJson.item.answerSource).toBe("instant_diagnostic");
    delete process.env.GROQ_API_KEY;
  });

  it("answer validates input, 404s unknown ids, and preserves the instant answer", async () => {
    const missing = await POST(postReq({ action: "answer", answer: "x" }));
    expect(missing.status).toBe(400);
    const blank = await POST(postReq({ action: "answer", id: "qa-x", answer: "  " }));
    expect(blank.status).toBe(400);

    const unknown = await POST(postReq({ action: "answer", id: "qa-nope", answer: "ok" }));
    expect(unknown.status).toBe(404);
    await expect(unknown.json()).resolves.toEqual({
      ok: false,
      error: "Pergunta não encontrada.",
    });

    const list = (await (await GET(new Request("http://localhost/api/qa"))).json()) as {
      items: QaItem[];
    };
    const target = list.items.find((i) => i.propertyKey === "quintoandar:999")!;
    const res = await POST(
      postReq({ action: "answer", id: target.id, answer: "Resposta detalhada da sessão" }),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { item: QaItem };
    expect(json.item.answer).toBe("Resposta detalhada da sessão");
    expect(json.item.answerSource).toBe("cursor_session");
    expect(json.item.instantAnswer).toContain("7º andar");
    expect(json.item.awaitingDetailedAnswer).toBe(false);
  });

  it("delete validates id, removes items, tolerates unknown ids; clear resets", async () => {
    const missing = await POST(postReq({ action: "delete" }));
    expect(missing.status).toBe(400);

    const before = (await (await GET(new Request("http://localhost/api/qa"))).json()) as {
      items: QaItem[];
    };
    const victim = before.items[0]!;
    const res = await POST(postReq({ action: "delete", id: victim.id }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { items: QaItem[] };
    expect(json.items.some((i) => i.id === victim.id)).toBe(false);

    const unknown = await POST(postReq({ action: "delete", id: "qa-ghost" }));
    expect(unknown.status).toBe(200);

    const cleared = await POST(postReq({ action: "clear" }));
    await expect(cleared.json()).resolves.toEqual({ ok: true, items: [] });
  });

  it("ask resolves the evaluated listing from the scored set + the raw listing from disk and queues to Cursor", async () => {
    dbMocks.flags.raw = true;
    dbMocks.flags.queue = true;
    // local-scraper.ts:9-18 — the queue/raw dir now comes from
    // HOUSING_SCRAPER_DIR (the fs mock above keys ".cursor" paths to
    // flags.queue and "imoveis_" paths to flags.raw).
    process.env.HOUSING_SCRAPER_DIR = "/mock/.cursor/scraper";
    const bsb = makeEvaluated({
      id: "777",
      cityCode: "BSB",
      neighborhood: "Águas Claras",
      totalMonthly: 3500,
      areaM2: 55,
      finalScore: 80,
    });
    dbMocks.getScoredProperties.mockResolvedValue(scoredSet([makeEvaluated({ id: "888" }), bsb]));
    try {
      const res = await POST(
        postReq({
          action: "ask",
          propertyKey: "quintoandar:888",
          question: "qual o andar, o preço, comparado com Águas Claras?",
          weights: { minAreaM2: 40, bogus: 1 },
          // BSB is hidden by default: the Águas Claras benchmark only exists once it is enabled.
          enabledHiddenCities: ["BSB"],
        }),
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        item: QaItem;
        queuedToLocalCursor: boolean;
      };
      expect(json.queuedToLocalCursor).toBe(true);
      expect(json.item.answer).toContain("5º andar");
      expect(json.item.answer).toContain("Imobiliária Raw");
      expect(json.item.answer).toContain("Comparado com Águas Claras");
      expect(dbMocks.getScoredProperties).toHaveBeenCalledWith(
        expect.objectContaining({ minAreaM2: 40 }),
        expect.objectContaining({ enabledHiddenCities: ["BSB"] }),
      );
      expect(dbMocks.getScoredProperties.mock.calls[0]![0]).not.toHaveProperty("bogus");
      // Second ask over the same scored set reuses the evaluated-snapshot cache.
      const again = await POST(
        postReq({
          action: "ask",
          propertyKey: "quintoandar:888",
          question: "qual a nota?",
          weights: { minAreaM2: 40 },
          enabledHiddenCities: ["BSB"],
        }),
      );
      expect(again.status).toBe(200);
    } finally {
      dbMocks.flags.raw = false;
      dbMocks.flags.queue = false;
      delete process.env.HOUSING_SCRAPER_DIR;
      await POST(postReq({ action: "clear" }));
    }
  });

  it("streams items over SSE with event-stream headers", async () => {
    const controller = new AbortController();
    const res = await GET(
      new Request("http://localhost/api/qa?stream=1", { signal: controller.signal }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-cache");
    const reader = res.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("retry: 1500");
    controller.abort();
    await reader.cancel().catch(() => {});
  });
});
