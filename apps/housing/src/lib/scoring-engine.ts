import type {
  CityHubCode,
  ComputedNeighborhood,
  EvaluatedProperty,
  FloorTag,
  FurnitureTier,
  ModernityTier,
  NeighborhoodEntry,
  ScoringWeights,
  SlimPropertyRecord,
} from "@/types/housing";
import {
  computeDistanceToNubankHubKm,
  findHospitalNoiseCluster,
  resolveNeighborhoodCenter,
} from "./geocoding";
import {
  IPTU_ESTIMATE_PER_M2,
  PROVIDER_LABELS,
  prepareListingsForScoring,
} from "./listing-normalization";
import { PHOTO_AUDIT_OVERRIDES, type PhotoAuditOverride } from "./photo-audit-overrides";

export const DEFAULT_WEIGHTS: ScoringWeights = {
  urbanBreathingWeight: 3.0,
  commuteLogisticsWeight: 1.0,
  buildingStockWeight: 2.0,
  budgetFitWeight: 1.0,
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
};

const WEIGHT_NUMERIC_BOUNDS: Record<
  Exclude<keyof ScoringWeights, "requireParking" | "penalizeMegaCondo">,
  { min: number; max: number }
> = {
  urbanBreathingWeight: { min: 0, max: 5 },
  commuteLogisticsWeight: { min: 0, max: 5 },
  buildingStockWeight: { min: 0, max: 5 },
  budgetFitWeight: { min: 0, max: 5 },
  safetyCarWeight: { min: 0, max: 5 },
  neighborhoodMultiplier: { min: 0, max: 15 },
  modernityMultiplier: { min: 0, max: 3 },
  nuancesMultiplier: { min: 0, max: 5 },
  minModernityScore: { min: 0, max: 100 },
  budgetIdeal: { min: 1500, max: 15000 },
  budgetMax: { min: 1500, max: 20000 },
  budgetHardCap: { min: 1500, max: 25000 },
  budgetWeight: { min: 0, max: 5 },
  unfurnishedBonus: { min: -50, max: 50 },
  furnishedPenalty: { min: -80, max: 20 },
  parkingBonus1: { min: -30, max: 40 },
  parkingBonus2: { min: -30, max: 50 },
  minAreaM2: { min: 20, max: 200 },
  maxAreaM2: { min: 25, max: 300 },
  sweetSpotMinM2: { min: 20, max: 250 },
  sweetSpotMaxM2: { min: 25, max: 300 },
};

export function sanitizeAndMigrateWeights(
  rawWeights: unknown,
  schemaVersion?: number,
): ScoringWeights {
  if (
    !rawWeights ||
    typeof rawWeights !== "object" ||
    Array.isArray(rawWeights)
  ) {
    return { ...DEFAULT_WEIGHTS };
  }

  const obj = rawWeights as Record<string, unknown>;
  const isV2 = schemaVersion === 2 || obj.schemaVersion === 2;

  const sanitizeNum = <
    K extends Exclude<
      keyof ScoringWeights,
      "requireParking" | "penalizeMegaCondo"
    >,
  >(
    key: K,
  ): number => {
    const val = obj[key];
    if (typeof val !== "number" || !Number.isFinite(val)) {
      return DEFAULT_WEIGHTS[key];
    }
    const bounds = WEIGHT_NUMERIC_BOUNDS[key];
    return Math.min(bounds.max, Math.max(bounds.min, val));
  };

  const result: ScoringWeights = {
    urbanBreathingWeight: sanitizeNum("urbanBreathingWeight"),
    commuteLogisticsWeight: sanitizeNum("commuteLogisticsWeight"),
    buildingStockWeight: sanitizeNum("buildingStockWeight"),
    budgetFitWeight: sanitizeNum("budgetFitWeight"),
    safetyCarWeight: sanitizeNum("safetyCarWeight"),
    neighborhoodMultiplier: sanitizeNum("neighborhoodMultiplier"),
    modernityMultiplier: sanitizeNum("modernityMultiplier"),
    nuancesMultiplier: sanitizeNum("nuancesMultiplier"),
    minModernityScore: sanitizeNum("minModernityScore"),
    budgetIdeal: sanitizeNum("budgetIdeal"),
    budgetMax: sanitizeNum("budgetMax"),
    budgetHardCap: sanitizeNum("budgetHardCap"),
    budgetWeight: sanitizeNum("budgetWeight"),
    unfurnishedBonus: sanitizeNum("unfurnishedBonus"),
    furnishedPenalty: sanitizeNum("furnishedPenalty"),
    parkingBonus1: sanitizeNum("parkingBonus1"),
    parkingBonus2: sanitizeNum("parkingBonus2"),
    requireParking:
      typeof obj.requireParking === "boolean"
        ? obj.requireParking
        : DEFAULT_WEIGHTS.requireParking,
    penalizeMegaCondo:
      typeof obj.penalizeMegaCondo === "boolean"
        ? obj.penalizeMegaCondo
        : DEFAULT_WEIGHTS.penalizeMegaCondo,
    minAreaM2: sanitizeNum("minAreaM2"),
    maxAreaM2: sanitizeNum("maxAreaM2"),
    sweetSpotMinM2: sanitizeNum("sweetSpotMinM2"),
    sweetSpotMaxM2: sanitizeNum("sweetSpotMaxM2"),
  };

  if (!isV2) {
    if (result.furnishedPenalty === -5) result.furnishedPenalty = -22;
    if (result.urbanBreathingWeight === 1) result.urbanBreathingWeight = 2;
    if (Math.abs(result.modernityMultiplier - 0.65) < 1e-6) {
      result.modernityMultiplier = 0.85;
    }
    if (result.sweetSpotMinM2 === 48) result.sweetSpotMinM2 = 50;
    if (result.sweetSpotMaxM2 === 68) result.sweetSpotMaxM2 = 72;
  }
  if (result.minAreaM2 === 40 || result.minAreaM2 === 45) {
    result.minAreaM2 = 35;
  }

  if (result.maxAreaM2 < result.minAreaM2) {
    result.maxAreaM2 = result.minAreaM2;
  }
  result.sweetSpotMinM2 = Math.min(
    result.maxAreaM2,
    Math.max(result.minAreaM2, result.sweetSpotMinM2),
  );
  result.sweetSpotMaxM2 = Math.min(
    result.maxAreaM2,
    Math.max(result.sweetSpotMinM2, result.sweetSpotMaxM2),
  );

  if (result.budgetMax < result.budgetIdeal) {
    result.budgetMax = result.budgetIdeal;
  }
  if (result.budgetHardCap < result.budgetMax) {
    result.budgetHardCap = result.budgetMax;
  }

  return result;
}

export const BUILTIN_PRESETS: {
  id: string;
  name: string;
  description: string;
  weights: ScoringWeights;
}[] = [
  {
    id: "perfeito",
    name: "✨ Perfeito (AC · Andar Alto · ≤ R$ 4.500 · ≤ 25 min · Seguro)",
    description:
      "Assinala os filtros ideais (Ar-condicionado, Andar Alto/Cobertura, pacote ≤ R$ 4.500, até 25 min do escritório, Não/Semi-mobiliado e Sem problemas de segurança) com pesos calibrados para segurança máxima e conforto.",
    weights: {
      ...DEFAULT_WEIGHTS,
      safetyCarWeight: 3.5,
      urbanBreathingWeight: 3.0,
      commuteLogisticsWeight: 1.8,
      buildingStockWeight: 2.2,
      budgetFitWeight: 1.5,
      budgetIdeal: 4200,
      budgetMax: 4500,
      budgetHardCap: 5000,
      unfurnishedBonus: 18,
      furnishedPenalty: -28,
    },
  },
  {
    id: "balanced-original",
    name: "Equilíbrio Original (Padrão)",
    description:
      "Pesos calibrados: Segurança (30%) e Respiração Urbana (30%) como fatores dominantes (3.0x), Estoque Predial (20%, 2.0x), Logística (10%, 1.0x) e Orçamento (10%, 1.0x).",
    weights: DEFAULT_WEIGHTS,
  },
  {
    id: "anti-velharia-max",
    name: "Foco Anti-Velharia Máximo",
    description:
      "Dobra o peso do Score de Modernidade (1.1x) e exige mínimo de 72/100 (apenas prédios novos ou 100% reformados), mantendo rigor em segurança.",
    weights: {
      ...DEFAULT_WEIGHTS,
      buildingStockWeight: 2.0,
      modernityMultiplier: 1.1,
      minModernityScore: 72,
      neighborhoodMultiplier: 5.0,
    },
  },
  {
    id: "nuances-conforto-max",
    name: "Nuances: Luz, Vista, Silêncio & Parques",
    description:
      "Dobra o peso das nuances individuais do imóvel (Sol da manhã, Vista livre, Rua silenciosa, Andar alto, Vaga livre e Parque próximo).",
    weights: {
      ...DEFAULT_WEIGHTS,
      nuancesMultiplier: 2.0,
      urbanBreathingWeight: 1.8,
      penalizeMegaCondo: true,
    },
  },
  {
    id: "logistica-nubank",
    name: "Logística Curta Nubank",
    description:
      "Prioriza tempo mínimo até o escritório sem abrir mão da trava de segurança na rua.",
    weights: {
      ...DEFAULT_WEIGHTS,
      commuteLogisticsWeight: 2.0,
      urbanBreathingWeight: 0.9,
      neighborhoodMultiplier: 7.0,
    },
  },
  {
    id: "economia-4k",
    name: "Economia Estrita (Até R$ 4.200)",
    description:
      "Trava o teto ideal em R$ 3.800 e limite máximo em R$ 4.200, dobrando o prêmio para imóveis econômicos.",
    weights: {
      ...DEFAULT_WEIGHTS,
      budgetFitWeight: 1.8,
      budgetIdeal: 3800,
      budgetMax: 4200,
      budgetHardCap: 4400,
      budgetWeight: 1.8,
    },
  },
];

export const WEIGHT_PRESETS = BUILTIN_PRESETS;

export interface NeighborhoodSafetyMetrics {
  cityCode: CityHubCode;
  commute: string;
  urbanBreathing: number;
  commuteLogistics: number;
  buildingStock: number;
  budgetFit: number;
  safetyCar: number;
}

export const NEIGHBORHOOD_SAFETY_AND_METRICS: Record<
  string,
  NeighborhoodSafetyMetrics
> = {
  // === RJ (Rio de Janeiro & Niterói) ===
  // Truly safe / high street walkability (safetyCar: 8.3–9.2)
  "RJ:Urca": { cityCode: "RJ", commute: "15-20 min do Nubank", urbanBreathing: 9.4, commuteLogistics: 7.8, buildingStock: 5.8, budgetFit: 5.5, safetyCar: 9.2 },
  "RJ:Leblon": { cityCode: "RJ", commute: "25-35 min do Nubank", urbanBreathing: 9.5, commuteLogistics: 6.5, buildingStock: 6.2, budgetFit: 4.5, safetyCar: 8.9 },
  "RJ:Ipanema": { cityCode: "RJ", commute: "25-30 min do Nubank", urbanBreathing: 9.4, commuteLogistics: 6.8, buildingStock: 6.0, budgetFit: 4.8, safetyCar: 8.7 },
  "RJ:Jardim Botânico": { cityCode: "RJ", commute: "20-30 min do Nubank via Rebouças", urbanBreathing: 9.5, commuteLogistics: 7.2, buildingStock: 6.2, budgetFit: 5.2, safetyCar: 8.6 },
  "RJ:Gávea": { cityCode: "RJ", commute: "25-35 min do Nubank via Rebouças", urbanBreathing: 9.3, commuteLogistics: 6.8, buildingStock: 6.0, budgetFit: 5.2, safetyCar: 8.6 },
  "RJ:Lagoa": { cityCode: "RJ", commute: "20-28 min do Nubank via Rebouças", urbanBreathing: 9.5, commuteLogistics: 7.2, buildingStock: 6.5, budgetFit: 5.2, safetyCar: 8.6 },
  "RJ:Arpoador": { cityCode: "RJ", commute: "25-30 min do Nubank", urbanBreathing: 9.4, commuteLogistics: 6.8, buildingStock: 5.8, budgetFit: 5.0, safetyCar: 8.5 },
  "RJ:Icaraí": { cityCode: "RJ", commute: "35-45 min do Nubank via Ponte", urbanBreathing: 8.6, commuteLogistics: 5.8, buildingStock: 8.4, budgetFit: 8.2, safetyCar: 8.3 },
  "RJ:Jd. Oceânico": { cityCode: "RJ", commute: "60-90 min do Nubank", urbanBreathing: 9.4, commuteLogistics: 2.5, buildingStock: 8.8, budgetFit: 7.5, safetyCar: 8.0 },
  "RJ:Jardim Oceânico": { cityCode: "RJ", commute: "60-90 min do Nubank", urbanBreathing: 9.4, commuteLogistics: 2.5, buildingStock: 8.8, budgetFit: 7.5, safetyCar: 8.0 },
  "RJ:Jardim Oceanico": { cityCode: "RJ", commute: "60-90 min do Nubank", urbanBreathing: 9.4, commuteLogistics: 2.5, buildingStock: 8.8, budgetFit: 7.5, safetyCar: 8.0 },
  "RJ:Barra da Tijuca": { cityCode: "RJ", commute: "60-90 min do Nubank", urbanBreathing: 9.4, commuteLogistics: 2.5, buildingStock: 8.8, budgetFit: 7.5, safetyCar: 8.0 },
  // Moderate-good Zona Sul / Niterói (safetyCar: 7.0–8.3)
  "RJ:Laranjeiras": { cityCode: "RJ", commute: "15-20 min do Nubank", urbanBreathing: 8.8, commuteLogistics: 8.5, buildingStock: 7.5, budgetFit: 7.8, safetyCar: 8.3 },
  "RJ:Humaitá": { cityCode: "RJ", commute: "20 min do Nubank via Túnel Rebouças", urbanBreathing: 8.5, commuteLogistics: 8.2, buildingStock: 7.2, budgetFit: 7.0, safetyCar: 8.2 },
  "RJ:Flamengo": { cityCode: "RJ", commute: "15 min do Nubank (Porto Maravilha)", urbanBreathing: 9.6, commuteLogistics: 9.2, buildingStock: 6.8, budgetFit: 6.8, safetyCar: 8.1 },
  "RJ:Botafogo": { cityCode: "RJ", commute: "10-15 min do Nubank (Porto Maravilha)", urbanBreathing: 8.2, commuteLogistics: 9.0, buildingStock: 7.6, budgetFit: 7.2, safetyCar: 8.0 },
  "RJ:Botafogo (Orla)": { cityCode: "RJ", commute: "10-15 min do Nubank (Porto Maravilha)", urbanBreathing: 8.2, commuteLogistics: 9.0, buildingStock: 7.6, budgetFit: 7.2, safetyCar: 8.0 },
  "RJ:Leme": { cityCode: "RJ", commute: "20-25 min do Nubank", urbanBreathing: 9.0, commuteLogistics: 8.0, buildingStock: 5.5, budgetFit: 6.2, safetyCar: 7.8 },
  "RJ:Ingá": { cityCode: "RJ", commute: "30-40 min do Nubank via Ponte", urbanBreathing: 8.0, commuteLogistics: 6.0, buildingStock: 7.8, budgetFit: 8.2, safetyCar: 7.8 },
  "RJ:Santa Rosa": { cityCode: "RJ", commute: "35-45 min do Nubank via Ponte", urbanBreathing: 7.8, commuteLogistics: 5.6, buildingStock: 8.2, budgetFit: 8.4, safetyCar: 7.6 },
  "RJ:São Domingos": { cityCode: "RJ", commute: "30-35 min do Nubank via Ponte", urbanBreathing: 7.8, commuteLogistics: 6.0, buildingStock: 7.5, budgetFit: 8.0, safetyCar: 7.6 },
  "RJ:Cosme Velho": { cityCode: "RJ", commute: "18-22 min do Nubank", urbanBreathing: 8.2, commuteLogistics: 7.8, buildingStock: 5.8, budgetFit: 6.8, safetyCar: 7.5 },
  "RJ:Copacabana": { cityCode: "RJ", commute: "20-25 min do Nubank", urbanBreathing: 7.5, commuteLogistics: 7.8, buildingStock: 5.5, budgetFit: 6.2, safetyCar: 7.0 },
  // Transition / Center-South (safetyCar: 5.6–6.4)
  "RJ:Catete": { cityCode: "RJ", commute: "10-12 min do Nubank (Porto Maravilha)", urbanBreathing: 7.2, commuteLogistics: 9.2, buildingStock: 5.8, budgetFit: 7.4, safetyCar: 6.3 },
  "RJ:Glória": { cityCode: "RJ", commute: "8-10 min do Nubank (Porto Maravilha)", urbanBreathing: 8.2, commuteLogistics: 9.4, buildingStock: 5.8, budgetFit: 7.2, safetyCar: 6.0 },
  "RJ:Santa Teresa": { cityCode: "RJ", commute: "12-18 min do Nubank", urbanBreathing: 7.8, commuteLogistics: 8.0, buildingStock: 5.0, budgetFit: 7.2, safetyCar: 5.6 },
  // High street insecurity / "sair do condomínio já exige alerta máximo" (safetyCar: 3.5–5.2)
  "RJ:Tijuca": { cityCode: "RJ", commute: "20-30 min do Nubank (Porto Maravilha)", urbanBreathing: 6.8, commuteLogistics: 8.0, buildingStock: 7.2, budgetFit: 8.8, safetyCar: 4.8 },
  "RJ:Tijuca (Pç Uruguai)": { cityCode: "RJ", commute: "20-30 min do Nubank (Porto Maravilha)", urbanBreathing: 6.8, commuteLogistics: 8.0, buildingStock: 7.2, budgetFit: 8.8, safetyCar: 4.8 },
  "RJ:Grajaú": { cityCode: "RJ", commute: "25-35 min do Nubank", urbanBreathing: 7.2, commuteLogistics: 7.2, buildingStock: 6.5, budgetFit: 8.5, safetyCar: 4.8 },
  "RJ:Grajau": { cityCode: "RJ", commute: "25-35 min do Nubank", urbanBreathing: 7.2, commuteLogistics: 7.2, buildingStock: 6.5, budgetFit: 8.5, safetyCar: 4.8 },
  "RJ:Saúde": { cityCode: "RJ", commute: "5-8 min do Nubank (Porto Maravilha)", urbanBreathing: 5.5, commuteLogistics: 9.6, buildingStock: 6.5, budgetFit: 8.2, safetyCar: 4.5 },
  "RJ:Fátima": { cityCode: "RJ", commute: "10-12 min do Nubank", urbanBreathing: 5.8, commuteLogistics: 8.8, buildingStock: 5.8, budgetFit: 8.0, safetyCar: 4.5 },
  "RJ:Maracanã": { cityCode: "RJ", commute: "15-25 min do Nubank", urbanBreathing: 6.2, commuteLogistics: 8.2, buildingStock: 6.8, budgetFit: 8.5, safetyCar: 4.2 },
  "RJ:Vila Isabel": { cityCode: "RJ", commute: "20-30 min do Nubank", urbanBreathing: 6.4, commuteLogistics: 7.6, buildingStock: 6.8, budgetFit: 8.6, safetyCar: 4.2 },
  "RJ:Santo Cristo": { cityCode: "RJ", commute: "5 min do Nubank (Porto Maravilha)", urbanBreathing: 5.8, commuteLogistics: 9.8, buildingStock: 8.5, budgetFit: 8.4, safetyCar: 4.2 },
  "RJ:Centro": { cityCode: "RJ", commute: "5-10 min do Nubank (Porto Maravilha)", urbanBreathing: 5.0, commuteLogistics: 9.5, buildingStock: 6.5, budgetFit: 8.2, safetyCar: 4.2 },
  "RJ:Andaraí": { cityCode: "RJ", commute: "25-35 min do Nubank", urbanBreathing: 6.0, commuteLogistics: 7.4, buildingStock: 6.5, budgetFit: 8.6, safetyCar: 4.0 },
  "RJ:Cidade Nova": { cityCode: "RJ", commute: "8-12 min do Nubank", urbanBreathing: 5.2, commuteLogistics: 9.2, buildingStock: 6.5, budgetFit: 8.4, safetyCar: 4.0 },
  "RJ:Gamboa": { cityCode: "RJ", commute: "5 min do Nubank (Porto Maravilha)", urbanBreathing: 5.4, commuteLogistics: 9.6, buildingStock: 7.0, budgetFit: 8.4, safetyCar: 4.0 },
  "RJ:Lapa": { cityCode: "RJ", commute: "8-12 min do Nubank", urbanBreathing: 5.2, commuteLogistics: 9.2, buildingStock: 5.8, budgetFit: 8.0, safetyCar: 4.0 },
  "RJ:Rio Comprido": { cityCode: "RJ", commute: "10-15 min do Nubank", urbanBreathing: 5.5, commuteLogistics: 8.8, buildingStock: 6.5, budgetFit: 8.5, safetyCar: 3.8 },
  "RJ:Catumbi": { cityCode: "RJ", commute: "10-12 min do Nubank", urbanBreathing: 5.2, commuteLogistics: 8.8, buildingStock: 5.8, budgetFit: 8.4, safetyCar: 3.8 },
  "RJ:São Cristóvão": { cityCode: "RJ", commute: "10-15 min do Nubank", urbanBreathing: 5.5, commuteLogistics: 8.8, buildingStock: 6.2, budgetFit: 8.5, safetyCar: 3.8 },
  "RJ:Praça da Bandeira": { cityCode: "RJ", commute: "10-15 min do Nubank", urbanBreathing: 5.2, commuteLogistics: 8.8, buildingStock: 6.0, budgetFit: 8.5, safetyCar: 3.8 },
  "RJ:Estácio": { cityCode: "RJ", commute: "10-15 min do Nubank", urbanBreathing: 5.2, commuteLogistics: 8.8, buildingStock: 6.0, budgetFit: 8.5, safetyCar: 3.5 },

  // === BH (Belo Horizonte & Nova Lima) ===
  // Truly safe Zona Sul / Nova Lima (safetyCar: 8.3–9.6)
  "BH:Lourdes": { cityCode: "BH", commute: "15 min do Nubank", urbanBreathing: 9.6, commuteLogistics: 9.3, buildingStock: 9.5, budgetFit: 9.0, safetyCar: 9.6 },
  "BH:Funcionários": { cityCode: "BH", commute: "10 min do Nubank", urbanBreathing: 9.5, commuteLogistics: 9.8, buildingStock: 8.8, budgetFit: 9.2, safetyCar: 9.1 },
  // Belvedere / Vale do Sereno / Vila da Serra share the BR-356 / N. Sra. do Carmo peak bottleneck (like Buritis' single exit).
  "BH:Belvedere": { cityCode: "BH", commute: "25-45 min do Nubank (gargalo BR-356 no pico)", urbanBreathing: 8.8, commuteLogistics: 5.6, buildingStock: 6.0, budgetFit: 5.5, safetyCar: 9.0 },
  "BH:Vale do Sereno": { cityCode: "BH", commute: "30-50 min do Nubank (gargalo BR-356 no pico)", urbanBreathing: 9.2, commuteLogistics: 5.0, buildingStock: 8.8, budgetFit: 7.6, safetyCar: 9.0 },
  "BH:Santo Agostinho": { cityCode: "BH", commute: "15 min do Nubank", urbanBreathing: 8.6, commuteLogistics: 8.8, buildingStock: 8.6, budgetFit: 8.4, safetyCar: 8.9 },
  "BH:Anchieta": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 8.6, commuteLogistics: 8.5, buildingStock: 8.2, budgetFit: 8.0, safetyCar: 8.9 },
  "BH:Savassi": { cityCode: "BH", commute: "10-12 min do Nubank", urbanBreathing: 8.9, commuteLogistics: 9.5, buildingStock: 8.6, budgetFit: 8.6, safetyCar: 8.8 },
  "BH:Sion": { cityCode: "BH", commute: "15-20 min do Nubank", urbanBreathing: 8.7, commuteLogistics: 8.4, buildingStock: 8.0, budgetFit: 9.2, safetyCar: 8.8 },
  "BH:Carmo": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 8.8, commuteLogistics: 8.8, buildingStock: 8.6, budgetFit: 8.8, safetyCar: 8.8 },
  "BH:Santo Antônio": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 8.6, commuteLogistics: 8.8, buildingStock: 8.5, budgetFit: 8.8, safetyCar: 8.7 },
  "BH:Cruzeiro": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 8.5, buildingStock: 8.0, budgetFit: 8.2, safetyCar: 8.7 },
  "BH:Vila da Serra": { cityCode: "BH", commute: "30-50 min do Nubank (gargalo BR-356/N. Sra. do Carmo no pico)", urbanBreathing: 9.2, commuteLogistics: 5.2, buildingStock: 8.8, budgetFit: 7.8, safetyCar: 8.7 },
  "BH:Cidade Jardim": { cityCode: "BH", commute: "18-22 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 7.6, buildingStock: 7.5, budgetFit: 8.0, safetyCar: 8.6 },
  "BH:Vila Paris": { cityCode: "BH", commute: "18-22 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 7.6, buildingStock: 8.0, budgetFit: 8.0, safetyCar: 8.6 },
  "BH:Gutierrez": { cityCode: "BH", commute: "18-22 min do Nubank", urbanBreathing: 8.0, commuteLogistics: 7.8, buildingStock: 8.0, budgetFit: 8.2, safetyCar: 8.5 },
  "BH:Mangabeiras": { cityCode: "BH", commute: "15-20 min do Nubank", urbanBreathing: 9.0, commuteLogistics: 8.0, buildingStock: 7.5, budgetFit: 7.5, safetyCar: 8.5 },
  "BH:São Pedro": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 8.6, buildingStock: 8.0, budgetFit: 8.0, safetyCar: 8.4 },
  "BH:Luxemburgo": { cityCode: "BH", commute: "18-22 min do Nubank", urbanBreathing: 8.2, commuteLogistics: 7.6, buildingStock: 8.2, budgetFit: 8.2, safetyCar: 8.4 },
  "BH:Santa Lúcia": { cityCode: "BH", commute: "18-25 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 7.4, buildingStock: 8.0, budgetFit: 8.0, safetyCar: 8.4 },
  "BH:Serra": { cityCode: "BH", commute: "10-12 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 9.0, buildingStock: 8.0, budgetFit: 8.2, safetyCar: 8.3 },
  "BH:Buritis": { cityCode: "BH", commute: "35-45 min do Nubank (saída única com gargalo no pico)", urbanBreathing: 7.8, commuteLogistics: 4.8, buildingStock: 8.4, budgetFit: 8.8, safetyCar: 8.3 },
  // Transition / Near Nubank & Central BH
  "BH:Santa Efigênia": { cityCode: "BH", commute: "5 min do Nubank (mesmo bairro)", urbanBreathing: 8.6, commuteLogistics: 9.9, buildingStock: 9.2, budgetFit: 9.4, safetyCar: 7.8 },
  "BH:Boa Viagem": { cityCode: "BH", commute: "8-12 min do Nubank", urbanBreathing: 7.6, commuteLogistics: 9.2, buildingStock: 7.5, budgetFit: 8.4, safetyCar: 7.6 },
  "BH:Prado": { cityCode: "BH", commute: "15-20 min do Nubank", urbanBreathing: 7.4, commuteLogistics: 8.2, buildingStock: 7.6, budgetFit: 8.4, safetyCar: 7.5 },
  "BH:Floresta": { cityCode: "BH", commute: "8-10 min do Nubank", urbanBreathing: 7.0, commuteLogistics: 9.2, buildingStock: 6.8, budgetFit: 8.4, safetyCar: 7.0 },
  "BH:Barro Preto": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 6.8, commuteLogistics: 8.8, buildingStock: 7.0, budgetFit: 8.4, safetyCar: 7.0 },
  "BH:Carlos Prates": { cityCode: "BH", commute: "15-20 min do Nubank", urbanBreathing: 6.4, commuteLogistics: 8.2, buildingStock: 6.8, budgetFit: 8.6, safetyCar: 6.5 },
  "BH:Centro": { cityCode: "BH", commute: "10 min do Nubank", urbanBreathing: 5.5, commuteLogistics: 9.2, buildingStock: 6.8, budgetFit: 8.6, safetyCar: 5.2 },
  "BH:Lagoinha": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 5.0, commuteLogistics: 8.6, buildingStock: 5.8, budgetFit: 8.6, safetyCar: 4.2 },

  // === CP (Campinas) ===
  "CP:Nova Campinas": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 8.2, commuteLogistics: 8.2, buildingStock: 6.5, budgetFit: 6.2, safetyCar: 9.1 },
  "CP:Gramado": { cityCode: "CP", commute: "25-30 min do Nubank (Viracopos)", urbanBreathing: 8.8, commuteLogistics: 7.4, buildingStock: 7.8, budgetFit: 7.0, safetyCar: 9.0 },
  "CP:Cambuí": { cityCode: "CP", commute: "25-30 min do Nubank (Viracopos)", urbanBreathing: 6.2, commuteLogistics: 7.8, buildingStock: 8.8, budgetFit: 6.5, safetyCar: 8.7 },
  "CP:Taquaral": { cityCode: "CP", commute: "35-40 min do Nubank (Viracopos)", urbanBreathing: 9.6, commuteLogistics: 7.5, buildingStock: 9.2, budgetFit: 9.4, safetyCar: 8.6 },
  "CP:Parque Taquaral": { cityCode: "CP", commute: "35-40 min do Nubank (Viracopos)", urbanBreathing: 9.6, commuteLogistics: 7.5, buildingStock: 9.2, budgetFit: 9.4, safetyCar: 8.6 },
  "CP:Mansões Santo Antônio": { cityCode: "CP", commute: "30-35 min do Nubank (Viracopos)", urbanBreathing: 8.0, commuteLogistics: 7.2, buildingStock: 8.6, budgetFit: 8.6, safetyCar: 8.6 },
  "CP:Jd. Guanabara": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 7.2, commuteLogistics: 8.4, buildingStock: 8.6, budgetFit: 9.0, safetyCar: 8.5 },
  "CP:Jardim Guanabara": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 7.2, commuteLogistics: 8.4, buildingStock: 8.6, budgetFit: 9.0, safetyCar: 8.5 },
  "CP:Guanabara": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 7.2, commuteLogistics: 8.4, buildingStock: 8.6, budgetFit: 9.0, safetyCar: 8.5 },
  "CP:Chácara Primavera": { cityCode: "CP", commute: "30-35 min do Nubank (Viracopos)", urbanBreathing: 8.2, commuteLogistics: 7.4, buildingStock: 8.4, budgetFit: 8.4, safetyCar: 8.5 },
  "CP:Chácara da Barra": { cityCode: "CP", commute: "25-30 min do Nubank (Viracopos)", urbanBreathing: 8.2, commuteLogistics: 7.6, buildingStock: 8.2, budgetFit: 8.2, safetyCar: 8.5 },
  "CP:Jd. Chapadão": { cityCode: "CP", commute: "30-35 min do Nubank (Viracopos)", urbanBreathing: 7.8, commuteLogistics: 6.5, buildingStock: 6.5, budgetFit: 7.8, safetyCar: 8.5 },
  "CP:Jardim Chapadão": { cityCode: "CP", commute: "30-35 min do Nubank (Viracopos)", urbanBreathing: 7.8, commuteLogistics: 6.5, buildingStock: 6.5, budgetFit: 7.8, safetyCar: 8.5 },
  "CP:Castelo": { cityCode: "CP", commute: "30-35 min do Nubank (Viracopos)", urbanBreathing: 7.8, commuteLogistics: 6.5, buildingStock: 6.8, budgetFit: 8.0, safetyCar: 8.4 },
  "CP:Parque Prado": { cityCode: "CP", commute: "15 min do Nubank (Viracopos)", urbanBreathing: 7.2, commuteLogistics: 9.4, buildingStock: 7.5, budgetFit: 8.5, safetyCar: 8.5 },
  "CP:Vila Itapura": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 7.2, commuteLogistics: 8.0, buildingStock: 7.8, budgetFit: 8.2, safetyCar: 8.0 },
  "CP:Jardim Proença": { cityCode: "CP", commute: "15-20 min do Nubank (Viracopos)", urbanBreathing: 7.6, commuteLogistics: 8.8, buildingStock: 7.6, budgetFit: 8.2, safetyCar: 8.0 },
  "CP:Bosque": { cityCode: "CP", commute: "15-20 min do Nubank (Viracopos)", urbanBreathing: 7.4, commuteLogistics: 8.8, buildingStock: 8.2, budgetFit: 8.5, safetyCar: 8.5 },
  "CP:Botafogo": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 6.4, commuteLogistics: 8.0, buildingStock: 7.2, budgetFit: 8.6, safetyCar: 6.8 },
  "CP:Centro": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 5.5, commuteLogistics: 8.2, buildingStock: 6.5, budgetFit: 8.8, safetyCar: 5.5 },

  // === SP (São Paulo Capital) ===
  "SP:Vila Nova Conceição": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 9.2, commuteLogistics: 7.8, buildingStock: 6.5, budgetFit: 4.5, safetyCar: 8.9 },
  "SP:Jardim América": { cityCode: "SP", commute: "10-20 min do Nubank (Pinheiros)", urbanBreathing: 9.0, commuteLogistics: 8.8, buildingStock: 6.8, budgetFit: 5.2, safetyCar: 8.8 },
  "SP:Jardim America": { cityCode: "SP", commute: "10-20 min do Nubank (Pinheiros)", urbanBreathing: 9.0, commuteLogistics: 8.8, buildingStock: 6.8, budgetFit: 5.2, safetyCar: 8.8 },
  "SP:Moema": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 8.8, commuteLogistics: 7.8, buildingStock: 8.2, budgetFit: 7.8, safetyCar: 8.7 },
  "SP:Indianópolis": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 8.8, commuteLogistics: 7.8, buildingStock: 8.2, budgetFit: 7.8, safetyCar: 8.7 },
  "SP:Vila Uberabinha": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 8.5, commuteLogistics: 7.8, buildingStock: 8.2, budgetFit: 8.0, safetyCar: 8.6 },
  "SP:Jardim Paulista": { cityCode: "SP", commute: "15-25 min do Nubank (Pinheiros)", urbanBreathing: 8.0, commuteLogistics: 8.5, buildingStock: 7.0, budgetFit: 6.8, safetyCar: 8.6 },
  "SP:Jardins": { cityCode: "SP", commute: "15-25 min do Nubank (Pinheiros)", urbanBreathing: 8.0, commuteLogistics: 8.5, buildingStock: 7.0, budgetFit: 6.8, safetyCar: 8.6 },
  "SP:Paraíso": { cityCode: "SP", commute: "25-35 min do Nubank (Pinheiros)", urbanBreathing: 7.6, commuteLogistics: 7.4, buildingStock: 7.8, budgetFit: 7.0, safetyCar: 8.4 },
  "SP:Alto de Pinheiros": { cityCode: "SP", commute: "15-25 min do Nubank (Pinheiros)", urbanBreathing: 9.2, commuteLogistics: 8.5, buildingStock: 5.5, budgetFit: 5.0, safetyCar: 8.4 },
  "SP:Itaim Bibi": { cityCode: "SP", commute: "15-25 min do Nubank (Pinheiros)", urbanBreathing: 6.8, commuteLogistics: 8.4, buildingStock: 7.0, budgetFit: 4.8, safetyCar: 8.3 },
  "SP:Vila Mariana": { cityCode: "SP", commute: "30-40 min do Nubank (Pinheiros)", urbanBreathing: 6.2, commuteLogistics: 5.8, buildingStock: 7.5, budgetFit: 7.2, safetyCar: 8.3 },
  "SP:Vila Clementino": { cityCode: "SP", commute: "25-35 min do Nubank (Pinheiros)", urbanBreathing: 6.8, commuteLogistics: 6.5, buildingStock: 7.6, budgetFit: 7.4, safetyCar: 8.3 },
  "SP:Chácara Klabin": { cityCode: "SP", commute: "30-40 min do Nubank (Pinheiros)", urbanBreathing: 7.2, commuteLogistics: 5.8, buildingStock: 8.0, budgetFit: 7.2, safetyCar: 8.4 },
  "SP:Vila Olímpia": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 6.8, commuteLogistics: 8.0, buildingStock: 7.8, budgetFit: 5.8, safetyCar: 8.2 },
  "SP:Vila Olimpia": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 6.8, commuteLogistics: 8.0, buildingStock: 7.8, budgetFit: 5.8, safetyCar: 8.2 },
  "SP:Perdizes": { cityCode: "SP", commute: "15-25 min do Nubank (Pinheiros)", urbanBreathing: 7.0, commuteLogistics: 8.0, buildingStock: 6.8, budgetFit: 6.5, safetyCar: 8.2 },
  "SP:Pompeia": { cityCode: "SP", commute: "15-25 min do Nubank (Pinheiros)", urbanBreathing: 6.8, commuteLogistics: 8.0, buildingStock: 7.0, budgetFit: 6.8, safetyCar: 8.1 },
  "SP:Pompéia": { cityCode: "SP", commute: "15-25 min do Nubank (Pinheiros)", urbanBreathing: 6.8, commuteLogistics: 8.0, buildingStock: 7.0, budgetFit: 6.8, safetyCar: 8.1 },
  "SP:Vila Pompéia": { cityCode: "SP", commute: "15-25 min do Nubank (Pinheiros)", urbanBreathing: 6.8, commuteLogistics: 8.0, buildingStock: 7.0, budgetFit: 6.8, safetyCar: 8.1 },
  "SP:Higienópolis": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 7.8, commuteLogistics: 7.5, buildingStock: 6.5, budgetFit: 6.5, safetyCar: 8.1 },
  "SP:Cerqueira César": { cityCode: "SP", commute: "15-20 min do Nubank (Pinheiros)", urbanBreathing: 7.4, commuteLogistics: 8.6, buildingStock: 7.0, budgetFit: 6.2, safetyCar: 8.2 },
  "SP:Brooklin": { cityCode: "SP", commute: "25-40 min do Nubank (Pinheiros)", urbanBreathing: 7.5, commuteLogistics: 6.8, buildingStock: 7.8, budgetFit: 5.8, safetyCar: 8.0 },
  "SP:Brooklin Paulista": { cityCode: "SP", commute: "25-40 min do Nubank (Pinheiros)", urbanBreathing: 7.5, commuteLogistics: 6.8, buildingStock: 7.8, budgetFit: 5.8, safetyCar: 8.0 },
  "SP:Brooklin Novo": { cityCode: "SP", commute: "25-40 min do Nubank (Pinheiros)", urbanBreathing: 7.5, commuteLogistics: 6.8, buildingStock: 7.8, budgetFit: 5.8, safetyCar: 8.0 },
  "SP:Sumaré": { cityCode: "SP", commute: "10-20 min do Nubank (Pinheiros)", urbanBreathing: 8.0, commuteLogistics: 8.5, buildingStock: 6.0, budgetFit: 6.5, safetyCar: 7.8 },
  "SP:Sumarezinho": { cityCode: "SP", commute: "10-20 min do Nubank (Pinheiros)", urbanBreathing: 7.6, commuteLogistics: 8.6, buildingStock: 6.5, budgetFit: 6.8, safetyCar: 7.8 },
  "SP:Pinheiros": { cityCode: "SP", commute: "5-15 min do Nubank (Capote Valente)", urbanBreathing: 6.2, commuteLogistics: 9.8, buildingStock: 7.2, budgetFit: 5.2, safetyCar: 7.6 },
  "SP:Vila Madalena": { cityCode: "SP", commute: "10-15 min do Nubank (Pinheiros)", urbanBreathing: 7.4, commuteLogistics: 9.0, buildingStock: 6.8, budgetFit: 5.8, safetyCar: 7.5 },
  "SP:Aclimação": { cityCode: "SP", commute: "30-40 min do Nubank (Pinheiros)", urbanBreathing: 7.4, commuteLogistics: 6.0, buildingStock: 7.0, budgetFit: 7.4, safetyCar: 7.6 },
  "SP:Consolação": { cityCode: "SP", commute: "15-25 min do Nubank (Pinheiros)", urbanBreathing: 6.2, commuteLogistics: 8.2, buildingStock: 7.0, budgetFit: 7.2, safetyCar: 6.8 },
  "SP:Bela Vista": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 6.0, commuteLogistics: 7.8, buildingStock: 6.8, budgetFit: 7.6, safetyCar: 6.5 },
  "SP:Santa Cecília": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 5.8, commuteLogistics: 7.4, buildingStock: 6.5, budgetFit: 7.8, safetyCar: 5.8 },
  "SP:Liberdade": { cityCode: "SP", commute: "30-40 min do Nubank (Pinheiros)", urbanBreathing: 5.5, commuteLogistics: 6.5, buildingStock: 6.2, budgetFit: 8.0, safetyCar: 5.8 },
  "SP:Brás": { cityCode: "SP", commute: "35-50 min do Nubank (Pinheiros)", urbanBreathing: 4.8, commuteLogistics: 5.5, buildingStock: 6.8, budgetFit: 8.4, safetyCar: 4.5 },
  "SP:República": { cityCode: "SP", commute: "25-35 min do Nubank (Pinheiros)", urbanBreathing: 5.0, commuteLogistics: 7.2, buildingStock: 6.0, budgetFit: 8.4, safetyCar: 4.2 },
  "SP:Sé": { cityCode: "SP", commute: "30-40 min do Nubank (Pinheiros)", urbanBreathing: 4.5, commuteLogistics: 6.8, buildingStock: 5.5, budgetFit: 8.4, safetyCar: 3.8 },
  "SP:Centro": { cityCode: "SP", commute: "25-40 min do Nubank (Pinheiros)", urbanBreathing: 4.8, commuteLogistics: 7.0, buildingStock: 5.8, budgetFit: 8.4, safetyCar: 3.8 },
  "SP:Campos Elíseos": { cityCode: "SP", commute: "25-35 min do Nubank (Pinheiros)", urbanBreathing: 4.5, commuteLogistics: 7.0, buildingStock: 5.5, budgetFit: 8.6, safetyCar: 3.5 },

  // === BSB (Águas Claras, Brasília - DF — Benchmark de Referência Atual) ===
  "BSB:Águas Claras": { cityCode: "BSB", commute: "Benchmark Referência Atual (Águas Claras - DF)", urbanBreathing: 8.5, commuteLogistics: 8.5, buildingStock: 9.2, budgetFit: 9.2, safetyCar: 8.8 },
  "BSB:Aguas Claras": { cityCode: "BSB", commute: "Benchmark Referência Atual (Águas Claras - DF)", urbanBreathing: 8.5, commuteLogistics: 8.5, buildingStock: 9.2, budgetFit: 9.2, safetyCar: 8.8 },
  "BSB:Norte (Águas Claras)": { cityCode: "BSB", commute: "Benchmark Referência Atual (Águas Claras Norte - DF)", urbanBreathing: 8.6, commuteLogistics: 8.5, buildingStock: 9.3, budgetFit: 9.2, safetyCar: 8.8 },
  "BSB:Sul (Águas Claras)": { cityCode: "BSB", commute: "Benchmark Referência Atual (Águas Claras Sul - DF)", urbanBreathing: 8.5, commuteLogistics: 8.5, buildingStock: 9.2, budgetFit: 9.2, safetyCar: 8.8 },
  "BSB:Águas Claras Norte": { cityCode: "BSB", commute: "Benchmark Referência Atual (Águas Claras Norte - DF)", urbanBreathing: 8.6, commuteLogistics: 8.5, buildingStock: 9.3, budgetFit: 9.2, safetyCar: 8.8 },
  "BSB:Águas Claras Sul": { cityCode: "BSB", commute: "Benchmark Referência Atual (Águas Claras Sul - DF)", urbanBreathing: 8.5, commuteLogistics: 8.5, buildingStock: 9.2, budgetFit: 9.2, safetyCar: 8.8 },
};

