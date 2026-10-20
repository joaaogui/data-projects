import { resolveEnabledHiddenCities } from "@/lib/city-config";
import { enforceRateLimit, parseJsonBody, qaPostSchema } from "@/lib/api-guards";
import { requireAuth } from "@/lib/auth";
import { getCardQuestionsQueueFile, getLocalScraperDir } from "@/lib/local-scraper";
import { logger } from "@/lib/logger";
import { getScoredProperties } from "@/lib/server-scoring";
import { PHOTO_AUDIT_OVERRIDES } from "@/lib/photo-audit-overrides";
import { buildQaLlmPrompt } from "@/lib/qa-llm-prompt";
import type { ScoredSet } from "@/lib/property-query";
import {
  loadQaStore,
  preservedInstantAnswer,
  qaChangeListeners,
  sanitizePropertySnapshot,
  saveQaItems,
} from "@/lib/qa-store";
import {
  AC_INFRA_ONLY_TAG,
  AC_UNCONFIRMED_TAG,
  DEFAULT_WEIGHTS,
  classifyFurnitureTier,
  evaluateStreetMicroEnvironment,
  resolveNeighborhoodSafetyAndMetrics,
} from "@/lib/scoring-engine";
import type {
  CityHubCode,
  EvaluatedProperty,
  PropertyQuestionItem,
  PropertyQuestionSnapshot,
  ScoringWeights,
} from "@/types/housing";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

export const dynamic = "force-dynamic";

const QA_ASK_RATE_LIMIT = { limit: 12, windowMs: 60_000 };

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

export interface BsbBenchmark {
  count: number;
  medianTotalMonthly: number;
  medianAreaM2: number;
  medianPricePerM2: number;
  medianFinalScore: number;
}

interface EvaluatedSnapshot {
  evaluatedByKey: Map<string, EvaluatedProperty>;
  topEvaluated: EvaluatedProperty[];
  rankedEligible: EvaluatedProperty[];
  bsbBenchmark: BsbBenchmark | null;
}

const evaluatedBySet = new WeakMap<ScoredSet, EvaluatedSnapshot>();

function sanitizeWeights(raw: unknown): ScoringWeights {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_WEIGHTS;
  }
  const src = raw as Record<string, unknown>;
  const merged: Record<string, number | boolean> = { ...DEFAULT_WEIGHTS };
  for (const [key, def] of Object.entries(DEFAULT_WEIGHTS)) {
    const value = src[key];
    if (typeof def === "number" && typeof value === "number" && Number.isFinite(value)) {
      merged[key] = value;
    } else if (typeof def === "boolean" && typeof value === "boolean") {
      merged[key] = value;
    }
  }
  return merged as unknown as ScoringWeights;
}

