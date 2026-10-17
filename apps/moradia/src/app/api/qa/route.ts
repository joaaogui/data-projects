import { logger } from "@/lib/logger";
import {
  DEFAULT_WEIGHTS,
  classifyFurnitureTier,
  computeDynamicNeighborhoods,
  computeDynamicProperties,
} from "@/lib/scoring-engine";
import type {
  EvaluatedProperty,
  NeighborhoodEntry,
  PropertyQuestionItem,
  PropertyQuestionSnapshot,
  SlimPropertyRecord,
} from "@/types/moradia";
import { fetchWithRetry } from "@data-projects/shared/db";
import { neon, neonConfig } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const dynamic = "force-dynamic";

const DEFAULT_QA_ROW_ID = "default";
const LOCAL_QA_FILE = join(process.cwd(), "src/data/property-qa.json");
const FALLBACK_QA_FILE = join(
  process.cwd(),
  "apps/moradia/src/data/property-qa.json",
);
const TMP_QA_FILE = join(tmpdir(), "moradia-property-qa.json");
const LOCAL_SNAPSHOT_FILE = join(process.cwd(), "src/data/seed-snapshot.json");
const FALLBACK_SNAPSHOT_FILE = join(
  process.cwd(),
  "apps/moradia/src/data/seed-snapshot.json",
);
const CURSOR_QUEUE_FILE =
  "/Users/joao.guilherme/.cursor/Empty/.card-questions-queue.jsonl";
const RAW_WORKSPACE_DIR = "/Users/joao.guilherme/.cursor/Empty";

interface RawListingRecord {
  provider?: string;
  id?: string;
  external_id?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
  construction_year?: number | null;
  condition?: string | null;
  prices?: {
    rent?: number | null;
    condo_fee?: number | null;
    iptu?: number | null;
    home_protection?: number | null;
    service_fee?: number | null;
    total_monthly?: number | null;
  };
  specs?: {
    area_m2?: number | null;
    bedrooms?: number | null;
    suites?: number | null;
    bathrooms?: number | null;
    parking_spaces?: number | null;
    floor?: number | null;
    floor_range?: { min: number; max: number } | null;
    total_floors?: number | null;
    furnished?: boolean | null;
    accepts_pets?: boolean | null;
    near_subway?: boolean | null;
  };
  address?: {
    street?: string | null;
    street_number?: string | null;
    neighborhood?: string | null;
    city?: string | null;
    state_code?: string | null;
    zip_code?: string | null;
    formatted?: string | null;
  };
  condominium?: {
    name?: string | null;
    doorman?: string | null;
  } | null;
  amenities?: string[];
  installations?: string[];
  comfort_commodities?: string[];
  practicality_commodities?: string[];
  description?: string | null;
  generated_description?: string | null;
  photos_count?: number | null;
  photo_captions?: string[];
  advertiser?: {
    name?: string | null;
    creci?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
  } | null;
}

function getSqlClient() {
  const url = (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    ""
  ).trim();
  if (!url) return null;
  neonConfig.fetchFunction = fetchWithRetry;
  return neon(url);
}

let qaTableEnsuredPromise: Promise<void> | null = null;

async function ensureQaTable(): Promise<void> {
  const sql = getSqlClient();
  if (!sql) return;
  if (!qaTableEnsuredPromise) {
    qaTableEnsuredPromise = (async () => {
      await sql`CREATE SCHEMA IF NOT EXISTS moradia`;
      await sql`
        CREATE TABLE IF NOT EXISTS moradia.property_qa (
          id text PRIMARY KEY,
          items jsonb NOT NULL DEFAULT '[]'::jsonb,
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `;
    })().catch((err) => {
      qaTableEnsuredPromise = null;
      throw err;
    });
  }
  return qaTableEnsuredPromise;
}

function parseQaRaw(raw: unknown): PropertyQuestionItem[] {
  if (Array.isArray(raw)) {
    return raw.filter(
      (item): item is PropertyQuestionItem =>
        Boolean(
          item &&
            typeof item === "object" &&
            "id" in item &&
            "propertyKey" in item,
        ),
    );
  }
  if (
    raw &&
    typeof raw === "object" &&
    "items" in raw &&
    Array.isArray((raw as { items: unknown }).items)
  ) {
    return (raw as { items: unknown[] }).items.filter(
      (item): item is PropertyQuestionItem =>
        Boolean(
          item &&
            typeof item === "object" &&
            "id" in item &&
            "propertyKey" in item,
        ),
    );
  }
  return [];
}

let memQaItems: PropertyQuestionItem[] | null = null;
let lastQaDbLoadMs = 0;
const QA_DB_CACHE_TTL_MS = 2_500;
let inFlightQaLoadPromise: Promise<PropertyQuestionItem[]> | null = null;

function readDiskQaItems(): PropertyQuestionItem[] {
  for (const candidate of [TMP_QA_FILE, LOCAL_QA_FILE, FALLBACK_QA_FILE]) {
    if (existsSync(/*turbopackIgnore: true*/ candidate)) {
      try {
        const raw = JSON.parse(
          readFileSync(/*turbopackIgnore: true*/ candidate, "utf8"),
        ) as unknown;
        return parseQaRaw(raw);
      } catch {
        // try next
      }
    }
  }
  return [];
}

function readLocalQaFileItems(): PropertyQuestionItem[] {
  if (!existsSync(/*turbopackIgnore: true*/ LOCAL_QA_FILE)) return [];
  try {
    const raw = JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ LOCAL_QA_FILE, "utf8"),
    ) as unknown;
    return parseQaRaw(raw);
  } catch {
    return [];
  }
}

function writeDiskQaItems(items: PropertyQuestionItem[]): void {
  memQaItems = items;
  const serialized = `${JSON.stringify({ items }, null, 2)}\n`;
  try {
    mkdirSync(/*turbopackIgnore: true*/ dirname(LOCAL_QA_FILE), {
      recursive: true,
    });
    writeFileSync(/*turbopackIgnore: true*/ LOCAL_QA_FILE, serialized, "utf8");
  } catch {
    // Fallback to /tmp in read-only serverless environments
  }
  if (existsSync(/*turbopackIgnore: true*/ FALLBACK_QA_FILE)) {
    try {
      writeFileSync(
        /*turbopackIgnore: true*/ FALLBACK_QA_FILE,
        serialized,
        "utf8",
      );
    } catch {
      // Ignore fallback write errors
    }
  }
  try {
    writeFileSync(/*turbopackIgnore: true*/ TMP_QA_FILE, serialized, "utf8");
  } catch {
    // Ignore /tmp write errors
  }
}