const NORMALIZED_NEIGHBORHOOD_METRICS = new Map<
  string,
  NeighborhoodSafetyMetrics
>();
for (const [key, val] of Object.entries(NEIGHBORHOOD_SAFETY_AND_METRICS)) {
  NORMALIZED_NEIGHBORHOOD_METRICS.set(key.toLowerCase(), val);
}

export function resolveNeighborhoodSafetyAndMetrics(
  cityCode: CityHubCode,
  neighborhood: string,
): NeighborhoodSafetyMetrics | undefined {
  const trimmed = neighborhood.trim();
  const norm = normalizeNeighborhoodKey(trimmed, cityCode);
  return (
    NORMALIZED_NEIGHBORHOOD_METRICS.get(
      `${cityCode}:${trimmed}`.toLowerCase(),
    ) ??
    NORMALIZED_NEIGHBORHOOD_METRICS.get(`${cityCode}:${norm}`.toLowerCase())
  );
}

export function computeWeightedNeighborhoodScore(
  scores: {
    urbanBreathing: number;
    commuteLogistics: number;
    buildingStock: number;
    budgetFit: number;
    safetyCar: number;
  },
  weights: ScoringWeights,
): number {
  const wSum =
    weights.urbanBreathingWeight +
    weights.commuteLogisticsWeight +
    weights.buildingStockWeight +
    weights.budgetFitWeight +
    weights.safetyCarWeight;

  if (wSum <= 0) return 7.0;

  const weighted =
    (scores.urbanBreathing * weights.urbanBreathingWeight +
      scores.commuteLogistics * weights.commuteLogisticsWeight +
      scores.buildingStock * weights.buildingStockWeight +
      scores.budgetFit * weights.budgetFitWeight +
      scores.safetyCar * weights.safetyCarWeight) /
    wSum;

  const safetyScale = Math.min(1, Math.max(0, weights.safetyCarWeight));
  let streetSafetyDelta = 0;
  if (scores.safetyCar >= 8.5) {
    streetSafetyDelta = 0.3 * safetyScale;
  } else if (scores.safetyCar < 8.0) {
    streetSafetyDelta = -(8.0 - scores.safetyCar) * 0.85 * safetyScale;
    if (scores.safetyCar < 6.5) {
      streetSafetyDelta -= 1.2 * safetyScale;
    }
  }

  const commuteScale = Math.min(1, Math.max(0, weights.commuteLogisticsWeight));
  let commuteDistanceDelta = 0;
  if (scores.commuteLogistics < 7.0) {
    commuteDistanceDelta = -(7.0 - scores.commuteLogistics) * 0.65 * commuteScale;
    if (scores.commuteLogistics <= 4.0) {
      commuteDistanceDelta -= 1.4 * commuteScale;
    }
  }

  const breathingScale = Math.min(1, Math.max(0, weights.urbanBreathingWeight));
  let urbanBreathingDelta = 0;
  if (scores.urbanBreathing >= 9.0) {
    urbanBreathingDelta = 0.45 * breathingScale;
  } else if (scores.urbanBreathing < 7.5) {
    urbanBreathingDelta =
      -(7.5 - scores.urbanBreathing) * 0.75 * breathingScale;
  }

  const finalScore = Math.max(
    1.0,
    Math.min(
      10.0,
      weighted +
        streetSafetyDelta +
        commuteDistanceDelta +
        urbanBreathingDelta,
    ),
  );
  return Math.round(finalScore * 100) / 100;
}

export function computeDynamicNeighborhoods(
  neighborhoods: NeighborhoodEntry[],
  weights: ScoringWeights,
): {
  ranked: ComputedNeighborhood[];
  cityAverages: {
    cityCode: CityHubCode;
    cityName: string;
    top3Avg: number;
    top5Avg: number;
    top3Names: string[];
  }[];
} {
  const computed = neighborhoods.map((n) => {
    const calibrated = resolveNeighborhoodSafetyAndMetrics(
      n.cityCode,
      n.neighborhood,
    );
    const effectiveSafetyCar =
      calibrated && calibrated.safetyCar < 6.5
        ? Math.min(n.safetyCarScore, calibrated.safetyCar)
        : n.safetyCarScore;
    const effectiveUrbanBreathing =
      calibrated && calibrated.urbanBreathing < 8.0
        ? Math.min(n.urbanBreathingScore, calibrated.urbanBreathing)
        : n.urbanBreathingScore;
    const effectiveCommuteLogistics =
      calibrated && calibrated.urbanBreathing < 8.0
        ? Math.min(n.commuteLogisticsScore, calibrated.commuteLogistics)
        : n.commuteLogisticsScore;

    const rawDynamicScore = computeWeightedNeighborhoodScore(
      {
        urbanBreathing: effectiveUrbanBreathing,
        commuteLogistics: effectiveCommuteLogistics,
        buildingStock: n.buildingStockFitScore,
        budgetFit: n.budgetFitScore,
        safetyCar: effectiveSafetyCar,
      },
      weights,
    );

    const dynamicScore =
      n.cityCode === "SP"
        ? Math.round(Math.max(1.0, rawDynamicScore - 1.5) * 100) / 100
        : rawDynamicScore;

    const safetyPenaltyNote =
      effectiveSafetyCar < 6.5
        ? ` [Penalidade severa de segurança ao sair na rua aplicada: nota ${effectiveSafetyCar.toFixed(1)}/10]`
        : effectiveSafetyCar < 8.0
          ? ` [Penalidade progressiva de segurança urbana: nota ${effectiveSafetyCar.toFixed(1)}/10]`
          : effectiveSafetyCar >= 8.5
            ? ` [Bônus de bolha caminhável segura: +0.3]`
            : "";
    const spDiscountNote =
      n.cityCode === "SP" ? " [Desconto SP Capital: -1.50]" : "";

    const dynamicJustification =
      `Nota Dinâmica ${dynamicScore.toFixed(2)}/10 (Base original: ${n.baseScore.toFixed(1)}) — ` +
      `Composição ponderada: Respiração Urbana ${effectiveUrbanBreathing.toFixed(1)} (peso ${weights.urbanBreathingWeight.toFixed(1)}x), ` +
      `Logística Nubank ${effectiveCommuteLogistics.toFixed(1)} (peso ${weights.commuteLogisticsWeight.toFixed(1)}x), ` +
      `Estoque Predial ${n.buildingStockFitScore.toFixed(1)} (peso ${weights.buildingStockWeight.toFixed(1)}x), ` +
      `Adequação Orçamento ${n.budgetFitScore.toFixed(1)} (peso ${weights.budgetFitWeight.toFixed(1)}x), ` +
      `Segurança & Carro ${effectiveSafetyCar.toFixed(1)} (peso ${weights.safetyCarWeight.toFixed(1)}x).${safetyPenaltyNote}${spDiscountNote} ` +
      n.detailedJustification;

    return {
      ...n,
      urbanBreathingScore: effectiveUrbanBreathing,
      commuteLogisticsScore: effectiveCommuteLogistics,
      safetyCarScore: effectiveSafetyCar,
      dynamicScore,
      dynamicOverallRank: 0,
      dynamicCityRank: 0,
      dynamicJustification,
    };
  });

  computed.sort(
    (a, b) =>
      b.dynamicScore - a.dynamicScore || a.overallPosition - b.overallPosition,
  );

  const cityCounters = new Map<CityHubCode, number>();
  computed.forEach((item, idx) => {
    item.dynamicOverallRank = idx + 1;
    const cRank = (cityCounters.get(item.cityCode) ?? 0) + 1;
    cityCounters.set(item.cityCode, cRank);
    item.dynamicCityRank = cRank;
  });

  const cities: { code: CityHubCode; name: string }[] = [
    { code: "BH", name: "Belo Horizonte" },
    { code: "CP", name: "Campinas" },
    { code: "SP", name: "São Paulo" },
    { code: "RJ", name: "Rio de Janeiro" },
  ];

  const cityAverages = cities
    .map((c) => {
      const inCity = computed.filter((n) => n.cityCode === c.code);
      const top3 = inCity.slice(0, 3);
      const top5 = inCity.slice(0, 5);
      const avg = (arr: ComputedNeighborhood[]) =>
        arr.length
          ? Math.round(
              (arr.reduce((s, x) => s + x.dynamicScore, 0) / arr.length) * 100,
            ) / 100
          : 0;
      return {
        cityCode: c.code,
        cityName: c.name,
        top3Avg: avg(top3),
        top5Avg: avg(top5),
        top3Names: top3.map((x) => x.neighborhood),
      };
    })
    .sort((a, b) => b.top3Avg - a.top3Avg);

  return { ranked: computed, cityAverages };
}

export function normalizeNeighborhoodKey(
  nb: string,
  cityCode?: CityHubCode,
): string {
  const trimmed = nb.trim();
  if (trimmed === "Jardim Guanabara" || trimmed === "Guanabara") {
    return "Jd. Guanabara";
  }
  if (trimmed === "Jardim Chapadão") return "Jd. Chapadão";
  if (trimmed === "Parque Taquaral") return "Taquaral";
  if (trimmed === "Botafogo" && (!cityCode || cityCode === "RJ")) {
    return "Botafogo (Orla)";
  }
  if (trimmed === "Tijuca") return "Tijuca (Pç Uruguai)";
  if (
    trimmed === "Jardim Oceânico" ||
    trimmed === "Jardim Oceanico" ||
    trimmed === "Barra da Tijuca"
  ) {
    return "Jd. Oceânico";
  }
  if (trimmed === "Jardim America") return "Jardim América";
  if (trimmed === "Vila Olimpia") return "Vila Olímpia";
  if (trimmed === "Grajau") return "Grajaú";
  if (trimmed === "Humaita") return "Humaitá";
  return trimmed;
}

const SINGLE_EXIT_BOTTLENECK_NEIGHBORHOODS = new Set<string>([
  "bh:buritis",
  "rj:icaraí",
  "rj:icarai",
  "rj:santa rosa",
  "rj:ingá",
  "rj:inga",
  "rj:são domingos",
  "rj:sao domingos",
]);

const SLOPED_HILLSIDE_NEIGHBORHOODS = new Set<string>([
  "bh:sion",
  "bh:santo antônio",
  "bh:cruzeiro",
  "bh:serra",
  "bh:anchieta",
  "bh:carmo",
  "bh:são pedro",
  "bh:mangabeiras",
  "bh:santa lúcia",
  "bh:luxemburgo",
  "bh:vila da serra",
  "bh:vale do sereno",
  "bh:belvedere",
  "bh:buritis",
  "bh:santo agostinho",
  "bh:gutierrez",
  "bh:cidade jardim",
  "rj:laranjeiras",
  "rj:cosme velho",
  "rj:santa teresa",
  "rj:glória",
  "rj:humaitá",
  "rj:gávea",
  "rj:jardim botânico",
  "sp:sumaré",
  "sp:sumarezinho",
  "sp:perdizes",
  "sp:vila madalena",
]);

const ORDINAL_FLOOR_MAP: Record<string, number> = {
  primeiro: 1,
  segundo: 2,
  terceiro: 3,
  quarto: 4,
  quinto: 5,
  sexto: 6,
  setimo: 7,
  sétimo: 7,
  oitavo: 8,
  nono: 9,
  decimo: 10,
  décimo: 10,
};

const CONDO_OR_GARAGE_FLOOR_CONTEXT =
  /(?<![a-zA-ZÀ-ÿ0-9_])(garagem|vagas?|estacionamento|box|lazer|piscina|academia|fitness|gin[aá]stica|quadra|sal[aã]o|festas|jogos|churrasqueira|gourmet|sky\s*lounge|sky\s*gourmet|lounge|rooftop|cobertura|terra[cç]o|coworking|office|trabalho|lavanderia|portaria|hall|recep[cç][aã]o|pilotis|lojas?|com[eé]rcio|padaria|mercearia|mercado|restaurante|cafeteria|galeteria|[aá]reas?\s+comuns?|brinquedoteca|brinquedos|playground|biciclet[aá]rio|lances?\s+de\s+escada|de\s+escada|elevadores?\s+por|unidades?\s+por|apartamentos?\s+por|aptos?\s+por|por\s+andar|por\s+pavimento|dropbox|chaves)(?![a-zA-ZÀ-ÿ0-9_])/i;

/**
 * Determines whether free-text description explicitly states the apartment unit itself
 * is on the ground floor ("Térreo"), ignoring mentions of condominium common areas,
 * garage levels, lobbies, or street-level stores ("vaga no térreo", "lazer no térreo",
 * "piscina no térreo", "portaria no térreo", "lojas no térreo").
 */