/** The portal's own scored listings for these weights, so answers match what the user sees. */
async function getEvaluatedSnapshot(
  weights: ScoringWeights,
  enabledHiddenCities: CityHubCode[],
  signal: AbortSignal,
): Promise<EvaluatedSnapshot> {
  const set = await getScoredProperties(weights, { enabledHiddenCities, signal });
  const hit = evaluatedBySet.get(set);
  if (hit) return hit;
  const evaluatedByKey = new Map<string, EvaluatedProperty>();
  for (const p of set.properties) {
    evaluatedByKey.set(`${p.provider}:${p.id}`, p);
  }
  const rankedEligible = set.properties
    .filter((p) => p.eligible && p.isActive !== false)
    .sort((a, b) => b.finalScore - a.finalScore);
  const entry: EvaluatedSnapshot = {
    evaluatedByKey,
    topEvaluated: rankedEligible.slice(0, 15),
    rankedEligible,
    bsbBenchmark: computeBsbBenchmark(set.properties),
  };
  evaluatedBySet.set(set, entry);
  return entry;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

function computeBsbBenchmark(
  evaluated: EvaluatedProperty[],
): BsbBenchmark | null {
  const aguasClaras = evaluated.filter(
    (p) => p.cityCode === "BSB" && /[aá]guas claras/i.test(p.neighborhood),
  );
  if (aguasClaras.length === 0) return null;
  return {
    count: aguasClaras.length,
    medianTotalMonthly: median(aguasClaras.map((p) => p.totalMonthly)),
    medianAreaM2: median(aguasClaras.map((p) => p.areaM2)),
    medianPricePerM2: median(
      aguasClaras
        .filter((p) => p.areaM2 > 0)
        .map((p) => p.totalMonthly / p.areaM2),
    ),
    medianFinalScore: median(aguasClaras.map((p) => p.finalScore)),
  };
}

const rawFileMapCache = new Map<
  string,
  { mtimeMs: number; byKey: Map<string, RawListingRecord> }
>();

const CITY_RAW_FILE_PRIORITY: Record<string, string> = {
  BH: "imoveis_mg.json",
  BSB: "imoveis_df.json",
  RJ: "imoveis_rj.json",
  CP: "imoveis_sp_campinas.json",
  SP: "imoveis_sp_capital.json",
};

function findRawListingOnDisk(
  propertyKey: string,
  cityCodeHint?: string | null,
): RawListingRecord | null {
  const [provider, id] = propertyKey.split(":");
  const rawWorkspaceDir = getLocalScraperDir();
  if (!provider || !id || !rawWorkspaceDir) return null;

  const baseFiles = [
    "imoveis_mg.json",
    "imoveis_rj.json",
    "imoveis_sp_campinas.json",
    "imoveis_sp_capital.json",
    "imoveis_df.json",
  ];
  const preferredFile = cityCodeHint
    ? CITY_RAW_FILE_PRIORITY[cityCodeHint.toUpperCase()]
    : undefined;
  const orderedFiles = preferredFile
    ? [preferredFile, ...baseFiles.filter((f) => f !== preferredFile)]
    : baseFiles;

  for (const file of orderedFiles) {
    const fullPath = join(rawWorkspaceDir, file);
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
      // If we checked the hinted city's file and it wasn't there, no need to parse all other 4 cities
      if (preferredFile && file === preferredFile) {
        return null;
      }
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

const CITY_MENTIONS: [CityHubCode, RegExp, string][] = [
  ["CP", /\b(campinas|cp)\b/, "Campinas"],
  ["BH", /\b(bh|belo horizonte|beaga)\b/, "Belo Horizonte"],
  ["RJ", /\b(rj|rio|rio de janeiro)\b/, "Rio de Janeiro"],
  ["SP", /\b(sp|sao paulo|sampa)\b/, "São Paulo"],
];

function formatListingLine(p: EvaluatedProperty, idx: number): string {
  return `${idx + 1}. **${p.neighborhood} (${p.cityCode}) — ${p.street}${p.streetNumber ? `, ${p.streetNumber}` : ""}** · #${p.overallRank ?? "—"} · **${p.finalScore.toFixed(1)} pts** · ${formatBRL(p.totalMonthly)}/mês · ${p.areaM2} m² · ${p.commuteLabel ?? "deslocamento N.I."}`;
}

function buildGeneralAnswer(params: {
  qNorm: string;
  rankedEligible: EvaluatedProperty[];
  contextSummary?: string;
}): string {
  const { qNorm, rankedEligible, contextSummary } = params;
  const city = CITY_MENTIONS.find(([, re]) => re.test(qNorm));
  const asksNeighborhood = /\b(bairro\w*|regia\w*|zona\w*|onde morar)\b/.test(qNorm);
  const asksScreen = /\b(tela|filtr\w*|compar\w*)\b/.test(qNorm);
  const pool = city
    ? rankedEligible.filter((p) => p.cityCode === city[0])
    : rankedEligible;
  const scope = city ? city[2] : "todas as praças";
  const sections: string[] = [];

  if (asksNeighborhood && pool.length > 0) {
    const byNeighborhood = new Map<string, EvaluatedProperty[]>();
    for (const p of pool.slice(0, 80)) {
      const list = byNeighborhood.get(p.neighborhood) ?? [];
      list.push(p);
      byNeighborhood.set(p.neighborhood, list);
    }
    const ranked = [...byNeighborhood.entries()]
      .map(([name, list]) => ({
        name,
        city: list[0]!.cityCode,
        count: list.length,
        best: list[0]!,
        medianTotal: median(list.map((p) => p.totalMonthly)),
        commute: list[0]!.commuteLabel,
      }))
      .sort((a, b) => b.best.finalScore - a.best.finalScore)
      .slice(0, 5);
    sections.push(
      `### 🏘️ Melhores bairros para o seu perfil — ${scope}\n` +
        ranked
          .map(
            (n, idx) =>
              `${idx + 1}. **${n.name}${city ? "" : ` (${n.city})`}** — melhor apê com **${n.best.finalScore.toFixed(1)} pts** · ${n.count} apê(s) elegível(is) · aluguel total mediano ${formatBRL(n.medianTotal)}${n.commute ? ` · ${n.commute}` : ""}`,
          )
          .join("\n") +
        "\n\nOrdenado pela melhor nota de apartamento elegível em cada bairro (a nota já pondera segurança, deslocamento, orçamento e qualidade do imóvel).",
    );
  }

  if (asksScreen && contextSummary) {
    sections.push(`### 🖥️ Top da sua tela (filtros atuais)\n${contextSummary}`);
  } else if (pool.length > 0) {
    sections.push(
      `### 🏆 Top apartamentos elegíveis — ${scope}\n${pool.slice(0, 5).map((p, idx) => formatListingLine(p, idx)).join("\n")}`,
    );
  } else {
    sections.push(
      `Não há imóveis elegíveis em ${scope} no snapshot atual.`,
    );
  }

  sections.push(
    "💡 Use **Perguntar** em um card para conversar sobre um imóvel específico (segurança da rua, andar, mobília, ar-condicionado, por que foi retido).",
  );
  return sections.join("\n\n");
}

export function buildInstantGroundedAnswer(params: {
  question: string;
  propertyKey: string;
  snapshot: PropertyQuestionSnapshot;
  evaluated: EvaluatedProperty | null;
  rawListing: RawListingRecord | null;
  topEvaluated: EvaluatedProperty[];
  rankedEligible?: EvaluatedProperty[];
  bsbBenchmark?: BsbBenchmark | null;
  weights?: ScoringWeights;
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
    rankedEligible = topEvaluated,
    bsbBenchmark = null,
    weights = DEFAULT_WEIGHTS,
    contextSummary,
    queuedToLocalCursor = false,
  } = params;
  const qNorm = question
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  // Case 1: General question (no single property pinned)
  if (propertyKey === "general" || (!evaluated && !snapshot.neighborhood)) {
    return buildGeneralAnswer({ qNorm, rankedEligible, contextSummary });
  }

  const prop = evaluated;
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
  const asksSafety =
    /\b(perigos[oa]?s?|perigo|segur[oa]?s?|seguranc\w*|assalt\w*|violenc\w*|crime\w*|criminal\w*|risco\w*|medo|roubo\w*|furto\w*|tiroteio\w*|favela\w*|comunidade\w*|morro\w*|faccao|polici\w*|bunker|calcada\w*|andar a pe|caminhar|sair a noite|noite|tranquil\w*|hostil)\b/.test(
      qNorm,
    );
  const asksFloor =
    /\b(andar\w*|terreo|cobertura\w*|alto|baixo|pavimento\w*|elevador\w*|escada\w*)\b/.test(
      qNorm,
    );
  const asksFurniture =
    /\b(mobiliad\w*|mobilia\w*|cama\w*|sofa\w*|geladeira\w*|fogao|cooktop|maquina\w*|armario\w*|marcenaria|mudanca|eletro\w*)\b/.test(
      qNorm,
    );
  const asksRetention =
    /\b(retid\w*|retenc\w*|exclu\w*|elimin\w*|barrad\w*|barreira\w*|bloquead\w*|elegiv\w*|inelegiv\w*|sumiu|nao aparece|fora do ranking)\b/.test(
      qNorm,
    );
  const asksAirConditioning =
    /\bar[- ]?condicionado\b|\bsplit\w*|\bclimatiz\w*|\bcalor\b|\bac\b/.test(qNorm);
  const asksCompareBsb =
    /\b(aguas claras|brasilia|bsb|plano piloto)\b/.test(qNorm);
  const asksScoreOrRule =
    /\b(nota\w*|score\w*|ponto\w*|pontuac\w*|ranking|posicao|avaliac\w*|deveria\w*|errad\w*|corrig\w*|penalidade\w*|bonus)\b/.test(
      qNorm,
    ) ||
    (/\b(por que|porque)\b/.test(qNorm) && !asksRetention && !asksAirConditioning);
  const asksPhotosOrCondition =
    /\b(foto\w*|imagem|imagens|acabamento\w*|reforma\w*|modern\w*|velh\w*|antig\w*|estado|conserva\w*|cozinha\w*|banheiro\w*|sala\w*|quarto\w*)\b/.test(
      qNorm,
    );
  const asksLocationOrCommute =
    /\b(rua\w*|quadra\w*|trecho\w*|localizac\w*|localidade\w*|regiao|regioes|area\w*|zona\w*|vizinhanca\w*|entorno|onde fica|lugar\w*|bairro\w*|barulh\w*|silencios\w*|nubank|escritorio\w*|distancia\w*|tempo|transito|metro|parque\w*|shopping\w*|onibus|carro\w*)\b/.test(
      qNorm,
    );
  const asksPrice =
    /\b(preco\w*|valor\w*|aluguel|alugueis|condominio\w*|iptu|caro\w*|barato\w*|custo\w*|orcamento\w*|justo\w*|m2)\b/.test(
      qNorm,
    );
  const asksVisit =
    /\b(visita\w*|vale\w*|compensa\w*|bom|boa|bons|boas|acha\w*|opiniao|opinioes|criterio\w*|perfil|analis\w*|avali\w*|veredito|resumo|pros|contras|recomenda\w*|morar)\b/.test(
      qNorm,
    );
  const isBugOrRuleFeedback =
    /\b(deveria\w*|errad\w*|corrig\w*|melhor\w*|falso positivo|bug\w*|ajuste\w*|ajustar|reclassific\w*|tambem e|tbm e|nao e)\b/.test(
      qNorm,
    );

  const cityCodeUpper = (prop?.cityCode ?? snapshot.cityCode ?? "BH") as CityHubCode;
  const nbMetrics = resolveNeighborhoodSafetyAndMetrics(
    cityCodeUpper,
    snapshot.neighborhood || prop?.neighborhood || "",
  );
  const microEnv = prop ? evaluateStreetMicroEnvironment(prop) : null;
  const redTags = prop?.cardTags.redTags ?? snapshot.redTags ?? [];
  const greenTags = prop?.cardTags.greenTags ?? snapshot.greenTags ?? [];
  const doormanRaw =
    prop?.doorman ??
    snapshot.doorman ??
    rawListing?.condominium?.doorman ??
    null;
  const has24hDoorman =
    doormanRaw === "NightAndDayShift" ||
    doormanRaw === "24h" ||
    amenitiesList.some((a) => /portaria 24h/i.test(a)) ||
    (prop?.nuanceHighlights ?? snapshot.nuanceHighlights ?? []).some((h) =>
      /portaria 24h/i.test(h),
    );
  const doormanLabel = has24hDoorman
    ? "Portaria 24h presencial/biometria"
    : doormanRaw ?? "Verificar horário de portaria no anúncio";

  const safeBubblesByCity: Record<string, string> = {
    RJ: "Em RJ, os enclaves com calçada segura e caminhável (nota 7.8 a 9.2/10) são **Flamengo (colado no Aterro)**, **Laranjeiras**, **Botafogo**, **Jardim Botânico**, **Ipanema/Leblon** e **Jardim Oceânico (miolo da Barra)**.",
    BH: "Em BH, as bolhas mais seguras e caminháveis (nota 8.8 a 9.6/10) são **Funcionários (Savassi)**, **Lourdes**, **Santo Agostinho**, **Sion** e **Vila da Serra**.",
    CP: "Em Campinas, os eixos mais seguros para rua e carro (nota 8.5 a 9.2/10) são **Parque Taquaral**, **Nova Campinas**, **Jardim Guanabara** e **Mansões Santo Antônio**.",
    SP: "Em SP, os miolos mais seguros para caminhar (nota 8.2 a 9.2/10) são **Moema (Pássaros/Índios)**, **Vila Mariana**, **Jardim Paulista** e **Pinheiros / Alto de Pinheiros**.",
    BSB: "Referência de Brasília: **Águas Claras** (nota 8.8/10 em segurança urbana e caminhabilidade).",
  };

  const sections: string[] = [];
  const photoAudit = PHOTO_AUDIT_OVERRIDES[propertyKey];
  const visualWarnings = photoAudit?.visualWarnings ?? [];
  let visualWarningsShown = false;

  // Retention (eligibility barriers); prefer what the card showed the user
  if (asksRetention) {
    const eligible = snapshot.eligible ?? prop?.eligible;
    const exclusionReason = snapshot.exclusionReason ?? prop?.exclusionReason;
    const rank = snapshot.overallRank ?? prop?.overallRank ?? null;
    const cityRank = snapshot.cityRank ?? prop?.cityRank ?? null;
    if (eligible === undefined) {
      sections.push(
        "### 🚦 Status de retenção\nNão encontrei este imóvel no snapshot atual do ranking, então não consigo confirmar se ele passa nas barreiras.",
      );
    } else if (!eligible) {
      const reasons = (exclusionReason ?? "Motivo não registrado")
        .split(" · ")
        .map((r) => `- ${r}`)
        .join("\n");
      sections.push(
        `### 🚦 Sim, está retido pelas barreiras\n${reasons}\n\nHoje só retêm: área abaixo de ${weights.minAreaM2} m², tempo até o escritório acima de 50 min, sem vaga, vaga presa/gaveta/rotativa/manobrista e prédio sem elevador. Orçamento, mobília e modernidade só mexem na nota.`,
      );
    } else {
      sections.push(
        `### ✅ Não está retido\nPassa em todas as barreiras (área ≥ ${weights.minAreaM2} m², ${prop?.commuteLabel ?? "deslocamento dentro do limite"}, ${snapshot.parkingSpaces} vaga(s) livre(s), prédio com elevador)${rank ? ` e está em **#${rank} no ranking geral**${cityRank ? ` (#${cityRank} em ${snapshot.cityCode})` : ""}` : ""}.` +
          (prop?.isActive === false
            ? "\n- ⚠️ O anúncio foi **desativado** no portal de origem, por isso pode não aparecer na lista."
            : ""),
      );
    }
  }

  // Air conditioning (photo audit can flag false AC)
  if (asksAirConditioning) {
    const acLabel = prop?.cardTags.acLabel ?? snapshot.acLabel ?? null;
    const acSentence = fullDesc
      .split(/[.!?\n]/)
      .find((segment) => /\b(?:split|ar[- ]?condicionado)\b/i.test(segment))
      ?.trim()
      .slice(0, 220);
    const acWarnings = visualWarnings.filter((w) =>
      /ar-condicionado|\bac\b|split/i.test(w),
    );
    const lines: string[] = [];
    if (photoAudit?.falseAC) {
      lines.push(
        "### ❄️ Ar-condicionado: **não confirmado nas fotos**",
        "- O anúncio cita ar-condicionado, mas a auditoria visual das fotos não encontrou split instalado.",
        ...acWarnings.map((w) => `- ${w}`),
        "- Na nota: conta como **sem AC (−20 pts)** em vez de +12.",
      );
      visualWarningsShown = acWarnings.length === visualWarnings.length;
    } else if (prop?.cardTags.warningTags.includes(AC_INFRA_ONLY_TAG)) {
      lines.push(
        "### ❄️ Ar-condicionado: **não instalado (só infraestrutura)**",
        acSentence
          ? `- O anúncio fala em ponto/infraestrutura para ar-condicionado, não em aparelho instalado: *"${acSentence}"*`
          : "- O anúncio fala em ponto/infraestrutura para ar-condicionado, não em aparelho instalado.",
        "- Na nota: **0 pts** (com split instalado seria +12; sem AC, −20).",
        "- Conte com o custo de comprar e instalar os splits, ou pergunte se o proprietário instala.",
      );
    } else if (prop?.cardTags.warningTags.includes(AC_UNCONFIRMED_TAG)) {
      lines.push(
        "### ❄️ Ar-condicionado: **não confirmado**",
        "- Só aparece marcado no checklist de comodidades do portal; o texto do anúncio e as legendas das fotos não citam ar-condicionado/split.",
        "- Na nota: **0 pts** até confirmar (com split confirmado seria +12; sem AC, −20).",
        "- Pergunte ao anunciante se há split instalado (e em quais cômodos) ou só a infraestrutura.",
      );
    } else if (acLabel) {
      lines.push(
        acLabel === "Ar-condicionado"
          ? "### ❄️ Ar-condicionado: **sim**"
          : `### ❄️ Ar-condicionado: **sim — ${acLabel}**`,
        acSentence
          ? `- Evidência no anúncio: *"${acSentence}"*`
          : "- Evidência: listado nas comodidades do anúncio.",
        "- Na nota: **+12 pts** (sem AC seria −20).",
        "- Vale confirmar na visita se há split em todos os cômodos (quarto e sala).",
      );
    } else {
      lines.push(
        "### ❄️ Ar-condicionado: **não**",
        "- Nenhum ar-condicionado (split ou comum) aparece nas comodidades nem no texto do anúncio.",
        "- Na nota: **−20 pts**.",
      );
    }
    sections.push(lines.join("\n"));
  }

  // Comparison with the Águas Claras benchmark
  if (asksCompareBsb && bsbBenchmark) {
    const total = snapshot.totalMonthly;
    const area = snapshot.areaM2;
    const pricePerM2 = area > 0 ? total / area : 0;
    const pct = (value: number, base: number) => {
      if (base <= 0) return "";
      const diff = Math.round(((value - base) / base) * 100);
      return diff === 0 ? " (igual)" : ` (${diff > 0 ? "+" : ""}${diff}%)`;
    };
    const finalScore = prop?.finalScore ?? snapshot.finalScore;
    const safety = nbMetrics?.safetyCar;
    sections.push(
      `### ⚖️ Comparado com Águas Claras (mediana de ${bsbBenchmark.count} anúncios)\n` +
        `- **Custo mensal**: ${formatBRL(total)} vs ${formatBRL(bsbBenchmark.medianTotalMonthly)}${pct(total, bsbBenchmark.medianTotalMonthly)}\n` +
        `- **Área**: ${area} m² vs ${bsbBenchmark.medianAreaM2} m²${pct(area, bsbBenchmark.medianAreaM2)}\n` +
        `- **R$/m²**: ${formatBRL(pricePerM2)} vs ${formatBRL(bsbBenchmark.medianPricePerM2)}${pct(pricePerM2, bsbBenchmark.medianPricePerM2)}\n` +
        `- **Nota no mesmo motor**: ${finalScore.toFixed(1)} pts vs ${bsbBenchmark.medianFinalScore.toFixed(1)} pts\n` +
        (safety !== undefined
          ? `- **Segurança rua/carro do bairro**: ${safety.toFixed(1)}/10 vs 8.8/10 em Águas Claras\n`
          : "") +
        `- **Deslocamento**: ${prop?.commuteLabel ?? nbMetrics?.commute ?? "não informado"}`,
    );
  }

  // 0. Safety / Danger / Walkability analysis
  if (asksSafety) {
    const rawSafety =
      nbMetrics?.safetyCar ??
      ((snapshot.breakdown?.safetyPoints ?? prop?.breakdown.safetyPoints ?? 0) < 0
        ? 4.8
        : 8.2);
    const effectiveSafety =
      microEnv?.safetyCarCap !== null && microEnv?.safetyCarCap !== undefined
        ? Math.min(rawSafety, microEnv.safetyCarCap)
        : rawSafety;
    const safetyPts =
      snapshot.breakdown?.safetyPoints ?? prop?.breakdown.safetyPoints ?? 0;
    const hasSafetyRedTag =
      redTags.includes("Alerta de Segurança na Rua") ||
      redTags.includes("Via Arterial / Efeito Bunker");
    const safeComparison =
      safeBubblesByCity[cityCodeUpper] ?? safeBubblesByCity.BH!;

    if (
      effectiveSafety < 5.8 ||
      safetyPts <= -15 ||
      hasSafetyRedTag ||
      microEnv?.category === "BUNKER_OR_SPOOF"
    ) {
      const streetReason =
        microEnv?.warning ??
        (cityCodeUpper === "RJ"
          ? `O bairro **${snapshot.neighborhood}** na Zona Norte/Centro tem índice elevado de assaltos a pedestres no período noturno, risco de abordagem a veículos em semáforos/entrada de garagem e proximidade com áreas de tensão urbana.`
          : `O trecho de **${snapshot.street || snapshot.neighborhood}** sofre com esvaziamento de calçada à noite e maior incidência de abordagens a pedestres.`);
      sections.push(
        `### 🚨 Diagnóstico de Segurança — Área de Atenção / Risco Elevado\n` +
          `• **Veredito para o seu perfil (padrão Águas Claras / Setor Marista)**: **Sim, é uma área delicada/perigosa para vida a pé.** O nosso motor aplica **${safetyPts.toFixed(1)} pts** de penalidade de segurança (nota de Segurança de Rua & Carro: **${effectiveSafety.toFixed(1)}/10**)${redTags.length > 0 ? ` e alerta vermelho **${redTags.join(" · ")}**` : ""}.\n` +
          `• **Dinâmica da rua (${snapshot.street}${snapshot.streetNumber ? `, ${snapshot.streetNumber}` : ""})**: ${streetReason} Na prática, impõe o **"efeito bunker"** (sair e voltar quase exclusivamente de carro/Uber à noite, sem liberdade de caminhar com celular na mão).\n` +
          `• **Segurança interna do condomínio**: **${doormanLabel}** · **${snapshot.parkingSpaces} vaga(s) de garagem**.\n` +
          `• **Alternativas seguras na mesma praça**: ${safeComparison}`,
      );
    } else if (
      effectiveSafety < 7.5 ||
      microEnv?.category === "HEAVY_ARTERIAL"
    ) {
      sections.push(
        `### 🟡 Diagnóstico de Segurança — Segurança Moderada (Atenção Noturna)\n` +
          `• **Veredito para o seu perfil**: **Nível intermediário de segurança (nota ${effectiveSafety.toFixed(1)}/10 · ajuste de ${safetyPts >= 0 ? `+${safetyPts.toFixed(1)}` : safetyPts.toFixed(1)} pts).** Durante o dia há movimento comercial e circulação normal, mas exige atenção com celular na calçada e cautela ao caminhar à noite após o fechamento do comércio.\n` +
          `• **Perfil da via (${snapshot.street}${snapshot.streetNumber ? `, ${snapshot.streetNumber}` : ""})**: ${microEnv?.warning ?? microEnv?.highlight ?? "Via urbana mista — vale observar o fluxo de pedestres na quadra exata no início da noite."}\n` +
          `• **Segurança interna do condomínio**: **${doormanLabel}** · **${snapshot.parkingSpaces} vaga(s) de garagem**.\n` +
          `• **Comparativo**: ${safeComparison}`,
      );
    } else {
      sections.push(
        `### 🛡️ Diagnóstico de Segurança — Bolha Residencial Segura & Caminhável\n` +
          `• **Veredito para o seu perfil (padrão Águas Claras / Setor Marista)**: **Não é área perigosa — fica em uma bolha residencial segura e caminhável** (nota **${effectiveSafety.toFixed(1)}/10** em Segurança de Rua & Carro · ajuste de **${safetyPts >= 0 ? `+${safetyPts.toFixed(1)}` : safetyPts.toFixed(1)} pts**).\n` +
          `• **Ambiência da rua (${snapshot.street}${snapshot.streetNumber ? `, ${snapshot.streetNumber}` : ""})**: ${microEnv?.highlight ?? "Quadra consolidada com calçadas ativas, bom movimento de moradores e baixo índice de sinistros para caminhar a pé ou entrar/sair de carro."}\n` +
          `• **Segurança interna do condomínio**: **${doormanLabel}** · **${snapshot.parkingSpaces} vaga(s) de garagem**${greenTags.length > 0 ? ` · Destaques: **${greenTags.join(", ")}**` : ""}.`,
      );
    }
  }

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

    sections.push(`### 🏢 Diagnóstico de Andar\n${floorDetails.join("\n")}`);
  }

  // 2. Furniture analysis (2 tiers: Mobiliado requires geladeira + sofá + cama)
  if (asksFurniture) {
    const tier =
      prop?.furnitureTier ??
      snapshot.furnitureTier ??
      (prop ? classifyFurnitureTier(prop) : "UNFURNISHED");
    const isFurnished = tier === "FULLY_FURNISHED";
    const searchCorpus = [
      fullDesc,
      ...amenitiesList,
      ...commoditiesList,
      ...captions,
    ].join(" | ");
    const requiredChecks: [string, RegExp][] = [
      ["Geladeira", /(?<![a-zA-ZÀ-ÿ0-9_])(geladeiras?|refrigerador(?:es)?|frigobar)(?![a-zA-ZÀ-ÿ0-9_])/i],
      ["Sofá", /(?<![a-zA-ZÀ-ÿ0-9_])(sof[aá]s?)(?![a-zA-ZÀ-ÿ0-9_])/i],
      ["Cama", /(?<![a-zA-ZÀ-ÿ0-9_])(camas?|colch[aã]o|colch[oõ]es)(?![a-zA-ZÀ-ÿ0-9_])/i],
    ];
    const checklist = requiredChecks
      .map(([label, re]) => `${label} ${re.test(searchCorpus) ? "✅" : "❌"}`)
      .join(" · ");
    const furnPts =
      prop?.breakdown.furniturePoints ??
      snapshot.breakdown?.furniturePoints ??
      0;
    const lines = [
      `### 🛋️ Mobília: **${isFurnished ? "Mobiliado" : "Não mobiliado"}**`,
      `- **Regra**: só conta como Mobiliado com **geladeira + sofá + cama** citados no anúncio, nas comodidades ou nas legendas das fotos.`,
      `- **O que o anúncio cita**: ${checklist}`,
      `- **Impacto na nota**: **${furnPts >= 0 ? `+${furnPts}` : furnPts} pts** (${isFurnished ? "mobiliado conflita com a mudança vinda de Brasília" : "livre para receber seus móveis"})`,
    ];
    if (photoAudit?.furnishedTier) {
      lines.push(
        `- **Auditoria visual das fotos** fixou a classificação em **${photoAudit.furnishedTier === "FULLY_FURNISHED" ? "Mobiliado" : "Não mobiliado"}** (sobrepõe o texto do anúncio).`,
      );
    }
    if (rawListing?.specs?.furnished === true && !isFurnished) {
      lines.push(
        "- O anúncio marca `mobiliado: sim`, mas sem os três itens obrigatórios — por isso fica como não mobiliado.",
      );
    }
    sections.push(lines.join("\n"));
  }

  // 3. Location / Street / Commute / User Criteria
  if (asksLocationOrCommute || asksVisit) {
    const parks = prop?.parksNearby ?? [];
    const malls = prop?.mallsNearby ?? [];
    const places = (prop?.placesNearby ?? []).map((p) => p.name).slice(0, 6);
    const commuteText =
      prop?.commuteLabel ?? nbMetrics?.commute ?? "~15-30 min do Nubank";
    const subScoresLine = nbMetrics
      ? `Respiro Urbano **${nbMetrics.urbanBreathing.toFixed(1)}/10** · Logística Nubank **${nbMetrics.commuteLogistics.toFixed(1)}/10** · Segurança Rua/Carro **${nbMetrics.safetyCar.toFixed(1)}/10**`
      : null;
    const microLine =
      microEnv?.highlight ??
      microEnv?.warning ??
      (greenTags.includes("Rua Silenciosa")
        ? "Quadra residencial silenciosa e arborizada"
        : null);

    sections.push(
      `### 📍 Localidade, Rua & Logística até o Nubank\n` +
        `• **Endereço**: ${snapshot.street}${snapshot.streetNumber ? `, ${snapshot.streetNumber}` : ""}${condoName ? ` (${condoName})` : ""} — **${snapshot.neighborhood}** (${prop?.city ?? snapshot.cityCode})\n` +
        `• **Deslocamento até o Escritório do Nubank**: **${commuteText}**${prop?.breakdown.commutePoints ? ` (${prop.breakdown.commutePoints >= 0 ? `+${prop.breakdown.commutePoints.toFixed(1)}` : prop.breakdown.commutePoints.toFixed(1)} pts)` : ""}\n` +
        (subScoresLine ? `• **Indicadores do Bairro**: ${subScoresLine}\n` : "") +
        (microLine ? `• **Microambiente da Quadra**: ${microLine}\n` : "") +
        `• **Portaria / Segurança no Prédio**: **${doormanLabel}**\n` +
        (parks.length > 0 ? `• **Parques / Áreas verdes próximas**: ${parks.join(", ")}\n` : "") +
        (malls.length > 0 ? `• **Shoppings / Comércio**: ${malls.join(", ")}\n` : "") +
        (places.length > 0 ? `• **Referências no entorno**: ${places.join(", ")}` : ""),
    );
  }

  const asksGeneralVerdict = asksVisit && !asksCompareBsb;
  const hasSpecificIntent =
    asksSafety ||
    asksFloor ||
    asksFurniture ||
    asksPhotosOrCondition ||
    asksLocationOrCommute ||
    asksPrice ||
    asksRetention ||
    asksAirConditioning ||
    asksCompareBsb;

  // 4. Score / Ranking breakdown
  if (asksScoreOrRule || asksGeneralVerdict || !hasSpecificIntent) {
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
        `• **Bairro (${snapshot.neighborhood})**: **+${bd.neighborhoodPoints.toFixed(1)} pts** (Nota do bairro: ${prop?.neighborhoodDynamicScore.toFixed(2) ?? "—"}/10 · ${prop?.commuteLabel ?? nbMetrics?.commute ?? "Logística calculada"})`,
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
    sections.push(`### 📊 Decomposição da Nota\n${scoreLines.join("\n")}`);
  }

  // 5. Photos / Finishing / Condition
  if (asksPhotosOrCondition) {
    const posSignals = prop?.positiveSignals ?? [];
    const negSignals = prop?.negativeSignals ?? [];
    sections.push(
      `### 📸 Acabamento, Modernidade & Fotos (${snapshot.modernityScore}/100)\n` +
        `• **Tier de Modernidade**: **${prop?.modernityTier ?? "Avaliado"}** (${snapshot.modernityScore}/100)${prop?.constructionYear ? ` · Ano de construção: **${prop.constructionYear}**` : ""}\n` +
        `• **Sinais positivos detectados**: ${posSignals.length > 0 ? posSignals.join(", ") : "Acabamento padrão bem conservado"}\n` +
        (negSignals.length > 0
          ? `• **Alertas de idade/acabamento**: ${negSignals.join(", ")}\n`
          : "") +
        `• **Fotos disponíveis**: **${prop?.photosCount ?? "—"} fotos**${sampleRooms.length > 0 ? ` cobrindo ${sampleRooms.join(", ")}` : ""}\n` +
        (captions.length > 0
          ? `• **Legendas das fotos**: ${captions.slice(0, 5).join(" | ")}\n`
          : "") +
        (!visualWarningsShown && visualWarnings.length > 0
          ? visualWarnings.map((w) => `• ⚠️ ${w}`).join("\n")
          : ""),
    );
    visualWarningsShown = true;
  }

  const visualAuditFlags = [
    photoAudit?.falseGourmet
      ? "Varanda/espaço gourmet anunciado não aparece nas fotos"
      : null,
    photoAudit?.hasMaintenanceIssue
      ? "Fotos mostram problema de manutenção (ex.: infiltração/umidade)"
      : null,
    ...visualWarnings,
  ].filter((w): w is string => Boolean(w));
  if (
    !visualWarningsShown &&
    visualAuditFlags.length > 0 &&
    (asksVisit || asksScoreOrRule || asksRetention || asksFurniture || !hasSpecificIntent)
  ) {
    sections.push(
      `### 🔎 Auditoria visual das fotos\n${visualAuditFlags.map((w) => `- ${w}`).join("\n")}`,
    );
  }

  // 6. Price / Cost breakdown
  if (asksPrice || asksGeneralVerdict) {
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
      `### 💰 Custos & Condições (${formatBRL(snapshot.totalMonthly)}/mês)\n` +
        `• **Pacote Mensal**: **${formatBRL(snapshot.totalMonthly)}** (Aluguel ${formatBRL(snapshot.rent)} + Condomínio ${formatBRL(snapshot.condoFee)} + IPTU ${formatBRL(snapshot.iptu)}${prop?.listedIptu !== undefined ? ` estimado; portal informa ${formatBRL(prop.listedIptu)}` : ""}${feesNote})\n` +
        (prop?.listedRent !== undefined
          ? `• **Preço divergente**: a descrição informa aluguel de ${formatBRL(prop.rent)}, acima dos ${formatBRL(prop.listedRent)} do portal; o total usa o maior valor\n`
          : "") +
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

  if (
    fullDesc &&
    fullDesc.trim().length >= 40 &&
    !/^(mr\.|#|\$\d+)/i.test(fullDesc.trim()) &&
    (sections.length === 0 || (asksGeneralVerdict && sections.length < 3))
  ) {
    const trimmedDesc =
      fullDesc.length > 360 ? `${fullDesc.slice(0, 360).trim()}...` : fullDesc;
    sections.push(`### 📝 Trecho da Descrição Original\n"${trimmedDesc}"`);
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
  rankedEligible?: EvaluatedProperty[];
  bsbBenchmark?: BsbBenchmark | null;
  weights?: ScoringWeights;
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

  const { systemPrompt, userPrompt } = buildQaLlmPrompt({
    question: params.question,
    propertyKey: params.propertyKey,
    snapshot: params.snapshot,
    evaluated: params.evaluated,
    rawSpecs: params.rawListing?.specs ?? null,
    advertiser: params.rawListing?.advertiser ?? null,
    topEvaluated: params.topEvaluated,
    contextSummary: params.contextSummary,
    queuedToLocalCursor: params.queuedToLocalCursor,
  });

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

const QA_STREAM_MAX_MS = 55_000;
const QA_STREAM_POLL_MS = 2_500;
const QA_STREAM_HEARTBEAT_MS = 15_000;

/**
 * Server-sent events: pushes the full item list whenever its ETag changes. Writes on this
 * instance notify immediately; writes elsewhere (other instances, the Cursor session editing
 * the local file) are picked up by the store's short-TTL reload. The stream ends before the
 * function time limit and EventSource reconnects with Last-Event-ID = last ETag.
 */
function streamQaItems(request: Request): Response {
  const encoder = new TextEncoder();
  let lastEtag = request.headers.get("last-event-id") ?? "";
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const push = async () => {
        const items = await loadQaStore();
        const etag = computeQaEtag(items);
        if (etag === lastEtag) return;
        lastEtag = etag;
        send(`id: ${etag}\nevent: items\ndata: ${JSON.stringify({ items, etag })}\n\n`);
      };
      const onChange = () => {
        void push().catch(() => {});
      };
      const heartbeat = setInterval(() => send(": ping\n\n"), QA_STREAM_HEARTBEAT_MS);
      const close = () => {
        if (closed) return;
        closed = true;
        if (pollTimer) clearTimeout(pollTimer);
        clearInterval(heartbeat);
        clearTimeout(maxTimer);
        qaChangeListeners.delete(onChange);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      const maxTimer = setTimeout(close, QA_STREAM_MAX_MS);
      const poll = async () => {
        if (closed) return;
        await push().catch(() => {});
        if (!closed) pollTimer = setTimeout(() => void poll(), QA_STREAM_POLL_MS);
      };
      qaChangeListeners.add(onChange);
      request.signal.addEventListener("abort", close);
      send("retry: 1500\n\n");
      void poll();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET(request: Request) {
  const t0 = performance.now();
  const { searchParams } = new URL(request.url);
  if (searchParams.get("stream") === "1") {
    return streamQaItems(request);
  }
  const propertyKey = searchParams.get("propertyKey");
  const status = searchParams.get("status");

  let items = await loadQaStore();
  if (propertyKey) {
    items = items.filter((item) => item.propertyKey === propertyKey);
  }
  if (status === "pending" || status === "answered") {
    items = items.filter((item) => item.status === status);
  }

  const etag = computeQaEtag(items);
  const notModified = request.headers.get("if-none-match") === etag;
  const durationMs = Math.round((performance.now() - t0) * 100) / 100;
  logger.info("api/qa", "GET completed", {
    propertyKey: propertyKey ?? "ALL",
    status: status ?? "ALL",
    itemsCount: items.length,
    notModified,
    durationMs,
  });

  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    ETag: etag,
  };
  if (notModified) {
    return new NextResponse(null, { status: 304, headers });
  }
  return NextResponse.json({ ok: true, items }, { headers });
}

function computeQaEtag(items: PropertyQuestionItem[]): string {
  let hash = 0x811c9dc5;
  for (const item of items) {
    const part = `${item.id}|${item.status}|${item.answerSource ?? ""}|${item.answeredAt ?? ""}|${item.answer?.length ?? 0}|${item.awaitingDetailedAnswer ? 1 : 0};`;
    for (let i = 0; i < part.length; i++) {
      hash ^= part.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
  }
  return `W/"qa-${items.length}-${(hash >>> 0).toString(36)}"`;
}

let qaWriteLockPromise: Promise<unknown> = Promise.resolve();

function withQaWriteLock<T>(task: () => Promise<T>): Promise<T> {
  const next = qaWriteLockPromise.then(task, task);
  qaWriteLockPromise = next.catch(() => {});
  return next;
}

export async function POST(request: Request) {
  const t0 = performance.now();
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const parsedBody = await parseJsonBody(request, qaPostSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data;
    const action = body.action;

    if (action === "ask") {
      const limited = enforceRateLimit(request, "qa-ask", QA_ASK_RATE_LIMIT.limit, QA_ASK_RATE_LIMIT.windowMs);
      if (limited) return limited;
    }

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
          instantAnswer: preservedInstantAnswer(items[idx]!),
          awaitingDetailedAnswer: false,
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
    const propertyKey =
      typeof body.propertyKey === "string"
        ? body.propertyKey.trim().slice(0, 120) || "general"
        : "general";
    const question =
      typeof body.question === "string"
        ? body.question.trim().slice(0, 1500)
        : "";
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

    const weights = sanitizeWeights(body.weights);
    if (request.signal.aborted) {
      return new NextResponse(null, { status: 499 });
    }
    const { evaluatedByKey, topEvaluated, rankedEligible, bsbBenchmark } =
      await getEvaluatedSnapshot(
        weights,
        resolveEnabledHiddenCities({ enabledHiddenCities: body.enabledHiddenCities }),
        request.signal,
      );
    const evaluated =
      propertyKey !== "general"
        ? (evaluatedByKey.get(propertyKey) ?? null)
        : null;
    const rawSnapshotCityCode =
      body.propertySnapshot &&
      typeof body.propertySnapshot === "object" &&
      typeof body.propertySnapshot.cityCode === "string"
        ? body.propertySnapshot.cityCode.slice(0, 20)
        : null;
    const rawListing =
      propertyKey !== "general"
        ? findRawListingOnDisk(
            propertyKey,
            evaluated?.cityCode ?? rawSnapshotCityCode ?? null,
          )
        : null;

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

    const resolvedSnapshot: PropertyQuestionSnapshot = sanitizePropertySnapshot(
      body.propertySnapshot,
      defaultSnapshot,
    );

    const nowIso = new Date().toISOString();
    const itemId = `qa-${Date.now()}-${randomUUID().slice(0, 8)}`;

    let queuedToLocalCursor = false;
    const cursorQueueFile = getCardQuestionsQueueFile();
    if (cursorQueueFile) {
      try {
        appendFileSync(
          /*turbopackIgnore: true*/ cursorQueueFile,
          `${JSON.stringify({
            event: "HOUSING_QUESTION_RECEIVED",
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
      rankedEligible,
      bsbBenchmark,
      weights,
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
      awaitingDetailedAnswer: queuedToLocalCursor,
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