async function loadQaStore(): Promise<PropertyQuestionItem[]> {
  const sql = getSqlClient();
  if (!sql) {
    if (memQaItems !== null) {
      return [...memQaItems];
    }
    const diskItems = readDiskQaItems();
    memQaItems = diskItems;
    return [...diskItems];
  }

  if (memQaItems !== null && Date.now() - lastQaDbLoadMs < QA_DB_CACHE_TTL_MS) {
    return [...memQaItems];
  }

  if (inFlightQaLoadPromise) {
    const shared = await inFlightQaLoadPromise;
    return [...shared];
  }

  const loadPromise = (async (): Promise<PropertyQuestionItem[]> => {
    try {
      await ensureQaTable();
      const rows = await sql`
        SELECT items
        FROM moradia.property_qa
        WHERE id = ${DEFAULT_QA_ROW_ID}
        LIMIT 1
      `;
      if (rows.length > 0) {
        const dbItems = parseQaRaw((rows[0] as { items?: unknown }).items);
        const localItems = readLocalQaFileItems();
        const localById = new Map(localItems.map((item) => [item.id, item]));
        let changedVsDb = false;

        const updatedItems = dbItems.map((dbItem) => {
          if (dbItem.status !== "pending") return dbItem;
          const localItem = localById.get(dbItem.id);
          if (
            localItem &&
            localItem.status === "answered" &&
            typeof localItem.answer === "string" &&
            localItem.answer.trim().length > 0
          ) {
            changedVsDb = true;
            return {
              ...dbItem,
              status: "answered" as const,
              answer: localItem.answer,
              answeredAt: localItem.answeredAt ?? new Date().toISOString(),
              answerSource: localItem.answerSource ?? ("cursor_session" as const),
            };
          }
          return dbItem;
        });

        if (changedVsDb) {
          await sql`
            INSERT INTO moradia.property_qa (id, items, updated_at)
            VALUES (${DEFAULT_QA_ROW_ID}, ${JSON.stringify(updatedItems)}::jsonb, now())
            ON CONFLICT (id) DO UPDATE SET
              items = EXCLUDED.items,
              updated_at = now()
          `;
        }
        memQaItems = updatedItems;
        lastQaDbLoadMs = Date.now();
        return [...updatedItems];
      }

      const diskItems = memQaItems ?? readDiskQaItems();
      await sql`
        INSERT INTO moradia.property_qa (id, items, updated_at)
        VALUES (${DEFAULT_QA_ROW_ID}, ${JSON.stringify(diskItems)}::jsonb, now())
        ON CONFLICT (id) DO NOTHING
      `;
      memQaItems = diskItems;
      lastQaDbLoadMs = Date.now();
      return [...diskItems];
    } catch (err) {
      logger.warn("api/qa", "loadQaStore DB query failed; using disk fallback", {
        error: err,
      });
      if (memQaItems !== null) {
        return [...memQaItems];
      }
      const diskItems = readDiskQaItems();
      memQaItems = diskItems;
      return [...diskItems];
    } finally {
      inFlightQaLoadPromise = null;
    }
  })();

  inFlightQaLoadPromise = loadPromise;
  return loadPromise;
}

async function saveQaItems(items: PropertyQuestionItem[]): Promise<void> {
  writeDiskQaItems(items);
  lastQaDbLoadMs = Date.now();
  const sql = getSqlClient();
  if (!sql) return;
  try {
    await ensureQaTable();
    await sql`
      INSERT INTO moradia.property_qa (id, items, updated_at)
      VALUES (${DEFAULT_QA_ROW_ID}, ${JSON.stringify(items)}::jsonb, now())
      ON CONFLICT (id) DO UPDATE SET
        items = EXCLUDED.items,
        updated_at = now()
    `;
    lastQaDbLoadMs = Date.now();
  } catch (err) {
    logger.warn("api/qa", "saveQaItems DB write failed; saved to disk mirror", {
      error: err,
    });
  }
}

interface SnapshotCache {
  evaluatedByKey: Map<string, EvaluatedProperty>;
  topEvaluated: EvaluatedProperty[];
}

let cachedSnapshotTime = 0;
let cachedSnapshotData: SnapshotCache | null = null;

function getEvaluatedSnapshotCache(): SnapshotCache {
  const now = Date.now();
  if (cachedSnapshotData && now - cachedSnapshotTime < 15_000) {
    return cachedSnapshotData;
  }

  for (const candidate of [LOCAL_SNAPSHOT_FILE, FALLBACK_SNAPSHOT_FILE]) {
    if (existsSync(/*turbopackIgnore: true*/ candidate)) {
      try {
        const raw = JSON.parse(
          readFileSync(/*turbopackIgnore: true*/ candidate, "utf8"),
        ) as {
          neighborhoods?: NeighborhoodEntry[];
          properties?: SlimPropertyRecord[];
        };
        const neighborhoods = computeDynamicNeighborhoods(
          raw.neighborhoods ?? [],
          DEFAULT_WEIGHTS,
        );
        const evaluated = computeDynamicProperties(
          raw.properties ?? [],
          neighborhoods.ranked,
          DEFAULT_WEIGHTS,
          { includeBsbBenchmark: true },
        );
        const evaluatedByKey = new Map<string, EvaluatedProperty>();
        for (const p of evaluated) {
          evaluatedByKey.set(`${p.provider}:${p.id}`, p);
        }
        const topEvaluated = evaluated
          .filter((p) => p.eligible && p.isActive !== false)
          .slice(0, 15);
        cachedSnapshotData = { evaluatedByKey, topEvaluated };
        cachedSnapshotTime = now;
        return cachedSnapshotData;
      } catch {
        // try next
      }
    }
  }

  return { evaluatedByKey: new Map(), topEvaluated: [] };
}