export function isExplicitUnitGroundFloor(rawText: string): boolean {
  if (!rawText || !/\bt[eé]rreo\b/i.test(rawText)) return false;

  // Reject duplex internal floor descriptions where one level is "primeiro andar" and another is "térreo"
  if (
    /\b(?:primeiro|1[º°ªo]?)\s*(?:andar|pavimento)\b[\s\S]{0,120}\bt[eé]rreo\b/i.test(
      rawText,
    )
  ) {
    return false;
  }

  for (const m of rawText.matchAll(/\bt[eé]rreo\b/gi)) {
    const idx = m.index ?? 0;
    const before = rawText.slice(Math.max(0, idx - 55), idx);
    const after = rawText.slice(idx + m[0].length, idx + m[0].length + 45);
    const clauseBefore = before.split(/[.,;!\n|]/).pop() ?? before;
    const clauseAfter = after.split(/[.,;!\n|]/)[0] ?? after;
    const localClause = `${clauseBefore} térreo ${clauseAfter}`;
    const sentenceBefore = before.split(/[.;!\n|]/).pop() ?? before;
    const sentenceAfter = after.split(/[.;!\n|]/)[0] ?? after;
    const widerSentence = `${sentenceBefore} térreo ${sentenceAfter}`;

    const isDirectUnitPhrase =
      /\b(?:apartamento|apto\.?|im[oó]vel|unidade|flat|studio|kitnet)\s+(?:pronto para morar\s+)?(?:localizad[oa]\s+|situad[oa]\s+|fica\s+)?(?:no\s+|em\s+)?(?:piso\s+|andar\s+|n[ií]vel\s+)?t[eé]rreo\b/i.test(
        widerSentence,
      );
    if (isDirectUnitPhrase) {
      if (CONDO_OR_GARAGE_FLOOR_CONTEXT.test(clauseBefore)) continue;
      return true;
    }

    if (CONDO_OR_GARAGE_FLOOR_CONTEXT.test(localClause)) continue;
    if (CONDO_OR_GARAGE_FLOOR_CONTEXT.test(widerSentence)) continue;

    if (
      /\b(?:localizad[oa]|situad[oa]|fica)\s+(?:no\s+|em\s+)(?:piso\s+|andar\s+|n[ií]vel\s+)?t[eé]rreo\b/i.test(
        localClause,
      ) ||
      /\b(?:andar|piso)\s+t[eé]rreo\b/i.test(localClause) ||
      /\bbloco\s*\w+\s*[-–]\s*t[eé]rreo\b/i.test(widerSentence) ||
      /^\s*(?:apartamento\s+|apto\s+|im[oó]vel\s+)?t[eé]rreo\s*$/i.test(
        rawText.trim(),
      )
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts explicit apartment floor numbers (1 to 45) from description text while ignoring
 * duplex internal floor breakdowns ("1º andar: sala, 2º andar: quartos"), condominium
 * leisure/garage floors ("piscina no 17º andar", "vaga no 1º andar"), stair flights
 * ("1 lance de escada"), or QuintoAndar company mentions ("Dropbox do 5 Andar").
 */
export function extractExplicitFloorFromText(rawText: string): number | null {
  if (!rawText) return null;

  // 1. Prioritize explicit physical height equivalences ("no 1º andar (equivalente ao 4º andar)")
  const equivMatch = rawText.match(
    /\b(?:equivalente|corresponde)\s+a(?:o)?\s+(\d{1,2})\b/i,
  );
  if (equivMatch?.[1]) {
    const n = Number(equivMatch[1]);
    if (n >= 1 && n <= 45) return n;
  }

  // 2. Reject duplex internal floor breakdowns ("1º andar: sala... 2º andar: suíte")
  const hasDuplexBreakdown =
    (/\b(?:1[º°ªo]?|primeiro)\s*(?:andar|pavimento)\b/i.test(rawText) &&
      /\b(?:2[º°ªo]?|segundo)\s*(?:andar|pavimento)\b/i.test(rawText)) ||
    (/\b(?:1[º°ªo]?|primeiro)\s*(?:andar|pavimento)\b/i.test(rawText) &&
      /\bt[eé]rreo\b/i.test(rawText)) ||
    /\b(?:1[º°ªo]?|2[º°ªo]?|primeiro|segundo)\s*(?:andar|pavimento)\s*:/i.test(
      rawText,
    );
  if (hasDuplexBreakdown) return null;

  // 3. Explicit numeric floor mentions ("12º andar", "8° andar", "5º pavimento", "no 11 andar")
  const numRegex =
    /\b(\d{1,2})[ \t]{0,3}([º°ªo])?[ \t]{0,3}(andar|pavimento)\b(?![ \t]{0,3}(?:alto|baixo|m[eé]dio|intermedi[aá]rio))/gi;
  for (const m of rawText.matchAll(numRegex)) {
    const n = Number(m[1]);
    if (!Number.isFinite(n) || n < 1 || n > 45) continue;
    const hasOrdinal = Boolean(m[2]);
    const idx = m.index ?? 0;
    const before = rawText.slice(Math.max(0, idx - 55), idx);
    const after = rawText.slice(idx + m[0].length, idx + m[0].length + 45);
    const clauseBefore = before.split(/[.,;!\n|]/).pop() ?? before;
    const clauseAfter = after.split(/[.,;!\n|]/)[0] ?? after;
    const localClause = `${clauseBefore} ${m[0]} ${clauseAfter}`;
    const sentenceBefore = before.split(/[.;!\n|]/).pop() ?? before;

    if (CONDO_OR_GARAGE_FLOOR_CONTEXT.test(localClause)) continue;
    if (
      /\b(?:piscina|academia|sal[aã]o|festas|jogos|churrasqueira|gourmet|sky\s*lounge|sky\s*gourmet|lounge|rooftop|terra[cç]o|coworking|lavanderia|garagem|vagas?|restaurante|lances?\s+de\s+escada|de\s+escada)\b/i.test(
        sentenceBefore,
      )
    ) {
      continue;
    }
    if (
      /\b(?:quartos?|qtos?|su[ií]tes?|dormit[oó]rios?|sala|cozinha)\s+(?:p\s+)?(?:localizad[oa]s?\s+|ficam?\s+|no\s+)/i.test(
        localClause,
      )
    ) {
      continue;
    }
    if (!hasOrdinal) {
      const validNoOrdinal =
        /\b(?:no|do|ao|em|apto\.?|apartamento|unidade|quarto|m[²2]|andar)\s*$/i.test(
          clauseBefore.trim(),
        ) || /^\s*\d{1,2}\s+(?:andar|pavimento)\b/i.test(localClause.trim());
      if (!validNoOrdinal) continue;
    }
    return n;
  }

  // 4. Portuguese ordinal words ("primeiro andar" .. "décimo andar")
  const ordRegex =
    /\b(primeiro|segundo|terceiro|quarto|quinto|sexto|s[eé]timo|oitavo|nono|d[eé]cimo)\s+(andar|pavimento)\b/gi;
  for (const m of rawText.matchAll(ordRegex)) {
    const word = (m[1] ?? "").toLowerCase();
    const n = ORDINAL_FLOOR_MAP[word];
    if (!n) continue;
    const idx = m.index ?? 0;
    const before = rawText.slice(Math.max(0, idx - 55), idx);
    const after = rawText.slice(idx + m[0].length, idx + m[0].length + 45);
    const clauseBefore = before.split(/[.,;!\n|]/).pop() ?? before;
    const clauseAfter = after.split(/[.,;!\n|]/)[0] ?? after;
    const localClause = `${clauseBefore} ${m[0]} ${clauseAfter}`;
    if (CONDO_OR_GARAGE_FLOOR_CONTEXT.test(localClause)) continue;
    if (
      word === "quinto" &&
      /\b(?:na|pela|da|do|no)\s+quinto\s+andar\b/i.test(localClause) &&
      !/\b(?:de\s+frente|localizado|situado|fica)\b/i.test(localClause)
    ) {
      continue;
    }
    return n;
  }

  // 5. Explicit apartment unit number (e.g. "APTº505" -> 5º andar, "apto 304" -> 3º andar)
  const aptNumMatch = rawText.match(
    /\b(?:apt[oº°]\.?|apartamento)\s*(?:n[º°]\.?\s*)?([1-9]\d{2})\b(?!\s*m)/i,
  );
  if (aptNumMatch?.[1]) {
    const aptNum = Number(aptNumMatch[1]);
    const inferredFloor = Math.floor(aptNum / 100);
    const unitSuffix = aptNum % 100;
    if (
      inferredFloor >= 1 &&
      inferredFloor <= 35 &&
      unitSuffix >= 1 &&
      unitSuffix <= 24
    ) {
      return inferredFloor;
    }
  }

  return null;
}

function detectUnitPenthouseOrDuplex(rawText: string): {
  isPenthouseText: boolean;
  isDuplex: boolean;
} {
  const cleanedForCobertura = rawText
    .replace(
      /(?<![a-zA-ZÀ-ÿ0-9_])(?:piscina|lazer|[aá]rea\s+de\s+lazer|sal[aã]o(?: de festas)?|churrasqueira|sauna|academia|fitness|espa[cç]o gourmet|rooftop|terra[cç]o|jardim|solarium|lavanderia|coworking|vista)[^.;,\n]{0,45}\bna cobertura\b/gi,
      " ",
    )
    .replace(
      /\bna cobertura[ \t]{0,3}[:,-]?[ \t]{0,3}(?:piscina|lazer|[aá]rea\s+de\s+lazer|sal[aã]o|churrasqueira|sauna|academia|fitness|espa[cç]o gourmet|rooftop|solarium)/gi,
      " ",
    )
    .replace(/\bna cobertura do (?:edif[ií]cio|pr[eé]dio|condom[ií]nio)\b/gi, " ")
    .replace(
      /\b(?:condom[ií]nio|pr[eé]dio|edif[ií]cio)\s+(?:conta\s+com|possui|tem|disp[oõ]e\s+de)\s+cobertura\b/gi,
      " ",
    )
    .replace(
      /\bcobertura\s+(?:coletiva|do\s+pr[eé]dio|do\s+edif[ií]cio|do\s+condom[ií]nio|das\s+[aá]reas|sky\s+view|de\s+vidro|retr[aá]til|met[aá]lica|inclusive|de\s+celular|de\s+sinal|de\s+internet|do\s+seguro|de\s+garantia|de\s+policarbonato|de\s+lona|de\s+telha)\b/gi,
      " ",
    )
    .replace(
      /(?<![a-zA-ZÀ-ÿ0-9_])(?:sacada|varanda|vaga|garagem|seguro|[aá]rea|sinal|celular|internet)[^.;,\n]{0,35}\bcobertura\b/gi,
      " ",
    );

  const cleanedForDuplex = rawText.replace(
    /\b(?:geladeira|refrigerador|arm[aá]rio|guarda[- ]?roupa|edif[ií]cio york)\s+duplex\b/gi,
    " ",
  );

  const isPenthouseText = /\bcobertura\b/i.test(cleanedForCobertura);
  const isDuplex =
    /(?<![a-zA-ZÀ-ÿ0-9_])(duplex|triplex|loft duplex|p[eé][- ]direito duplo)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      cleanedForDuplex,
    );

  return { isPenthouseText, isDuplex };
}

function detectUnitTopFloor(
  rawText: string,
  effectiveFloor: number | null,
  totalFloors: number | null,
): boolean {
  if (
    effectiveFloor !== null &&
    totalFloors !== null &&
    totalFloors >= 5 &&
    effectiveFloor <= totalFloors - 2
  ) {
    return false;
  }
  const cleanedTopFloor = rawText.replace(
    /\b(?:sal[aã]o|sal[oõ]es|festas?|lazer|piscina|academia|rooftop|terra[cç]o|churrasqueira|gourmet)[^.;,\n]{0,35}(?<![a-zA-ZÀ-ÿ0-9_])(?:[uú]ltimo andar|andar topo)(?![a-zA-ZÀ-ÿ0-9_])/gi,
    " ",
  );
  return (
    /(?<![a-zA-ZÀ-ÿ0-9_])([uú]ltimo andar|andar topo)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      cleanedTopFloor,
    ) ||
    (effectiveFloor !== null &&
      totalFloors !== null &&
      totalFloors >= 3 &&
      effectiveFloor === totalFloors)
  );
}

export interface StreetMicroEnvironmentEvaluation {
  category:
    | "BUNKER_OR_SPOOF"
    | "HEAVY_ARTERIAL"
    | "PRIME_WALKABLE"
    | "NEUTRAL";
  pointsDelta: number;
  redTag: string | null;
  greenTag: string | null;
  warning: string | null;
  highlight: string | null;
  safetyCarCap: number | null;
  urbanBreathingCap: number | null;
}

const streetMicroCache = new WeakMap<
  SlimPropertyRecord,
  StreetMicroEnvironmentEvaluation
>();

/**
 * Deterministic street & micro-location analyzer that prevents "Efeito Bunker"
 * (buildings on noisy 4–6 lane arterial avenues or degraded downtown borders
 * masquerading as a neighboring noble neighborhood) and rewards genuinely
 * walkable, tree-lined micro-axes ("Vibe Setor Marista").
 */
export function evaluateStreetMicroEnvironment(
  prop: SlimPropertyRecord,
): StreetMicroEnvironmentEvaluation {
  const cached = streetMicroCache.get(prop);
  if (cached) return cached;

  const normText = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const street = normText(prop.street ?? "").trim();
  const streetNorm = street;
  const nb = normText(prop.neighborhood ?? "").trim();
  const numStr = (prop.streetNumber ?? "").replace(/\D/g, "");
  const streetNum = numStr ? Number(numStr) : null;

  const coreText = normText(
    [
      prop.street ?? "",
      prop.title ?? "",
      prop.description ?? "",
      prop.condominiumName ?? "",
    ]
      .filter(Boolean)
      .join(" "),
  );

  const allPlaces = prop.placesNearby ?? [];
  const immediatePlacesText = normText(
    allPlaces
      .slice(0, 6)
      .map((p) => p.name)
      .join(" "),
  );
  const generatedTextIfCompactPlaces =
    allPlaces.length <= 6 ? normText(prop.generatedDescription ?? "") : "";
  const combinedMicroText =
    `${coreText} ${immediatePlacesText} ${generatedTextIfCompactPlaces}`.trim();

  // === CATEGORY A: Border Spoofing + Express Corridor ("Efeito Bunker" -> -26 pts) ===
  let isCategoryA = false;

  if (prop.cityCode === "CP") {
    const isCpExpressOrBorderStreet =
      /\b(aquidaba|viaduto\s+cury|rua\s+uruguaiana|duque\s+de\s+caxias|francisco\s+glicerio|senador\s+saraiva|av(?:enida|\.)?\s+anchieta)\b/i.test(
        streetNorm,
      ) ||
      (/\bmoraes\s+salles\b/i.test(streetNorm) &&
        (/\b(centro|bosque)\b/i.test(nb) ||
          (streetNum !== null && streetNum < 1500) ||
          /\b(viaduto|centro|aquidaba|terminal)\b/i.test(combinedMicroText))) ||
      (/\b(bosque|centro)\b/i.test(nb) &&
        /\b(rua\s+jose\s+paulino|rua\s+boaventura\s+do\s+amaral|rua\s+luzitana|rua\s+doutor\s+quirino|rua\s+barao\s+de\s+jaguara)\b/i.test(
          streetNorm,
        ));
    const hasJaraguaOrAquidabaSpoof =
      /\b(bosque|centro)\b/i.test(nb) &&
      /\bmoraes\s+salles|aquidaba|jose\s+paulino|boaventura\s+do\s+amaral|luzitana|doutor\s+quirino|barao\s+de\s+jaguara\b/i.test(
        streetNorm,
      ) &&
      /\b(shopping\s+jaragua|aquidaba)\b/i.test(combinedMicroText);

    if (isCpExpressOrBorderStreet || hasJaraguaOrAquidabaSpoof) {
      isCategoryA = true;
    }
  } else if (prop.cityCode === "BH") {
    const isNobleBhTag =
      /\b(lourdes|funcionarios|santo\s+agostinho|savassi)\b/i.test(nb);
    const isBhBorderCandidateStreet =
      /\b(rua\s+sao\s+paulo|rua\s+rio\s+de\s+janeiro|rua\s+espirito\s+santo|rua\s+da\s+bahia|rua\s+santa\s+catarina|rua\s+curitiba|rua\s+dos\s+guajajaras|rua\s+dos\s+goitacazes|rua\s+dos\s+tupis|rua\s+dos\s+tamoios|rua\s+dos\s+carijos|rua\s+dos\s+tupinambas|rua\s+dos\s+caetes|av(?:enida|\.)?\s+augusto\s+de\s+lima|av(?:enida|\.)?\s+amazonas|av(?:enida|\.)?\s+afonso\s+pena|av(?:enida|\.)?\s+olegario\s+maciel)\b/i.test(
        streetNorm,
      );
    const hasExplicitCentroLandmark =
      (isBhBorderCandidateStreet &&
        /\b(shopping\s+cidade|mercado\s+central|praca\s+raul\s+soares|sesc\s+palladium|praca\s+sete|shopping\s+popular\s+oiapoque|shopping\s+oiapoque|minas\s+centro|rodoviaria)\b/i.test(
          combinedMicroText,
        )) ||
      /\b(otima\s+localizacao\s+no\s+centro|localizado\s+no\s+centro)\b/i.test(
        coreText,
      );
    const isAmazonas =
      /\bav(?:enida|\.)?\s+amazonas\b/i.test(streetNorm) ||
      /\b(esquina\s+com\s+av(?:enida|\.)?\s+amazonas|na\s+av(?:enida|\.)?\s+amazonas)\b/i.test(
        coreText,
      );
    const isAfonsoPenaCentro =
      /\bav(?:enida|\.)?\s+afonso\s+pena\b/i.test(streetNorm) &&
      (/\b(centro|lourdes)\b/i.test(nb) ||
        (streetNum !== null && streetNum < 1600) ||
        /\b(centro|shopping\s+cidade|mercado\s+central|sesc\s+palladium|parque\s+municipal|praca\s+sete|rodoviaria)\b/i.test(
          combinedMicroText,
        ));
    const isOlegarioCentro =
      /\bav(?:enida|\.)?\s+olegario\s+maciel\b/i.test(streetNorm) &&
      (/\bcentro\b/i.test(nb) ||
        (streetNum !== null && streetNum < 1400) ||
        /\b(centro|shopping\s+cidade|mercado\s+central|raul\s+soares|amazonas|rodoviaria)\b/i.test(
          combinedMicroText,
        ));
    const isBhDowntownBorderStreetNumber =
      isNobleBhTag &&
      /\b(rua\s+sao\s+paulo|rua\s+rio\s+de\s+janeiro|rua\s+espirito\s+santo|rua\s+da\s+bahia|rua\s+santa\s+catarina|rua\s+curitiba|rua\s+dos\s+guajajaras|rua\s+dos\s+goitacazes|rua\s+dos\s+tupis|rua\s+dos\s+tamoios|rua\s+dos\s+carijos|rua\s+dos\s+tupinambas|rua\s+dos\s+caetes|av(?:enida|\.)?\s+augusto\s+de\s+lima)\b/i.test(
        streetNorm,
      ) &&
      ((streetNum !== null && streetNum > 0 && streetNum <= 1350) ||
        /\b(rua\s+dos\s+guajajaras|rua\s+dos\s+goitacazes|rua\s+dos\s+tupis|rua\s+dos\s+tamoios|rua\s+dos\s+carijos|rua\s+dos\s+tupinambas|rua\s+dos\s+caetes|av(?:enida|\.)?\s+augusto\s+de\s+lima)\b/i.test(
          streetNorm,
        ));

    if (
      (isNobleBhTag && hasExplicitCentroLandmark) ||
      isAmazonas ||
      isAfonsoPenaCentro ||
      isOlegarioCentro ||
      isBhDowntownBorderStreetNumber
    ) {
      isCategoryA = true;
    }
  } else if (prop.cityCode === "RJ") {
    const isRjExpressCorridor =
      /\b(presidente\s+vargas|binario\s+do\s+porto|av(?:enida|\.)?\s+brasil|conde\s+de\s+bonfim|rua\s+pinheiro\s+machado)\b/i.test(
        streetNorm,
      ) ||
      (/\bbarata\s+ribeiro\b/i.test(streetNorm) &&
        (/\b(tunel|inhanga)\b/i.test(combinedMicroText) ||
          (streetNum !== null && streetNum <= 220)));
    if (isRjExpressCorridor) {
      isCategoryA = true;
    }
  } else if (prop.cityCode === "SP") {
    const isSpExpressCorridor =
      /\b(23\s+de\s+maio|vinte\s+e\s+tres\s+de\s+maio|rubem\s+berta|moreira\s+guimaraes|av(?:enida|\.)?\s+dos\s+bandeirantes|av(?:enida|\.)?\s+santo\s+amaro|av(?:enida|\.)?\s+reboucas|nove\s+de\s+julho|9\s+de\s+julho|brigadeiro\s+lui[sz]\s+antonio|minhocao|elevado\s+presidente\s+joao\s+goulart|elevado\s+costa\s+e\s+silva|rua\s+amaral\s+gurgel)\b/i.test(
        streetNorm,
      );
    if (isSpExpressCorridor) {
      isCategoryA = true;
    }
  }

  if (isCategoryA) {
    const res: StreetMicroEnvironmentEvaluation = {
      category: "BUNKER_OR_SPOOF",
      pointsDelta: -26.0,
      redTag: "Via Arterial / Efeito Bunker",
      greenTag: null,
      warning:
        "Corredor viário intenso / divisa de centro (efeito bunker: -26 pts base)",
      highlight: null,
      safetyCarCap: 5.8,
      urbanBreathingCap: 5.0,
    };
    streetMicroCache.set(prop, res);
    return res;
  }

  // === CATEGORY B: Heavy Traffic Arterial Avenue (-10 pts) ===
  let isCategoryB = false;
  if (prop.cityCode === "BH") {
    isCategoryB =
      /\b(av(?:enida|\.)?\s+do\s+contorno|nossa\s+senhora\s+do\s+carmo|raja\s+gabaglia|cristiano\s+machado|antonio\s+carlos|bias\s+fortes)\b/i.test(
        street,
      );
  } else if (prop.cityCode === "CP") {
    isCategoryB =
      /\b(av(?:enida|\.)?\s+brasil|barao\s+de\s+itapura|orosimbo\s+maia|norte[- ]?sul|jose\s+de\s+sou[zs]a\s+campos)\b/i.test(
        street,
      ) || /\bav(?:enida|\.)?\s+norte[- ]?sul\b/i.test(coreText);
  } else if (prop.cityCode === "RJ") {
    isCategoryB =
      /\b(voluntarios\s+da\s+patria|rua\s+sao\s+clemente|rua\s+humaita|nossa\s+senhora\s+de\s+copacabana)\b/i.test(
        street,
      );
  }

  if (isCategoryB) {
    const res: StreetMicroEnvironmentEvaluation = {
      category: "HEAVY_ARTERIAL",
      pointsDelta: -10.0,
      redTag: null,
      greenTag: null,
      warning:
        "Avenida de tráfego intenso (ruído e menor caminhabilidade)",
      highlight: null,
      safetyCarCap: null,
      urbanBreathingCap: null,
    };
    streetMicroCache.set(prop, res);
    return res;
  }

  // === CATEGORY C: Prime Walkable "Vibe Setor Marista" Micro-Location Bonus (+8 pts) ===
  let isCategoryC = false;
  if (prop.cityCode === "BH") {
    const isBhPrimeNb =
      /\b(funcionarios|lourdes|savassi|santo\s+agostinho|boa\s+viagem)\b/i.test(
        nb,
      );
    const isFuncionariosOrLourdesPrimeStreet =
      /\b(rua\s+maranhao|rua\s+alagoas|rua\s+goncalves\s+dias|rua\s+sergipe|rua\s+paraiba|rua\s+pernambuco|rua\s+bernardo\s+guimaraes|rua\s+(?:dos\s+)?aimores|rua\s+claudio\s+manoel|rua\s+piaui|av(?:enida|\.)?\s+alvares\s+cabral|av(?:enida|\.)?\s+carandai|rua\s+marilia\s+de\s+dirceu|rua\s+tomas\s+gonzaga|rua\s+barbara\s+heliodora|praca\s+da\s+liberdade|praca\s+marilia\s+de\s+dirceu|praca\s+da\s+assembleia)\b/i.test(
        street,
      ) ||
      (/\blourdes\b/i.test(nb) &&
        /\b(rua\s+curitiba|rua\s+rio\s+de\s+janeiro)\b/i.test(street) &&
        (streetNum === null || streetNum >= 1400));

    if (
      (isBhPrimeNb && isFuncionariosOrLourdesPrimeStreet) ||
      /\b(praca\s+marilia\s+de\s+dirceu|praca\s+da\s+liberdade|praca\s+da\s+assembleia)\b/i.test(
        street,
      )
    ) {
      isCategoryC = true;
    }
  } else if (prop.cityCode === "CP") {
    const isTaquaralNb = /\btaquaral\b/i.test(nb);
    const isTaquaralPrimeStreet =
      /\b(heitor\s+penteado|padre\s+mano?el\s+bernardes|marechal\s+carmona|paula\s+bueno|lui[sz]\s+otavio)\b/i.test(
        street,
      ) ||
      (isTaquaralNb &&
        /\b(frente\s+para\s+a\s+lagoa|ao\s+lado\s+da\s+lagoa|colado\s+na\s+lagoa|parque\s+portugal)\b/i.test(
          coreText,
        ));
    if (isTaquaralPrimeStreet) {
      isCategoryC = true;
    }
  } else if (prop.cityCode === "RJ") {
    const isRjPrimeStreet =
      /\b(praia\s+do\s+flamengo|rua\s+cruz\s+lima|rua\s+tucuma|(?:rua|av(?:enida|\.)?)\s+oswaldo\s+cruz|rua\s+paulo\s+barreto|barao\s+de\s+icarai|epitacio\s+pessoa|borges\s+de\s+medeiros|joao\s+luiz\s+alves|candido\s+gaffree|praia\s+da\s+urca|rua\s+jardim\s+botanico|rua\s+lopes\s+quintas|rua\s+maria\s+angelica|rua\s+faro|rua\s+pio\s+correia|delfim\s+moreira|vieira\s+souto|prudente\s+de\s+morais|nascimento\s+silva|rua\s+redentor|barao\s+da\s+torre|dias\s+ferreira|general\s+urquiza|venancio\s+flores|anibal\s+de\s+mendonca|garcia\s+d['’]?avila|maria\s+quiteria|joana\s+angelica|visconde\s+de\s+piraja|francisco\s+otaviano)\b/i.test(
        street,
      ) ||
      (/\b(flamengo|lagoa|urca|jardim\s+botanico|leblon|ipanema)\b/i.test(
        nb,
      ) &&
        /\b(aterro\s+do\s+flamengo|lagoa\s+rodrigo\s+de\s+freitas|praia\s+do\s+leblon|praia\s+de\s+ipanema|parque\s+lage)\b/i.test(
          coreText,
        ));
    if (isRjPrimeStreet) {
      isCategoryC = true;
    }
  } else if (prop.cityCode === "SP") {
    const isSpIbirapueraAxis =
      (/\bvila\s+nova\s+conceicao\b/i.test(nb) &&
        /\b(afonso\s+braz|diogo\s+jacome|domingos\s+fernandes|joao\s+lourenco|balthazar\s+da\s+veiga|antonio\s+jose\s+da\s+silva|pereira\s+coutinho|republica\s+do\s+libano|quarto\s+centenario)\b/i.test(
          street,
        )) ||
      (/\b(moema|vila\s+uberabinha|vila\s+nova\s+conceicao)\b/i.test(
        nb,
      ) &&
        /\b(rua\s+gaivota|rua\s+canario|rua\s+tuim|rua\s+inhambu|rua\s+pintassilgo|escobar\s+ortiz|lourenco\s+de\s+almeida|franca\s+pinto|moema\s+passaros|colado\s+no\s+parque\s+ibirapuera|ao\s+lado\s+do\s+ibirapuera)\b/i.test(
          coreText,
        ));
    if (isSpIbirapueraAxis) {
      isCategoryC = true;
    }
  }

  if (isCategoryC) {
    const res: StreetMicroEnvironmentEvaluation = {
      category: "PRIME_WALKABLE",
      pointsDelta: 8.0,
      redTag: null,
      greenTag: "Eixo Caminhável / Respiro Urbano",
      warning: null,
      highlight: "Eixo caminhável arborizado (estilo Setor Marista)",
      safetyCarCap: null,
      urbanBreathingCap: null,
    };
    streetMicroCache.set(prop, res);
    return res;
  }

  const res: StreetMicroEnvironmentEvaluation = {
    category: "NEUTRAL",
    pointsDelta: 0,
    redTag: null,
    greenTag: null,
    warning: null,
    highlight: null,
    safetyCarCap: null,
    urbanBreathingCap: null,
  };
  streetMicroCache.set(prop, res);
  return res;
}

export const detectArterialOrBorderBunker = evaluateStreetMicroEnvironment;

/**
 * Extracts fine-grained apartment nuances from comfortCommodities, practicalityCommodities,
 * floor / floorRange, placesNearby (parks, malls, subway), installations, photoCaptions,
 * description, and generatedDescription.
 */
type ApartmentNuancesEvaluation = {
  rawNuancePoints: number;
  nuanceHighlights: string[];
  nuanceWarnings: string[];
  parksNearby: string[];
  mallsNearby: string[];
  acLabel: string | null;
  floorTag: FloorTag | null;
  highFloorLabel: string | null;
  lowFloorLabel: string | null;
  hasNoElevator: boolean;
  hasTrappedParking: boolean;
  /** No cabinets anywhere (QuintoAndar checklist or photo audit): caps the unfurnished bonus. */
  isBareShell: boolean;
  greenTags: string[];
  redTags: string[];
  warningTags: string[];
};

const nuancesCacheTrue = new WeakMap<
  SlimPropertyRecord,
  ApartmentNuancesEvaluation
>();
const nuancesCacheFalse = new WeakMap<
  SlimPropertyRecord,
  ApartmentNuancesEvaluation
>();

function cloneApartmentNuances(
  cached: ApartmentNuancesEvaluation,
): ApartmentNuancesEvaluation {
  return {
    rawNuancePoints: cached.rawNuancePoints,
    nuanceHighlights: cached.nuanceHighlights.slice(),
    nuanceWarnings: cached.nuanceWarnings.slice(),
    parksNearby: cached.parksNearby.slice(),
    mallsNearby: cached.mallsNearby.slice(),
    acLabel: cached.acLabel,
    floorTag: cached.floorTag,
    highFloorLabel: cached.highFloorLabel,
    lowFloorLabel: cached.lowFloorLabel,
    hasNoElevator: cached.hasNoElevator,
    hasTrappedParking: cached.hasTrappedParking,
    isBareShell: cached.isBareShell,
    greenTags: cached.greenTags.slice(),
    redTags: cached.redTags.slice(),
    warningTags: cached.warningTags.slice(),
  };
}

function evaluateApartmentNuancesFast(
  prop: SlimPropertyRecord,
  penalizeMegaCondo: boolean,
): ApartmentNuancesEvaluation {
  const cache = penalizeMegaCondo ? nuancesCacheTrue : nuancesCacheFalse;
  const cached = cache.get(prop);
  if (cached) return cached;
  evaluateApartmentNuances(prop, penalizeMegaCondo);
  return cache.get(prop)!;
}

/**
 * QuintoAndar keeps `salePrice` on the house even after the sale ad is unpublished
 * (e.g. "OWNER_RENTED_HOUSE"), so for that provider only explicit text counts as evidence.
 * Zap/VivaReal/ImovelWeb only expose sale pricing while the sale ad is live.
 */
export function hasActiveSaleListing(
  prop: Pick<
    SlimPropertyRecord,
    "provider" | "salePrice" | "title" | "description" | "generatedDescription"
  >,
): boolean {
  if (
    prop.provider !== "quintoandar" &&
    prop.salePrice !== null &&
    prop.salePrice > 0
  ) {
    return true;
  }
  return /\b(est[aá] [aà] venda|dispon[ií]vel para venda|visita de poss[ií]veis interessados)\b/i.test(
    `${prop.title ?? ""} ${prop.description ?? ""} ${prop.generatedDescription ?? ""}`,
  );
}

export const AC_ABSENT_TAG = "Sem ar-condicionado";
export const AC_UNCONFIRMED_TAG = "AC não confirmado";
export const FURNITURE_CONFLICT_TAG = "Mobília divergente — confirmar";
export const PRICE_MISMATCH_TAG = "Preço divergente na descrição";
export const HOSPITAL_NOISE_TAG = "Perto de hospital (sirenes)";


export type AcStatus = "confirmed" | "unconfirmed" | "absent";

/**
 * Portal checkboxes (QuintoAndar "Ar condicionado", Zap AIR_CONDITIONING) are often ticked for
 * AC infrastructure only, so they are not proof of an installed unit. Only the listing's own words
 * (title, description, photo captions) or a photo audit confirm AC. The scraper's
 * "Ar-condicionado" positive signal is derived from those same checkboxes, so it counts as a checkbox.
 * `trustCheckbox` (new/renovated unit with effective modernity >= 85) accepts the checkbox as confirmed.
 */
export function resolveAcEvidence(
  prop: Pick<
    SlimPropertyRecord,
    | "title"
    | "description"
    | "photoCaptions"
    | "comfortCommodities"
    | "amenities"
    | "positiveSignals"
    | "twinAcConfirmed"
  >,
  photoAudit?: PhotoAuditOverride,
  options?: { trustCheckbox?: boolean },
): { acStatus: AcStatus; acLabel: string | null } {
  if (photoAudit?.falseAC) return { acStatus: "absent", acLabel: null };

  const ownText = [prop.title ?? "", prop.description ?? "", ...(prop.photoCaptions ?? [])]
    .join(". ")
    .toLowerCase();
  const hasOnlyWindowAcText =
    /\b(ar[- ]?condicionado\s+de\s+(?:janela|parede)|ar\s+de\s+janela|(?:buraco|caixa)\s+para\s+ar)\b/i.test(
      ownText,
    ) && !/\b(split|inverter)\b/i.test(ownText);
  const hasExplicitNoAcText =
    /\b(sem\s+ar(?:es)?[- ]?condicionados?|n[aã]o\s+(?:possui|tem|h[aá])\s+ar(?:es)?[- ]?condicionados?)\b/i.test(
      ownText,
    );
  if (hasOnlyWindowAcText || hasExplicitNoAcText) {
    return { acStatus: "absent", acLabel: null };
  }

  // "Ponto/infraestrutura para ar" is only provision for a future unit.
  const installedAcText = ownText.replace(
    /\b(?:pontos?|infra(?:estrutura)?|prepara[cç][aã]o|preparad[oa]|tubula[cç][aã]o)\s+(?:de\s+|para\s+)?(?:o\s+|os\s+)?(?:ar(?:es)?[- ]?condicionados?|ar)(?:\s+split)?\b/gi,
    " ",
  );
  if (/\b(split|inverter)\b/i.test(installedAcText)) {
    return { acStatus: "confirmed", acLabel: "Ar-condicionado Split" };
  }
  if (
    photoAudit?.verifiedAC ||
    prop.twinAcConfirmed ||
    /\b(ar(?:es)?[- ]?condicionados?|climatizad[oa]s?)\b/i.test(installedAcText)
  ) {
    return { acStatus: "confirmed", acLabel: "Ar-condicionado" };
  }

  const comfort = (prop.comfortCommodities ?? []).map((c) => c.toLowerCase());
  const amenities = (prop.amenities ?? []).map((c) => c.toLowerCase());
  const hasInfraOnlyText = installedAcText !== ownText;
  const hasPortalCheckbox =
    comfort.includes("ar condicionado") ||
    amenities.some((a) =>
      ["ar condicionado", "ar-condicionado", "ar_condicionado", "air_conditioning"].includes(a),
    ) ||
    prop.positiveSignals.some((s) => s.toLowerCase().includes("ar-condicionado"));
  const auditSawNoAc = (photoAudit?.visualWarnings ?? []).some((w) =>
    /\bsem\s+(?:split|ar[- ]?condicionado)/i.test(w),
  );
  if (hasPortalCheckbox && !hasInfraOnlyText && !auditSawNoAc && options?.trustCheckbox) {
    return { acStatus: "confirmed", acLabel: "Ar-condicionado" };
  }
  return hasInfraOnlyText || hasPortalCheckbox
    ? { acStatus: "unconfirmed", acLabel: null }
    : { acStatus: "absent", acLabel: null };
}

export function evaluateApartmentNuances(
  prop: SlimPropertyRecord,
  penalizeMegaCondo: boolean,
): ApartmentNuancesEvaluation {
  const cache = penalizeMegaCondo ? nuancesCacheTrue : nuancesCacheFalse;
  const cached = cache.get(prop);
  if (cached) {
    return cloneApartmentNuances(cached);
  }

  let pts = 0;
  const highlights: string[] = [];
  const warnings: string[] = [];
  const greenTags: string[] = [];
  const redTags: string[] = [];
  const warningTags: string[] = [];

  const comfort = new Set(
    (prop.comfortCommodities ?? []).map((c) => c.toLowerCase()),
  );
  const practicality = new Set(
    (prop.practicalityCommodities ?? []).map((c) => c.toLowerCase()),
  );
  const installs = new Set(
    (prop.installations ?? []).map((c) => c.toLowerCase()),
  );
  const amenities = new Set(
    (prop.amenities ?? []).map((c) => c.toLowerCase()),
  );
  const captions = (prop.photoCaptions ?? []).join(" ").toLowerCase();
  const sentenceJoinedDesc = [
    prop.title ?? "",
    prop.description ?? "",
    prop.generatedDescription ?? "",
  ]
    .filter(Boolean)
    .join(". ");
  const fullDesc = sentenceJoinedDesc.toLowerCase();
  const elevatorSources = [
    ...(prop.installations ?? []),
    ...(prop.amenities ?? []),
    prop.description ?? "",
    prop.generatedDescription ?? "",
    prop.title ?? "",
  ].join(" ");

  const cleanedElevatorSources = elevatorSources
    .replace(/\bacesso\s+sem\s+escadas?\b/gi, " ")
    .replace(/\bpraticidade\s+do\s+acesso\s+sem\s+elevador\b/gi, " ")
    .replace(
      /\b(?:segundo\s+andar|piso\s+superior|mezanino|cobertura|duplex)[^.;!\n]{0,35}\bacesso\s+por\s+escadas?\b/gi,
      " ",
    )
    .replace(
      /\bacesso\s+por\s+escada\s+(?:em\s+madeira|interna|caracol|privativa)\b/gi,
      " ",
    )
    .replace(/\bsem\s+elevador\s+de\s+servi[cç]o\b/gi, " ");
  const hasExplicitNoElevatorText =
    !/sem\s+elevador\s+de\s+servi[cç]o/i.test(elevatorSources) &&
    /(?<![a-zA-ZÀ-ÿ0-9_])(sem elevador|n[aã]o\s+(?:possui|tem|disp[oõ]e\s+de|conta\s+com)\s+(?:portaria\s+(?:ou|e|nem)\s+)?elevador|pr[eé]dio\s+(?:sem\s+elevador|escada)|\d+\s*(?:lances?|andares?)\s+de\s+escada|acesso\s+(?:somente\s+)?por\s+escadas?)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      cleanedElevatorSources,
    );
  const hasElevatorMention = /elevador|elevator/i.test(elevatorSources);
  // Portal CRMs often copy the unit floor into totalFloors; in a pricey condo that is not real evidence of a 3-story walk-up.
  const isLikelyCrmFloorNoise =
    prop.floor !== null &&
    prop.floor === prop.totalFloors &&
    prop.condoFee >= 800;
  const hasLowBuildingNoElevatorEvidence =
    prop.totalFloors !== null &&
    prop.totalFloors > 0 &&
    prop.totalFloors <= 3 &&
    !isLikelyCrmFloorNoise &&
    !hasElevatorMention &&
    !/piscina|academia|sauna|portaria 24|portaria_24h|concierge_24h|pool|gym|fitness|elevador/i.test(
      elevatorSources,
    );
  const isGroundFloorUnit =
    prop.floor === 0 || isExplicitUnitGroundFloor(sentenceJoinedDesc);
  const hasStairsToUnitText =
    /(?<![a-zA-ZÀ-ÿ0-9_])(subir\b[^.;!\n]{0,40}\bescadas?|\d+\s*(?:lances?|andares?)\s+de\s+escadas?|lances?\s+de\s+escadas?|acesso\s+(?:somente\s+)?por\s+escadas?)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      cleanedElevatorSources,
    );
  const hasNoElevator =
    (hasExplicitNoElevatorText || hasLowBuildingNoElevatorEvidence) &&
    (!isGroundFloorUnit || hasStairsToUnitText);
  const cleanedTrappedSources = elevatorSources
    .replace(
      /\b(?:(?:vagas?|estacionamento)\s+rotativ[oa]s?\s+(?:p[uú]blic[oa]s?\s+)?(?:(?:em|na)\s+frente|na\s+(?:rua|cal[cç]ada|via|avenida|quadra)|nas\s+ruas)|zona\s+azul)\b/gi,
      " ",
    )
    .replace(
    /\b(?:n[aã]o\s+(?:[eé]|s[aã]o)\s+(?:vagas?\s+)?(?:presas?|gavetas?|rotativas?)|sem\s+vagas?\s+(?:presas?|gavetas?|rotativas?)|sem\s+manobrista|vagas?\s+livres?\s*\(\s*n[aã]o\s+(?:[eé]|s[aã]o)\s+(?:vagas?\s+)?(?:presas?|gavetas?|rotativas?)\s*\)|\d+\s*vagas?\s+livres?\s+e\s+\d+\s*(?:vagas?\s+)?(?:presas?|gavetas?)|\d+\s*(?:vagas?\s+)?(?:presas?|gavetas?)\s+e\s+\d+\s*vagas?\s+livres?)\b/gi,
    " ",
  );
  const hasTrappedParking =
    /\b(?:vagas?\s+(?:de\s+garagem\s+)?(?:(?:cobertas?|descobertas?|demarcadas?|fixas?)\s+(?:e\s+)?)?presas?|vaga\s+de\s+garagem\s*\(\s*presa\s*\)|garagem\s+presa|vagas?\s+bloqueadas?|vagas?\s+(?:de\s+garagem\s+)?(?:tipo\s+|em\s+)?gavetas?|garagem\s+(?:tipo\s+|em\s+)?gavetas?|vagas?\s+(?:de\s+garagem\s+)?(?:rotativas?|coletivas?|sujeitas?\s+a\s+sorteio)|garagem\s+(?:rotativa|coletiva)|sorteio\s+de\s+vagas?|vagas?\s+(?:de\s+garagem\s+)?com\s+(?:servi[cç]o\s+de\s+)?(?:manobrista|valet)|garagem\s+com\s+(?:servi[cç]o\s+de\s+)?(?:manobrista|valet)|deixar\s+(?:a\s+)?chave\s+na\s+portaria)\b/i.test(
      cleanedTrappedSources,
    );

  const propKey = `${prop.provider}:${prop.id}`;
  const photoAudit: PhotoAuditOverride | undefined = PHOTO_AUDIT_OVERRIDES[propKey];

  // Ar-condicionado: +12 when confirmed by text/photos (or a checkbox on a new/renovated unit with modernity >= 85),
  // 0 when only a portal checkbox claims it, -10 when absent
  const { effectiveModernityScore } = calibrateRuntimeModernity(
    prop,
    photoAudit,
    buildFullLocationText(prop),
  );
  const isNewOrRenovatedUnit =
    prop.condition === "NEW_OR_RENOVATED" ||
    prop.positiveSignals.includes("Flag Novo/Reformado") ||
    (prop.constructionYear ?? 0) >= 2015 ||
    photoAudit?.modernityTier === "MODERN_OR_RENOVATED";
  const { acLabel, acStatus } = resolveAcEvidence(prop, photoAudit, {
    trustCheckbox: isNewOrRenovatedUnit && effectiveModernityScore >= 85,
  });
  if (acStatus === "confirmed") {
    pts += 12.0;
    greenTags.push(acLabel!);
    highlights.push(acLabel!);
  } else if (acStatus === "unconfirmed") {
    warningTags.push(AC_UNCONFIRMED_TAG);
    warnings.push(
      "Ar-condicionado só marcado no checklist do portal (texto e fotos não confirmam): 0 pts até confirmar",
    );
  } else {
    pts -= 10.0;
    redTags.push(AC_ABSENT_TAG);
    if (photoAudit?.falseAC) {
      const acWarn =
        (photoAudit.visualWarnings ?? []).find((w) =>
          /auditoria visual:.*ar-condicionado/i.test(w),
        ) ??
        "Auditoria visual: anúncio marca ar-condicionado mas não há Split instalado nas fotos";
      warnings.push(acWarn);
    } else {
      warnings.push("Sem ar-condicionado (-10 pts base)");
    }
  }

  const isMegaCondo =
    (installs.has("brinquedoteca") &&
      installs.has("playground") &&
      installs.has("quadra esportiva") &&
      installs.has("salão de jogos")) ||
    /(?<![a-zA-ZÀ-ÿ0-9_])(m[uú]ltiplas torres|\d+ torres|bloco [b-z])(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullDesc);

  // 1. Luz, Silêncio e Ventilação (comfort_commodities + texto)
  const hasFreeViewText =
    /(?<![a-zA-ZÀ-ÿ0-9_])(vista (?:livre|definitiva|panor[aâ]mica|inexplic[aá]vel|incr[ií]vel|permanente|desimpedida|aberta|para\s+(?:o\s+|a\s+)?(?:mar|lagoa|p[aã]o\s+de\s+a[cç][uú]car|cristo|serra|montanha|parque|ba[ií]a|aterro))|bela\s+vista|indevassad[oa]|indevass[aá]vel)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullDesc,
    );
  const hasFreeViewCheckbox =
    comfort.has("vista livre") ||
    amenities.has("sea_view") ||
    amenities.has("mountain_view") ||
    amenities.has("lake_view") ||
    amenities.has("panoramic_view") ||
    amenities.has("exterior_view");
  const hasFreeView =
    !photoAudit?.falseFreeView && (hasFreeViewText || hasFreeViewCheckbox);
  const hasMorningSun =
    comfort.has("sol da manhã") || /(?<![a-zA-ZÀ-ÿ0-9_])sol da manh[aã](?![a-zA-ZÀ-ÿ0-9_])/i.test(fullDesc);

  if (hasFreeView && !hasFreeViewText && isMegaCondo) {
    // Sister towers usually block part of an owner-declared view in multi-tower condos.
    pts += 4.0;
    highlights.push("Vista livre parcial (megacondomínio)");
  } else if (hasFreeView) {
    pts += 8.0;
    highlights.push("Vista livre/definitiva");
  }
  if (hasMorningSun) {
    pts += 4.5;
    highlights.push("Sol da manhã");
  }
  const hasBusyStreetText =
    /(?<![a-zA-ZÀ-ÿ0-9_])(bares|barzinhos?|bo[eê]mi[oa]s?|vida\s+noturna|baladas?|casas?\s+noturnas?|postos?\s+(?:de\s+gasolina|de\s+combust[ií]vel|br|shell|ipiranga)|em\s+frente\s+(?:a|ao|aos|à|às)\s+(?:supermercados?|mercados?|posto)|(?:padaria|panificadora)[^.;\n]{0,25}24\s*h)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullDesc,
    );
  if (
    !hasBusyStreetText &&
    (comfort.has("rua silenciosa") || /\brua (tranquila|silenciosa|calma)\b/i.test(fullDesc))
  ) {
    pts += 3.0;
    highlights.push("Rua silenciosa");
  }
  if (comfort.has("janelas grandes") || /\bjanelas (grandes|amplas)\b/i.test(fullDesc)) {
    pts += 2.0;
    highlights.push("Janelas amplas");
  }
  if (comfort.has("janela anti-ruído") || /(?<![a-zA-ZÀ-ÿ0-9_])(antirru[ií]do|anti-ru[ií]do|ac[uú]stic[oa])(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullDesc)) {
    pts += 3.0;
    highlights.push("Janela antirruído");
  }

  // 2. Andar Alto & Bônus Último Andar / Duplex / Cobertura (Fortnite Rarity Hierarchy)
  let floorTag: FloorTag | null = null;
  let highFloorLabel: string | null = null;
  let lowFloorLabel: string | null = null;

  const explicitGroundText = isExplicitUnitGroundFloor(sentenceJoinedDesc);
  const textFloor = extractExplicitFloorFromText(sentenceJoinedDesc);
  const effectiveTotalFloors =
    prop.totalFloors !== null && prop.totalFloors > 0 ? prop.totalFloors : null;

  let normalizedPropFloor = prop.floor;
  if (normalizedPropFloor !== null && normalizedPropFloor > 45) {
    normalizedPropFloor =
      normalizedPropFloor <= 95 ? Math.floor(normalizedPropFloor / 10) : null;
  }

  let normalizedFloorRange = prop.floorRange;
  if (
    normalizedFloorRange &&
    normalizedFloorRange.min > 45 &&
    normalizedFloorRange.max <= 95
  ) {
    const inferred = Math.floor(normalizedFloorRange.min / 10);
    normalizedFloorRange = { min: inferred, max: inferred };
  }

  // On Zap Imóveis & VivaReal, unitFloor=0 is the API default when the agency did not fill in the floor
  const isOlxZeroFloorPlaceholder =
    normalizedPropFloor === 0 &&
    (prop.provider === "zapimoveis" ||
      prop.provider === "vivareal" ||
      prop.provider === "zap") &&
    !explicitGroundText;

  // In some CRMs feeding Zap/VivaReal, unitFloor=1 is filled as a default placeholder even in tall towers
  const isZapFirstFloorPlaceholder =
    normalizedPropFloor === 1 &&
    (prop.provider === "zapimoveis" ||
      prop.provider === "vivareal" ||
      prop.provider === "zap") &&
    textFloor === null &&
    !explicitGroundText &&
    !/(?<![a-zA-ZÀ-ÿ0-9_])(1[º°ªo]?\s*(?:andar|pavimento)|primeiro\s+(?:andar|pavimento)|andar\s+baixo|[aá]rea\s+privativa(?!\s*(?:de\s*)?\d)|garden|quintal)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      sentenceJoinedDesc,
    ) &&
    ((effectiveTotalFloors !== null && effectiveTotalFloors >= 8) ||
      hasFreeView ||
      /(?<![a-zA-ZÀ-ÿ0-9_])andar\s+(alto|m[eé]dio|intermedi[aá]rio)(?![a-zA-ZÀ-ÿ0-9_])/i.test(sentenceJoinedDesc));

  let effectiveFloor =
    isOlxZeroFloorPlaceholder || isZapFirstFloorPlaceholder
      ? null
      : normalizedPropFloor;

  if (
    explicitGroundText &&
    (effectiveFloor === null || effectiveFloor === 0) &&
    textFloor === null
  ) {
    effectiveFloor = 0;
  } else if (
    effectiveFloor === null &&
    normalizedFloorRange === null &&
    textFloor !== null
  ) {
    effectiveFloor = textFloor;
  } else if (
    effectiveFloor !== null &&
    effectiveFloor <= 3 &&
    textFloor !== null &&
    textFloor >= 4
  ) {
    effectiveFloor = textFloor;
  } else if (
    normalizedFloorRange !== null &&
    normalizedFloorRange.min <= 3 &&
    textFloor !== null &&
    textFloor >= 4
  ) {
    effectiveFloor = textFloor;
  } else if (
    normalizedFloorRange !== null &&
    normalizedFloorRange.min === 0 &&
    normalizedFloorRange.max === 3 &&
    textFloor !== null &&
    textFloor >= 1 &&
    textFloor <= 3
  ) {
    effectiveFloor = textFloor;
  }

  const minFloor = effectiveFloor ?? normalizedFloorRange?.min ?? null;
  const maxFloor = effectiveFloor ?? normalizedFloorRange?.max ?? null;
  const floorHint = minFloor === null ? photoAudit?.floorHint : undefined;

  const isTopFloor = detectUnitTopFloor(
    sentenceJoinedDesc,
    effectiveFloor,
    effectiveTotalFloors,
  );
  const { isPenthouseText, isDuplex } = detectUnitPenthouseOrDuplex(sentenceJoinedDesc);
  // The portal's "Apartamento cobertura" checkbox needs the text, a top-floor match or a penthouse-sized area.
  const isPenthouse =
    isPenthouseText ||
    (amenities.has("apartamento cobertura") && (isTopFloor || prop.areaM2 >= 70));
  const hasLoftLayout =
    isDuplex ||
    /(?<![a-zA-ZÀ-ÿ0-9_])(loft|mezanino)(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullDesc) ||
    (photoAudit?.visualWarnings ?? []).some((w) => /\b(loft|mezanino)\b/i.test(w));
  const isSmallLoft = hasLoftLayout && prop.areaM2 < 60;
  const knownBuildingFloors =
    effectiveTotalFloors ?? (isTopFloor ? (effectiveFloor ?? textFloor) : null);
  const isLowRiseTopFloor =
    isTopFloor && knownBuildingFloors !== null && knownBuildingFloors < 5;
  const isRealTopFloor = isTopFloor && !isLowRiseTopFloor;
  const isElevatedEnoughForPremium =
    !isLowRiseTopFloor && (isRealTopFloor || (minFloor !== null ? minFloor >= 4 : isPenthouse));
  const hasPremiumPenthouse = isPenthouse && isElevatedEnoughForPremium;
  const hasPremiumDuplex = isDuplex && !isSmallLoft && isElevatedEnoughForPremium;
  const hasPremiumElevation = hasPremiumPenthouse || hasPremiumDuplex;

  if (hasPremiumElevation && isRealTopFloor) {
    pts += 18.0;
    highFloorLabel = "Cobertura / Duplex (Último andar)";
    floorTag = { label: highFloorLabel, rarity: "legendary" };
    highlights.push(highFloorLabel);
  } else if (hasPremiumElevation) {
    pts += 15.0;
    highFloorLabel = hasPremiumPenthouse ? "Cobertura" : "Duplex / Pé-direito duplo";
    floorTag = { label: highFloorLabel, rarity: "legendary" };
    highlights.push(highFloorLabel);
  } else if (isRealTopFloor) {
    pts += 15.0;
    highFloorLabel = minFloor
      ? `Último andar (${minFloor}º andar)`
      : "Último andar";
    floorTag = { label: highFloorLabel, rarity: "legendary" };
    highlights.push(highFloorLabel);
  }
  if (hasLoftLayout && !hasPremiumElevation) {
    pts += 3.0;
    highlights.push("Pé-direito duplo (loft)");
  }

  if (minFloor !== null) {
    if (minFloor >= 8) {
      pts += 11.0;
      const floorText = effectiveFloor
        ? `Andar alto (${effectiveFloor}º andar)`
        : `Andar alto (${minFloor}º–${maxFloor}º andar)`;
      if (!highFloorLabel) highFloorLabel = floorText;
      if (!floorTag) floorTag = { label: floorText, rarity: "epic" };
      highlights.push(floorText);
    } else if (
      amenities.has("andar alto") ||
      comfort.has("andar alto") ||
      /\bandar alto\b/i.test(fullDesc)
    ) {
      pts += 9.0;
      if (!highFloorLabel) highFloorLabel = "Andar alto";
      if (!floorTag) floorTag = { label: "Andar alto", rarity: "epic" };
      highlights.push("Andar alto");
    } else if (minFloor >= 4) {
      pts += 3.5;
      const midFloorText =
        effectiveFloor !== null
          ? `Andar médio (${effectiveFloor}º andar)`
          : maxFloor && maxFloor !== minFloor
            ? `Andar médio (${minFloor}º–${maxFloor}º andar)`
            : `Andar médio (${minFloor}º andar)`;
      if (!floorTag) floorTag = { label: midFloorText, rarity: "rare" };
      highlights.push(midFloorText);
    } else if (
      !floorTag &&
      (amenities.has("andar médio") ||
        amenities.has("andar intermediário") ||
        /(?<![a-zA-ZÀ-ÿ0-9_])andar (m[eé]dio|intermedi[aá]rio)(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullDesc))
    ) {
      pts += 3.5;
      floorTag = { label: "Andar médio", rarity: "rare" };
      highlights.push("Andar médio");
    }
  } else if (
    !highFloorLabel &&
    (amenities.has("andar alto") ||
      comfort.has("andar alto") ||
      /\bandar alto\b/i.test(fullDesc) ||
      floorHint === "HIGH")
  ) {
    pts += 9.0;
    highFloorLabel = "Andar alto";
    if (!floorTag) floorTag = { label: "Andar alto", rarity: "epic" };
    highlights.push("Andar alto");
  } else if (
    !floorTag &&
    (amenities.has("andar médio") ||
      amenities.has("andar intermediário") ||
      /(?<![a-zA-ZÀ-ÿ0-9_])andar (m[eé]dio|intermedi[aá]rio)(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullDesc) ||
      floorHint === "MID")
  ) {
    pts += 3.5;
    floorTag = { label: "Andar médio", rarity: "rare" };
    highlights.push("Andar médio");
  }

  if (hasFreeView) {
    greenTags.push("Vista livre");
  } else if (hasMorningSun) {
    greenTags.push("Sol da manhã");
  }

  if (!isRealTopFloor && !hasPremiumElevation && !highFloorLabel && !floorTag) {
    const isGroundFloor =
      effectiveFloor === 0 ||
      explicitGroundText ||
      (minFloor === 0 && (maxFloor === null || maxFloor <= 1));

    if (isGroundFloor) {
      lowFloorLabel = "Térreo";
      floorTag = { label: "Térreo", rarity: "common" };
    } else if (effectiveFloor !== null && effectiveFloor >= 1 && effectiveFloor <= 3) {
      lowFloorLabel = `Andar baixo (${effectiveFloor}º andar)`;
      floorTag = { label: lowFloorLabel, rarity: "uncommon" };
    } else if (minFloor !== null && minFloor <= 3) {
      const displayMin = minFloor === 0 ? 1 : minFloor;
      lowFloorLabel =
        maxFloor && maxFloor !== displayMin
          ? `Andar baixo (${displayMin}º–${maxFloor}º andar)`
          : `Andar baixo (${displayMin}º andar)`;
      floorTag = { label: lowFloorLabel, rarity: "uncommon" };
    } else if (minFloor === null) {
      if (/\bandar baixo\b/i.test(fullDesc) || floorHint === "LOW") {
        lowFloorLabel = "Andar baixo";
        floorTag = { label: lowFloorLabel, rarity: "uncommon" };
      }
    }

    if (floorTag?.rarity === "common") {
      pts -= 24.0;
      warnings.push("Térreo (maior ruído de rua e menor privacidade: -24 pts base)");
    } else if (floorTag?.rarity === "uncommon") {
      const isFirstFloor =
        effectiveFloor === 1 ||
        (minFloor !== null && minFloor <= 1) ||
        /\b1[º°](?:\s*[–-]\s*\d+[º°])?\s*andar\b/i.test(lowFloorLabel ?? "");
      const hasPrivatePatio =
        amenities.has("área privativa") ||
        amenities.has("area privativa") ||
        amenities.has("garden") ||
        amenities.has("quintal") ||
        /(?<![a-zA-ZÀ-ÿ0-9_])([aá]rea privativa(?!\s*(?:de\s*)?\d)|apartamento garden|apto garden|tipo garden|quintal privativo|terra[cç]o privativo)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
          fullDesc,
        );
      const isSlopedNeighborhood = SLOPED_HILLSIDE_NEIGHBORHOODS.has(
        `${prop.cityCode.toLowerCase()}:${prop.neighborhood.trim().toLowerCase()}`,
      );

      let lowFloorPenalty = isFirstFloor ? 22.0 : 18.0;
      if (hasFreeView && isSlopedNeighborhood) {
        lowFloorPenalty = isFirstFloor ? 9.0 : 5.0;
        warnings.push(
          `${lowFloorLabel ?? "Andar baixo"} compensado por topografia em desnível e vista livre (-${lowFloorPenalty} pts base)`,
        );
      } else if (hasFreeView || hasPrivatePatio) {
        lowFloorPenalty = 16.0;
        warnings.push(
          `${lowFloorLabel ?? "Andar baixo"} atenuado por ${hasFreeView ? "vista livre" : "área privativa/garden"} (-${lowFloorPenalty} pts base)`,
        );
      } else {
        warnings.push(`${lowFloorLabel ?? "Andar baixo"} (-${lowFloorPenalty} pts base)`);
      }
      pts -= lowFloorPenalty;
    }
  }

  // 3. Parques, Shoppings e Metrô ao redor (places_nearby)
  const places = prop.placesNearby ?? [];
  const parksNearby = [
    ...new Set(
      places
        .filter((p) => p.type === "PARK_OR_GREEN_AREA")
        .map((p) => p.name),
    ),
  ];
  const mallsNearby = [
    ...new Set(
      places
        .filter((p) => p.type === "SHOPPING_MALL")
        .map((p) => p.name),
    ),
  ];
  const subwayNearby = [
    ...new Set(
      places
        .filter((p) => p.type === "ESTACAO_METRO_OU_TREM")
        .map((p) => p.name),
    ),
  ];

  if (parksNearby.length > 0) {
    pts += 3.0;
    highlights.push(`Parque/Praça próx.: ${parksNearby.slice(0, 2).join(", ")}`);
  }
  if (mallsNearby.length > 0) {
    pts += 1.5;
    highlights.push(`Shopping próx.: ${mallsNearby[0]}`);
  }
  if (subwayNearby.length > 0 || prop.nearSubway || installs.has("perto de metrô ou trem")) {
    pts += 1.5;
    highlights.push(
      subwayNearby[0] ? `Metrô próx.: ${subwayNearby[0]}` : "Próximo ao metrô",
    );
  }

  // 4. Praticidade para sua mudança de Brasília (Área de serviço, Vaga livre vs presa, Portaria)
  const hasServiceArea =
    amenities.has("área de serviço") ||
    amenities.has("area_de_servico") ||
    amenities.has("service_area") ||
    practicality.has("tanque") ||
    captions.includes("área de serviço") ||
    /(?<![a-zA-ZÀ-ÿ0-9_])[aá]rea de servi[cç]o(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullDesc);
  if (hasServiceArea) {
    pts += 2.0;
    highlights.push("Área de serviço p/ máquinas");
  }

  const rawHasGourmetBalcony =
    amenities.has("varanda gourmet") ||
    amenities.has("gourmet_balcony") ||
    /\b(varanda\s+gourmet|sacada\s+gourmet|churrasqueira\s+na\s+varanda)\b/i.test(
      fullDesc,
    );
  const hasNoBalconyInAudit =
    photoAudit?.falseGourmet === true &&
    (photoAudit.visualWarnings ?? []).some((w) =>
      /n[aã]o possui varanda|sem varanda gourmet\s*\(\s*n[aã]o possui varanda/i.test(w),
    );
  const isBalconyIntegratedText =
    /(?<![a-zA-ZÀ-ÿ0-9_])(?:varanda|sacada|terra[cç]o)\s+(?:foi\s+|totalmente\s+)?(?:integrad[oa]|incorporad[oa]|fechad[oa](?!\s+(?:com|em|por)\s+(?:vidro|cortina)))/i.test(
      fullDesc,
    );
  const isBalconyRuledOut =
    !photoAudit?.verifiedBalcony && (hasNoBalconyInAudit || isBalconyIntegratedText);
  const hasGourmetBalcony =
    !photoAudit?.falseGourmet && !isBalconyRuledOut && rawHasGourmetBalcony;
  const hasBalcony =
    photoAudit?.verifiedBalcony === true ||
    (!isBalconyRuledOut &&
      (hasGourmetBalcony ||
        amenities.has("varanda") ||
        amenities.has("balcony") ||
        captions.includes("varanda") ||
        /\b(varanda|sacada)\b/i.test(fullDesc)));
  if (hasGourmetBalcony) {
    pts += 6.5;
    highlights.push("Varanda gourmet");
  } else if (hasBalcony) {
    pts += 5.0;
    highlights.push("Varanda");
  }

  // An explicit "no doorman" structured field beats text like "biometria" / "acesso por app".
  const has24hDoorman =
    prop.doorman !== "NotAvailable" &&
    (prop.doorman === "NightAndDayShift" ||
      prop.doorman === "24h" ||
      installs.has("portaria_24h") ||
      amenities.has("concierge_24h") ||
      /\b(portaria 24|porteiro 24|portaria virtual|biometria)\b/i.test(fullDesc));
  if (has24hDoorman) {
    pts += 6.0;
    highlights.push("Portaria 24h / Biometria");
  } else if (prop.doorman === "NotAvailable") {
    const noDoormanPenalty =
      floorTag?.rarity === "common" || floorTag?.rarity === "uncommon"
        ? 25.0
        : 6.0;
    pts -= noDoormanPenalty;
    warnings.push(`Sem portaria 24h (-${noDoormanPenalty} pts base)`);
  } else if (
    prop.doorman === null &&
    (amenities.has("armored_security_cabin") ||
      /(?<![a-zA-ZÀ-ÿ0-9_])guaritas?(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullDesc))
  ) {
    pts += 2.5;
    highlights.push("Guarita de segurança");
  }

  const hasPoolOrGym =
    installs.has("piscina") ||
    installs.has("academia") ||
    amenities.has("pool") ||
    amenities.has("piscina") ||
    amenities.has("gym") ||
    amenities.has("fitness_room") ||
    amenities.has("academia") ||
    prop.positiveSignals.some((s) =>
      /piscina\s+e\s+academia/i.test(s),
    ) ||
    /\b(piscina|academia|espa[cç]o\s+fitness)\b/i.test(fullDesc);
  if (hasPoolOrGym) {
    pts += 1.5;
  }

  if (hasActiveSaleListing(prop)) {
    pts -= 4.0;
    warnings.push("Imóvel também à venda (-4 pts base)");
  }

  if (
    /\bvagas? (de garagem )?(cobertas? e )?(livres?|individuais?|demarcadas?|fixas?)\b/i.test(fullDesc)
  ) {
    pts += 5.0;
    highlights.push("Vaga livre e demarcada");
  } else if (hasTrappedParking) {
    pts -= 4.0;
    warnings.push("Vaga presa / gaveta");
  }

  const hasIndividualUtilities =
    /(?<![a-zA-ZÀ-ÿ0-9_])(?:(?:[aá]gua|g[aá]s)(?:\s+e\s+(?:de\s+)?(?:[aá]gua|g[aá]s))?\s+(?:individua(?:l|is|lizad[oa]s?)|separad[oa]s?|medid[oa]s?)|consumos?\s+[^.;\n]{0,30}?individua(?:l|is))/i.test(
      fullDesc,
    );
  if (
    !hasIndividualUtilities &&
    /(?<![a-zA-ZÀ-ÿ0-9_])((?:[aá]gua e g[aá]s|[aá]gua|g[aá]s)\s+(?:inclus[oa]s?|inclu[ií]d[oa]s?)|condom[ií]nio\s+(?:j[aá]\s+)?inclui\s+(?:[aá]gua|g[aá]s))(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullDesc,
    )
  ) {
    pts += 2.5;
    highlights.push("Água/gás inclusos no condomínio");
  }

  // Interior Finish Priority: Planned Cabinetry + Modern Bath/Kitchen + Good Flooring
  const hasKitchenCabinetry =
    amenities.has("armários na cozinha") ||
    amenities.has("kitchen_cabinets") ||
    practicality.has("armários na cozinha") ||
    /(?<![a-zA-ZÀ-ÿ0-9_])arm[aá]rios?\s+(?:planejados?\s+)?na\s+cozinha\b/i.test(fullDesc);
  const hasBedroomOrBathCabinetry =
    amenities.has("armários no quarto") ||
    amenities.has("armários no banheiro") ||
    amenities.has("builtin_wardrobe") ||
    amenities.has("bedroom_wardrobe") ||
    amenities.has("bathroom_cabinets") ||
    practicality.has("armários no quarto") ||
    practicality.has("armários no banheiro") ||
    /(?<![a-zA-ZÀ-ÿ0-9_])arm[aá]rios?\s+(?:planejados?\s+)?(?:nos?\s+quartos?|na\s+su[ií]te|nos?\s+banheiros?)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullDesc,
    );
  const hasExplicitPlannedCabinetry =
    amenities.has("marcenaria planejada") ||
    amenities.has("planned_furniture") ||
    prop.positiveSignals.includes("Marcenaria planejada / Painel") ||
    /(?<![a-zA-ZÀ-ÿ0-9_])(marcenaria\s+planejada|arm[aá]rios?\s+planejados?|m[oó]veis\s+planejados?|arm[aá]rios?\s+sob\s+medida)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullDesc,
    );
  const isVerifiedModernInAudit =
    photoAudit?.modernityTier === "MODERN_OR_RENOVATED" &&
    !(photoAudit.visualWarnings ?? []).some((w) =>
      /aus[eê]ncia total de arm[aá]rios|sem nenhum arm[aá]rio|quartos sem arm[aá]rios/i.test(
        w,
      ),
    );
  const isDatedInAudit = photoAudit?.modernityTier === "DATED" || photoAudit?.hardExcludeDated === true;

  const hasNoCabinetsInAudit = photoAudit?.noCabinets === true;

  if (
    !isDatedInAudit &&
    !hasNoCabinetsInAudit &&
    (hasExplicitPlannedCabinetry ||
      (isVerifiedModernInAudit && (hasKitchenCabinetry || hasBedroomOrBathCabinetry)))
  ) {
    pts += 5.0;
    highlights.push("Marcenaria / armários planejados");
  } else if (
    !isDatedInAudit &&
    !hasNoCabinetsInAudit &&
    (hasKitchenCabinetry ||
      hasBedroomOrBathCabinetry ||
      /(?<![a-zA-ZÀ-ÿ0-9_])(com\s+arm[aá]rios|arm[aá]rios\s+embutidos)(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullDesc))
  ) {
    pts += 2.0;
    highlights.push("Armários instalados");
  }

  // A filled-in QuintoAndar checklist (>= 6 items; most listings carry 0-3) lists every cabinet item the unit has,
  // so none of them and no cabinet text means a bare shell.
  const hasAnyCabinetEvidence =
    hasKitchenCabinetry ||
    hasBedroomOrBathCabinetry ||
    hasExplicitPlannedCabinetry ||
    amenities.has("closet") ||
    /(?<![a-zA-ZÀ-ÿ0-9_])(arm[aá]rios?|marcenaria|planejad[oa]s?|closet|guarda[- ]?roupas?)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullDesc,
    );
  const isChecklistBareShell =
    prop.provider === "quintoandar" &&
    amenities.size + practicality.size >= 6 &&
    !hasAnyCabinetEvidence;
  const isBareShell = hasNoCabinetsInAudit || isChecklistBareShell;
  if (isBareShell) {
    pts -= 6.0;
    warnings.push("Sem nenhum armário (cozinha/quartos/banheiros) — custo de marcenaria (-6 pts base)");
    const hasShowerBox =
      amenities.has("box") ||
      amenities.has("blindex_box") ||
      practicality.has("box") ||
      practicality.has("box blindex") ||
      /(?<![a-zA-ZÀ-ÿ0-9_])box(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullDesc);
    if (!hasShowerBox) {
      pts -= 2.0;
      warnings.push("Banheiro sem box (-2 pts base)");
    }
  }

  const hasModernFlooring =
    amenities.has("porcelain") ||
    amenities.has("laminated_floor") ||
    amenities.has("vinyl_floor") ||
    prop.positiveSignals.includes("Porcelanato / Vinílico") ||
    /(?<![a-zA-ZÀ-ÿ0-9_])(porcelanato|piso\s+vin[ií]lico|vin[ií]lico|piso\s+laminado|laminado)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullDesc,
    );
  const hasBlindexAndCountertop =
    (amenities.has("box") ||
      amenities.has("blindex_box") ||
      practicality.has("box") ||
      practicality.has("box blindex") ||
      /\b(box\s+blindex|blindex|box\s+de\s+vidro)\b/i.test(fullDesc)) &&
    /(?<![a-zA-ZÀ-ÿ0-9_])(bancada\s+(?:em\s+|de\s+)?(?:granito|quartzo|m[aá]rmore|silestone|nanoglass)|granito|quartzo)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullDesc,
    );

  if (hasModernFlooring || hasBlindexAndCountertop) {
    pts += 3.5;
    if (hasModernFlooring) {
      highlights.push("Piso moderno (porcelanato/vinílico)");
    } else {
      highlights.push("Box blindex e bancada moderna");
    }
  }

  // 5. Alerta de Megacondomínio Familiar ("Cidade dentro do condomínio") vs Torre Única
  const isReservedBuilding =
    /(?<![a-zA-ZÀ-ÿ0-9_])(torre [uú]nica|pr[eé]dio pequeno|poucos moradores|1 por andar|2 por andar)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullDesc,
    );

  if (isReservedBuilding) {
    pts += 3.5;
    highlights.push("Torre única / Prédio reservado");
    greenTags.push("Torre única / Reservado");
  } else if (isMegaCondo && penalizeMegaCondo) {
    pts -= 4.0;
    warnings.push("Perfil megacondomínio familiar (brinquedoteca + playground + quadra + jogos)");
  }

  if (prop.constructionYear && prop.constructionYear >= 2010) {
    greenTags.push(`Prédio Novo (${prop.constructionYear})`);
  } else if (
    /(?<![a-zA-ZÀ-ÿ0-9_])(primeira loca[cç][aã]o|1[aª] loca[cç][aã]o|rec[eé]m[- ]entregue|pr[eé]dio (super )?novo)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullDesc,
    )
  ) {
    greenTags.push("Prédio Novo / 1ª Locação");
  }

  // 6. Micro-localização de Rua: Detector Anti-Bunker / Corredor Arterial vs Eixo Caminhável
  const microEnv = evaluateStreetMicroEnvironment(prop);
  if (microEnv.pointsDelta !== 0) {
    pts += microEnv.pointsDelta;
  }
  if (microEnv.highlight && !highlights.includes(microEnv.highlight)) {
    highlights.push(microEnv.highlight);
  }
  if (microEnv.warning && !warnings.includes(microEnv.warning)) {
    warnings.unshift(microEnv.warning);
  }
  if (microEnv.greenTag && !greenTags.includes(microEnv.greenTag)) {
    greenTags.push(microEnv.greenTag);
  }
  if (microEnv.redTag && !redTags.includes(microEnv.redTag)) {
    redTags.unshift(microEnv.redTag);
  }

  const hospitalCluster = findHospitalNoiseCluster(prop);
  const auditHospitalWarning = (photoAudit?.visualWarnings ?? []).find((w) => /hospita/i.test(w));
  if (hospitalCluster || auditHospitalWarning) {
    const hospitalPenalty = minFloor !== null && minFloor >= 8 ? 1.5 : 3.0;
    pts -= hospitalPenalty;
    warnings.push(
      `Entorno hospitalar${hospitalCluster ? ` (${hospitalCluster.name}, ~400 m)` : ""}: sirenes e fluxo de ambulâncias (-${hospitalPenalty} pts base)`,
    );
    warningTags.push(HOSPITAL_NOISE_TAG);
  }

  const ownFurnitureText = describeFurnitureInText(prop.description);
  const portalFurnitureTier =
    photoAudit?.furnishedTier ??
    (prop.furnished === true ? "FULLY_FURNISHED" : prop.furnished === false ? "UNFURNISHED" : null);
  if (
    (ownFurnitureText === "furnished" && portalFurnitureTier === "UNFURNISHED") ||
    (ownFurnitureText === "unfurnished" && portalFurnitureTier === "FULLY_FURNISHED")
  ) {
    warningTags.push(FURNITURE_CONFLICT_TAG);
    warnings.push(
      ownFurnitureText === "furnished"
        ? "Descrição diz mobiliado, mas portal/fotos indicam sem mobília — confirmar (sem impacto na nota)"
        : "Descrição diz sem mobília, mas portal/fotos indicam mobiliado — confirmar (sem impacto na nota)",
    );
  }

  if (prop.listedRent !== undefined) {
    warningTags.push(PRICE_MISMATCH_TAG);
    warnings.push(
      `Descrição informa aluguel de R$ ${fmtIntPtBr(prop.rent)} (portal: R$ ${fmtIntPtBr(prop.listedRent)}); total calculado com o maior valor`,
    );
  }
  if (prop.listedIptu !== undefined) {
    warnings.push(
      `IPTU estimado em R$ ${fmtIntPtBr(prop.iptu)}/mês (~R$ ${IPTU_ESTIMATE_PER_M2.toFixed(2).replace(".", ",")}/m²; portal informa R$ ${fmtIntPtBr(prop.listedIptu)})`,
    );
  }
  for (const twinKey of prop.alsoListedOn ?? []) {
    const provider = twinKey.split(":")[0] as SlimPropertyRecord["provider"];
    const tag = `Também anunciado em ${PROVIDER_LABELS[provider] ?? provider}`;
    if (!warningTags.includes(tag)) warningTags.push(tag);
  }

  // Build Red Tags (floor badge is rendered separately via floorTag)
  if (isMegaCondo) {
    redTags.push("Megacondomínio");
  }
  if (prop.parkingSpaces < 1) {
    redTags.push("Sem vaga de garagem");
  }
  if (hasNoElevator) {
    redTags.push("Sem elevador");
  }
  if (hasTrappedParking) {
    redTags.push("Vaga presa / gaveta");
  }
  if (photoAudit?.visualWarnings && photoAudit.visualWarnings.length > 0) {
    for (const vw of photoAudit.visualWarnings) {
      if (!warnings.includes(vw)) {
        warnings.push(vw);
      }
    }
  }
  if (photoAudit?.hasMaintenanceIssue && !redTags.includes("Infiltração / Manutenção Crítica")) {
    redTags.push("Infiltração / Manutenção Crítica");
  }

  const result: ApartmentNuancesEvaluation = {
    rawNuancePoints: Math.round(pts * 10) / 10,
    nuanceHighlights: highlights,
    nuanceWarnings: warnings,
    parksNearby,
    mallsNearby,
    acLabel,
    floorTag,
    highFloorLabel,
    lowFloorLabel,
    hasNoElevator,
    hasTrappedParking,
    isBareShell,
    greenTags,
    redTags,
    warningTags,
  };
  cache.set(prop, {
    ...result,
    nuanceHighlights: [...result.nuanceHighlights],
    nuanceWarnings: [...result.nuanceWarnings],
    parksNearby: [...result.parksNearby],
    mallsNearby: [...result.mallsNearby],
    greenTags: [...result.greenTags],
    redTags: [...result.redTags],
    warningTags: [...result.warningTags],
  });
  return result;
}

