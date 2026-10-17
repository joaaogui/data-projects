import type { EvaluatedProperty, PropertyQuestionSnapshot } from "@/types/housing";

export interface AdvertiserContact {
  name?: string | null;
  creci?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
}

export interface QaLlmPromptParams {
  question: string;
  propertyKey: string;
  snapshot: PropertyQuestionSnapshot;
  evaluated: EvaluatedProperty | null;
  rawSpecs: unknown;
  /** Only used to scrub the advertiser's identity from free text; never sent to the model. */
  advertiser?: AdvertiserContact | null;
  topEvaluated: EvaluatedProperty[];
  contextSummary?: string;
  queuedToLocalCursor?: boolean;
}

const REDACTED = "[contato do anunciante omitido]";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches a phone number however it's formatted (spaces, dashes, parentheses, +55). */
function phonePattern(raw: string): RegExp | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const local = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  const tail = local.slice(-8);
  return new RegExp(`(?:\\+?55[\\s.-]*)?(?:\\(?\\d{2}\\)?[\\s.-]*)?9?[\\s.-]*${tail.split("").join("[\\s.-]*")}`, "g");
}

export function redactAdvertiserContact(
  text: string,
  advertiser: AdvertiserContact | null | undefined,
): string {
  if (!advertiser) return text;
  let out = text;
  for (const phone of [advertiser.phone, advertiser.whatsapp]) {
    const pattern = phone ? phonePattern(phone) : null;
    if (pattern) out = out.replace(pattern, REDACTED);
  }
  const name = advertiser.name?.trim();
  if (name && name.length >= 3) {
    out = out.replace(new RegExp(escapeRegExp(name), "gi"), REDACTED);
  }
  return out;
}

/** System + user prompts for the listing Q&A model. Advertiser identity/contact never leaves the server. */
export function buildQaLlmPrompt(params: QaLlmPromptParams): {
  systemPrompt: string;
  userPrompt: string;
} {
  const contextPayload = {
    propertyKey: params.propertyKey,
    snapshot: params.snapshot,
    evaluatedBreakdown: params.snapshot.breakdown ?? params.evaluated?.breakdown ?? null,
    furnitureTier: params.snapshot.furnitureTier ?? params.evaluated?.furnitureTier ?? null,
    nuanceHighlights:
      params.snapshot.nuanceHighlights ?? params.evaluated?.nuanceHighlights ?? [],
    nuanceWarnings: params.snapshot.nuanceWarnings ?? params.evaluated?.nuanceWarnings ?? [],
    cardTags: params.evaluated?.cardTags ?? null,
    amenities: params.evaluated?.amenities ?? [],
    installations: params.evaluated?.installations ?? [],
    comfortCommodities: params.evaluated?.comfortCommodities ?? [],
    practicalityCommodities: params.evaluated?.practicalityCommodities ?? [],
    photoCaptions: params.evaluated?.photoCaptions ?? [],
    rawSpecs: params.rawSpecs ?? null,
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
    "Você é o Consultor Imobiliário Inteligente do Portal Housing 2026 (mudança de Brasília para BH, Campinas ou RJ próximo ao Nubank). " +
    "Responda em português de forma direta, objetiva, estruturada em tópicos curtos e 100% fundamentada nos dados reais do imóvel abaixo. " +
    "Cite números exatos (andar, R$ aluguel/condomínio/total, m², decomposição da nota, itens de mobília e comodidades)." +
    (params.queuedToLocalCursor
      ? " Se o usuário apontar um erro de cadastro ou pedir ajuste na regra de pontuação, confirme os dados brutos do anúncio e avise que a sessão ativa do Cursor também recebeu o alerta para atualizar o motor/dataset."
      : "");

  const userPrompt = redactAdvertiserContact(
    `Pergunta do usuário: "${params.question}"\n\nDados completos do imóvel e ranking:\n${JSON.stringify(contextPayload, null, 2)}`,
    params.advertiser,
  );

  return { systemPrompt, userPrompt };
}