const rawFileMapCache = new Map<
  string,
  { mtimeMs: number; byKey: Map<string, RawListingRecord> }
>();

function findRawListingOnDisk(propertyKey: string): RawListingRecord | null {
  const [provider, id] = propertyKey.split(":");
  if (!provider || !id) return null;

  const rawFiles = [
    "imoveis_mg.json",
    "imoveis_df.json",
    "imoveis_rj.json",
    "imoveis_sp_campinas.json",
    "imoveis_sp_capital.json",
  ];

  for (const file of rawFiles) {
    const fullPath = join(RAW_WORKSPACE_DIR, file);
    if (!existsSync(/*turbopackIgnore: true*/ fullPath)) continue;
    try {
      const mtimeMs = statSync(/*turbopackIgnore: true*/ fullPath).mtimeMs;
      let cached = rawFileMapCache.get(fullPath);
      if (!cached || cached.mtimeMs !== mtimeMs) {
        const content = readFileSync(
          /*turbopackIgnore: true*/ fullPath,
          "utf8",
        );
        const parsed = JSON.parse(content) as { listings?: RawListingRecord[] };
        const byKey = new Map<string, RawListingRecord>();
        for (const l of parsed.listings ?? []) {
          if (l.id !== undefined) {
            const p = l.provider ?? "quintoandar";
            byKey.set(`${p}:${String(l.id)}`, l);
            byKey.set(`*:${String(l.id)}`, l);
          }
        }
        cached = { mtimeMs, byKey };
        rawFileMapCache.set(fullPath, cached);
      }
      const match =
        cached.byKey.get(`${provider}:${id}`) ?? cached.byKey.get(`*:${id}`);
      if (match) return match;
    } catch {
      // ignore read errors
    }
  }
  return null;
}

const AMENITY_PT_MAP: Record<string, string> = {
  AIR_CONDITIONING: "Ar-condicionado",
  POOL: "Piscina",
  GYM: "Academia",
  FITNESS_ROOM: "Academia",
  ELEVATOR: "Elevador",
  CONCIERGE_24H: "Portaria 24h",
  WATCHMAN: "Guarita / Vigia",
  BALCONY: "Varanda / Sacada",
  GOURMET_BALCONY: "Varanda Gourmet",
  GOURMET_SPACE: "Espaço Gourmet",
  BARBECUE_GRILL: "Churrasqueira",
  PARTY_HALL: "Salão de Festas",
  PLAYGROUND: "Playground",
  SAUNA: "Sauna",
  LAUNDRY: "Lavanderia",
  SERVICE_AREA: "Área de serviço",
  PETS_ALLOWED: "Aceita Pets",
  FURNISHED: "Mobiliado (tag)",
  KITCHEN_CABINETS: "Armários na cozinha",
  BEDROOM_WARDROBE: "Armários no quarto",
  BATHROOM_CABINETS: "Armários no banheiro",
  BUILTIN_WARDROBE: "Armários embutidos",
  AMERICAN_KITCHEN: "Cozinha americana",
  GAS_SHOWER: "Chuveiro a gás",
  HEATING: "Aquecimento",
  GARDEN: "Jardim",
  SAFETY_CIRCUIT: "Circuito de segurança",
  INTERCOM: "Interfone",
  GATED_COMMUNITY: "Condomínio fechado",
  ELECTRONIC_GATE: "Portão eletrônico",
  SPORTS_COURT: "Quadra esportiva",
  COWORKING: "Coworking",
  ROOFTOP: "Rooftop",
  FREE_VIEW: "Vista livre",
  MORNING_SUN: "Sol da manhã",
};

function translateAmenity(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return AMENITY_PT_MAP[upper] ?? raw;
}

function formatBRL(val: number): string {
  return `R$ ${Math.round(val).toLocaleString("pt-BR")}`;
}