function formatListPt(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

const ZAP_AMENITY_TRANSLATIONS: Record<string, { label: string; category: "interior" | "condo" | "skip" }> = {
  ELEVATOR: { label: "Elevador", category: "condo" },
  POOL: { label: "Piscina", category: "condo" },
  GYM: { label: "Academia", category: "condo" },
  FITNESS_ROOM: { label: "Academia", category: "condo" },
  SAUNA: { label: "Sauna", category: "condo" },
  PARTY_HALL: { label: "Salão de festas", category: "condo" },
  BARBECUE_GRILL: { label: "Churrasqueira", category: "condo" },
  GOURMET_SPACE: { label: "Espaço gourmet", category: "condo" },
  PLAYGROUND: { label: "Playground", category: "condo" },
  SPORTS_COURT: { label: "Quadra esportiva", category: "condo" },
  TOY_LIBRARY: { label: "Brinquedoteca", category: "condo" },
  GAMES_ROOM: { label: "Salão de jogos", category: "condo" },
  CONCIERGE_24H: { label: "Portaria 24h", category: "condo" },
  WATCHMAN: { label: "Vigilância / Guarita", category: "condo" },
  SAFETY_CIRCUIT: { label: "Circuito de segurança", category: "condo" },
  ELECTRONIC_GATE: { label: "Portão eletrônico", category: "condo" },
  INTERCOM: { label: "Interfone", category: "condo" },
  GARDEN: { label: "Jardim / Área verde", category: "condo" },
  GREEN_AREA: { label: "Área verde", category: "condo" },
  BICYCLES_PLACE: { label: "Bicicletário", category: "condo" },
  COWORKING: { label: "Coworking", category: "condo" },
  LAUNDRY: { label: "Lavanderia no prédio", category: "condo" },
  PETS_ALLOWED: { label: "Aceita pets", category: "condo" },
  GATED_COMMUNITY: { label: "Condomínio fechado", category: "condo" },
  DISABLED_ACCESS: { label: "Acesso sem degraus", category: "condo" },
  BALCONY: { label: "Varanda", category: "interior" },
  GOURMET_BALCONY: { label: "Varanda gourmet", category: "interior" },
  SERVICE_AREA: { label: "Área de serviço", category: "interior" },
  BUILTIN_WARDROBE: { label: "Armários no quarto", category: "interior" },
  KITCHEN_CABINETS: { label: "Armários na cozinha", category: "interior" },
  BATHROOM_CABINETS: { label: "Armários no banheiro", category: "interior" },
  PLANNED_FURNITURE: { label: "Marcenaria planejada", category: "interior" },
  AMERICAN_KITCHEN: { label: "Cozinha americana", category: "interior" },
  CLOSET: { label: "Closet", category: "interior" },
  HOME_OFFICE: { label: "Espaço home office", category: "interior" },
  GAS_SHOWER: { label: "Chuveiro a gás", category: "interior" },
  HEATING: { label: "Aquecimento a gás", category: "interior" },
  SOUNDPROOFING: { label: "Isolamento acústico", category: "interior" },
  LARGE_WINDOW: { label: "Janelas grandes", category: "interior" },
  BLINDEX_BOX: { label: "Box de vidro", category: "interior" },
  FULL_CABLING: { label: "Cabeamento estruturado", category: "interior" },
  // Skip items already represented in card specs or badges
  GARAGE: { label: "Garagem", category: "skip" },
  KITCHEN: { label: "Cozinha", category: "skip" },
  FURNISHED: { label: "Mobiliado", category: "skip" },
  AIR_CONDITIONING: { label: "Ar-condicionado", category: "skip" },
  NEAR_SUBWAY: { label: "Próximo ao metrô", category: "skip" },
  APARTMENT_COBERTURA: { label: "Cobertura", category: "skip" },
};

const ptBrIntCache = new Map<number, string>();
const ptBrIntFormatter = new Intl.NumberFormat("pt-BR");
function fmtIntPtBr(n: number): string {
  const hit = ptBrIntCache.get(n);
  if (hit !== undefined) return hit;
  const formatted = ptBrIntFormatter.format(n);
  ptBrIntCache.set(n, formatted);
  return formatted;
}

const categorizedFeaturesCache = new WeakMap<
  SlimPropertyRecord,
  { interiorFeatures: string[]; condoFeatures: string[] }
>();

/**
 * Normalizes and splits raw commodities/amenities/installations into non-overlapping
 * interior features vs. condominium installations for clean UI display, omitting
 * items already shown in top-level card pills.
 */
export function categorizePropertyFeatures(prop: SlimPropertyRecord): {
  interiorFeatures: string[];
  condoFeatures: string[];
} {
  const cached = categorizedFeaturesCache.get(prop);
  if (cached) return cached;

  const interiorMap = new Map<string, string>();
  const condoMap = new Map<string, string>();

  const normKey = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\s-]+/g, " ");

  // Items already shown in card pills/specs
  const skipNormalized = new Set([
    "ar condicionado",
    "ar condicionado split",
    "air conditioning",
    "vista livre",
    "sol da manha",
    "mobiliado",
    "furnished",
    "garagem",
    "garage",
    "cozinha",
    "kitchen",
    "apartamento cobertura",
    "perto de metro ou trem",
    "near subway",
    "pode ter animais de estimacao",
  ]);

  const condoKeywords =
    /(?<![a-zA-ZÀ-ÿ0-9_])(elevador|portaria|piscina|academia|fitness|sauna|sal[aã]o|churrasqueira|gourmet|playground|quadra|brinquedoteca|jogos|jardim|[aá]rea verde|biciclet[aá]rio|coworking|lavanderia|corrim[aã]o|rampa|acess[ií]vel|g[aá]s encanado|guarita|seguran[cç]a|port[aã]o|interfone|condom[ií]nio|pets)(?![a-zA-ZÀ-ÿ0-9_])/i;

  const addItem = (raw: string, preferredBucket: "interior" | "condo") => {
    const trimmed = raw.trim();
    if (!trimmed) return;

    const upper = trimmed.toUpperCase().replace(/[\s-]+/g, "_");
    const mapped = ZAP_AMENITY_TRANSLATIONS[upper];
    if (mapped) {
      if (mapped.category === "skip") return;
      const k = normKey(mapped.label);
      if (mapped.category === "condo") {
        if (!condoMap.has(k) && !interiorMap.has(k)) {
          condoMap.set(k, mapped.label);
        }
      } else if (!interiorMap.has(k) && !condoMap.has(k)) {
        interiorMap.set(k, mapped.label);
      }
      return;
    }

    const k = normKey(trimmed);
    if (skipNormalized.has(k)) return;

    // Clean screaming snake case or uppercase strings
    let display = trimmed;
    if (/^[A-Z0-9_]+$/.test(trimmed)) {
      const human = trimmed.toLowerCase().replace(/_/g, " ");
      display = human.charAt(0).toUpperCase() + human.slice(1);
    }

    const bucket = condoKeywords.test(display) ? "condo" : preferredBucket;
    if (bucket === "condo") {
      if (!condoMap.has(k) && !interiorMap.has(k)) {
        condoMap.set(k, display);
      }
    } else if (!interiorMap.has(k) && !condoMap.has(k)) {
      interiorMap.set(k, display);
    }
  };

  for (const item of prop.comfortCommodities ?? []) addItem(item, "interior");
  for (const item of prop.practicalityCommodities ?? []) addItem(item, "interior");
  for (const item of prop.installations ?? []) addItem(item, "condo");
  for (const item of prop.amenities ?? []) addItem(item, "interior");

  const result = {
    interiorFeatures: [...interiorMap.values()],
    condoFeatures: [...condoMap.values()],
  };
  categorizedFeaturesCache.set(prop, result);
  return result;
}

function stripParentheticalClauses(
  input: string,
  predicate?: (inner: string) => boolean,
): string {
  let out = "";
  let i = 0;
  while (i < input.length) {
    const open = input.indexOf("(", i);
    if (open === -1) {
      out += input.slice(i);
      break;
    }
    const close = input.indexOf(")", open + 1);
    if (close === -1) {
      out += input.slice(i);
      break;
    }
    out += input.slice(i, open);
    const inner = input.slice(open + 1, close);
    if (predicate && !predicate(inner)) {
      out += input.slice(open, close + 1);
    }
    i = close + 1;
  }
  return out;
}

function resolveOfficeReference(
  cityCode: CityHubCode,
  catalogNb: ComputedNeighborhood | undefined,
  nbCommute: string,
): { commuteTimeText: string; officeLabel: string } {
  const officeByCity: Record<CityHubCode, string> = {
    BH: "escritório do Nubank",
    CP: "hub em Viracopos",
    RJ: "hub no Porto Maravilha",
    SP: "escritório na Capote Valente",
    BSB: "Parque de Águas Claras (Referência BSB)",
  };
  let rawTime = "";
  if (catalogNb) {
    rawTime = catalogNb.commuteTime;
  } else {
    const withoutParens = stripParentheticalClauses(nbCommute);
    const nubankIdx = withoutParens.toLowerCase().indexOf("do nubank");
    const beforeNubank =
      nubankIdx === -1 ? withoutParens : withoutParens.slice(0, nubankIdx);
    rawTime = beforeNubank.replace(/^~/, "").trim();
  }

  return {
    commuteTimeText: rawTime || "20 min",
    officeLabel: officeByCity[cityCode] ?? "escritório do Nubank",
  };
}

const commuteMinutesCache = new Map<
  string,
  { minutes: number | null; label: string }
>();

export function parseCommuteMinutes(
  commuteText: string,
  isDeepWestBarra?: boolean,
): { minutes: number | null; label: string } {
  if (isDeepWestBarra) {
    return { minutes: 85, label: "75–100 min" };
  }
  const cacheKey = commuteText ?? "";
  const hit = commuteMinutesCache.get(cacheKey);
  if (hit) return hit;

  const raw = cacheKey.trim();
  if (/benchmark|[aá]guas claras|\bbsb\b/i.test(raw) && !/\b\d{1,3}[ \t]{0,3}min/i.test(raw)) {
    const res = { minutes: null, label: "Ref. BSB" };
    commuteMinutesCache.set(cacheKey, res);
    return res;
  }

  const withoutParens = stripParentheticalClauses(raw);
  const nubankIdx = withoutParens.toLowerCase().indexOf("do nubank");
  const cleaned = (
    nubankIdx === -1 ? withoutParens : withoutParens.slice(0, nubankIdx)
  )
    .replace(/^~/, "")
    .trim();

  // Hour range notation: e.g. "1h a 1h30", "1h-1h30"
  const hourRangeMatch = cleaned.match(
    /\b(\d{1,2})[ \t]{0,2}h(?:oras?)?[ \t]{0,2}(\d{1,2})?(?:[ \t]{0,2}min(?:utos?)?)?[ \t]{0,3}[-–a][ \t]{0,3}(\d{1,2})[ \t]{0,2}h(?:oras?)?[ \t]{0,2}(\d{1,2})?(?:[ \t]{0,2}min(?:utos?)?)?/i,
  );
  if (hourRangeMatch) {
    const h1 = Number(hourRangeMatch[1]);
    const m1 = hourRangeMatch[2] ? Number(hourRangeMatch[2]) : 0;
    const h2 = Number(hourRangeMatch[3]);
    const m2 = hourRangeMatch[4] ? Number(hourRangeMatch[4]) : 0;
    const total1 = h1 * 60 + m1;
    const total2 = h2 * 60 + m2;
    if (Number.isFinite(total1) && Number.isFinite(total2)) {
      const res = {
        minutes: Math.round((total1 + total2) / 2),
        label: `${total1}–${total2} min`,
      };
      commuteMinutesCache.set(cacheKey, res);
      return res;
    }
  }

  // Single hour notation: e.g. "1h 20min", "1h30", "1 hora"
  const hourSingleMatch = cleaned.match(
    /\b(\d{1,2})[ \t]{0,2}(?:h\b|horas?\b|h(?=\d))(?:[ \t]{0,2}e)?(?:[ \t]{0,2}(\d{1,2})(?:[ \t]{0,2}min(?:utos?)?)?)?/i,
  );
  if (hourSingleMatch) {
    const h = Number(hourSingleMatch[1]);
    const m = hourSingleMatch[2] ? Number(hourSingleMatch[2]) : 0;
    const total = h * 60 + m;
    if (Number.isFinite(total) && total > 0) {
      const res = {
        minutes: total,
        label: `${total} min`,
      };
      commuteMinutesCache.set(cacheKey, res);
      return res;
    }
  }

  const rangeMatch = cleaned.match(/\b(\d{1,3})[ \t]{0,3}[-–a][ \t]{0,3}(\d{1,3})[ \t]{0,3}min/i);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const res = {
        minutes: Math.round((a + b) / 2),
        label: `${a}–${b} min`,
      };
      commuteMinutesCache.set(cacheKey, res);
      return res;
    }
  }

  const singleMatch = cleaned.match(/\b(\d{1,3})[ \t]{0,3}min/i);
  if (singleMatch) {
    const m = Number(singleMatch[1]);
    if (Number.isFinite(m)) {
      const res = {
        minutes: m,
        label: `${m} min`,
      };
      commuteMinutesCache.set(cacheKey, res);
      return res;
    }
  }

  const res = { minutes: null, label: cleaned || "Ref. BSB" };
  commuteMinutesCache.set(cacheKey, res);
  return res;
}

/**
 * QuintoAndar's `listingUpdatedAt` is the rent ad's `lastPublicationDate` (relistings keep the
 * original `firstPublicationDate` in `publishedAt`). Other providers' update timestamps are ad
 * edits/bumps, so they keep using the creation date.
 */
export function resolveCurrentPublicationIso(
  prop: Pick<SlimPropertyRecord, "provider" | "publishedAt" | "listingUpdatedAt">,
): string | null {
  if (prop.provider === "quintoandar") {
    return prop.listingUpdatedAt ?? prop.publishedAt ?? null;
  }
  return prop.publishedAt ?? prop.listingUpdatedAt ?? null;
}

export function computeListingAge(
  publishedAt: string | null | undefined,
  updatedAt?: string | null | undefined,
  referenceDateMs?: number,
): { days: number | null; label: string | null } {
  const rawTs = (publishedAt ?? updatedAt ?? "").trim();
  if (!rawTs) {
    return { days: null, label: null };
  }
  const pubMs = Date.parse(rawTs);
  if (!Number.isFinite(pubMs)) {
    return { days: null, label: null };
  }
  const refMs = referenceDateMs ?? Date.now();
  const days = Math.max(0, Math.floor((refMs - pubMs) / 86_400_000));
  let label: string;
  if (days === 0) {
    label = "Hoje";
  } else if (days === 1) {
    label = "Há 1 dia";
  } else if (days < 30) {
    label = `Há ${days} dias`;
  } else if (days < 60) {
    label = `Há 1 mês (${days}d)`;
  } else {
    label = `Há ${Math.floor(days / 30)} meses (${days}d)`;
  }
  return { days, label };
}

/**
 * Extracts qualitative features from the apartment, condominium, and surroundings
 * that are NOT already displayed in the card header, specs row, floor badge, or green/red pills.
 */
const nonRedundantHighlightsCache = new WeakMap<
  SlimPropertyRecord,
  { featureHighlights: string[]; surroundingHighlights: string[] }
>();

function extractNonRedundantHighlights(
  prop: SlimPropertyRecord,
  nuances: ReturnType<typeof evaluateApartmentNuances>,
): {
  featureHighlights: string[];
  surroundingHighlights: string[];
} {
  const cached = nonRedundantHighlightsCache.get(prop);
  if (cached) return cached;

  const features: string[] = [];
  const surroundings: string[] = [];

  const addFeature = (label: string) => {
    if (!features.includes(label)) features.push(label);
  };
  const addSurrounding = (label: string) => {
    if (!surroundings.includes(label)) surroundings.push(label);
  };

  const fullText = [
    prop.title ?? "",
    prop.description ?? "",
    ...(prop.amenities ?? []),
    ...(prop.installations ?? []),
    ...(prop.comfortCommodities ?? []),
    ...(prop.practicalityCommodities ?? []),
    ...(prop.photoCaptions ?? []),
  ].join(" ");

  // 1. Interior finishes & equipment (excluding AC, Vista livre, Sol da manhã, Prédio Novo, Andar)
  if (
    prop.positiveSignals.includes("Porcelanato / Vinílico") ||
    /(?<![a-zA-ZÀ-ÿ0-9_])(porcelanato|piso vin[ií]lico)(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullText)
  ) {
    addFeature("piso em porcelanato/vinílico");
  }

  if (
    prop.positiveSignals.includes("Fechadura eletrônica / USB") ||
    /(?<![a-zA-ZÀ-ÿ0-9_])fechadura (eletr[oô]nica|digital|biom[eé]trica)(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullText)
  ) {
    addFeature("fechadura eletrônica");
  }

  if (
    prop.positiveSignals.includes("Cooktop / Coifa / Forno embutido") ||
    /\b(cooktop|cook top|forno embutido|coifa)\b/i.test(fullText)
  ) {
    addFeature("cooktop");
  }

  if (
    prop.positiveSignals.includes("Marcenaria planejada / Painel") ||
    /(?<![a-zA-ZÀ-ÿ0-9_])(marcenaria|arm[aá]rios (planejados|sob medida|na cozinha|no quarto)|builtin_wardrobe|kitchen_cabinets|planned_furniture)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullText,
    )
  ) {
    addFeature("marcenaria/armários planejados");
  }

  if (
    prop.positiveSignals.includes("Projeto de iluminação / Gesso") ||
    /(?<![a-zA-ZÀ-ÿ0-9_])(projeto de ilumina[cç][aã]o|ilumina[cç][aã]o planejada|rebaixamento em gesso)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullText,
    )
  ) {
    addFeature("iluminação em gesso");
  }

  if (/\b(varanda gourmet|gourmet_balcony|churrasqueira na varanda)\b/i.test(fullText)) {
    addFeature("varanda gourmet");
  } else if (nuances.nuanceHighlights.includes("Varanda")) {
    addFeature("varanda");
  }

  if (/\b(cozinha americana|cozinha integrada|american_kitchen)\b/i.test(fullText)) {
    addFeature("cozinha americana");
  }

  if (
    prop.positiveSignals.includes("Janela antirruído / Blackout") ||
    nuances.nuanceHighlights.includes("Janela antirruído")
  ) {
    addFeature("janelas antirruído");
  } else if (/\bcortinas? corta[- ]?luz|blackout\b/i.test(fullText)) {
    addFeature("cortinas blackout");
  }

  if (nuances.nuanceHighlights.includes("Janelas amplas")) {
    addFeature("janelas amplas");
  }

  if (/\blavabo\b/i.test(fullText)) {
    addFeature("lavabo");
  }

  if (/(?<![a-zA-ZÀ-ÿ0-9_])(home[- ]?office|escrit[oó]rio)(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullText)) {
    addFeature("espaço home office");
  }

  if (/\bcloset\b/i.test(fullText)) {
    addFeature("closet");
  }

  if (nuances.nuanceHighlights.includes("Área de serviço p/ máquinas")) {
    addFeature("área de serviço separada");
  }

  if (/(?<![a-zA-ZÀ-ÿ0-9_])(g[aá]s encanado|chuveiro a g[aá]s|gas_shower|aquecimento a g[aá]s)(?![a-zA-ZÀ-ÿ0-9_])/i.test(fullText)) {
    addFeature("gás encanado");
  }

  // 2. Condominium & parking details (excluding Torre única, Megacondomínio, Sem elevador, Vaga presa)
  if (nuances.nuanceHighlights.includes("Portaria 24h / Biometria")) {
    addFeature("portaria 24h");
  }

  if (
    prop.positiveSignals.includes("Lazer com piscina e academia") ||
    (/\b(piscina|pool)\b/i.test(fullText) && /\b(academia|fitness|gym)\b/i.test(fullText))
  ) {
    addFeature("lazer com piscina e academia");
  } else if (/\b(piscina|pool)\b/i.test(fullText)) {
    addFeature("piscina no condomínio");
  } else if (/\b(academia|fitness|gym)\b/i.test(fullText)) {
    addFeature("academia no prédio");
  }

  if (prop.positiveSignals.includes("Rooftop / Gourmet / Lavanderia")) {
    addFeature("rooftop/espaço gourmet");
  }

  if (nuances.nuanceHighlights.includes("Vaga livre e demarcada")) {
    addFeature("garagem livre e demarcada");
  }

  if (nuances.nuanceHighlights.includes("Água/gás inclusos no condomínio")) {
    addFeature("água/gás inclusos");
  }

  // 3. Surroundings & Micro-location
  if (nuances.greenTags.includes("Eixo Caminhável / Respiro Urbano")) {
    addSurrounding("quadra arborizada com vida a pé (estilo Setor Marista)");
  }

  if (nuances.nuanceHighlights.includes("Rua silenciosa")) {
    addSurrounding("rua silenciosa");
  }

  if (/(?<![a-zA-ZÀ-ÿ0-9_])(trecho plano|[aá]rea plana|rua plana|100% plano)(?![a-zA-ZÀ-ÿ0-9_])/i.test(prop.description ?? "")) {
    addSurrounding("trecho plano");
  }

  if (nuances.parksNearby.length > 0) {
    addSurrounding(`próx. a ${nuances.parksNearby.slice(0, 2).join(" e ")}`);
  }

  if (nuances.mallsNearby.length > 0) {
    addSurrounding(`próx. ao ${nuances.mallsNearby[0]}`);
  }

  const subwayPlaces = (prop.placesNearby ?? [])
    .filter((p) => p.type === "ESTACAO_METRO_OU_TREM")
    .map((p) => p.name);
  if (subwayPlaces.length > 0) {
    addSurrounding(`acesso à estação ${subwayPlaces[0]}`);
  } else if (
    prop.nearSubway ||
    (prop.installations ?? []).some((i) => /metr[oô]|trem/i.test(i))
  ) {
    addSurrounding("acesso fácil ao metrô");
  }

  const result = {
    featureHighlights: features,
    surroundingHighlights: surroundings,
  };
  nonRedundantHighlightsCache.set(prop, result);
  return result;
}