function buildInstantGroundedAnswer(params: {
  question: string;
  propertyKey: string;
  snapshot: PropertyQuestionSnapshot;
  evaluated: EvaluatedProperty | null;
  rawListing: RawListingRecord | null;
  topEvaluated: EvaluatedProperty[];
  contextSummary?: string;
  queuedToLocalCursor?: boolean;
}): string {
  const {
    question,
    propertyKey,
    snapshot,
    evaluated,
    rawListing,
    topEvaluated,
    contextSummary,
    queuedToLocalCursor = false,
  } = params;
  const qNorm = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  // Case 1: General question (no single property pinned)
  if (propertyKey === "general" || (!evaluated && !snapshot.neighborhood)) {
    const topList = topEvaluated.slice(0, 6);
    const lines: string[] = [
      "**Consultor da Sessão — Visão Geral dos Top Imóveis**",
    ];
    if (contextSummary) {
      lines.push(contextSummary);
    }
    if (topList.length > 0) {
      lines.push(
        "\n**Melhores opções elegíveis no ranking geral agora:**",
        ...topList.map(
          (p, idx) =>
            `${idx + 1}. **#${p.overallRank ?? idx + 1} ${p.neighborhood} (${p.cityCode}) — ${p.street}${p.streetNumber ? `, ${p.streetNumber}` : ""}**: **${p.finalScore.toFixed(1)} pts** · ${formatBRL(p.totalMonthly)}/mês · ${p.areaM2} m² · ${p.bedrooms}Q · ${p.parkingSpaces} vaga(s) · Mod. ${p.modernityScore}/100 (${p.cardTags.floorTag?.label ?? "Andar N.I."})`,
        ),
      );
    }
    lines.push(
      `\n💡 **Dica**: Clique em **Perguntar** em qualquer card da lista para fixar o imóvel aqui no chat e inspecionar andar real, mobília nas fotos, decomposição da nota ou veredito de visita.${queuedToLocalCursor ? " Sua mensagem também foi enviada à sessão ativa do Cursor!" : ""}`,
    );
    return lines.join("\n");
  }

  const prop = evaluated;
  const titleLabel = `${snapshot.neighborhood} (${snapshot.cityCode}) — ${snapshot.street}${snapshot.streetNumber ? `, ${snapshot.streetNumber}` : ""}`;
  const condoName = prop?.condominiumName ?? snapshot.condominiumName;
  const fullDesc =
    prop?.description ??
    prop?.generatedDescription ??
    snapshot.description ??
    rawListing?.description ??
    "";

  const amenitiesList = [
    ...new Set(
      [
        ...(prop?.amenities ?? []),
        ...(prop?.installations ?? []),
        ...(rawListing?.amenities ?? []),
      ].map(translateAmenity),
    ),
  ];
  const commoditiesList = [
    ...new Set([
      ...(prop?.comfortCommodities ?? []),
      ...(prop?.practicalityCommodities ?? []),
      ...(rawListing?.comfort_commodities ?? []),
      ...(rawListing?.practicality_commodities ?? []),
    ]),
  ];
  const captions = prop?.photoCaptions ?? rawListing?.photo_captions ?? [];
  const sampleRooms = [
    ...new Set(
      (prop?.samplePhotos ?? [])
        .map((p) => p.room)
        .filter((r): r is string => Boolean(r)),
    ),
  ];

  // Detect question intents
  const asksFloor =
    /\b(andar|terreo|cobertura|alto|baixo|pavimento|elevador|escada)\b/.test(
      qNorm,
    );
  const asksFurniture =
    /\b(mobiliad|mobilia|cama|sofa|geladeira|fogao|cooktop|maquina|armario|marcenaria|mudanca|eletro)\b/.test(
      qNorm,
    );
  const asksScoreOrRule =
    /\b(nota|score|ponto|pontuacao|ranking|posicao|por que|porque|avaliacao|deveria|errad|corrig|melhor|penalidade|bonus)\b/.test(
      qNorm,
    );
  const asksPhotosOrCondition =
    /\b(foto|fotos|imagem|imagens|acabamento|reforma|reformado|moderno|velho|antigo|estado|conserva|cozinha|banheiro|sala|quarto)\b/.test(
      qNorm,
    );
  const asksLocationOrCommute =
    /\b(rua|quadra|trecho|localizacao|bairro|segur|barulh|silencios|nubank|escritorio|distancia|tempo|transito|metro|parque|shopping|onibus|carro)\b/.test(
      qNorm,
    );
  const asksPrice =
    /\b(preco|valor|aluguel|condominio|iptu|caro|barato|custo|orcamento|justo|m2)\b/.test(
      qNorm,
    );
  const asksVisit =
    /\b(visita|visitar|vale|compensa|bom|opiniao|analis|resumo|pros|contras|recomenda)\b/.test(
      qNorm,
    );
  const isBugOrRuleFeedback =
    /\b(deveria|errad|corrig|melhor|falso positivo|bug|ajuste|ajustar|reclassific|tambem e|tbm e|nao e)\b/.test(
      qNorm,
    );

  const sections: string[] = [];

  // 1. Floor analysis
  if (asksFloor) {
    const exactFloor = prop?.floor ?? snapshot.floor;
    const floorRange = prop?.floorRange ?? snapshot.floorRange;
    const totalFloors =
      prop?.totalFloors ??
      snapshot.totalFloors ??
      rawListing?.specs?.total_floors ??
      null;
    const floorTagLabel =
      prop?.cardTags.floorTag?.label ?? snapshot.floorLabel ?? null;
    const rawSpecFloor = rawListing?.specs?.floor;

    const floorMentionMatch = fullDesc.match(
      /\b(\d{1,2})\s*[º°o]\s*andar\b|\bandar\s*(\d{1,2})\b|\b(andar\s+alto|andar\s+baixo|t[eé]rreo|[aá]rea\s+privativa|cobertura|duplex)\b/i,
    );

    const floorDetails: string[] = [];
    if (exactFloor !== null && exactFloor !== undefined && exactFloor > 0) {
      floorDetails.push(
        `• **Andar cadastrado no anúncio**: **${exactFloor}º andar**${totalFloors ? ` (de ${totalFloors} andares no edifício)` : ""}.`,
      );
    } else if (floorRange) {
      floorDetails.push(
        `• **Faixa de andar (QuintoAndar)**: **${floorRange.min}º ao ${floorRange.max}º andar**${totalFloors ? ` (edifício de ${totalFloors} andares)` : ""}.`,
      );
    } else if (exactFloor === 0) {
      floorDetails.push(
        `• **Andar cadastrado**: **Térreo (andar 0)** confirmado pelo anúncio.`,
      );
    } else {
      floorDetails.push(
        `• **Campo numérico de andar**: Não informado pela imobiliária (${rawSpecFloor === 0 ? "API retornou `0`, que no Zap/VivaReal significa campo em branco" : "`null`"}).`,
      );
    }

    if (floorTagLabel) {
      floorDetails.push(
        `• **Classificação no motor**: **${floorTagLabel}** (${prop?.cardTags.floorTag?.rarity ?? "classificado"}).`,
      );
    }
    if (floorMentionMatch) {
      floorDetails.push(
        `• **Menção direta no texto/descrição**: *"${floorMentionMatch[0]}"*.`,
      );
    }
    const highFloorAmenity = amenitiesList.find((a) =>
      /andar alto|vista livre|cobertura/i.test(a),
    );
    if (highFloorAmenity) {
      floorDetails.push(
        `• **Tag nos metadados da imobiliária**: **${highFloorAmenity}**.`,
      );
    }

    sections.push(`**🏢 Diagnóstico de Andar (${titleLabel})**\n${floorDetails.join("\n")}`);
  }

  // 2. Furniture analysis
  if (asksFurniture) {
    const tier =
      snapshot.furnitureTier ??
      prop?.furnitureTier ??
      (prop ? classifyFurnitureTier(prop) : "UNFURNISHED");
    const tierLabel =
      tier === "FULLY_FURNISHED"
        ? "Mobiliado (Sim)"
        : tier === "SEMI_FURNISHED"
          ? "Semi-mobiliado (Eletros)"
          : "Sem mobília";

    const searchCorpus = [
      fullDesc,
      ...amenitiesList,
      ...commoditiesList,
      ...captions,
    ].join(" | ");
    const detectedItems: string[] = [];
    const itemChecks: [string, RegExp][] = [
      ["Cama", /\b(cama|colch[aã]o|bicama|queen|king)\b/i],
      ["Sofá / Poltrona", /\b(sof[aá]s?|poltronas?)\b/i],
      ["Geladeira / Frigobar", /\b(geladeira|refrigerador|frigobar)\b/i],
      ["Fogão / Cooktop", /\b(fog[aã]o|cooktop|forno|induc[aã]o)\b/i],
      ["Micro-ondas", /\b(micro-?ondas)\b/i],
      ["Máquina de lavar / Lava e seca", /\b(m[aá]quina de lavar|lava e seca|lavadora)\b/i],
      ["Mesa / Cadeiras", /\b(mesa de jantar|mesa com cadeiras|bancada com banquetas)\b/i],
      ["Televisão", /\b(tv|televis[aã]o|smart tv)\b/i],
      ["Armários planejados", /\b(arm[aá]rios?|marcenaria|planejados?|closet)\b/i],
    ];
    for (const [label, regex] of itemChecks) {
      if (regex.test(searchCorpus)) detectedItems.push(label);
    }

    const furnPts =
      snapshot.breakdown?.furniturePoints ??
      prop?.breakdown.furniturePoints ??
      0;
    const furnExplanation =
      tier === "UNFURNISHED"
        ? "Bônus de imóvel livre p/ receber seus móveis de Brasília"
        : tier === "SEMI_FURNISHED"
          ? "Penalidade reduzida por possuir apenas eletros/cozinha sem cama ou sofá"
          : "Penalidade por conflito com a mudança de Brasília";
    sections.push(
      `**🛋️ Diagnóstico de Mobília (${titleLabel})**\n` +
        `• **Status atual no portal**: **${tierLabel}** (\`furnitureTier: ${tier}\`)\n` +
        `• **Impacto na nota (Mudança BSB)**: **${furnPts >= 0 ? `+${furnPts}` : furnPts} pts** (${furnExplanation})\n` +
        `• **Itens identificados nos metadados/texto/legendas**: ${detectedItems.length > 0 ? detectedItems.join(", ") : "Nenhum móvel solto citado no texto (apenas estrutura base)"}\n` +
        (commoditiesList.length > 0
          ? `• **Comodidades listadas (${commoditiesList.length})**: ${commoditiesList.slice(0, 12).join(", ")}`
          : `• **Cômodos fotografados (${ prop?.photosCount ?? snapshot.areaM2 } fotos)**: ${sampleRooms.length > 0 ? sampleRooms.join(", ") : "Ver galeria do card"}`),
    );
  }

  // 3. Score / Ranking breakdown
  if (asksScoreOrRule || (!asksFloor && !asksFurniture && !asksPhotosOrCondition && !asksLocationOrCommute && !asksPrice)) {
    const bd = snapshot.breakdown ?? prop?.breakdown;
    const finalScore = snapshot.finalScore ?? prop?.finalScore ?? 0;
    const rank =
      snapshot.overallRank !== undefined
        ? snapshot.overallRank
        : (prop?.overallRank ?? null);
    const cityRank =
      snapshot.cityRank !== undefined
        ? snapshot.cityRank
        : (prop?.cityRank ?? null);

    const scoreLines: string[] = [
      `• **Nota Final**: **${finalScore.toFixed(1)} pts** (${rank ? `#${rank} no Ranking Geral` : "Fora do filtro elegível"}${cityRank ? ` · #${cityRank} em ${snapshot.cityCode}` : ""})`,
    ];
    if (bd) {
      scoreLines.push(
        `• **Bairro (${snapshot.neighborhood})**: **+${bd.neighborhoodPoints.toFixed(1)} pts** (Nota do bairro: ${prop?.neighborhoodDynamicScore.toFixed(2) ?? "—"}/10 · ${prop?.commuteLabel ?? "Logística calculada"})`,
        `• **Modernidade (${snapshot.modernityScore}/100)**: **+${bd.modernityPoints.toFixed(1)} pts**`,
        `• **Nuances do Apartamento**: **${bd.nuancesPoints >= 0 ? `+${bd.nuancesPoints.toFixed(1)}` : bd.nuancesPoints.toFixed(1)} pts**`,
        `• **Orçamento (${formatBRL(snapshot.totalMonthly)}/mês)**: **${bd.budgetPoints >= 0 ? `+${bd.budgetPoints.toFixed(1)}` : bd.budgetPoints.toFixed(1)} pts**`,
        `• **Mobília**: **${bd.furniturePoints >= 0 ? `+${bd.furniturePoints.toFixed(1)}` : bd.furniturePoints.toFixed(1)} pts** · **Área (${snapshot.areaM2} m²)**: **${bd.areaPoints >= 0 ? `+${bd.areaPoints.toFixed(1)}` : bd.areaPoints.toFixed(1)} pts** · **Vagas (${snapshot.parkingSpaces})**: **${bd.parkingPoints >= 0 ? `+${bd.parkingPoints.toFixed(1)}` : bd.parkingPoints.toFixed(1)} pts**`,
      );
      if (
        bd.safetyPoints !== 0 ||
        bd.commutePoints !== 0 ||
        bd.cityPreferencePoints !== 0
      ) {
        scoreLines.push(
          `• **Ajustes de Segurança / Logística / Praça**: Segurança **${bd.safetyPoints >= 0 ? `+${bd.safetyPoints.toFixed(1)}` : bd.safetyPoints.toFixed(1)} pts** · Deslocamento **${bd.commutePoints >= 0 ? `+${bd.commutePoints.toFixed(1)}` : bd.commutePoints.toFixed(1)} pts** · Praça **${bd.cityPreferencePoints >= 0 ? `+${bd.cityPreferencePoints.toFixed(1)}` : bd.cityPreferencePoints.toFixed(1)} pts**`,
        );
      }
    }
    const highlights = prop?.nuanceHighlights ?? snapshot.nuanceHighlights ?? [];
    const warnings = prop?.nuanceWarnings ?? snapshot.nuanceWarnings ?? [];
    if (highlights.length > 0) {
      scoreLines.push(`• **Bônus/Destaques aplicados**: ${highlights.join(" · ")}`);
    }
    if (warnings.length > 0) {
      scoreLines.push(`• **Penalidades/Ressalvas aplicadas**: ${warnings.join(" · ")}`);
    }
    sections.push(`**📊 Decomposição da Nota (${titleLabel})**\n${scoreLines.join("\n")}`);
  }

  // 4. Location / Street / Commute
  if (asksLocationOrCommute) {
    const parks = prop?.parksNearby ?? [];
    const malls = prop?.mallsNearby ?? [];
    const places = (prop?.placesNearby ?? []).map((p) => p.name).slice(0, 6);
    sections.push(
      `**📍 Localização, Rua & Logística (${titleLabel})**\n` +
        `• **Endereço**: ${snapshot.street}${snapshot.streetNumber ? `, ${snapshot.streetNumber}` : ""}${condoName ? ` (${condoName})` : ""} — ${snapshot.neighborhood}, ${prop?.city ?? snapshot.cityCode}\n` +
        `• **Deslocamento até o Nubank**: **${prop?.commuteLabel ?? "~15-30 min"}**\n` +
        `• **Portaria / Segurança no Prédio**: ${prop?.doorman ?? rawListing?.condominium?.doorman ?? (amenitiesList.some((a) => /portaria 24h/i.test(a)) ? "Portaria 24h" : "Verificar no anúncio")}\n` +
        (parks.length > 0 ? `• **Parques próximos**: ${parks.join(", ")}\n` : "") +
        (malls.length > 0 ? `• **Shoppings/Comércio**: ${malls.join(", ")}\n` : "") +
        (places.length > 0 ? `• **Referências no entorno**: ${places.join(", ")}` : ""),
    );
  }

  // 5. Photos / Finishing / Condition
  if (asksPhotosOrCondition) {
    const posSignals = prop?.positiveSignals ?? [];
    const negSignals = prop?.negativeSignals ?? [];
    sections.push(
      `**📸 Acabamento, Modernidade & Fotos (${snapshot.modernityScore}/100)**\n` +
        `• **Tier de Modernidade**: **${prop?.modernityTier ?? "Avaliado"}** (${snapshot.modernityScore}/100)${prop?.constructionYear ? ` · Ano de construção: **${prop.constructionYear}**` : ""}\n` +
        `• **Sinais positivos detectados**: ${posSignals.length > 0 ? posSignals.join(", ") : "Acabamento padrão bem conservado"}\n` +
        (negSignals.length > 0
          ? `• **Alertas de idade/acabamento**: ${negSignals.join(", ")}\n`
          : "") +
        `• **Fotos disponíveis**: **${prop?.photosCount ?? "—"} fotos**${sampleRooms.length > 0 ? ` cobrindo ${sampleRooms.join(", ")}` : ""}\n` +
        (captions.length > 0
          ? `• **Legendas das fotos**: ${captions.slice(0, 5).join(" | ")}`
          : ""),
    );
  }

  // 6. Price / Cost breakdown
  if (asksPrice || asksVisit) {
    const pricePerM2 =
      snapshot.areaM2 > 0
        ? Math.round(snapshot.totalMonthly / snapshot.areaM2)
        : 0;
    const advertiserName = rawListing?.advertiser?.name;
    const advertiserPhone =
      rawListing?.advertiser?.whatsapp ?? rawListing?.advertiser?.phone;
    const basePartsSum = snapshot.rent + snapshot.condoFee + snapshot.iptu;
    const residualFees = Math.round(snapshot.totalMonthly - basePartsSum);
    const feesNote =
      residualFees > 0 ? ` + Taxas/Seguro ${formatBRL(residualFees)}` : "";
    sections.push(
      `**💰 Custos & Condições (${formatBRL(snapshot.totalMonthly)}/mês)**\n` +
        `• **Pacote Mensal**: **${formatBRL(snapshot.totalMonthly)}** (Aluguel ${formatBRL(snapshot.rent)} + Condomínio ${formatBRL(snapshot.condoFee)} + IPTU ${formatBRL(snapshot.iptu)}${feesNote})\n` +
        `• **Custo por m²**: **${formatBRL(pricePerM2)}/m²** para **${snapshot.areaM2} m²** (${snapshot.bedrooms} quarto(s), ${prop?.suites ?? 0} suíte(s), ${snapshot.bathrooms} banheiro(s), ${snapshot.parkingSpaces} vaga(s))\n` +
        (amenitiesList.length > 0
          ? `• **Infraestrutura & Lazer**: ${amenitiesList.slice(0, 12).join(", ")}\n`
          : "") +
        (advertiserName
          ? `• **Anunciante**: ${advertiserName}${rawListing?.advertiser?.creci ? ` (CRECI ${rawListing.advertiser.creci})` : ""}${advertiserPhone ? ` · Tel/WhatsApp: ${advertiserPhone}` : ""}\n`
          : "") +
        `• **Resumo Consultivo**: ${snapshot.shortJustification.replace(/\n/g, " ")}`,
    );
  }

  if (fullDesc && sections.length < 3) {
    const trimmedDesc =
      fullDesc.length > 360 ? `${fullDesc.slice(0, 360).trim()}...` : fullDesc;
    sections.push(`**📝 Trecho da Descrição Original**\n"${trimmedDesc}"`);
  }

  if (isBugOrRuleFeedback && queuedToLocalCursor) {
    sections.push(
      `⚡ **Encaminhado à Sessão do Cursor**: Seu relato sobre este card (\`${propertyKey}\`) já entrou na fila em tempo real da sessão ativa para ajuste de regra/dados se necessário.`,
    );
  }

  return sections.join("\n\n");
}