const NEIGHBORHOOD_DRAWBACK_FALLBACKS: Record<string, string> = {
  "bh:funcionários": "trânsito mais carregado nos horários de pico nas vias internas",
  "bh:lourdes": "taxas condominiais mais pressionadas na região",
  "bh:santa efigênia": "fluxo intenso do entorno hospitalar durante o dia",
  "bh:santo agostinho": "vida noturna de calçada mais pacata",
  "bh:savassi": "movimento de bares no entorno gera ruído nos fins de semana",
  "bh:sion": "ladeiras íngremes nas ruas internas",
  "bh:serra": "ladeiras íngremes nas ruas internas",
  "bh:cruzeiro": "ladeiras íngremes nas ruas internas",
  "bh:santo antônio": "ladeiras íngremes nas ruas internas",
  "bh:anchieta": "ladeiras íngremes nas ruas internas",
  "bh:carmo": "ladeiras íngremes nas ruas internas",
  "bh:são pedro": "ladeiras íngremes nas ruas internas",
  "bh:mangabeiras": "ladeiras íngremes nas ruas internas",
  "bh:santa lúcia": "ladeiras íngremes nas ruas internas",
  "bh:buritis": "ladeiras íngremes e trânsito carregado na saída única do bairro",
  "bh:vila da serra": "gargalo de trânsito diário no acesso à região central",
  "bh:vale do sereno": "gargalo de trânsito diário no acesso à região central",
  "bh:belvedere": "gargalo de trânsito diário no acesso à região central",
  "cp:taquaral": "trajeto mais longo via rodovia até o hub de Viracopos",
  "cp:parque taquaral": "trajeto mais longo via rodovia até o hub de Viracopos",
  "cp:mansões santo antônio": "trajeto mais longo via rodovia até o hub de Viracopos",
  "cp:chácara primavera": "trajeto mais longo via rodovia até o hub de Viracopos",
  "cp:jd. chapadão": "trajeto mais longo até a rodovia para Viracopos",
  "cp:jardim chapadão": "trajeto mais longo até a rodovia para Viracopos",
  "cp:castelo": "trajeto mais longo até a rodovia para Viracopos",
  "cp:bosque": "pouca vida noturna e gastronomia a pé no entorno",
  "cp:nova campinas": "perfil estritamente residencial com pouca vida a pé",
  "cp:jd. guanabara": "pouca vida de calçada vibrante no próprio quarteirão",
  "cp:jardim guanabara": "pouca vida de calçada vibrante no próprio quarteirão",
  "cp:cambuí": "vias internas estreitas e maior adensamento predial",
  "sp:moema": "rota de aproximação aérea de Congonhas e trânsito pesado até Pinheiros",
  "sp:indianópolis": "rota de aproximação aérea de Congonhas e trânsito pesado até Pinheiros",
  "sp:brooklin": "trânsito carregado nas pontes de acesso a Pinheiros",
  "sp:sumaré": "ladeiras íngremes nas ruas internas e pouco comércio a pé",
  "sp:perdizes": "ladeiras íngremes nas ruas internas",
  "sp:vila madalena": "ladeiras íngremes e barulho noturno nos fins de semana",
  "sp:pinheiros": "intenso movimento de bares e trânsito nas vias internas",
  "sp:itaim bibi": "trânsito intenso e ruído urbano nos horários de pico",
  "sp:vila olímpia": "trânsito intenso e pouca vida residencial tranquila à noite",
  "sp:vila mariana": "alta densidade de concreto e trânsito pesado até Pinheiros",
  "sp:jardim paulista": "garagens antigas e trânsito carregado nas vias de acesso",
  "rj:icaraí": "trânsito pesado na Ponte Rio-Niterói",
  "rj:ingá": "trânsito pesado na Ponte Rio-Niterói",
  "rj:santa rosa": "trânsito pesado na Ponte Rio-Niterói",
  "rj:são domingos": "trânsito pesado na Ponte Rio-Niterói",
  "rj:jd. oceânico": "longo deslocamento diário no trânsito até o Centro",
  "rj:jardim oceânico": "longo deslocamento diário no trânsito até o Centro",
  "rj:botafogo": "vida noturna no entorno gera barulho e ruas internas pedem atenção à noite",
  "rj:botafogo (orla)": "vida noturna no entorno gera barulho e ruas internas pedem atenção à noite",
  "rj:flamengo": "estoque predial do entorno majoritariamente antigo",
  "rj:leme": "estoque predial do entorno majoritariamente antigo",
  "rj:copacabana": "adensamento urbano elevado e fluxo intenso nas calçadas",
  "bsb:águas claras": "trânsito carregado nas saídas da EPTG em horário de pico e ausência de hub presencial do Nubank",
  "bsb:norte (águas claras)": "trânsito carregado nas saídas da EPTG em horário de pico e ausência de hub presencial do Nubank",
  "bsb:sul (águas claras)": "trânsito carregado nas saídas da EPTG/Park Way em horário de pico e ausência de hub presencial do Nubank",
};

const neighborhoodDrawbackCache = new WeakMap<
  SlimPropertyRecord,
  string | null
>();

function resolveNeighborhoodDrawback(
  prop: SlimPropertyRecord,
  catalogNb: ComputedNeighborhood | undefined,
): string | null {
  if (neighborhoodDrawbackCache.has(prop)) {
    return neighborhoodDrawbackCache.get(prop) ?? null;
  }
  const nbLower = prop.neighborhood.trim().toLowerCase();
  const normNbLower = normalizeNeighborhoodKey(
    prop.neighborhood,
    prop.cityCode,
  ).toLowerCase();

  if (catalogNb?.cons) {
    for (const rawCon of catalogNb.cons) {
      const cleaned = stripParentheticalClauses(
        rawCon,
        (inner) =>
          inner.includes("R$") ||
          inner.includes("m²") ||
          inner.toLowerCase().includes("ex.:"),
      )
        .replace(/\s+/g, " ")
        .replace(/\.$/, "")
        .trim();
      if (cleaned.length < 15) continue;
      if (/R\$|\bm²\b|\b\d{1,2}[ \t]{0,3}quartos?|\b\d{1,2}[ \t]{0,3}vagas?/i.test(cleaned)) continue;
      if (
        /\b(oferta|flats?\s+antigos?|pr[eé]dios?\s+pequenos?\s+sem\s+elevador|unidades?\s+abaixo|quase\s+inexistente)\b/i.test(
          cleaned,
        )
      ) {
        continue;
      }
      if (
        cleaned.toLowerCase().includes(nbLower) ||
        cleaned.toLowerCase().includes(normNbLower)
      ) {
        continue;
      }
      const res = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
      neighborhoodDrawbackCache.set(prop, res);
      return res;
    }
  }

  const fallback =
    NEIGHBORHOOD_DRAWBACK_FALLBACKS[`${prop.cityCode.toLowerCase()}:${nbLower}`] ??
    NEIGHBORHOOD_DRAWBACK_FALLBACKS[`${prop.cityCode.toLowerCase()}:${normNbLower}`] ??
    null;
  neighborhoodDrawbackCache.set(prop, fallback);
  return fallback;
}

const conservationDrawbacksCache = new WeakMap<SlimPropertyRecord, string[]>();

function extractConservationDrawbacks(prop: SlimPropertyRecord): string[] {
  const cached = conservationDrawbacksCache.get(prop);
  if (cached) return cached;

  const result: string[] = [];
  const addUnique = (text: string) => {
    if (!result.includes(text)) result.push(text);
  };

  const propKey = `${prop.provider}:${prop.id}`;
  const photoAudit = PHOTO_AUDIT_OVERRIDES[propKey];

  const hasRenovationEvidence = prop.positiveSignals.some(
    (p) =>
      p !== "Flag Novo/Reformado" &&
      (p.includes("Reformado") ||
        p.includes("novo") ||
        p.includes("Porcelanato") ||
        p.includes("Construção 20")),
  );

  const allNegSignals = [
    ...prop.negativeSignals,
    ...(photoAudit?.visualWarnings ?? []),
  ];

  for (const sig of allNegSignals) {
    if (/sem elevador|pr[eé]dio escada/i.test(sig)) continue;
    if (/venda|comprad/i.test(sig)) continue;
    if (/descri[cç][aã]o gen[eé]rica/i.test(sig)) continue;

    if (/infiltra[cç][aã]o|umidade|mofo|trinca/i.test(sig)) {
      addUnique("infiltração ou problema de manutenção visível nas fotos");
    } else if (/depend[eê]ncia de servi[cç]o|\bdce\b/i.test(sig)) {
      addUnique("planta antiga com dependência de serviço (DCE) sem reforma declarada");
    } else if (/piso antigo|cer[aâ]mica|t[aá]bua corrida|taco|ard[oó]sia/i.test(sig)) {
      addUnique("piso antigo de cerâmica ou taco");
    } else if (/constru[cç][aã]o antiga/i.test(sig)) {
      addUnique("prédio mais antigo sem reforma recente");
    } else if (/anos 80\/90|pr[eé]dio\/im[oó]vel antigo/i.test(sig)) {
      addUnique("estrutura predial antiga sem reforma recente");
    } else if (/azulejo/i.test(sig)) {
      addUnique("azulejos e revestimentos datados");
    } else if (/arm[aá]rios? (?:embutidos? )?antigos?|marcenaria.*antig|madeira avermelhada|mogno|cerejeira|f[oó]rmica/i.test(sig)) {
      addUnique("armários antigos");
    } else if (!/R\$|\bm²\b/i.test(sig)) {
      const cleanSig = sig.trim().replace(/\.$/, "");
      if (cleanSig && cleanSig.length <= 95) {
        addUnique(cleanSig.charAt(0).toLowerCase() + cleanSig.slice(1));
      }
    }
  }

  if (result.length === 0) {
    if (
      prop.constructionYear !== null &&
      prop.constructionYear < 1995 &&
      !hasRenovationEvidence
    ) {
      addUnique("prédio mais antigo sem reforma recente");
    } else if (
      prop.modernityTier === "DATED" ||
      photoAudit?.modernityTier === "DATED"
    ) {
      addUnique("acabamento original sem sinais de reforma recente");
    }
  }

  conservationDrawbacksCache.set(prop, result);
  return result;
}

function buildShortJustification(params: {
  prop: SlimPropertyRecord;
  furnitureTier: FurnitureTier;
  catalogNb: ComputedNeighborhood | undefined;
  nbScore: number;
  nbCommute: string;
  safetyCar: number;
  weights: ScoringWeights;
  nuances: ReturnType<typeof evaluateApartmentNuances>;
  eligible: boolean;
  exclusionReason: string | null;
}): string {
  const {
    prop,
    furnitureTier,
    catalogNb,
    nbCommute,
    safetyCar,
    weights,
    nuances,
    eligible,
  } = params;

  const { commuteTimeText, officeLabel } = resolveOfficeReference(
    prop.cityCode,
    catalogNb,
    nbCommute,
  );
  const staticMeta = getStaticPropertyScoringMeta(prop);

  // === SENTENCE 1: PONTOS POSITIVOS (PRÓS) ===
  const isBunkerCorridor =
    staticMeta.microEnv.category === "BUNKER_OR_SPOOF" ||
    nuances.redTags.includes("Via Arterial / Efeito Bunker");
  let urbanContext = `a ${commuteTimeText} do ${officeLabel}`;
  if (!isBunkerCorridor && catalogNb) {
    if (catalogNb.urbanBreathingScore >= 9.0) {
      urbanContext += " em eixo arborizado de alto respiro urbano";
    } else if (catalogNb.commuteLogisticsScore >= 9.0) {
      urbanContext += " com logística rápida para o presencial";
    } else if (safetyCar >= 8.3) {
      urbanContext += " em bolha caminhável segura";
    } else if (catalogNb.budgetFitScore >= 9.0) {
      urbanContext += " em região de ótimo custo-benefício";
    }
  } else if (!isBunkerCorridor && safetyCar >= 8.3) {
    urbanContext += " em bolha caminhável segura";
  }

  const total = prop.totalMonthly;
  const area = prop.areaM2;
  const diffIdeal = weights.budgetIdeal - total;

  const hasFeatures = staticMeta.topFeaturesFormatted.length > 0;
  const hasSurroundings = staticMeta.topSurroundingsFormatted.length > 0;

  let positiveLead = "";
  if (hasFeatures) {
    positiveLead = `Com ${staticMeta.topFeaturesFormatted}`;
  } else if (furnitureTier === "UNFURNISHED" && area >= weights.sweetSpotMinM2) {
    positiveLead =
      "Planta bem dimensionada e livre de mobília solta para a mudança de Brasília";
  } else if (furnitureTier === "UNFURNISHED") {
    positiveLead =
      "Unidade livre de mobília solta para receber sua mudança de Brasília";
  } else if (area >= weights.sweetSpotMinM2) {
    positiveLead = "Planta espaçosa pronta para uso";
  } else {
    positiveLead = "Planta funcional pronta para uso";
  }

  if (hasSurroundings) {
    positiveLead += `, em ${staticMeta.topSurroundingsFormatted}`;
  }

  let positiveTail = "";
  if (total > 0 && diffIdeal >= 250) {
    positiveTail = ", com folga confortável no orçamento";
  } else if (total > 0 && diffIdeal >= 0) {
    positiveTail = ", enquadrado na meta financeira";
  } else if (furnitureTier === "UNFURNISHED" && hasFeatures) {
    positiveTail = ", livre de mobília solta para a mudança de Brasília";
  } else if (
    area >= weights.sweetSpotMinM2 &&
    area <= weights.sweetSpotMaxM2 &&
    hasFeatures
  ) {
    positiveTail = ", com planta bem distribuída para a rotina";
  }

  const sentence1 = `${positiveLead} — fica ${urbanContext}${positiveTail}.`;

  // === SENTENCE 2: PONTOS NEGATIVOS / RESSALVAS (CONTRAS) ===
  const primaryDrawbacks: string[] = [];
  const secondaryDrawbacks: string[] = [];

  // 0. Anti-Bunker / Express Corridor (#1 drawback when detected)
  if (isBunkerCorridor) {
    primaryDrawbacks.push(
      "fica em corredor viário intenso / divisa de centro (efeito bunker: barulho de trânsito e calçada hostil a pé)",
    );
  } else if (staticMeta.hasTrafficWarning) {
    primaryDrawbacks.push(
      "fica em avenida de tráfego intenso (ruído e menor caminhabilidade)",
    );
  }

  // 1. Hard eligibility exclusions
  if (!eligible) {
    const filterReasons: string[] = [];
    const effectiveMinMod = weights.minModernityScore;
    if (
      staticMeta.photoAudit?.hardExcludeDated ||
      staticMeta.photoAudit?.hasMaintenanceIssue ||
      staticMeta.effectiveModernityScore < effectiveMinMod
    ) {
      filterReasons.push("acabamento original sem reforma registrada");
    }
    if (nuances.hasNoElevator) {
      filterReasons.push("acesso por escadas sem elevador");
    }
    if (nuances.hasTrappedParking) {
      filterReasons.push("vaga presa na garagem");
    }
    if (weights.requireParking && prop.parkingSpaces < 1) {
      filterReasons.push("ausência de garagem privativa");
    }
    if (area < weights.minAreaM2) {
      filterReasons.push("planta abaixo da metragem mínima");
    }
    const parsedCommuteReason = parseCommuteMinutes(
      catalogNb?.commuteTime ?? nbCommute,
      staticMeta.isDeepWestBarra,
    );
    if (
      prop.cityCode !== "BSB" &&
      parsedCommuteReason.minutes !== null &&
      parsedCommuteReason.minutes > 50
    ) {
      filterReasons.push("tempo até o escritório acima de 50 min");
    }

    if (filterReasons.length > 0) {
      primaryDrawbacks.push(
        `retido pelos filtros (${formatListPt(filterReasons)})`,
      );
    } else if (furnitureTier !== "FULLY_FURNISHED") {
      primaryDrawbacks.push(
        "retido pelos filtros (critérios ativos do calibrador)",
      );
    }
  }

  // 2. Street safety risks
  if (safetyCar < 6.0) {
    primaryDrawbacks.push("insegurança elevada ao sair do condomínio a pé");
  } else if (safetyCar < 7.5) {
    primaryDrawbacks.push("exige maior atenção na rua no período noturno");
  }

  // 3. City preference penalty
  if (prop.cityCode === "SP") {
    primaryDrawbacks.push(
      "penalizado pelo trânsito, custo de vida e caos urbano de São Paulo Capital",
    );
  }

  // 4. Floor / Elevation drawbacks (only when confirmed low/ground floor; never penalize unmentioned floor)
  if (nuances.floorTag?.rarity === "common") {
    primaryDrawbacks.push(
      "fica no térreo (maior exposição a ruído de calçada e menor privacidade)",
    );
  } else if (nuances.floorTag?.rarity === "uncommon") {
    if (nuances.nuanceHighlights.includes("Vista livre/definitiva")) {
      secondaryDrawbacks.push(
        "fica em andar baixo (embora atenuado pela vista livre)",
      );
    } else {
      primaryDrawbacks.push(
        "fica em andar baixo (mais próximo do ruído da rua e com vista mais restrita)",
      );
    }
  }

  // 5. Conservation / Building age drawbacks (only from confirmed negative conservation evidence)
  const conservationDrawbacks = extractConservationDrawbacks(prop);
  for (const cd of conservationDrawbacks.slice(0, 2)) {
    primaryDrawbacks.push(cd);
  }

  // 6. High-impact nuance & condominium drawbacks
  const isMegaCondo = weights.penalizeMegaCondo
    ? staticMeta.isMegaCondoTrue
    : staticMeta.isMegaCondoFalse;
  if (isMegaCondo) {
    primaryDrawbacks.push(
      "perfil de megacondomínio familiar (maior fluxo e barulho nas áreas comuns)",
    );
  }

  if (furnitureTier === "FULLY_FURNISHED") {
    primaryDrawbacks.push(
      "já mobiliado com cama/sofá (exige negociar retirada ou adaptar sua mudança de Brasília)",
    );
  } else if (furnitureTier === "SEMI_FURNISHED") {
    primaryDrawbacks.push(
      "semi-mobiliado com eletrodomésticos (verificar se conflita com seus eletros de Brasília)",
    );
  }

  // 7. Budget & Area friction
  if (total > weights.budgetMax) {
    primaryDrawbacks.push("pacote mensal acima da faixa ideal (exige negociação)");
  } else if (total > weights.budgetIdeal) {
    primaryDrawbacks.push(
      "custo mensal consome a faixa de tolerância acima da meta ideal",
    );
  }

  if (area < weights.sweetSpotMinM2) {
    primaryDrawbacks.push(
      "metragem mais enxuta para acomodar toda a mudança",
    );
  }

  // 8. Confirmed commute, parking, or doorman drawbacks (never invent unmentioned features as downsides)
  const parsedCommuteForDrawback = parseCommuteMinutes(
    catalogNb?.commuteTime ?? nbCommute,
    staticMeta.isDeepWestBarra,
  );
  if (
    parsedCommuteForDrawback.minutes !== null &&
    parsedCommuteForDrawback.minutes >= 28
  ) {
    secondaryDrawbacks.push(
      "trajeto mais longo até o escritório presencial nos horários de pico",
    );
  }

  if (prop.parkingSpaces < 1) {
    primaryDrawbacks.push("sem vaga de garagem privativa");
  }

  if (
    prop.doorman === "NotAvailable" ||
    prop.doorman === "None" ||
    prop.doorman === "Sem portaria" ||
    /\bsem\s+portaria\b/i.test(prop.description ?? "")
  ) {
    secondaryDrawbacks.push("condomínio sem portaria presencial");
  }

  // 9. Neighborhood-specific cons
  const nbDrawback = resolveNeighborhoodDrawback(prop, catalogNb);

  // Assemble top drawbacks prioritizing severity + keeping room for neighborhood con when relevant
  const selectedDrawbacks: string[] = [];
  for (const item of primaryDrawbacks) {
    if (selectedDrawbacks.length < 4 && !selectedDrawbacks.includes(item)) {
      selectedDrawbacks.push(item);
    }
  }

  const maxBeforeNb = nbDrawback ? 3 : 4;
  for (const item of secondaryDrawbacks) {
    if (
      selectedDrawbacks.length < maxBeforeNb &&
      !selectedDrawbacks.includes(item)
    ) {
      selectedDrawbacks.push(item);
    }
  }

  if (
    nbDrawback &&
    selectedDrawbacks.length < 4 &&
    !selectedDrawbacks.includes(nbDrawback)
  ) {
    selectedDrawbacks.push(nbDrawback);
  }

  for (const item of secondaryDrawbacks) {
    if (selectedDrawbacks.length < 4 && !selectedDrawbacks.includes(item)) {
      selectedDrawbacks.push(item);
    }
  }

  if (selectedDrawbacks.length === 0) {
    selectedDrawbacks.push(
      "sem ressalvas críticas identificadas nos dados do anúncio — validar posição da vaga e incidência solar na visita",
    );
  }

  const rawSentence2 = formatListPt(selectedDrawbacks);
  const sentence2 = `${rawSentence2.charAt(0).toUpperCase() + rawSentence2.slice(1)}.`;

  return `${sentence1}\n${sentence2}`;
}

function buildNarrativeJustification(params: {
  prop: SlimPropertyRecord;
  furnitureTier: FurnitureTier;
  catalogNb: ComputedNeighborhood | undefined;
  nbCommute: string;
  weights: ScoringWeights;
  nuances: ReturnType<typeof evaluateApartmentNuances>;
  eligible: boolean;
  exclusionReason: string | null;
}): string {
  const {
    prop,
    furnitureTier,
    catalogNb,
    nbCommute,
    weights,
    nuances,
    eligible,
  } = params;

  const { commuteTimeText, officeLabel } = resolveOfficeReference(
    prop.cityCode,
    catalogNb,
    nbCommute,
  );
  const staticMeta = getStaticPropertyScoringMeta(prop);

  // 1. Urban breathing, office commute & surroundings synthesis
  let urbanClause = `Fica a cerca de ${commuteTimeText} do ${officeLabel}`;
  if (catalogNb) {
    const rationaleClean = catalogNb.shortRationale.replace(/\.$/, "");
    urbanClause += ` (${rationaleClean.charAt(0).toLowerCase() + rationaleClean.slice(1)})`;
  }
  if (staticMeta.allSurroundingsFormatted.length > 0) {
    urbanClause += `, somando ${staticMeta.allSurroundingsFormatted} no entorno imediato.`;
  } else {
    urbanClause += ", em ponto com fácil acesso aos serviços cotidianos.";
  }

  // 2. Interior, condominium & acoustic/elevation synthesis
  let acousticClause = "";
  if (nuances.highFloorLabel) {
    acousticClause =
      "A elevação da unidade favorece a privacidade visual, a ventilação cruzada e o isolamento contra ruídos de rua";
  } else if (nuances.lowFloorLabel) {
    acousticClause =
      "Por ficar em pavimento mais baixo, vale conferir na visita a incidência de luz direta e o isolamento acústico em relação à calçada";
  } else {
    acousticClause =
      "A configuração intermediária equilibra acesso prático e distanciamento do fluxo da rua";
  }

  const interiorClause =
    staticMeta.allFeaturesFormatted.length > 0
      ? `No interior e condomínio, agrega ${staticMeta.allFeaturesFormatted}. ${acousticClause}.`
      : `${acousticClause}, embora o anúncio traga poucos detalhes sobre marcenaria ou equipamentos extras instalados.`;

  // 3. Brasília relocation logistics, floorplan & budget trade-off
  let moveClause =
    "Para a mudança de Brasília, a configuração livre de mobília solta permite acomodar seus próprios móveis e eletrodomésticos sem atrito";
  if (furnitureTier === "SEMI_FURNISHED") {
    moveClause =
      "Para a mudança de Brasília, a unidade é semi-mobiliada com eletrodomésticos de cozinha (sem cama ou sofá), exigindo apenas alinhar eventual sobreposição de eletros";
  } else if (furnitureTier === "FULLY_FURNISHED") {
    moveClause =
      "Para a mudança de Brasília, a presença de mobília pronta exige negociar a retirada de itens pelo proprietário ou adaptar o frete dos seus móveis";
  }

  const area = prop.areaM2;
  let layoutAnalytical = "planta de proporções equilibradas";
  if (area >= weights.sweetSpotMinM2 && area <= weights.sweetSpotMaxM2) {
    layoutAnalytical = "planta no sweet spot de metragem para morar sozinho ou em casal";
  } else if (area >= weights.minAreaM2 && area < weights.sweetSpotMinM2) {
    layoutAnalytical = "planta compacta de baixa manutenção diária";
  } else if (area > weights.sweetSpotMaxM2 && area <= weights.maxAreaM2) {
    layoutAnalytical = "planta espaçosa com folga para home office dedicado";
  }

  const total = prop.totalMonthly;
  let budgetAnalytical = "";
  if (total > 0 && total <= weights.budgetIdeal - 300) {
    budgetAnalytical = "deixando margem mensal confortável abaixo da meta financeira";
  } else if (total > 0 && total <= weights.budgetIdeal) {
    budgetAnalytical = "mantendo o custo mensal dentro do orçamento-alvo planejado";
  } else if (total <= weights.budgetMax) {
    budgetAnalytical = "operando na faixa de tolerância financeira configurada";
  } else if (total <= weights.budgetHardCap) {
    budgetAnalytical = "exigindo negociação de pacote por operar no limite superior tolerado";
  } else {
    budgetAnalytical = "ultrapassando o teto financeiro estipulado no calibrador";
  }

  const rjParkingNote =
    prop.cityCode === "RJ" && prop.parkingSpaces >= 1
      ? ", além da vantagem rara de contar com garagem privativa na Zona Sul carioca"
      : "";

  const logisticsSentence = `${moveClause}, combinando ${layoutAnalytical} e ${budgetAnalytical}${rjParkingNote}.`;

  // 4. Caveats & visit checklist
  const visitCaveats: string[] = [];
  if (nuances.redTags.includes("Alerta de Segurança na Rua")) {
    visitCaveats.push(
      "avaliar com rigor a segurança pública ao sair do condomínio a pé e no retorno noturno (região com alerta de insegurança de rua no entorno)",
    );
  }
  if (nuances.redTags.includes("Megacondomínio")) {
    visitCaveats.push(
      "avaliar o fluxo de moradores nos elevadores e áreas comuns em horários de pico",
    );
  }
  if (nuances.hasTrappedParking) {
    visitCaveats.push("checar a rotina de manobra de veículos na garagem");
  }
  if (nuances.hasNoElevator) {
    visitCaveats.push(
      "considerar o impacto dos lances de escada no frete da mudança e no dia a dia",
    );
  }
  if (staticMeta.hasLegacyFinishSignals) {
    visitCaveats.push(
      "inspecionar o estado da rede elétrica, pressão hidráulica e vedação das janelas",
    );
  }
  if (catalogNb?.cons?.[0] && visitCaveats.length < 2) {
    const nbCon = catalogNb.cons[0];
    if (!/R\$|\b\d{1,4}[ \t]{0,3}m²/i.test(nbCon)) {
      visitCaveats.push(
        `observar a dinâmica local (${nbCon.charAt(0).toLowerCase() + nbCon.slice(1)})`,
      );
    }
  }

  const caveatSentence =
    visitCaveats.length > 0
      ? `Checklist para visita: ${formatListPt(visitCaveats)}.`
      : "Checklist para visita: validar posição da garagem, pressão de água nos chuveiros e nível de ruído com janelas fechadas.";

  const sentences = [
    urbanClause,
    interiorClause,
    logisticsSentence,
    caveatSentence,
  ];

  if (!eligible) {
    sentences.push(
      "Nos parâmetros atuais do calibrador, o imóvel fica retido pelos filtros eliminatórios ativos.",
    );
  }

  return sentences.join(" ");
}

export const PHOTO_DETECTED_FURNISHED_KEYS = new Set<string>([
  "zapimoveis:2917412160",
  "quintoandar:895706010",
  "quintoandar:895122863",
  "quintoandar:895777924",
  "quintoandar:895394820",
  "quintoandar:895606021",
  "quintoandar:895695873",
  "quintoandar:895708434",
  "quintoandar:895698227",
  "quintoandar:895649428",
  "quintoandar:894323737",
  "quintoandar:151248072",
  "quintoandar:895727794",
  "quintoandar:895568360",
  "quintoandar:894499680",
  "zapimoveis:2911265476",
  "quintoandar:130122125",
  "netimoveis:988658",
  "quintoandar:895787104",
  "zapimoveis:2908912416",
  "quintoandar:895771407",
  "quintoandar:895524560",
  "quintoandar:895726012",
  "quintoandar:895256433",
  "zapimoveis:2787266715",
  "quintoandar:894861060",
  "quintoandar:895020185",
  "quintoandar:895115686",
  "quintoandar:893592624",
]);

export const FULL_FURNITURE_COMMODITY_ITEMS = new Set<string>([
  "cama de casal",
  "cama de solteiro",
  "cama",
  "cama box",
  "sofá",
  "sofá-cama",
  "poltrona",
  "mesas e cadeiras de jantar",
  "mesa com cadeiras",
  "televisão",
  "smart tv",
]);

export const SEMI_FURNISHED_APPLIANCE_ITEMS = new Set<string>([
  "geladeira",
  "refrigerador",
  "frigobar",
  "microondas",
  "micro-ondas",
  "máquina de lavar",
  "lava e seca",
  "lava-louças",
  "lava louças",
  "utensílios de cozinha",
]);

export const FURNISHED_COMMODITY_ITEMS = new Set<string>([
  ...FULL_FURNITURE_COMMODITY_ITEMS,
  ...SEMI_FURNISHED_APPLIANCE_ITEMS,
]);

const FURNITURE_REMOVAL_NEGOTIABLE_REGEX =
  /\b(retirad[oa]s?\s+(?:de\s+|da\s+)?mob[ií]lia|poss[ií]vel\s+retirar\s+(?:a\s+)?mob[ií]lia|pode\s+retirar\s+(?:a\s+|os\s+)?(?:mob[ií]lia|m[oó]veis)|propriet[aá]ri[oa]\s+retira\s+(?:a\s+|os\s+)?(?:mob[ií]lia|m[oó]veis)|op[cç][aã]o\s+(?:de\s+)?alugar\s+sem\s+mob[ií]lia|com\s+ou\s+sem\s+mob[ií]lia|negocia\s+retirada\s+de\s+m[oó]veis|m[oó]veis\s+podem\s+ser\s+retirados)\b/i;

export function canNegotiateFurnitureRemoval(
  prop: SlimPropertyRecord,
): boolean {
  const text = [
    prop.title ?? "",
    prop.description ?? "",
    prop.generatedDescription ?? "",
  ].join(" ");
  return FURNITURE_REMOVAL_NEGOTIABLE_REGEX.test(text);
}

/**
 * Classifies a property into a 3-tier furniture scale tailored for the user's
 * Brasília relocation (bringing Queen bed, sofa, large fridge, washing machine,
 * and countertop dishwasher):
 * - "UNFURNISHED": No loose furniture (only built-in cabinets / marcenaria / box blindex)
 * - "SEMI_FURNISHED": Kitchen/laundry appliances or explicit "semi-mobiliado" WITHOUT bed or sofa
 * - "FULLY_FURNISHED": Has bed, sofa, living/bedroom furniture set, apart-hotel, or full furnished flag
 */
export const PHOTO_VERIFIED_UNFURNISHED_KEYS = new Set<string>([
  "quintoandar:895702014",
  "quintoandar:895752152",
  "quintoandar:895694297",
]);

export const PHOTO_VERIFIED_SEMI_OR_CABINETRY_KEYS = new Set<string>([]);

const furnitureTierCache = new WeakMap<SlimPropertyRecord, FurnitureTier>();

const APART_HOTEL_BRAND_REGEX =
  /\b(monet|max savassi|savassi hotel|radisson|mercure|ibis|trypp?|golden tulip|caesar business|manhattan flat|liberty palace|transamerica)\b/i;
const SERVICED_CONDO_NAME_REGEX =
  /\b(top life|residence service|apart[- ]?hot(?:el|[eé]is)|apart[- ]?service|flat|hotel|novotel|blue tree|slaviero)\b/i;
const SERVICED_TEXT_REGEX =
  /(?<![a-zA-ZÀ-ÿ0-9_])(apart[- ]?hot(?:el|[eé]is)|aparthotel|(?<!tv\s|tela\s|smart\s)flats?(?!\s+screen)|residence service|servi[cç]os?\s+de\s+(?:hotel(?:aria)?|arruma[cç][aã]o|quarto|camareira)|hotelaria|camareiras?|arruma[cç][aã]o\s+(?:di[aá]ria|semanal)|room service|pool de loca[cç][aã]o|lavanderia inclusa)(?![a-zA-ZÀ-ÿ0-9_])/i;
const RECEPTION_24H_REGEX = /\brecep[cç][aã]o\s+24\s*h/i;

/**
 * Apart-hotel / serviced flat: a known brand or serviced condo name ("Top Life", "Residence Service",
 * "Apart Hotel"), or serviced text backed by a hotel-level condo fee (>= R$ 1.200, or >= 50% of the
 * rent). "Recepção 24h" alone is common in regular condos, so it only counts for furnished units with
 * both fee conditions. Units explicitly listed as unfurnished are only caught by the brand list.
 */
export function isApartHotelListing(
  prop: Pick<
    SlimPropertyRecord,
    | "condominiumName"
    | "title"
    | "description"
    | "installations"
    | "amenities"
    | "rent"
    | "condoFee"
    | "furnished"
  >,
): boolean {
  const condoName = prop.condominiumName ?? "";
  if (APART_HOTEL_BRAND_REGEX.test(condoName)) return true;
  if (prop.furnished === false) return false;
  if (SERVICED_CONDO_NAME_REGEX.test(condoName)) return true;

  const highFee = prop.condoFee >= 1200;
  const feeHeavy = prop.rent > 0 && prop.condoFee >= prop.rent * 0.5;
  if (!highFee && !feeHeavy) return false;

  const text = [
    prop.title ?? "",
    prop.description ?? "",
    ...(prop.installations ?? []),
    ...(prop.amenities ?? []),
  ].join(" | ");
  if (SERVICED_TEXT_REGEX.test(text)) return true;
  return prop.furnished === true && highFee && feeHeavy && RECEPTION_24H_REGEX.test(text);
}

const FURNITURE_NEGATION_REGEX =
  /semi[- ]?mobiliad[oa]s?|desmobiliad[oa]s?|sem\s+(?:mob[ií]lias?|m[oó]veis)|n[aã]o\s+(?:est[aá]\s+|[eé]\s+|ser[aá]\s+|vem\s+)?mobiliad[oa]s?|(?:apenas|somente|s[oó])\s+(?:com\s+)?(?:os\s+)?arm[aá]rios/gi;
const FURNITURE_AFFIRMATIVE_REGEX =
  /(?<![a-zA-ZÀ-ÿ0-9_-])mobiliad[oa]s?(?![a-zA-ZÀ-ÿ0-9_])|\bporteira\s+fechada\b/i;

/** What the owner's own text says about furniture; null when silent or contradictory ("com ou sem mobília"). */
export function describeFurnitureInText(
  text: string | null | undefined,
): "furnished" | "unfurnished" | null {
  if (!text) return null;
  const hasNegation = new RegExp(FURNITURE_NEGATION_REGEX.source, "i").test(text);
  const hasAffirmation = FURNITURE_AFFIRMATIVE_REGEX.test(
    text.replace(FURNITURE_NEGATION_REGEX, " "),
  );
  if (hasAffirmation && !hasNegation) return "furnished";
  if (hasNegation && !hasAffirmation) return "unfurnished";
  return null;
}

export function classifyFurnitureTier(prop: SlimPropertyRecord): FurnitureTier {
  const cached = furnitureTierCache.get(prop);
  if (cached) return cached;

  const propKey = `${prop.provider}:${prop.id}`;
  if (PHOTO_VERIFIED_UNFURNISHED_KEYS.has(propKey)) {
    furnitureTierCache.set(prop, "UNFURNISHED");
    return "UNFURNISHED";
  }
  const photoAudit = PHOTO_AUDIT_OVERRIDES[propKey];
  if (photoAudit?.furnishedTier) {
    const tier: FurnitureTier =
      photoAudit.furnishedTier === "FULLY_FURNISHED"
        ? "FULLY_FURNISHED"
        : "UNFURNISHED";
    furnitureTierCache.set(prop, tier);
    return tier;
  }
  if (PHOTO_DETECTED_FURNISHED_KEYS.has(propKey)) {
    furnitureTierCache.set(prop, "FULLY_FURNISHED");
    return "FULLY_FURNISHED";
  }

  if (isApartHotelListing(prop)) {
    furnitureTierCache.set(prop, "FULLY_FURNISHED");
    return "FULLY_FURNISHED";
  }

  const structuredCommoditiesLower = [
    ...(prop.comfortCommodities ?? []),
    ...(prop.practicalityCommodities ?? []),
    ...(prop.amenities ?? []),
  ].map((c) => c.trim().toLowerCase());

  const captionsText = (prop.photoCaptions ?? []).join(" ");

  const rawDescText = [
    prop.title ?? "",
    prop.description ?? "",
    prop.generatedDescription ?? "",
  ].join("\n");

  const strippedSpacePhrases = rawDescText
    .replace(
      /(?<![a-zA-ZÀ-ÿ0-9_])(?:ser[aá]\s+alugad[oa]\s+sem\s+(?:mob[ií]lias?|m[oó]veis)|alugad[oa]\s+sem\s+(?:mob[ií]lias?|m[oó]veis)|n[aã]o\s+(?:est[aá]|[eé]|ser[aá]|vai)\s+mobiliad[oa]|sem\s+(?:mob[ií]lias?|m[oó]veis)(?:\s+solt[oa]s?)?|sem\s+(?:cama(?:\s+e\s+sem\s+sof[aá])?|sof[aá](?:\s+e\s+sem\s+cama)?|geladeira|fog[aã]o|m[aá]quina\s+de\s+lavar|eletrodom[eé]sticos?))(?![a-zA-ZÀ-ÿ0-9_])/gi,
      " ",
    )
    .replace(
      /\b(?:espa[cç]o|lugar|local|ponto|prepara[cç][aã]o|espera|cabe|cabem|comporta|acomoda|previsto)\s+(?:para\s+|p\/\s+)?(?:uma?\s+)?(?:cama(?:\s+(?:de\s+)?(?:casal|solteiro|box|queen|king))*|sof[aá](?:[- ]?cama|\s+retr[aá]til|\s+de\s+\d+\s+lugares)*|geladeira|refrigerador|m[aá]quina de lavar|lava[- ]?lou[cç]as|lava[- ]?e[- ]?seca|fog[aã]o|micro[- ]?ondas|mesa(?:\s+(?:de\s+jantar|com\s+cadeiras))*|tv)/gi,
      " ",
    );

  const affirmativeClauses = strippedSpacePhrases
    .split(/[.;!\n]+|,\s*(?=mas\b|por[eé]m\b|contudo\b|entretanto\b)/i)
    .filter(
      (clause) =>
        !/ser[aã]o removid|n[aã]o fica|retirad|sem mob[ií]lia|sem m[oó]veis|n[aã]o\s+(?:est[aá]\s+|[eé]\s+|ser[aá]\s+)?mobiliad/i.test(
          clause,
        ),
    );
  const descText = affirmativeClauses.join(". ");

  const combinedEvidence = [
    ...structuredCommoditiesLower,
    captionsText,
    descText,
  ].join(" ");

  const hasGeladeira =
    /(?<![a-zA-ZÀ-ÿ0-9_])(geladeiras?|refrigerador(?:es)?|frigobar|refrigerators?)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      combinedEvidence,
    );
  const hasSofa =
    /(?<![a-zA-ZÀ-ÿ0-9_])(sof[aá]s?|sofa|couch)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      combinedEvidence,
    );
  const hasCama =
    /(?<![a-zA-ZÀ-ÿ0-9_])(camas?|colch[aã]o|colch[oõ]es|beds?)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      combinedEvidence,
    );

  const tier: FurnitureTier =
    (hasGeladeira && hasSofa && hasCama) ||
    (prop.furnished === true && describeFurnitureInText(prop.description) === "furnished")
      ? "FULLY_FURNISHED"
      : "UNFURNISHED";

  furnitureTierCache.set(prop, tier);
  return tier;
}

interface StaticPropertyScoringMeta {
  normNb: string;
  normNbLower: string;
  nbLower: string;
  calibratedMeta: ReturnType<typeof resolveNeighborhoodSafetyAndMetrics>;
  microEnv: StreetMicroEnvironmentEvaluation;
  isDeepWestBarra: boolean;
  effectiveFurnished: boolean | null;
  furnitureTier: FurnitureTier;
  isUnconfirmedNullFurniture: boolean;
  photoAudit: PhotoAuditOverride | undefined;
  effectiveModernityScore: number;
  effectiveModernityTier: ModernityTier;
  signalsSummary: string;
  negSummary: string;
  hasLegacyFinishSignals: boolean;
  topFeaturesFormatted: string;
  topSurroundingsFormatted: string;
  allFeaturesFormatted: string;
  allSurroundingsFormatted: string;
  hasBalconyFeature: boolean;
  has24hDoormanFeature: boolean;
  nuancesSummaryTrue: string;
  nuancesSummaryFalse: string;
  hasTrafficWarning: boolean;
  isMegaCondoTrue: boolean;
  isMegaCondoFalse: boolean;
  cpFarCommute: CpFarCommute | null;
}

export interface CpFarCommute {
  distanceKm: number;
  commuteText: string;
  penaltyPts: number;
}

// Starts at the MODERN_OR_RENOVATED tier floor so entering the tier adds no step: +0.5 pt per point, full +8 at 94.
const BARE_SHELL_UNFURNISHED_BONUS_CAP = 10;
const MODERNITY_RAMP_START = 78;
const MODERNITY_RAMP_MAX_BONUS = 8;

// Taquaral (~16 km straight-line from Bresco Viracopos) is the field-calibrated
// 35–40 min / −11 pts reference; anything at least that far gets the same treatment, scaled by distance.
const CP_FAR_COMMUTE_REFERENCE_KM = 16.1;
const CP_FAR_COMMUTE_REFERENCE_PENALTY = -11;
const CP_DRIVE_MINUTES_PER_STRAIGHT_KM = 2.2;

export function resolveCpFarCommute(
  cityCode: CityHubCode,
  neighborhood: string,
): CpFarCommute | null {
  if (cityCode !== "CP") return null;
  const center = resolveNeighborhoodCenter(cityCode, neighborhood);
  if (!center) return null;
  const distanceKm = computeDistanceToNubankHubKm(cityCode, center[0], center[1]);
  if (distanceKm < CP_FAR_COMMUTE_REFERENCE_KM) return null;
  const minLow =
    Math.floor((distanceKm * CP_DRIVE_MINUTES_PER_STRAIGHT_KM) / 5) * 5;
  return {
    distanceKm,
    commuteText: `${minLow}-${minLow + 5} min do Nubank (Viracopos)`,
    penaltyPts:
      Math.round(
        CP_FAR_COMMUTE_REFERENCE_PENALTY *
          (distanceKm / CP_FAR_COMMUTE_REFERENCE_KM) *
          10,
      ) / 10,
  };
}

const staticPropertyMetaCache = new WeakMap<
  SlimPropertyRecord,
  StaticPropertyScoringMeta
>();

function buildFullLocationText(prop: SlimPropertyRecord): string {
  return [
    prop.street ?? "",
    prop.title ?? "",
    prop.description ?? "",
    prop.generatedDescription ?? "",
    ...(prop.comfortCommodities ?? []),
    ...(prop.practicalityCommodities ?? []),
    ...(prop.amenities ?? []),
    ...(prop.installations ?? []),
    ...(prop.photoCaptions ?? []),
  ].join(" ");
}

function calibrateRuntimeModernity(
  prop: SlimPropertyRecord,
  photoAudit: PhotoAuditOverride | undefined,
  fullLocationText: string,
): {
  effectiveModernityScore: number;
  effectiveModernityTier: ModernityTier;
} {
  if (photoAudit) {
    return {
      effectiveModernityScore: photoAudit.modernityScore,
      effectiveModernityTier: photoAudit.modernityTier,
    };
  }

  let score = prop.modernityScore;
  const year = prop.constructionYear;
  const hasExplicitRenovationOrNewText =
    /\b(reformad[oa]|im[oó]vel novo|apartamento novo|pr[eé]dio (?:super )?novo|rec[eé]m[- ]?(?:reformad[oa]|entregue|constru[ií]do)|primeira loca[cç][aã]o|1[aª] loca[cç][aã]o|novinho|retrofit|modernizad[oa]|porcelanato|piso vin[ií]lico|vin[ií]lico)\b/i.test(
      fullLocationText,
    ) ||
    (year !== null && year !== undefined && year >= 2015) ||
    prop.positiveSignals.some(
      (s) =>
        s !== "Flag Novo/Reformado" &&
        /Reformado|Porcelanato|Construção recente|Construção 201[5-9]|Construção 202/i.test(
          s,
        ),
    );

  const hasDceProxy =
    /\b(depend[eê]ncia\s+(?:completa\s+)?de\s+empregada|\bdce\b|quarto\s+de\s+(?:servi[cç]o|empregada)|banheiro\s+de\s+(?:servi[cç]o|empregada)|quarto\s+extra\s+revers[ií]vel)\b/i.test(
      fullLocationText,
    );
  const hasOldFloorsProxy =
    /\b(piso\s+em\s+cer[aâ]mica|cer[aâ]mica\s+(?:antiga|fria)|piso\s+frio|t[aá]bua\s+corrida|(?:piso\s+(?:de|em)\s+)?taco[s]?|\bparquet\b|\bsinteco\b|\bard[oó]sia\b|\bgranilite\b|carpete\s+de\s+madeira|\bcarpete\b|\blajota[s]?)\b/i.test(
      fullLocationText,
    );
  const hasOldFramesOrWindowAc =
    /\b((?:esquadrias?|janelas?)\s+de\s+ferro|(?:janelas?|venezianas?)\s+de\s+madeira|vitr[oô]\s+de\s+ferro|ar[- ]?condicionado\s+de\s+(?:janela|parede)|ar\s+de\s+janela|(?:buraco|caixa)\s+para\s+ar)\b/i.test(
      fullLocationText,
    );

  // Discount uncorroborated Flag Novo/Reformado
  const hasInteriorModernSignal =
    prop.positiveSignals.some((s) =>
      /Porcelanato|Iluminação|Fechadura|Cooktop|Split|Marcenaria|Bancada|Imóvel\/prédio novo|Reformado \/ Moderno/i.test(
        s,
      ),
    ) ||
    /\b(im[oó]vel novo|apartamento novo|pr[eé]dio (?:super )?novo|rec[eé]m[- ]?(?:reformad[oa]|entregue|constru[ií]do)|primeira loca[cç][aã]o|1[aª] loca[cç][aã]o|novinho|reformad[oa]|retrofit|modernizad[oa]|porcelanato|piso vin[ií]lico|vin[ií]lico|bancada[s]?\s+(?:em\s+|de\s+)?(?:quartzo|silestone|nanoglass|granito\s+preto|s[aã]o\s+gabriel)|(?:varanda|sacada)\s+envidra[cç]ada|cortina\s+de\s+vidro|fechamento\s+em\s+vidro|projeto\s+(?:de\s+ilumina[cç][aã]o|luminot[eé]cnico)|ilumina[cç][aã]o\s+(?:planejada|em\s+led|indireta|embutida)|sanca|rebaixamento\s+em\s+gesso|teto\s+rebaixado|forro\s+de\s+gesso|spots?\s+de\s+led|fechadura\s+(?:eletr[oô]nica|digital|biom[eé]trica)|tomadas?\s+usb|cooktop|cook\s+top|forno\s+embutido|coifa|indu[cç][aã]o|split|inverter|infraestrutura\s+para\s+ar|arm[aá]rios?\s+planejados?|marcenaria(?:\s+planejada)?|m[oó]veis\s+planejados?|arm[aá]rios?\s+sob\s+medida|planned_furniture|painel\s+de\s+tv)\b/i.test(
      fullLocationText,
    );

  if (
    prop.positiveSignals.includes("Flag Novo/Reformado") ||
    prop.condition === "NEW_OR_RENOVATED"
  ) {
    const isCorroborated =
      hasInteriorModernSignal ||
      (year !== null && year !== undefined && year >= 2016);
    const isContradicted =
      !hasExplicitRenovationOrNewText && (hasDceProxy || hasOldFloorsProxy);
    if (isContradicted && score >= 70) {
      score -= 10;
    } else if (!isCorroborated && score >= 74) {
      score = Math.min(score, 74);
    }
  }

  // Stricter tier gate for MODERN_OR_RENOVATED (score >= 78)
  const qualifiesForModernTier =
    hasInteriorModernSignal ||
    (year !== null && year !== undefined && year >= 2015) ||
    prop.positiveSignals.length === 0;
  if (!qualifiesForModernTier && score >= 78) {
    score = 74;
  }

  // Cap double condo leisure bonus if both were added in legacy snapshot
  if (
    prop.positiveSignals.includes("Lazer com piscina e academia") &&
    prop.positiveSignals.includes("Rooftop / Gourmet / Lavanderia")
  ) {
    score -= 6;
  }

  // Apply old interior proxies if not already reflected in negativeSignals
  if (!hasExplicitRenovationOrNewText) {
    if (
      hasDceProxy &&
      !prop.negativeSignals.some((s) => /depend[eê]ncia|dce/i.test(s))
    ) {
      score -= 12;
    }
    if (
      hasOldFloorsProxy &&
      !prop.negativeSignals.some((s) => /piso antigo|cer[aâ]mica|taco/i.test(s))
    ) {
      score -= 14;
    }
    if (
      hasOldFramesOrWindowAc &&
      !prop.negativeSignals.some((s) => /esquadrias|ar de janela/i.test(s))
    ) {
      score -= 12;
    }
  }

  const clamped = Math.max(0, Math.min(100, score));
  let tier: ModernityTier = prop.modernityTier;
  if (score !== prop.modernityScore) {
    tier =
      clamped >= 78
        ? "MODERN_OR_RENOVATED"
        : clamped >= 65
          ? "WELL_MAINTAINED"
          : clamped >= 50
            ? "STANDARD"
            : "DATED";
  }

  return {
    effectiveModernityScore: clamped,
    effectiveModernityTier: tier,
  };
}

function getStaticPropertyScoringMeta(
  prop: SlimPropertyRecord,
): StaticPropertyScoringMeta {
  const cached = staticPropertyMetaCache.get(prop);
  if (cached) return cached;

  const propKey = `${prop.provider}:${prop.id}`;
  const photoAudit = PHOTO_AUDIT_OVERRIDES[propKey];
  const normNb = normalizeNeighborhoodKey(prop.neighborhood, prop.cityCode);
  const normNbLower = normNb.toLowerCase();
  const nbLower = `${prop.cityCode}:${prop.neighborhood.toLowerCase()}`;
  const calibratedMeta = resolveNeighborhoodSafetyAndMetrics(
    prop.cityCode,
    prop.neighborhood,
  );
  const microEnv = evaluateStreetMicroEnvironment(prop);
  const fullLocationText = buildFullLocationText(prop);
  const { effectiveModernityScore, effectiveModernityTier } =
    calibrateRuntimeModernity(prop, photoAudit, fullLocationText);
  const isDeepWestBarra =
    prop.cityCode === "RJ" &&
    /\b(barra ol[ií]mpica|estrada dos bandeirantes|shopping metropolitano|curicica|jacarepagu[aá]|recreio|riocentro|abelardo bueno|salvador allende|ad[ií]lio de oliveira)\b/i.test(
      fullLocationText,
    );
  const furnitureTier = classifyFurnitureTier(prop);
  const hasExplicitUnfurnishedOrCabinetryEvidence =
    prop.furnished === false ||
    prop.positiveSignals.includes("Marcenaria planejada / Painel") ||
    /(?<![a-zA-ZÀ-ÿ0-9_])(sem\s+(?:mob[ií]lias?|m[oó]veis)|n[aã]o\s+(?:est[aá]\s+|[eé]\s+|ser[aá]\s+)?mobiliad[oa]|vazio|arm[aá]rios?|marcenaria|planejad[oa]s?|closet|builtin_wardrobe|kitchen_cabinets|planned_furniture)(?![a-zA-ZÀ-ÿ0-9_])/i.test(
      fullLocationText,
    );
  const isUnconfirmedNullFurniture =
    furnitureTier === "UNFURNISHED" &&
    prop.furnished === null &&
    !hasExplicitUnfurnishedOrCabinetryEvidence;
  const effectiveFurnished: boolean | null =
    furnitureTier === "FULLY_FURNISHED"
      ? true
      : furnitureTier === "UNFURNISHED"
        ? isUnconfirmedNullFurniture
          ? null
          : false
        : prop.furnished;
  const signalsSummary =
    prop.positiveSignals.length > 0
      ? prop.positiveSignals.join(", ")
      : "padrão conservado";
  const filteredNegativeSignals = [
    ...prop.negativeSignals.filter(
      (s) => !/venda|comprad|visita[cç][aã]o/i.test(s),
    ),
    ...(photoAudit?.visualWarnings ?? []),
  ];
  const negSummary =
    filteredNegativeSignals.length > 0
      ? ` | Alertas: ${filteredNegativeSignals.join(", ")}`
      : "";
  const hasLegacyFinishSignals =
    prop.negativeSignals.some((s) =>
      /antig|cer[aâ]mica|t[aá]bua|taco|anos 80/i.test(s),
    ) ||
    effectiveModernityTier === "DATED" ||
    Boolean(photoAudit?.hasMaintenanceIssue);
  const nuancesTrue = evaluateApartmentNuancesFast(prop, true);
  const nuancesFalse = evaluateApartmentNuancesFast(prop, false);
  const hl = extractNonRedundantHighlights(prop, nuancesFalse);
  extractConservationDrawbacks(prop);
  const topFeatures = hl.featureHighlights.slice(0, 5);
  const topSurroundings = hl.surroundingHighlights.slice(0, 3);
  const topFeaturesFormatted = formatListPt(topFeatures);
  const topSurroundingsFormatted = formatListPt(topSurroundings);
  const allFeaturesFormatted = formatListPt(hl.featureHighlights);
  const allSurroundingsFormatted = formatListPt(hl.surroundingHighlights);
  const hasBalconyFeature =
    nuancesFalse.nuanceHighlights.includes("Varanda") ||
    hl.featureHighlights.includes("varanda") ||
    hl.featureHighlights.includes("varanda gourmet");
  const has24hDoormanFeature =
    nuancesFalse.nuanceHighlights.includes("Portaria 24h / Biometria") ||
    hl.featureHighlights.includes("portaria 24h");
  const nuancesSummaryTrue =
    nuancesTrue.nuanceHighlights.length > 0
      ? nuancesTrue.nuanceHighlights.join(", ")
      : "sem destaques extras de micro-localização/andar";
  const nuancesSummaryFalse =
    nuancesFalse.nuanceHighlights.length > 0
      ? nuancesFalse.nuanceHighlights.join(", ")
      : "sem destaques extras de micro-localização/andar";
  const hasTrafficWarning = nuancesFalse.nuanceWarnings.some((w) =>
    /avenida de tr[aá]fego intenso/i.test(w),
  );
  const isMegaCondoTrue =
    nuancesTrue.redTags.includes("Megacondomínio") ||
    nuancesTrue.nuanceWarnings.some((w) => /megacondom[ií]nio/i.test(w));
  const isMegaCondoFalse =
    nuancesFalse.redTags.includes("Megacondomínio") ||
    nuancesFalse.nuanceWarnings.some((w) => /megacondom[ií]nio/i.test(w));

  const meta: StaticPropertyScoringMeta = {
    normNb,
    normNbLower,
    nbLower,
    calibratedMeta,
    microEnv,
    isDeepWestBarra,
    effectiveFurnished,
    furnitureTier,
    isUnconfirmedNullFurniture,
    photoAudit,
    effectiveModernityScore,
    effectiveModernityTier,
    signalsSummary,
    negSummary,
    hasLegacyFinishSignals,
    topFeaturesFormatted,
    topSurroundingsFormatted,
    allFeaturesFormatted,
    allSurroundingsFormatted,
    hasBalconyFeature,
    has24hDoormanFeature,
    nuancesSummaryTrue,
    nuancesSummaryFalse,
    hasTrafficWarning,
    isMegaCondoTrue,
    isMegaCondoFalse,
    cpFarCommute: resolveCpFarCommute(prop.cityCode, prop.neighborhood),
  };
  staticPropertyMetaCache.set(prop, meta);
  return meta;
}

interface EvaluatedJustificationContext {
  prop: SlimPropertyRecord;
  staticMeta: StaticPropertyScoringMeta;
  furnitureTier: FurnitureTier;
  catalogNb: ComputedNeighborhood | undefined;
  nbScore: number;
  nbCommute: string;
  nbSafetyCar: number;
  weights: ScoringWeights;
  nuances: ApartmentNuancesEvaluation;
  eligible: boolean;
  exclusionReason: string | null;
  finalScore: number;
  neighborhoodPoints: number;
  modernityPoints: number;
  modernityCurveBonus: number;
  nuancesPoints: number;
  budgetPoints: number;
  furniturePoints: number;
  areaPoints: number;
  parkingPoints: number;
  streetSafetyAdjustment: number;
  cityPreferencePoints: number;
  comfortFloor: number;
  compactFloorM2: number;
}

function buildDetailedJustificationFromContext(
  ctx: EvaluatedJustificationContext,
): string {
  const {
    prop,
    staticMeta,
    furnitureTier,
    nbScore,
    nbCommute,
    nbSafetyCar,
    weights,
    nuances,
    eligible,
    exclusionReason,
    finalScore,
    neighborhoodPoints,
    modernityPoints,
    modernityCurveBonus,
    nuancesPoints,
    budgetPoints,
    furniturePoints,
    areaPoints,
    parkingPoints,
    streetSafetyAdjustment,
    cityPreferencePoints,
    comfortFloor,
    compactFloorM2,
  } = ctx;
  const fmtSign = (n: number) => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
  const total = prop.totalMonthly;
  const totalFmt = fmtIntPtBr(total);
  let budgetDesc = "";
  if (total > 0 && total <= comfortFloor) {
    budgetDesc = `R$ ${totalFmt}/mês com excelente folga abaixo da meta de R$ ${fmtIntPtBr(weights.budgetIdeal)}`;
  } else if (total > 0 && total <= weights.budgetIdeal) {
    budgetDesc = `R$ ${totalFmt}/mês dentro do teto ideal de R$ ${fmtIntPtBr(weights.budgetIdeal)}`;
  } else if (total <= weights.budgetMax) {
    budgetDesc = `R$ ${totalFmt}/mês dentro do limite máximo de R$ ${fmtIntPtBr(weights.budgetMax)}`;
  } else if (total <= weights.budgetHardCap) {
    budgetDesc = `R$ ${totalFmt}/mês ligeiramente acima de R$ ${fmtIntPtBr(weights.budgetMax)} (negociável)`;
  } else {
    budgetDesc = `R$ ${totalFmt}/mês acima do teto máximo de R$ ${fmtIntPtBr(weights.budgetHardCap)}`;
  }
  let furnitureDesc = nuances.isBareShell
    ? "Não mobiliado e sem nenhum armário (bônus limitado: marcenaria por sua conta)"
    : "Não mobiliado / só marcenaria fixa (pronto para receber sua mobília de Brasília)";
  if (furnitureTier === "SEMI_FURNISHED") {
    furnitureDesc =
      "Semi-mobiliado — apenas eletros/cozinha sem cama ou sofá (penalidade reduzida)";
  } else if (furnitureTier === "FULLY_FURNISHED") {
    furnitureDesc =
      "Totalmente mobiliado com cama/sofá (requer negociar retirada de mobília solta ou adaptar)";
  }
  const area = prop.areaM2;
  let areaDesc = "";
  if (area >= weights.sweetSpotMinM2 && area <= weights.sweetSpotMaxM2) {
    areaDesc = `${area} m² no sweet spot ideal para a mudança de Brasília (${weights.sweetSpotMinM2}–${weights.sweetSpotMaxM2} m²)`;
  } else if (area > weights.sweetSpotMaxM2 && area <= weights.maxAreaM2) {
    areaDesc = `${area} m² planta espaçosa (${weights.sweetSpotMaxM2}–${weights.maxAreaM2} m²)`;
  } else if (area >= compactFloorM2 && area < weights.sweetSpotMinM2) {
    areaDesc = `${area} m² compacta no limite (${compactFloorM2}–${weights.sweetSpotMinM2 - 1} m²)`;
  } else if (area >= weights.minAreaM2 && area < compactFloorM2) {
    areaDesc = `${area} m² muito enxuta para acomodar toda a mudança de Brasília (${weights.minAreaM2}–${compactFloorM2 - 1} m²)`;
  } else {
    areaDesc = `${area} m² fora da faixa configurada (${weights.minAreaM2}–${weights.maxAreaM2} m²)`;
  }
  let parkingDesc = "Sem vaga de garagem";
  if (prop.parkingSpaces >= 2) {
    parkingDesc = `${prop.parkingSpaces} vagas de garagem`;
  } else if (prop.parkingSpaces === 1) {
    parkingDesc = `1 vaga de garagem${prop.cityCode === "RJ" ? " (raridade na Zona Sul do RJ)" : ""}`;
  }
  const nuancesSummary = weights.penalizeMegaCondo
    ? staticMeta.nuancesSummaryTrue
    : staticMeta.nuancesSummaryFalse;
  const nuancesWarnSummary =
    nuances.nuanceWarnings.length > 0
      ? ` | Ressalvas: ${nuances.nuanceWarnings.join(", ")}`
      : "";
  const safetyClause =
    streetSafetyAdjustment !== 0
      ? ` [Segurança na Rua ${fmtSign(streetSafetyAdjustment)} pts (nota ${nbSafetyCar.toFixed(1)}/10)];`
      : "";
  const cityPrefClause =
    cityPreferencePoints !== 0
      ? ` [Ajuste Praça ${fmtSign(cityPreferencePoints)} pts (${prop.cityCode === "SP" ? "penalidade São Paulo Capital" : "penalidade estado SP / Campinas"})];`
      : "";
  const modernityCurveNote =
    modernityCurveBonus !== 0
      ? ` (curva não-linear ${fmtSign(modernityCurveBonus)} pts)`
      : "";

  return [
    `Score Final ${finalScore.toFixed(1)} pts (${eligible ? "Qualificado" : `Filtrado: ${exclusionReason}`}):`,
    `[Bairro ${fmtSign(neighborhoodPoints)} pts] ${prop.neighborhood} (${prop.cityCode}) tem nota dinâmica ${nbScore.toFixed(2)}/10 × peso ${weights.neighborhoodMultiplier.toFixed(1)} (${nbCommute});${safetyClause}${cityPrefClause}`,
    `[Modernidade ${fmtSign(modernityPoints)} pts] Score ${staticMeta.effectiveModernityScore}/100 (${staticMeta.effectiveModernityTier}: ${staticMeta.signalsSummary}${staticMeta.negSummary}) × peso ${weights.modernityMultiplier.toFixed(2)}${modernityCurveNote};`,
    `[Nuances & Micro-Localização ${fmtSign(nuancesPoints)} pts] (${nuancesSummary}${nuancesWarnSummary}) × peso ${(weights.nuancesMultiplier ?? 1).toFixed(1)};`,
    `[Orçamento ${fmtSign(budgetPoints)} pts] ${budgetDesc};`,
    `[Mobília ${fmtSign(furniturePoints)} pts] ${furnitureDesc};`,
    `[Planta ${fmtSign(areaPoints)} pts] ${areaDesc};`,
    `[Garagem ${fmtSign(parkingPoints)} pts] ${parkingDesc}.`,
  ].join(" ");
}