async function generateDiagnosticAnswer(params: {
  question: string;
  propertyKey: string;
  snapshot: PropertyQuestionSnapshot;
  evaluated: EvaluatedProperty | null;
  rawListing: RawListingRecord | null;
  topEvaluated: EvaluatedProperty[];
  contextSummary?: string;
  queuedToLocalCursor?: boolean;
}): Promise<{
  answer: string;
  source: "llm" | "instant_diagnostic";
}> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  const googleKey = (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GOOGLE_AI_API_KEY ??
    ""
  ).trim();

  const deterministicFallback = buildInstantGroundedAnswer(params);

  if (!groqKey && !googleKey) {
    return { answer: deterministicFallback, source: "instant_diagnostic" };
  }

  const contextPayload = {
    propertyKey: params.propertyKey,
    snapshot: params.snapshot,
    evaluatedBreakdown:
      params.snapshot.breakdown ?? params.evaluated?.breakdown ?? null,
    furnitureTier:
      params.snapshot.furnitureTier ?? params.evaluated?.furnitureTier ?? null,
    nuanceHighlights:
      params.snapshot.nuanceHighlights ??
      params.evaluated?.nuanceHighlights ??
      [],
    nuanceWarnings:
      params.snapshot.nuanceWarnings ?? params.evaluated?.nuanceWarnings ?? [],
    cardTags: params.evaluated?.cardTags ?? null,
    amenities: params.evaluated?.amenities ?? [],
    installations: params.evaluated?.installations ?? [],
    comfortCommodities: params.evaluated?.comfortCommodities ?? [],
    practicalityCommodities: params.evaluated?.practicalityCommodities ?? [],
    photoCaptions: params.evaluated?.photoCaptions ?? [],
    rawSpecs: params.rawListing?.specs ?? null,
    rawAdvertiser: params.rawListing?.advertiser ?? null,
    contextSummary: params.contextSummary ?? null,
    topRankingSample: params.topEvaluated.slice(0, 5).map((p) => ({
      key: `${p.provider}:${p.id}`,
      rank: p.overallRank,
      neighborhood: p.neighborhood,
      city: p.cityCode,
      street: p.street,
      totalMonthly: p.totalMonthly,
      areaM2: p.areaM2,
      finalScore: p.finalScore,
      modernityScore: p.modernityScore,
    })),
  };

  const systemPrompt =
    "Você é o Consultor Imobiliário Inteligente do Portal Moradia 2026 (mudança de Brasília para BH, Campinas, SP ou RJ próximo ao Nubank). " +
    "Responda em português de forma direta, objetiva, estruturada em tópicos curtos e 100% fundamentada nos dados reais do imóvel abaixo. " +
    "Cite números exatos (andar, R$ aluguel/condomínio/total, m², decomposição da nota, itens de mobília e comodidades)." +
    (params.queuedToLocalCursor
      ? " Se o usuário apontar um erro de cadastro ou pedir ajuste na regra de pontuação, confirme os dados brutos do anúncio e avise que a sessão ativa do Cursor também recebeu o alerta para atualizar o motor/dataset."
      : "");

  const userPrompt = `Pergunta do usuário: "${params.question}"\n\nDados completos do imóvel e ranking:\n${JSON.stringify(contextPayload, null, 2)}`;

  if (groqKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5500);
      const res = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            temperature: 0.2,
            max_tokens: 700,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
          }),
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = (await res.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) {
          return { answer: text, source: "llm" };
        }
      } else {
        logger.warn("api/qa", "Groq LLM returned non-OK status", {
          status: res.status,
          propertyKey: params.propertyKey,
        });
      }
    } catch (err) {
      logger.warn(
        "api/qa",
        "Groq LLM request failed; using instant_diagnostic fallback",
        {
          propertyKey: params.propertyKey,
          error: err,
        },
      );
    }
  }

  return { answer: deterministicFallback, source: "instant_diagnostic" };
}