class EvaluatedPropertyImpl implements EvaluatedProperty {
  provider: SlimPropertyRecord["provider"];
  id: string;
  cityCode: CityHubCode;
  city: string;
  neighborhood: string;
  street: string;
  streetNumber: string | null;
  condominiumName: string | null;
  doorman: string | null;
  url: string;
  title: string;
  rent: number;
  condoFee: number;
  iptu: number;
  totalMonthly: number;
  salePrice: number | null;
  areaM2: number;
  bedrooms: number;
  suites: number;
  bathrooms: number;
  parkingSpaces: number;
  floor: number | null;
  floorRange: { min: number; max: number } | null;
  totalFloors: number | null;
  furnished: boolean | null;
  acceptsPets: boolean | null;
  nearSubway: boolean | null;
  constructionYear: number | null;
  condition: string | null;
  installations: string[];
  amenities: string[];
  comfortCommodities: string[];
  practicalityCommodities: string[];
  placesNearby: Array<{ type: string; name: string }>;
  photoCaptions: string[];
  photosCount: number;
  modernityScore: number;
  modernityTier: SlimPropertyRecord["modernityTier"];
  positiveSignals: string[];
  negativeSignals: string[];
  samplePhotos: Array<{ room: string | null; url: string }>;
  description: string | null;
  generatedDescription: string | null;
  sourceSearch: string | null;
  isNewEntry: boolean;
  publishedAt?: string | null;
  listingUpdatedAt?: string | null;
  isActive?: boolean;
  deactivatedAt?: string | null;
  listedRent?: number;
  listedIptu?: number;
  alsoListedOn?: string[];
  twinAcConfirmed?: boolean;
  furnitureTier: FurnitureTier;
  commuteMinutes: number | null;
  commuteLabel: string;
  listingAgeDays: number | null;
  listingAgeLabel: string | null;
  firstPublicationAgeLabel: string | null;
  eligible: boolean;
  exclusionReason: string | null;
  finalScore: number;
  cityRank: number | null = null;
  overallRank: number | null = null;
  neighborhoodRank: number | null = null;
  neighborhoodDynamicScore: number;
  breakdown: EvaluatedProperty["breakdown"];
  cardTags: EvaluatedProperty["cardTags"];
  nuanceHighlights: string[];
  nuanceWarnings: string[];
  parksNearby: string[];
  mallsNearby: string[];
  #ctx: EvaluatedJustificationContext;
  #short?: string;
  #narrative?: string;
  #detailed?: string;

  constructor(
    p: SlimPropertyRecord,
    commuteMinutes: number | null,
    commuteLabel: string,
    cardTags: EvaluatedProperty["cardTags"],
    breakdown: EvaluatedProperty["breakdown"],
    ctx: EvaluatedJustificationContext,
  ) {
    this.provider = p.provider;
    this.id = p.id;
    this.cityCode = p.cityCode;
    this.city = p.city;
    this.neighborhood = p.neighborhood;
    this.street = p.street;
    this.streetNumber = p.streetNumber;
    this.condominiumName = p.condominiumName;
    this.doorman = p.doorman;
    this.url = p.url;
    this.title = p.title;
    this.rent = p.rent;
    this.condoFee = p.condoFee;
    this.iptu = p.iptu;
    this.totalMonthly = p.totalMonthly;
    this.salePrice = p.salePrice;
    this.areaM2 = p.areaM2;
    this.bedrooms = p.bedrooms;
    this.suites = p.suites;
    this.bathrooms = p.bathrooms;
    this.parkingSpaces = p.parkingSpaces;
    this.floor = p.floor;
    this.floorRange = p.floorRange;
    this.totalFloors = p.totalFloors;
    this.furnished = ctx.staticMeta.effectiveFurnished;
    this.acceptsPets = p.acceptsPets;
    this.nearSubway = p.nearSubway;
    this.constructionYear = p.constructionYear;
    this.condition = p.condition;
    this.installations = p.installations;
    this.amenities = p.amenities;
    this.comfortCommodities = p.comfortCommodities;
    this.practicalityCommodities = p.practicalityCommodities;
    this.placesNearby = p.placesNearby;
    this.photoCaptions = p.photoCaptions;
    this.photosCount = p.photosCount;
    this.modernityScore = ctx.staticMeta.effectiveModernityScore;
    this.modernityTier = ctx.staticMeta.effectiveModernityTier;
    this.positiveSignals = p.positiveSignals;
    this.negativeSignals = p.negativeSignals;
    this.samplePhotos = p.samplePhotos;
    this.description = p.description;
    this.generatedDescription = p.generatedDescription;
    this.sourceSearch = p.sourceSearch;
    this.isNewEntry = p.isNewEntry;
    this.publishedAt = p.publishedAt ?? null;
    this.listingUpdatedAt = p.listingUpdatedAt ?? null;
    this.isActive = p.isActive;
    this.deactivatedAt = p.deactivatedAt;
    this.listedRent = p.listedRent;
    this.listedIptu = p.listedIptu;
    this.alsoListedOn = p.alsoListedOn;
    this.twinAcConfirmed = p.twinAcConfirmed;
    this.furnitureTier = ctx.furnitureTier;
    this.commuteMinutes = commuteMinutes;
    this.commuteLabel = commuteLabel;
    const age = computeListingAge(resolveCurrentPublicationIso(p));
    this.listingAgeDays = age.days;
    this.listingAgeLabel = age.label;
    const firstAge = computeListingAge(p.publishedAt);
    this.firstPublicationAgeLabel =
      firstAge.days !== null && age.days !== null && firstAge.days - age.days >= 30
        ? firstAge.label
        : null;
    this.eligible = ctx.eligible;
    this.exclusionReason = ctx.exclusionReason;
    this.finalScore = ctx.finalScore;
    this.neighborhoodDynamicScore = ctx.nbScore;
    this.breakdown = breakdown;
    this.cardTags = cardTags;
    this.nuanceHighlights = ctx.nuances.nuanceHighlights;
    this.nuanceWarnings = ctx.nuances.nuanceWarnings;
    this.parksNearby = ctx.nuances.parksNearby;
    this.mallsNearby = ctx.nuances.mallsNearby;
    this.#ctx = ctx;

    // Define lazy-cached own enumerable getters on each instance so `{ ...prop }` object spread
    // always copies shortJustification, narrativeJustification, and detailedJustification.
    Object.defineProperties(this, {
      shortJustification: {
        enumerable: true,
        configurable: true,
        get: () => this.#getShortJustification(),
      },
      narrativeJustification: {
        enumerable: true,
        configurable: true,
        get: () => this.#getNarrativeJustification(),
      },
      detailedJustification: {
        enumerable: true,
        configurable: true,
        get: () => this.#getDetailedJustification(),
      },
    });
  }

  #getShortJustification(): string {
    if (this.#short === undefined) {
      this.#short = buildShortJustification({
        prop: this.#ctx.prop,
        furnitureTier: this.#ctx.furnitureTier,
        catalogNb: this.#ctx.catalogNb,
        nbScore: this.#ctx.nbScore,
        nbCommute: this.#ctx.nbCommute,
        safetyCar: this.#ctx.nbSafetyCar,
        weights: this.#ctx.weights,
        nuances: this.#ctx.nuances,
        eligible: this.#ctx.eligible,
        exclusionReason: this.#ctx.exclusionReason,
      });
    }
    return this.#short;
  }

  #getNarrativeJustification(): string {
    if (this.#narrative === undefined) {
      this.#narrative = buildNarrativeJustification({
        prop: this.#ctx.prop,
        furnitureTier: this.#ctx.furnitureTier,
        catalogNb: this.#ctx.catalogNb,
        nbCommute: this.#ctx.nbCommute,
        weights: this.#ctx.weights,
        nuances: this.#ctx.nuances,
        eligible: this.#ctx.eligible,
        exclusionReason: this.#ctx.exclusionReason,
      });
    }
    return this.#narrative;
  }

  #getDetailedJustification(): string {
    if (this.#detailed === undefined) {
      this.#detailed = buildDetailedJustificationFromContext(this.#ctx);
    }
    return this.#detailed;
  }

  get shortJustification(): string {
    return this.#getShortJustification();
  }

  get narrativeJustification(): string {
    return this.#getNarrativeJustification();
  }

  get detailedJustification(): string {
    return this.#getDetailedJustification();
  }
}

for (const key of [
  "shortJustification",
  "narrativeJustification",
  "detailedJustification",
] as const) {
  const desc = Object.getOwnPropertyDescriptor(
    EvaluatedPropertyImpl.prototype,
    key,
  );
  if (desc) {
    Object.defineProperty(EvaluatedPropertyImpl.prototype, key, {
      ...desc,
      enumerable: true,
    });
  }
}

export function computeDynamicProperties(
  properties: SlimPropertyRecord[],
  computedNeighborhoods: ComputedNeighborhood[],
  weights: ScoringWeights,
  options?: { includeBsbBenchmark?: boolean },
): EvaluatedProperty[] {
  const nbMap = new Map<string, ComputedNeighborhood>();
  for (const n of computedNeighborhoods) {
    nbMap.set(`${n.cityCode}:${n.neighborhood.toLowerCase()}`, n);
  }

  const evaluated: EvaluatedProperty[] = prepareListingsForScoring(properties).map((prop) => {
    const staticMeta = getStaticPropertyScoringMeta(prop);
    const {
      normNbLower,
      nbLower,
      calibratedMeta,
      microEnv,
      isDeepWestBarra,
      furnitureTier,
    } = staticMeta;
    const catalogNb =
      nbMap.get(nbLower) ?? nbMap.get(`${prop.cityCode}:${normNbLower}`);

    const baseSafetyCar = catalogNb
      ? calibratedMeta && calibratedMeta.safetyCar < 6.5
        ? Math.min(catalogNb.safetyCarScore, calibratedMeta.safetyCar)
        : catalogNb.safetyCarScore
      : calibratedMeta
        ? calibratedMeta.safetyCar
        : prop.cityCode === "RJ"
          ? 4.8
          : 6.5;

    const nbSafetyCar =
      microEnv.safetyCarCap !== null
        ? Math.min(baseSafetyCar, microEnv.safetyCarCap)
        : baseSafetyCar;

    const baseUrbanBreathing = catalogNb
      ? calibratedMeta && calibratedMeta.urbanBreathing < 8.0
        ? Math.min(catalogNb.urbanBreathingScore, calibratedMeta.urbanBreathing)
        : catalogNb.urbanBreathingScore
      : calibratedMeta
        ? calibratedMeta.urbanBreathing
        : 6.0;
    const effectiveUrbanBreathing =
      microEnv.urbanBreathingCap !== null
        ? Math.min(baseUrbanBreathing, microEnv.urbanBreathingCap)
        : baseUrbanBreathing;

    let nbScore = 6.2;
    let nbCommute = "~20-35 min do Nubank";
    const {
      photoAudit,
      effectiveModernityScore,
      effectiveModernityTier,
      cpFarCommute,
    } = staticMeta;
    if (catalogNb) {
      nbCommute = `${catalogNb.commuteTime} (${catalogNb.nubankHub})`;
      if (
        microEnv.safetyCarCap !== null ||
        microEnv.urbanBreathingCap !== null
      ) {
        nbScore = computeWeightedNeighborhoodScore(
          {
            urbanBreathing: effectiveUrbanBreathing,
            commuteLogistics: catalogNb.commuteLogisticsScore,
            buildingStock: catalogNb.buildingStockFitScore,
            budgetFit: catalogNb.budgetFitScore,
            safetyCar: nbSafetyCar,
          },
          weights,
        );
      } else {
        nbScore = catalogNb.dynamicScore;
      }
    } else if (calibratedMeta) {
      nbScore = computeWeightedNeighborhoodScore(
        {
          urbanBreathing: effectiveUrbanBreathing,
          commuteLogistics: calibratedMeta.commuteLogistics,
          buildingStock: calibratedMeta.buildingStock,
          budgetFit: calibratedMeta.budgetFit,
          safetyCar: nbSafetyCar,
        },
        weights,
      );
      nbCommute = calibratedMeta.commute;
    } else {
      nbScore = computeWeightedNeighborhoodScore(
        {
          urbanBreathing: effectiveUrbanBreathing,
          commuteLogistics: 6.5,
          buildingStock: 6.2,
          budgetFit: 7.0,
          safetyCar: nbSafetyCar,
        },
        weights,
      );
    }
    if (cpFarCommute) {
      nbCommute = cpFarCommute.commuteText;
    }

    const neighborhoodPoints =
      Math.round(nbScore * weights.neighborhoodMultiplier * 10) / 10;

    // Direct Street-Safety Impact (scaled by weights.safetyCarWeight / 2.5)
    const safetyWeightScale = weights.safetyCarWeight / 2.5;
    let rawStreetSafetyPts = 0;
    if (nbSafetyCar < 6.0) {
      // Unsafe outside the condominium (e.g., Tijuca, Maracanã, Santo Cristo, Rio Comprido, Centro): -28 to -45 pts
      rawStreetSafetyPts = -(
        28 + Math.min(17, Math.max(0, (6.0 - nbSafetyCar) * 8.5))
      );
    } else if (nbSafetyCar < 7.2) {
      // Attention required at night (e.g., Glória, Catete, Copacabana, Bela Vista): -12 to -18 pts
      rawStreetSafetyPts = -(12 + ((7.2 - nbSafetyCar) / 1.2) * 6);
    } else if (nbSafetyCar >= 8.5) {
      // Safe walkable bubble: +6 pts bonus
      rawStreetSafetyPts = 6.0;
    } else if (nbSafetyCar >= 8.0) {
      rawStreetSafetyPts = 2.5;
    }
    const streetSafetyAdjustment =
      Math.round(rawStreetSafetyPts * safetyWeightScale * 10) / 10;

    const nbCommuteLogistics = catalogNb
      ? calibratedMeta
        ? Math.min(catalogNb.commuteLogisticsScore, calibratedMeta.commuteLogistics)
        : catalogNb.commuteLogisticsScore
      : calibratedMeta
        ? calibratedMeta.commuteLogistics
        : 6.5;

    // Direct Commute-Distance Impact (heavily penalize far-away neighborhoods like Barra da Tijuca / Barra Olímpica / Ponte Rio-Niterói, and apply a distance-scaled discount to north/NE Campinas, Taquaral and beyond)
    const commuteWeightScale = weights.commuteLogisticsWeight / 1.8;
    let rawCommutePts = 0;
    if (isDeepWestBarra) {
      rawCommutePts = -48.0;
    } else if (nbCommuteLogistics <= 4.0) {
      rawCommutePts = -32.0;
    } else if (nbCommuteLogistics < 6.5) {
      rawCommutePts = -((6.5 - nbCommuteLogistics) * 6.5);
    } else if (cpFarCommute) {
      rawCommutePts =
        cpFarCommute.penaltyPts / Math.max(0.5, commuteWeightScale);
    } else if (nbCommuteLogistics >= 9.2) {
      rawCommutePts = 4.0;
    }
    const commuteDistanceAdjustment =
      Math.round(rawCommutePts * commuteWeightScale * 10) / 10;

    // Non-linear interior quality & modernity curve (linear ramp up to +8 pts for modern units; strong negative curve for dated/infiltrated apartments)
    const hasRenovationEvidence = prop.positiveSignals.some(
      (p) =>
        p !== "Flag Novo/Reformado" &&
        (p.includes("Reformado") ||
          p.includes("novo") ||
          p.includes("Porcelanato") ||
          p.includes("Construção 20")),
    );
    const hasNegativeConservationEvidence =
      prop.negativeSignals.some(
        (s) =>
          !/descri[cç][aã]o gen[eé]rica|venda|comprad|visita[cç][aã]o/i.test(s),
      ) ||
      effectiveModernityTier === "DATED" ||
      Boolean(photoAudit?.hardExcludeDated) ||
      Boolean(photoAudit?.hasMaintenanceIssue) ||
      (prop.constructionYear !== null &&
        prop.constructionYear < 1995 &&
        !hasRenovationEvidence);

    let rawModernityCurve = 0;
    if (weights.modernityMultiplier > 0) {
      if (
        effectiveModernityScore > MODERNITY_RAMP_START &&
        effectiveModernityTier === "MODERN_OR_RENOVATED"
      ) {
        rawModernityCurve = Math.min(
          MODERNITY_RAMP_MAX_BONUS,
          (effectiveModernityScore - MODERNITY_RAMP_START) * 0.5,
        );
      } else if (effectiveModernityScore < 45) {
        rawModernityCurve = -40.0;
      } else if (effectiveModernityScore < 60) {
        rawModernityCurve = -25.0;
      } else if (
        hasNegativeConservationEvidence &&
        effectiveModernityScore < 68
      ) {
        rawModernityCurve = -10.0;
      }
      if (photoAudit?.hasMaintenanceIssue === true) {
        rawModernityCurve -= 15.0;
      }
    }
    const modernityCurveBonus = rawModernityCurve;
    const modernityPoints =
      Math.round(
        (effectiveModernityScore * weights.modernityMultiplier +
          modernityCurveBonus) *
          10,
      ) / 10;

    // Nuances evaluation
    const baseNuances = evaluateApartmentNuancesFast(
      prop,
      weights.penalizeMegaCondo,
    );
    const isFurnishedClassified = furnitureTier === "FULLY_FURNISHED";
    const failsFurnished = false;
    const isBunkerExcluded = false;
    const failsBunker = isBunkerExcluded;
    const parsedCommute = parseCommuteMinutes(
      cpFarCommute?.commuteText ?? catalogNb?.commuteTime ?? nbCommute,
      isDeepWestBarra,
    );
    const commuteMinutes = parsedCommute.minutes;
    const isCommuteBottleneckExcluded =
      prop.cityCode !== "BSB" &&
      commuteMinutes !== null &&
      commuteMinutes > 50;
    const failsCommuteBottleneck = isCommuteBottleneckExcluded;
    const needsDistTag = isDeepWestBarra || nbCommuteLogistics <= 4.0;
    const needsSafetyTag = nbSafetyCar < 6.0;
    const hasPhotoAuditWarnings =
      photoAudit &&
      (photoAudit.hardExcludeDated ||
        photoAudit.hasMaintenanceIssue ||
        photoAudit.falseAC) &&
      (photoAudit.visualWarnings ?? []).length > 0;
    const nuances: ApartmentNuancesEvaluation =
      needsDistTag ||
      needsSafetyTag ||
      isFurnishedClassified ||
      failsCommuteBottleneck ||
      hasPhotoAuditWarnings
        ? {
            ...baseNuances,
            redTags: baseNuances.redTags.slice(),
            nuanceWarnings: baseNuances.nuanceWarnings.slice(),
          }
        : baseNuances;
    if (hasPhotoAuditWarnings && photoAudit) {
      for (const w of (photoAudit.visualWarnings ?? []).slice(0, 2)) {
        if (w && !nuances.nuanceWarnings.includes(w)) {
          nuances.nuanceWarnings.push(w);
        }
      }
    }
    if (
      isFurnishedClassified &&
      !nuances.redTags.includes("Totalmente mobiliado")
    ) {
      nuances.redTags.push("Totalmente mobiliado");
    }
    if (failsCommuteBottleneck) {
      const bottleneckTag = `Tempo > 50 min (${parsedCommute.label})`;
      if (!nuances.redTags.includes(bottleneckTag)) {
        nuances.redTags.push(bottleneckTag);
      }
    }
    if (needsDistTag) {
      const distTag = isDeepWestBarra
        ? "Barra Olímpica / Muito Longe do Nubank (75–100 min)"
        : "Longe do Escritório (60–90 min)";
      if (!nuances.redTags.includes(distTag)) {
        nuances.redTags.unshift(distTag);
      }
      nuances.nuanceWarnings.unshift(
        `Distância crítica até o escritório do Nubank (${commuteDistanceAdjustment.toFixed(1)} pts)`,
      );
    }
    if (needsSafetyTag) {
      if (!nuances.redTags.includes("Alerta de Segurança na Rua")) {
        nuances.redTags.unshift("Alerta de Segurança na Rua");
      }
      nuances.nuanceWarnings.unshift(
        `Entorno com alerta de insegurança ao sair do condomínio (nota segurança ${nbSafetyCar.toFixed(1)}/10: ${streetSafetyAdjustment.toFixed(1)} pts)`,
      );
    }
    const nuancesPoints =
      Math.round(nuances.rawNuancePoints * (weights.nuancesMultiplier ?? 1.0) * 10) / 10;

    const total = prop.totalMonthly;
    let rawBudgetPts = 0;
    const comfortFloor = Math.max(1500, weights.budgetIdeal - 500);
    const midToleranceCap = Math.min(weights.budgetHardCap, weights.budgetMax + 500);
    if (total > 0 && total <= comfortFloor) {
      rawBudgetPts = 11;
    } else if (total > 0 && total <= weights.budgetIdeal) {
      rawBudgetPts = 10;
    } else if (total <= weights.budgetMax) {
      rawBudgetPts = 8;
    } else if (total <= midToleranceCap) {
      rawBudgetPts = 0;
    } else if (total <= weights.budgetHardCap) {
      rawBudgetPts = -8;
    } else {
      rawBudgetPts = -16;
    }
    const budgetPoints =
      Math.round(rawBudgetPts * weights.budgetWeight * 10) / 10;

    // 3-tier Furniture classification & points
    let furniturePoints = staticMeta.isUnconfirmedNullFurniture
      ? Math.round(weights.unfurnishedBonus * 0.6)
      : weights.unfurnishedBonus;
    if (furnitureTier === "SEMI_FURNISHED") {
      furniturePoints = Math.round(weights.furnishedPenalty * 0.35);
    } else if (furnitureTier === "FULLY_FURNISHED") {
      furniturePoints = weights.furnishedPenalty;
    } else if (nuances.isBareShell) {
      furniturePoints = Math.min(furniturePoints, BARE_SHELL_UNFURNISHED_BONUS_CAP);
    }

    // Area points (calibrated for bringing Brasília furniture: Queen bed, large sofa, fridge, washer, dishwasher)
    const area = prop.areaM2;
    let areaPoints = 0;
    const compactFloorM2 = Math.min(
      weights.sweetSpotMinM2,
      Math.max(43, weights.minAreaM2, weights.sweetSpotMinM2 - 4),
    );
    if (area >= weights.sweetSpotMinM2 && area <= weights.sweetSpotMaxM2) {
      areaPoints = 10;
    } else if (area > weights.sweetSpotMaxM2 && area <= weights.maxAreaM2) {
      areaPoints = 6;
    } else if (area >= compactFloorM2 && area < weights.sweetSpotMinM2) {
      areaPoints = 0;
    } else if (area >= Math.max(40, weights.minAreaM2) && area < compactFloorM2) {
      areaPoints = -10;
    } else {
      areaPoints = -18;
    }

    // Parking points
    const isRJ = prop.cityCode === "RJ";
    let parkingPoints = 0;
    if (prop.parkingSpaces >= 2) {
      parkingPoints = isRJ ? weights.parkingBonus2 + 14 : weights.parkingBonus2;
    } else if (prop.parkingSpaces === 1) {
      parkingPoints = isRJ ? weights.parkingBonus1 + 12 : weights.parkingBonus1;
    } else {
      parkingPoints = isRJ ? -8 : -18;
    }

    // City Preference Adjustment (User preference: penalize São Paulo Capital heavily; since SP neighborhoods already carry a -1.5 dynamicScore discount [-9.75 pts], add -10.0 pts so total SP property penalty is ~-19.8 pts; BH, RJ, and CP compete on equal footing)
    const cityPreferencePoints = prop.cityCode === "SP" ? -10.0 : 0;

    const breakdown = {
      neighborhoodPoints: Math.round(neighborhoodPoints * 10) / 10,
      modernityPoints: Math.round(modernityPoints * 10) / 10,
      nuancesPoints: Math.round(nuancesPoints * 10) / 10,
      budgetPoints: Math.round(budgetPoints * 10) / 10,
      furniturePoints: Math.round(furniturePoints * 10) / 10,
      areaPoints: Math.round(areaPoints * 10) / 10,
      parkingPoints: Math.round(parkingPoints * 10) / 10,
      safetyPoints: Math.round(streetSafetyAdjustment * 10) / 10,
      commutePoints: Math.round(commuteDistanceAdjustment * 10) / 10,
      cityPreferencePoints: Math.round(cityPreferencePoints * 10) / 10,
    };

    const finalScore =
      Math.round(
        (breakdown.neighborhoodPoints +
          breakdown.modernityPoints +
          breakdown.nuancesPoints +
          breakdown.budgetPoints +
          breakdown.furniturePoints +
          breakdown.areaPoints +
          breakdown.parkingPoints +
          breakdown.safetyPoints +
          breakdown.commutePoints +
          breakdown.cityPreferencePoints) *
          10,
      ) / 10;

    // Eligibility checks (strictly per user retention rules: NO budget retention, NO furniture retention, NO modernity retention, NO bunker retention; retain ONLY on area < minAreaM2, commute > 50 min, no parking, no elevator, trapped parking)
    const failsBudget = false;
    const failsArea = area < weights.minAreaM2;
    const failsParking = weights.requireParking && prop.parkingSpaces < 1;
    const failsMod = false;
    const eligible =
      !failsBudget &&
      !failsArea &&
      !failsParking &&
      !nuances.hasNoElevator &&
      !nuances.hasTrappedParking &&
      !failsMod &&
      !failsFurnished &&
      !failsBunker &&
      !failsCommuteBottleneck;

    let exclusionReason: string | null = null;
    if (!eligible) {
      const exclusions: string[] = [];
      if (failsArea) {
        exclusions.push(
          `Área ${area} m² abaixo do mínimo de ${weights.minAreaM2} m² (eliminado)`,
        );
      }
      if (failsParking) {
        exclusions.push("Sem vaga de garagem (filtro exigir vaga ativo)");
      }
      if (nuances.hasNoElevator) {
        exclusions.push("Sem elevador (eliminado)");
      }
      if (nuances.hasTrappedParking) {
        exclusions.push("Vaga presa, gaveta ou rotativa (eliminado)");
      }
      if (failsCommuteBottleneck) {
        exclusions.push(
          `Tempo até o escritório (${commuteMinutes} min) acima do limite de 50 min (eliminado)`,
        );
      }
      exclusionReason = exclusions.join(" · ");
    }

    const cardTags: EvaluatedProperty["cardTags"] = {
      acLabel: nuances.acLabel,
      floorTag: nuances.floorTag,
      highFloorLabel: nuances.highFloorLabel,
      lowFloorLabel: nuances.lowFloorLabel,
      noParking: prop.parkingSpaces < 1,
      greenTags: nuances.greenTags,
      redTags: nuances.redTags,
      warningTags: nuances.warningTags,
    };

    const evaluatedItem = new EvaluatedPropertyImpl(
      prop,
      parsedCommute.minutes,
      parsedCommute.label,
      cardTags,
      breakdown,
      {
        prop,
        staticMeta,
        furnitureTier,
        catalogNb,
        nbScore,
        nbCommute,
        nbSafetyCar,
        weights,
        nuances,
        eligible,
        exclusionReason,
        finalScore,
        neighborhoodPoints,
        modernityPoints,
        modernityCurveBonus,
        nuancesPoints,
        budgetPoints,
        furniturePoints,
        areaPoints,
        parkingPoints,
        streetSafetyAdjustment,
        cityPreferencePoints,
        comfortFloor,
        compactFloorM2,
      },
    );
    staticPropertyMetaCache.set(evaluatedItem, staticMeta);
    return evaluatedItem;
  });

  evaluated.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (a.totalMonthly !== b.totalMonthly) return a.totalMonthly - b.totalMonthly;
    const ka = `${a.provider}:${a.id}`;
    const kb = `${b.provider}:${b.id}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

  let overallCounter = 0;
  const cityCounters = new Map<CityHubCode, number>();
  const nbCounters = new Map<string, number>();

  for (const item of evaluated) {
    if (!item.eligible || item.isActive === false) continue;

    const cRank = (cityCounters.get(item.cityCode) ?? 0) + 1;
    cityCounters.set(item.cityCode, cRank);
    item.cityRank = cRank;

    const staticMeta = staticPropertyMetaCache.get(item);
    const nbKey = staticMeta
      ? `${item.cityCode}:${staticMeta.normNbLower}`
      : `${item.cityCode}:${normalizeNeighborhoodKey(item.neighborhood, item.cityCode).toLowerCase()}`;
    const nRank = (nbCounters.get(nbKey) ?? 0) + 1;
    nbCounters.set(nbKey, nRank);
    item.neighborhoodRank = nRank;

    if (item.cityCode !== "BSB" || options?.includeBsbBenchmark) {
      overallCounter++;
      item.overallRank = overallCounter;
    }
  }

  return evaluated;
}