export async function GET(request: Request) {
  const t0 = performance.now();
  const { searchParams } = new URL(request.url);
  const propertyKey = searchParams.get("propertyKey");
  const status = searchParams.get("status");

  let items = await loadQaStore();
  if (propertyKey) {
    items = items.filter((item) => item.propertyKey === propertyKey);
  }
  if (status === "pending" || status === "answered") {
    items = items.filter((item) => item.status === status);
  }

  const durationMs = Math.round((performance.now() - t0) * 100) / 100;
  logger.info("api/qa", "GET completed", {
    propertyKey: propertyKey ?? "ALL",
    status: status ?? "ALL",
    itemsCount: items.length,
    durationMs,
  });

  return NextResponse.json(
    { ok: true, items },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    },
  );
}

let qaWriteLockPromise: Promise<unknown> = Promise.resolve();

function withQaWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const next = qaWriteLockPromise.then(task, task);
  qaWriteLockPromise = next.catch(() => {});
  return next;
}

export async function POST(request: Request) {
  const t0 = performance.now();
  try {
    const body = (await request.json()) as {
      action?: "ask" | "answer" | "delete" | "clear";
      id?: string;
      propertyKey?: string;
      question?: string;
      answer?: string;
      propertySnapshot?: Partial<PropertyQuestionSnapshot>;
      contextSummary?: string;
    };

    const action = body.action ?? "ask";

    if (action === "clear") {
      return await withQaWriteLock(async () => {
        await saveQaItems([]);
        const durationMs = Math.round((performance.now() - t0) * 100) / 100;
        logger.info("api/qa", "POST clear completed", {
          action: "clear",
          propertyKey: null,
          answerSource: null,
          queuedToLocalCursor: false,
          itemsCount: 0,
          durationMs,
        });
        return NextResponse.json({ ok: true, items: [] });
      });
    }

    if (action === "answer") {
      if (!body.id || typeof body.answer !== "string" || !body.answer.trim()) {
        const durationMs = Math.round((performance.now() - t0) * 100) / 100;
        logger.warn("api/qa", "POST answer rejected missing id or answer", {
          action: "answer",
          id: body.id ?? null,
          durationMs,
        });
        return NextResponse.json(
          { ok: false, error: "ID da pergunta e resposta são obrigatórios." },
          { status: 400 },
        );
      }

      return await withQaWriteLock(async () => {
        const items = await loadQaStore();
        const idx = items.findIndex((i) => i.id === body.id);
        if (idx === -1) {
          const durationMs = Math.round((performance.now() - t0) * 100) / 100;
          logger.warn("api/qa", "POST answer item not found", {
            action: "answer",
            id: body.id,
            durationMs,
          });
          return NextResponse.json(
            { ok: false, error: "Pergunta não encontrada." },
            { status: 404 },
          );
        }

        const updatedItem: PropertyQuestionItem = {
          ...items[idx]!,
          status: "answered",
          answer: body.answer!.trim(),
          answerSource: "cursor_session",
          answeredAt: new Date().toISOString(),
        };
        items[idx] = updatedItem;
        await saveQaItems(items);

        const durationMs = Math.round((performance.now() - t0) * 100) / 100;
        logger.info("api/qa", "POST answer completed", {
          action: "answer",
          id: updatedItem.id,
          propertyKey: updatedItem.propertyKey,
          answerSource: updatedItem.answerSource,
          queuedToLocalCursor: false,
          itemsCount: items.length,
          durationMs,
        });

        return NextResponse.json({ ok: true, item: updatedItem, items });
      });
    }

    if (action === "delete") {
      if (!body.id) {
        const durationMs = Math.round((performance.now() - t0) * 100) / 100;
        logger.warn("api/qa", "POST delete rejected missing id", {
          action: "delete",
          durationMs,
        });
        return NextResponse.json(
          { ok: false, error: "ID da pergunta é obrigatório." },
          { status: 400 },
        );
      }
      return await withQaWriteLock(async () => {
        const items = await loadQaStore();
        const nextItems = items.filter((i) => i.id !== body.id);
        await saveQaItems(nextItems);
        const durationMs = Math.round((performance.now() - t0) * 100) / 100;
        logger.info("api/qa", "POST delete completed", {
          action: "delete",
          id: body.id,
          propertyKey: null,
          answerSource: null,
          queuedToLocalCursor: false,
          itemsCount: nextItems.length,
          durationMs,
        });
        return NextResponse.json({ ok: true, items: nextItems });
      });
    }

    // Default action === "ask"
    const propertyKey = (body.propertyKey ?? "general").trim() || "general";
    const question = (body.question ?? "").trim();
    if (!question) {
      const durationMs = Math.round((performance.now() - t0) * 100) / 100;
      logger.warn("api/qa", "POST ask rejected empty question", {
        action: "ask",
        propertyKey,
        durationMs,
      });
      return NextResponse.json(
        { ok: false, error: "Digite uma pergunta para enviar ao chat." },
        { status: 400 },
      );
    }

    const { evaluatedByKey, topEvaluated } = getEvaluatedSnapshotCache();
    const evaluated =
      propertyKey !== "general"
        ? (evaluatedByKey.get(propertyKey) ?? null)
        : null;
    const rawListing =
      propertyKey !== "general" ? findRawListingOnDisk(propertyKey) : null;

    const defaultSnapshot: PropertyQuestionSnapshot = {
      title:
        evaluated?.title ??
        (propertyKey === "general"
          ? "Contexto Geral (Top imóveis filtrados)"
          : propertyKey),
      neighborhood: evaluated?.neighborhood ?? "",
      cityCode: evaluated?.cityCode ?? "",
      street: evaluated?.street ?? "",
      streetNumber: evaluated?.streetNumber ?? null,
      condominiumName: evaluated?.condominiumName ?? null,
      totalMonthly: evaluated?.totalMonthly ?? 0,
      rent: evaluated?.rent ?? 0,
      condoFee: evaluated?.condoFee ?? 0,
      iptu: evaluated?.iptu ?? 0,
      areaM2: evaluated?.areaM2 ?? 0,
      bedrooms: evaluated?.bedrooms ?? 0,
      bathrooms: evaluated?.bathrooms ?? 0,
      parkingSpaces: evaluated?.parkingSpaces ?? 0,
      floor: evaluated?.floor ?? null,
      floorLabel: evaluated?.cardTags.floorTag?.label ?? null,
      furnished: evaluated?.furnished ?? null,
      modernityScore: evaluated?.modernityScore ?? 0,
      finalScore: evaluated?.finalScore ?? 0,
      overallRank: evaluated?.overallRank ?? null,
      cityRank: evaluated?.cityRank ?? null,
      furnitureTier: evaluated?.furnitureTier,
      breakdown: evaluated?.breakdown,
      url: evaluated?.url ?? "",
      shortJustification: evaluated?.shortJustification ?? "",
      description:
        evaluated?.description ?? evaluated?.generatedDescription ?? null,
      thumbnailUrl: evaluated?.samplePhotos?.[0]?.url ?? null,
    };

    const resolvedSnapshot: PropertyQuestionSnapshot = {
      ...defaultSnapshot,
      ...(body.propertySnapshot ?? {}),
    };

    const nowIso = new Date().toISOString();
    const itemId = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    let queuedToLocalCursor = false;
    if (existsSync(/*turbopackIgnore: true*/ dirname(CURSOR_QUEUE_FILE))) {
      try {
        appendFileSync(
          /*turbopackIgnore: true*/ CURSOR_QUEUE_FILE,
          `${JSON.stringify({
            event: "MORADIA_QUESTION_RECEIVED",
            item: {
              id: itemId,
              propertyKey,
              question,
              createdAt: nowIso,
              propertySnapshot: resolvedSnapshot,
            },
          })}\n`,
          "utf8",
        );
        queuedToLocalCursor = true;
      } catch {
        queuedToLocalCursor = false;
      }
    }

    const diagnostic = await generateDiagnosticAnswer({
      question,
      propertyKey,
      snapshot: resolvedSnapshot,
      evaluated,
      rawListing,
      topEvaluated,
      contextSummary: body.contextSummary,
      queuedToLocalCursor,
    });

    const newItem: PropertyQuestionItem = {
      id: itemId,
      propertyKey,
      question,
      status: "answered",
      answer: diagnostic.answer,
      answerSource: diagnostic.source,
      createdAt: nowIso,
      answeredAt: nowIso,
      propertySnapshot: resolvedSnapshot,
    };

    const nextItems = await withQaWriteLock(async () => {
      const latestItems = await loadQaStore();
      const mergedItems = [...latestItems, newItem];
      await saveQaItems(mergedItems);
      return mergedItems;
    });

    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.info("api/qa", "POST ask completed", {
      action: "ask",
      id: itemId,
      propertyKey,
      answerSource: diagnostic.source,
      queuedToLocalCursor,
      itemsCount: nextItems.length,
      durationMs,
    });

    return NextResponse.json({
      ok: true,
      item: newItem,
      items: nextItems,
      queuedToLocalCursor,
    });
  } catch (err) {
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.error("api/qa", "POST failed", {
      durationMs,
      error: err,
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro ao processar pergunta sobre o imóvel.",
      },
      { status: 500 },
    );
  }
}
