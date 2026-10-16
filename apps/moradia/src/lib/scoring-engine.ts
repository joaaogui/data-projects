import type {
  CityHubCode,
  ComputedNeighborhood,
  EvaluatedProperty,
  FloorTag,
  FurnitureTier,
  NeighborhoodEntry,
  ScoringWeights,
  SlimPropertyRecord,
} from "@/types/moradia";

export const DEFAULT_WEIGHTS: ScoringWeights = {
  urbanBreathingWeight: 2.0,
  commuteLogisticsWeight: 1.8,
  buildingStockWeight: 1.0,
  budgetFitWeight: 1.0,
  safetyCarWeight: 2.5,
  neighborhoodMultiplier: 6.5,
  modernityMultiplier: 0.85,
  nuancesMultiplier: 1.0,
  minModernityScore: 60,
  budgetIdeal: 5500,
  budgetMax: 6500,
  budgetHardCap: 6850,
  budgetWeight: 1.0,
  unfurnishedBonus: 15,
  furnishedPenalty: -22,
  parkingBonus1: 5,
  parkingBonus2: 8,
  requireParking: true,
  penalizeMegaCondo: true,
  minAreaM2: 40,
  maxAreaM2: 95,
  sweetSpotMinM2: 50,
  sweetSpotMaxM2: 72,
};

export const BUILTIN_PRESETS: {
  id: string;
  name: string;
  description: string;
  weights: ScoringWeights;
}[] = [
  {
    id: "balanced-original",
    name: "Equilíbrio Original (Padrão)",
    description:
      "Pesos calibrados: segurança ao sair na rua como fator prioritário (2.5x), peso do bairro 6.5x, teto ideal R$ 5.500 (máx R$ 6.500), 40–95 m², foco em modernidade e respiração urbana.",
    weights: DEFAULT_WEIGHTS,
  },
  {
    id: "anti-velharia-max",
    name: "Foco Anti-Velharia Máximo",
    description:
      "Dobra o peso do Score de Modernidade (1.1x) e exige mínimo de 72/100 (apenas prédios novos ou 100% reformados), mantendo rigor em segurança.",
    weights: {
      ...DEFAULT_WEIGHTS,
      buildingStockWeight: 1.6,
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
  // Moderate-good Zona Sul / Niterói (safetyCar: 7.0–8.0)
  "RJ:Flamengo": { cityCode: "RJ", commute: "15 min do Nubank (Porto Maravilha)", urbanBreathing: 9.6, commuteLogistics: 9.2, buildingStock: 5.8, budgetFit: 6.5, safetyCar: 7.8 },
  "RJ:Humaitá": { cityCode: "RJ", commute: "20 min do Nubank via Túnel Rebouças", urbanBreathing: 8.0, commuteLogistics: 8.0, buildingStock: 6.5, budgetFit: 6.5, safetyCar: 7.8 },
  "RJ:Leme": { cityCode: "RJ", commute: "20-25 min do Nubank", urbanBreathing: 9.0, commuteLogistics: 8.0, buildingStock: 5.5, budgetFit: 6.2, safetyCar: 7.8 },
  "RJ:Ingá": { cityCode: "RJ", commute: "30-40 min do Nubank via Ponte", urbanBreathing: 8.0, commuteLogistics: 6.0, buildingStock: 7.8, budgetFit: 8.2, safetyCar: 7.8 },
  "RJ:Laranjeiras": { cityCode: "RJ", commute: "15-20 min do Nubank", urbanBreathing: 7.8, commuteLogistics: 8.2, buildingStock: 6.0, budgetFit: 6.8, safetyCar: 7.6 },
  "RJ:Santa Rosa": { cityCode: "RJ", commute: "35-45 min do Nubank via Ponte", urbanBreathing: 7.8, commuteLogistics: 5.6, buildingStock: 8.2, budgetFit: 8.4, safetyCar: 7.6 },
  "RJ:São Domingos": { cityCode: "RJ", commute: "30-35 min do Nubank via Ponte", urbanBreathing: 7.8, commuteLogistics: 6.0, buildingStock: 7.5, budgetFit: 8.0, safetyCar: 7.6 },
  "RJ:Cosme Velho": { cityCode: "RJ", commute: "18-22 min do Nubank", urbanBreathing: 8.2, commuteLogistics: 7.8, buildingStock: 5.8, budgetFit: 6.8, safetyCar: 7.5 },
  "RJ:Botafogo": { cityCode: "RJ", commute: "10-15 min do Nubank (Porto Maravilha)", urbanBreathing: 7.2, commuteLogistics: 9.0, buildingStock: 6.8, budgetFit: 6.0, safetyCar: 7.3 },
  "RJ:Botafogo (Orla)": { cityCode: "RJ", commute: "10-15 min do Nubank (Porto Maravilha)", urbanBreathing: 7.2, commuteLogistics: 9.0, buildingStock: 6.8, budgetFit: 6.0, safetyCar: 7.3 },
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
  // Truly safe Zona Sul / Nova Lima (safetyCar: 8.3–9.2)
  "BH:Lourdes": { cityCode: "BH", commute: "15 min do Nubank", urbanBreathing: 9.2, commuteLogistics: 9.2, buildingStock: 9.0, budgetFit: 9.0, safetyCar: 9.1 },
  "BH:Belvedere": { cityCode: "BH", commute: "25-35 min do Nubank", urbanBreathing: 8.8, commuteLogistics: 6.2, buildingStock: 6.0, budgetFit: 5.5, safetyCar: 9.0 },
  "BH:Vale do Sereno": { cityCode: "BH", commute: "25-35 min do Nubank", urbanBreathing: 9.2, commuteLogistics: 6.2, buildingStock: 8.8, budgetFit: 7.6, safetyCar: 9.0 },
  "BH:Sion": { cityCode: "BH", commute: "15-20 min do Nubank", urbanBreathing: 8.8, commuteLogistics: 8.4, buildingStock: 8.5, budgetFit: 9.4, safetyCar: 8.9 },
  "BH:Anchieta": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 8.6, commuteLogistics: 8.5, buildingStock: 8.2, budgetFit: 8.0, safetyCar: 8.9 },
  "BH:Carmo": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 8.8, commuteLogistics: 8.8, buildingStock: 8.6, budgetFit: 8.8, safetyCar: 8.8 },
  "BH:Funcionários": { cityCode: "BH", commute: "10 min do Nubank", urbanBreathing: 9.5, commuteLogistics: 9.8, buildingStock: 9.4, budgetFit: 9.5, safetyCar: 8.8 },
  "BH:Santo Agostinho": { cityCode: "BH", commute: "15 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 8.8, buildingStock: 8.5, budgetFit: 8.2, safetyCar: 8.8 },
  "BH:Santo Antônio": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 8.6, commuteLogistics: 8.8, buildingStock: 8.5, budgetFit: 8.8, safetyCar: 8.7 },
  "BH:Cruzeiro": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 8.5, buildingStock: 8.0, budgetFit: 8.2, safetyCar: 8.7 },
  "BH:Vila da Serra": { cityCode: "BH", commute: "25-35 min do Nubank", urbanBreathing: 9.2, commuteLogistics: 6.2, buildingStock: 8.8, budgetFit: 7.8, safetyCar: 8.7 },
  "BH:Cidade Jardim": { cityCode: "BH", commute: "18-22 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 7.6, buildingStock: 7.5, budgetFit: 8.0, safetyCar: 8.6 },
  "BH:Vila Paris": { cityCode: "BH", commute: "18-22 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 7.6, buildingStock: 8.0, budgetFit: 8.0, safetyCar: 8.6 },
  "BH:Gutierrez": { cityCode: "BH", commute: "18-22 min do Nubank", urbanBreathing: 8.0, commuteLogistics: 7.8, buildingStock: 8.0, budgetFit: 8.2, safetyCar: 8.5 },
  "BH:Mangabeiras": { cityCode: "BH", commute: "15-20 min do Nubank", urbanBreathing: 9.0, commuteLogistics: 8.0, buildingStock: 7.5, budgetFit: 7.5, safetyCar: 8.5 },
  "BH:São Pedro": { cityCode: "BH", commute: "12-15 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 8.6, buildingStock: 8.0, budgetFit: 8.0, safetyCar: 8.4 },
  "BH:Savassi": { cityCode: "BH", commute: "10-12 min do Nubank", urbanBreathing: 7.6, commuteLogistics: 9.4, buildingStock: 8.0, budgetFit: 7.6, safetyCar: 8.4 },
  "BH:Luxemburgo": { cityCode: "BH", commute: "18-22 min do Nubank", urbanBreathing: 8.2, commuteLogistics: 7.6, buildingStock: 8.2, budgetFit: 8.2, safetyCar: 8.4 },
  "BH:Santa Lúcia": { cityCode: "BH", commute: "18-25 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 7.4, buildingStock: 8.0, budgetFit: 8.0, safetyCar: 8.4 },
  "BH:Serra": { cityCode: "BH", commute: "10-12 min do Nubank", urbanBreathing: 8.4, commuteLogistics: 9.0, buildingStock: 8.0, budgetFit: 8.2, safetyCar: 8.3 },
  "BH:Buritis": { cityCode: "BH", commute: "25-35 min do Nubank", urbanBreathing: 7.8, commuteLogistics: 6.2, buildingStock: 8.4, budgetFit: 8.8, safetyCar: 8.3 },
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
  "CP:Jd. Guanabara": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 7.2, commuteLogistics: 8.0, buildingStock: 8.5, budgetFit: 8.8, safetyCar: 8.5 },
  "CP:Jardim Guanabara": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 7.2, commuteLogistics: 8.0, buildingStock: 8.5, budgetFit: 8.8, safetyCar: 8.5 },
  "CP:Guanabara": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 7.2, commuteLogistics: 8.0, buildingStock: 8.5, budgetFit: 8.8, safetyCar: 8.5 },
  "CP:Chácara Primavera": { cityCode: "CP", commute: "30-35 min do Nubank (Viracopos)", urbanBreathing: 8.2, commuteLogistics: 7.4, buildingStock: 8.4, budgetFit: 8.4, safetyCar: 8.5 },
  "CP:Chácara da Barra": { cityCode: "CP", commute: "25-30 min do Nubank (Viracopos)", urbanBreathing: 8.2, commuteLogistics: 7.6, buildingStock: 8.2, budgetFit: 8.2, safetyCar: 8.5 },
  "CP:Jd. Chapadão": { cityCode: "CP", commute: "30-35 min do Nubank (Viracopos)", urbanBreathing: 7.8, commuteLogistics: 6.5, buildingStock: 6.5, budgetFit: 7.8, safetyCar: 8.5 },
  "CP:Jardim Chapadão": { cityCode: "CP", commute: "30-35 min do Nubank (Viracopos)", urbanBreathing: 7.8, commuteLogistics: 6.5, buildingStock: 6.5, budgetFit: 7.8, safetyCar: 8.5 },
  "CP:Castelo": { cityCode: "CP", commute: "30-35 min do Nubank (Viracopos)", urbanBreathing: 7.8, commuteLogistics: 6.5, buildingStock: 6.8, budgetFit: 8.0, safetyCar: 8.4 },
  "CP:Parque Prado": { cityCode: "CP", commute: "15 min do Nubank (Viracopos)", urbanBreathing: 7.2, commuteLogistics: 9.4, buildingStock: 7.5, budgetFit: 8.5, safetyCar: 8.5 },
  "CP:Vila Itapura": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 7.2, commuteLogistics: 8.0, buildingStock: 7.8, budgetFit: 8.2, safetyCar: 8.0 },
  "CP:Jardim Proença": { cityCode: "CP", commute: "15-20 min do Nubank (Viracopos)", urbanBreathing: 7.6, commuteLogistics: 8.8, buildingStock: 7.6, budgetFit: 8.2, safetyCar: 8.0 },
  "CP:Bosque": { cityCode: "CP", commute: "15-20 min do Nubank (Viracopos)", urbanBreathing: 7.4, commuteLogistics: 8.5, buildingStock: 7.8, budgetFit: 8.2, safetyCar: 7.9 },
  "CP:Botafogo": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 6.4, commuteLogistics: 8.0, buildingStock: 7.2, budgetFit: 8.6, safetyCar: 6.8 },
  "CP:Centro": { cityCode: "CP", commute: "20-25 min do Nubank (Viracopos)", urbanBreathing: 5.5, commuteLogistics: 8.2, buildingStock: 6.5, budgetFit: 8.8, safetyCar: 5.5 },

  // === SP (São Paulo Capital) ===
  "SP:Vila Nova Conceição": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 9.2, commuteLogistics: 7.8, buildingStock: 6.5, budgetFit: 4.5, safetyCar: 8.9 },
  "SP:Jardim América": { cityCode: "SP", commute: "10-20 min do Nubank (Pinheiros)", urbanBreathing: 9.0, commuteLogistics: 8.8, buildingStock: 6.8, budgetFit: 5.2, safetyCar: 8.8 },
  "SP:Jardim America": { cityCode: "SP", commute: "10-20 min do Nubank (Pinheiros)", urbanBreathing: 9.0, commuteLogistics: 8.8, buildingStock: 6.8, budgetFit: 5.2, safetyCar: 8.8 },
  "SP:Moema": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 9.0, commuteLogistics: 8.0, buildingStock: 8.5, budgetFit: 8.2, safetyCar: 8.7 },
  "SP:Indianópolis": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 8.8, commuteLogistics: 7.8, buildingStock: 8.4, budgetFit: 8.0, safetyCar: 8.7 },
  "SP:Vila Uberabinha": { cityCode: "SP", commute: "20-30 min do Nubank (Pinheiros)", urbanBreathing: 8.5, commuteLogistics: 7.8, buildingStock: 8.2, budgetFit: 8.0, safetyCar: 8.6 },
  "SP:Jardim Paulista": { cityCode: "SP", commute: "15-25 min do Nubank (Pinheiros)", urbanBreathing: 8.0, commuteLogistics: 8.5, buildingStock: 6.8, budgetFit: 6.8, safetyCar: 8.6 },
  "SP:Jardins": { cityCode: "SP", commute: "15-25 min do Nubank (Pinheiros)", urbanBreathing: 8.0, commuteLogistics: 8.5, buildingStock: 6.8, budgetFit: 6.8, safetyCar: 8.6 },
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

    const dynamicScore = computeWeightedNeighborhoodScore(
      {
        urbanBreathing: effectiveUrbanBreathing,
        commuteLogistics: effectiveCommuteLogistics,
        buildingStock: n.buildingStockFitScore,
        budgetFit: n.budgetFitScore,
        safetyCar: effectiveSafetyCar,
      },
      weights,
    );

    const safetyPenaltyNote =
      effectiveSafetyCar < 6.5
        ? ` [Penalidade severa de segurança ao sair na rua aplicada: nota ${effectiveSafetyCar.toFixed(1)}/10]`
        : effectiveSafetyCar < 8.0
          ? ` [Penalidade progressiva de segurança urbana: nota ${effectiveSafetyCar.toFixed(1)}/10]`
          : effectiveSafetyCar >= 8.5
            ? ` [Bônus de bolha caminhável segura: +0.3]`
            : "";

    const dynamicJustification =
      `Nota Dinâmica ${dynamicScore.toFixed(2)}/10 (Base original: ${n.baseScore.toFixed(1)}) — ` +
      `Composição ponderada: Respiração Urbana ${effectiveUrbanBreathing.toFixed(1)} (peso ${weights.urbanBreathingWeight.toFixed(1)}x), ` +
      `Logística Nubank ${effectiveCommuteLogistics.toFixed(1)} (peso ${weights.commuteLogisticsWeight.toFixed(1)}x), ` +
      `Estoque Predial ${n.buildingStockFitScore.toFixed(1)} (peso ${weights.buildingStockWeight.toFixed(1)}x), ` +
      `Adequação Orçamento ${n.budgetFitScore.toFixed(1)} (peso ${weights.budgetFitWeight.toFixed(1)}x), ` +
      `Segurança & Carro ${effectiveSafetyCar.toFixed(1)} (peso ${weights.safetyCarWeight.toFixed(1)}x).${safetyPenaltyNote} ` +
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
  return trimmed;
}

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
  /\b(garagem|vagas?|estacionamento|box|lazer|piscina|academia|fitness|gin[aá]stica|quadra|sal[aã]o|festas|jogos|churrasqueira|gourmet|sky\s*lounge|sky\s*gourmet|lounge|rooftop|cobertura|terra[cç]o|coworking|office|trabalho|lavanderia|portaria|hall|recep[cç][aã]o|pilotis|lojas?|com[eé]rcio|padaria|mercearia|mercado|restaurante|cafeteria|galeteria|[aá]reas?\s+comuns?|brinquedoteca|brinquedos|playground|biciclet[aá]rio|lances?\s+de\s+escada|de\s+escada|elevadores?\s+por|unidades?\s+por|apartamentos?\s+por|aptos?\s+por|por\s+andar|por\s+pavimento|dropbox|chaves)\b/i;

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
    /\b(?:equivalente|corresponde)\s+a(?:o)?\s+(\d{1,2})\s*(?:[º°ªo]?\s*(?:andar|pavimento))?\b/i,
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
    /\b(\d{1,2})\s*([º°ªo])?\s*(andar|pavimento)\b(?!\s*(?:alto|baixo|m[eé]dio|intermedi[aá]rio))/gi;
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

function detectUnitPenthouseOrDuplex(
  rawText: string,
  amenities: Set<string>,
): { isPenthouse: boolean; isDuplex: boolean } {
  const cleanedForCobertura = rawText
    .replace(
      /\b(?:piscina|lazer|sal[aã]o(?: de festas)?|churrasqueira|sauna|academia|fitness|espa[cç]o gourmet|rooftop|terra[cç]o|jardim|solarium|lavanderia|coworking|vista)[^.;,\n]{0,45}\bna cobertura\b/gi,
      " ",
    )
    .replace(
      /\bna cobertura\s*(?::|-|,)?\s*(?:piscina|lazer|sal[aã]o|churrasqueira|sauna|academia|fitness|espa[cç]o gourmet|rooftop|solarium)/gi,
      " ",
    )
    .replace(/\bna cobertura do (?:edif[ií]cio|pr[eé]dio|condom[ií]nio)\b/gi, " ")
    .replace(
      /\bcobertura (?:coletiva|do pr[eé]dio|do edif[ií]cio|do condom[ií]nio|das [aá]reas|sky view|de vidro|retr[aá]til|met[aá]lica|inclusive)\b/gi,
      " ",
    )
    .replace(
      /\b(?:sacada|varanda|vaga|garagem|seguro|[aá]rea)[^.;,\n]{0,35}\bcobertura\b/gi,
      " ",
    );

  const cleanedForDuplex = rawText.replace(
    /\b(?:geladeira|refrigerador|arm[aá]rio|guarda[- ]?roupa|edif[ií]cio york)\s+duplex\b/gi,
    " ",
  );

  const isPenthouse =
    amenities.has("apartamento cobertura") ||
    /\bcobertura\b/i.test(cleanedForCobertura);
  const isDuplex =
    /\b(duplex|triplex|loft duplex|p[eé][- ]direito duplo)\b/i.test(
      cleanedForDuplex,
    );

  return { isPenthouse, isDuplex };
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
    /\b(?:sal[aã]o|sal[oõ]es|festas?|lazer|piscina|academia|rooftop|terra[cç]o|churrasqueira|gourmet)[^.;,\n]{0,35}\b(?:[uú]ltimo andar|andar topo)\b/gi,
    " ",
  );
  return (
    /\b([uú]ltimo andar|andar topo)\b/i.test(cleanedTopFloor) ||
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

/**
 * Deterministic street & micro-location analyzer that prevents "Efeito Bunker"
 * (buildings on noisy 4–6 lane arterial avenues or degraded downtown borders
 * masquerading as a neighboring noble neighborhood) and rewards genuinely
 * walkable, tree-lined micro-axes ("Vibe Setor Marista").
 */
export function evaluateStreetMicroEnvironment(
  prop: SlimPropertyRecord,
): StreetMicroEnvironmentEvaluation {
  const normText = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const street = normText(prop.street ?? "").trim();
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
        combinedMicroText,
      ) ||
      (/\bmoraes\s+salles\b/i.test(street) &&
        (/\b(centro|bosque)\b/i.test(nb) ||
          (streetNum !== null && streetNum < 1500) ||
          /\b(viaduto|centro|aquidaba|terminal)\b/i.test(combinedMicroText))) ||
      (/\b(bosque|centro)\b/i.test(nb) &&
        /\b(rua\s+jose\s+paulino|rua\s+boaventura\s+do\s+amaral|rua\s+luzitana|rua\s+doutor\s+quirino|rua\s+barao\s+de\s+jaguara)\b/i.test(
          street,
        ));
    const hasJaraguaOrAquidabaSpoof =
      /\b(shopping\s+jaragua|aquidaba)\b/i.test(combinedMicroText);

    if (isCpExpressOrBorderStreet || hasJaraguaOrAquidabaSpoof) {
      isCategoryA = true;
    }
  } else if (prop.cityCode === "BH") {
    const isNobleBhTag =
      /\b(lourdes|funcionarios|santo\s+agostinho|savassi)\b/i.test(nb);
    const hasExplicitCentroLandmark =
      /\b(shopping\s+cidade|mercado\s+central|praca\s+raul\s+soares|sesc\s+palladium|praca\s+sete|shopping\s+popular\s+oiapoque|shopping\s+oiapoque|minas\s+centro|rodoviaria)\b/i.test(
        combinedMicroText,
      ) ||
      /\b(otima\s+localizacao\s+no\s+centro|localizado\s+no\s+centro)\b/i.test(
        coreText,
      );
    const isAmazonas =
      /\bav(?:enida|\.)?\s+amazonas\b/i.test(street) ||
      /\b(esquina\s+com\s+av(?:enida|\.)?\s+amazonas|na\s+av(?:enida|\.)?\s+amazonas)\b/i.test(
        coreText,
      );
    const isAfonsoPenaCentro =
      /\bav(?:enida|\.)?\s+afonso\s+pena\b/i.test(street) &&
      (/\b(centro|lourdes)\b/i.test(nb) ||
        (streetNum !== null && streetNum < 1600) ||
        /\b(centro|shopping\s+cidade|mercado\s+central|sesc\s+palladium|parque\s+municipal|praca\s+sete|rodoviaria)\b/i.test(
          combinedMicroText,
        ));
    const isOlegarioCentro =
      /\bav(?:enida|\.)?\s+olegario\s+maciel\b/i.test(street) &&
      (/\bcentro\b/i.test(nb) ||
        (streetNum !== null && streetNum < 1400) ||
        /\b(centro|shopping\s+cidade|mercado\s+central|raul\s+soares|amazonas|rodoviaria)\b/i.test(
          combinedMicroText,
        ));
    const isBhDowntownBorderStreetNumber =
      isNobleBhTag &&
      /\b(rua\s+sao\s+paulo|rua\s+rio\s+de\s+janeiro|rua\s+espirito\s+santo|rua\s+da\s+bahia|rua\s+santa\s+catarina|rua\s+curitiba|rua\s+dos\s+guajajaras|rua\s+dos\s+goitacazes|rua\s+dos\s+tupis|rua\s+dos\s+tamoios|rua\s+dos\s+carijos|rua\s+dos\s+tupinambas|rua\s+dos\s+caetes|av(?:enida|\.)?\s+augusto\s+de\s+lima)\b/i.test(
        street,
      ) &&
      ((streetNum !== null && streetNum > 0 && streetNum <= 1350) ||
        /\b(rua\s+dos\s+guajajaras|rua\s+dos\s+goitacazes|rua\s+dos\s+tupis|rua\s+dos\s+tamoios|rua\s+dos\s+carijos|rua\s+dos\s+tupinambas|rua\s+dos\s+caetes|av(?:enida|\.)?\s+augusto\s+de\s+lima)\b/i.test(
          street,
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
        combinedMicroText,
      ) ||
      (/\bbarata\s+ribeiro\b/i.test(street) &&
        (/\b(tunel|inhanga)\b/i.test(combinedMicroText) ||
          (streetNum !== null && streetNum <= 220)));
    if (isRjExpressCorridor) {
      isCategoryA = true;
    }
  } else if (prop.cityCode === "SP") {
    const isSpExpressCorridor =
      /\b(23\s+de\s+maio|vinte\s+e\s+tres\s+de\s+maio|rubem\s+berta|moreira\s+guimaraes|av(?:enida|\.)?\s+dos\s+bandeirantes|av(?:enida|\.)?\s+santo\s+amaro|av(?:enida|\.)?\s+reboucas|nove\s+de\s+julho|9\s+de\s+julho|brigadeiro\s+lui[sz]\s+antonio|minhocao|elevado\s+presidente\s+joao\s+goulart|elevado\s+costa\s+e\s+silva|rua\s+amaral\s+gurgel)\b/i.test(
        combinedMicroText,
      );
    if (isSpExpressCorridor) {
      isCategoryA = true;
    }
  }

  if (isCategoryA) {
    return {
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
    return {
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
      /\b(praia\s+do\s+flamengo|rua\s+cruz\s+lima|rua\s+tucuma|rua\s+oswaldo\s+cruz|barao\s+de\s+icarai|epitacio\s+pessoa|borges\s+de\s+medeiros|joao\s+luiz\s+alves|candido\s+gaffree|praia\s+da\s+urca|rua\s+jardim\s+botanico|rua\s+lopes\s+quintas|rua\s+maria\s+angelica|rua\s+faro|rua\s+pio\s+correia|delfim\s+moreira|vieira\s+souto|prudente\s+de\s+morais|nascimento\s+silva|rua\s+redentor|barao\s+da\s+torre|dias\s+ferreira|general\s+urquiza|venancio\s+flores|anibal\s+de\s+mendonca|garcia\s+d['’]?avila|maria\s+quiteria|joana\s+angelica|visconde\s+de\s+piraja)\b/i.test(
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
    return {
      category: "PRIME_WALKABLE",
      pointsDelta: 8.0,
      redTag: null,
      greenTag: "Eixo Caminhável / Respiro Urbano",
      warning: null,
      highlight: "Eixo caminhável arborizado (estilo Setor Marista)",
      safetyCarCap: null,
      urbanBreathingCap: null,
    };
  }

  return {
    category: "NEUTRAL",
    pointsDelta: 0,
    redTag: null,
    greenTag: null,
    warning: null,
    highlight: null,
    safetyCarCap: null,
    urbanBreathingCap: null,
  };
}

export const detectArterialOrBorderBunker = evaluateStreetMicroEnvironment;

/**
 * Extracts fine-grained apartment nuances from comfortCommodities, practicalityCommodities,
 * floor / floorRange, placesNearby (parks, malls, subway), installations, photoCaptions,
 * description, and generatedDescription.
 */
export function evaluateApartmentNuances(
  prop: SlimPropertyRecord,
  penalizeMegaCondo: boolean,
): {
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
  greenTags: string[];
  redTags: string[];
} {
  let pts = 0;
  const highlights: string[] = [];
  const warnings: string[] = [];
  const greenTags: string[] = [];
  const redTags: string[] = [];

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

  const hasExplicitNoElevatorText =
    /\b(sem elevador|n[aã]o\s+(?:possui|tem|disp[oõ]e\s+de|conta\s+com)\s+elevador|pr[eé]dio escada|\d+\s*lances? de escada|acesso por escadas)\b/i.test(
      elevatorSources,
    );
  const hasElevatorMention = /elevador|elevator/i.test(elevatorSources);
  const hasTallBuildingElevatorEvidence =
    prop.provider !== "quintoandar" &&
    ((prop.totalFloors !== null && prop.totalFloors >= 5) ||
      (prop.floor !== null && prop.floor >= 5) ||
      ((prop.provider === "netimoveis" || prop.provider === "imovelweb") &&
        ((prop.floor !== null && prop.floor >= 4) ||
          Boolean(prop.doorman && prop.doorman !== "NotAvailable"))));
  const hasNoElevator =
    hasExplicitNoElevatorText ||
    (!hasElevatorMention && !hasTallBuildingElevatorEvidence);
  const hasTrappedParking =
    /\b(vagas? presas?|garagem presa|vaga bloqueada)\b/i.test(elevatorSources);

  // Ar-condicionado detection for card tag
  let acLabel: string | null = null;
  if (/\bsplit\b/i.test(fullDesc) || prop.positiveSignals.some((s) => s.toLowerCase().includes("split"))) {
    acLabel = "Ar-condicionado Split";
  } else if (
    comfort.has("ar condicionado") ||
    amenities.has("ar condicionado") ||
    amenities.has("ar-condicionado") ||
    amenities.has("air_conditioning") ||
    /\bar[- ]?condicionado\b/i.test(fullDesc) ||
    prop.positiveSignals.some((s) => s.toLowerCase().includes("ar-condicionado"))
  ) {
    acLabel = "Ar-condicionado";
  }
  if (acLabel) {
    greenTags.push(acLabel);
  }

  // 1. Luz, Silêncio e Ventilação (comfort_commodities + texto)
  const hasFreeView =
    comfort.has("vista livre") ||
    /\bvista (livre|definitiva|panor[aâ]mica|inexplic[aá]vel)\b/i.test(fullDesc);
  const hasMorningSun =
    comfort.has("sol da manhã") || /\bsol da manh[aã]\b/i.test(fullDesc);

  if (hasFreeView) {
    pts += 3.5;
    highlights.push("Vista livre/definitiva");
  }
  if (hasMorningSun) {
    pts += 3.0;
    highlights.push("Sol da manhã");
  }
  if (comfort.has("rua silenciosa") || /\brua (tranquila|silenciosa|calma)\b/i.test(fullDesc)) {
    pts += 3.0;
    highlights.push("Rua silenciosa");
  }
  if (comfort.has("janelas grandes") || /\bjanelas (grandes|amplas)\b/i.test(fullDesc)) {
    pts += 2.0;
    highlights.push("Janelas amplas");
  }
  if (comfort.has("janela anti-ruído") || /\b(antirru[ií]do|anti-ru[ií]do|ac[uú]stic[oa])\b/i.test(fullDesc)) {
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
    !/\b(1[º°ªo]?\s*(?:andar|pavimento)|primeiro\s+(?:andar|pavimento)|andar\s+baixo|[aá]rea\s+privativa(?!\s*(?:de\s*)?\d)|garden|quintal)\b/i.test(
      sentenceJoinedDesc,
    ) &&
    ((effectiveTotalFloors !== null && effectiveTotalFloors >= 8) ||
      hasFreeView ||
      /\bandar\s+(alto|m[eé]dio|intermedi[aá]rio)\b/i.test(sentenceJoinedDesc));

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

  const isTopFloor = detectUnitTopFloor(
    sentenceJoinedDesc,
    effectiveFloor,
    effectiveTotalFloors,
  );
  const { isPenthouse, isDuplex } = detectUnitPenthouseOrDuplex(
    sentenceJoinedDesc,
    amenities,
  );
  const isPenthouseOrDuplex = isPenthouse || isDuplex;

  if (isPenthouseOrDuplex && isTopFloor) {
    pts += 11.0;
    highFloorLabel = "Cobertura / Duplex (Último andar)";
    floorTag = { label: highFloorLabel, rarity: "legendary" };
    highlights.push(highFloorLabel);
  } else if (isPenthouseOrDuplex) {
    pts += 9.0;
    highFloorLabel = isPenthouse ? "Cobertura" : "Duplex / Pé-direito duplo";
    floorTag = { label: highFloorLabel, rarity: "legendary" };
    highlights.push(highFloorLabel);
  } else if (isTopFloor) {
    pts += 9.0;
    highFloorLabel = minFloor
      ? `Último andar (${minFloor}º andar)`
      : "Último andar";
    floorTag = { label: highFloorLabel, rarity: "legendary" };
    highlights.push(highFloorLabel);
  }

  if (minFloor !== null) {
    if (minFloor >= 8) {
      pts += 6.0;
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
      pts += 5.0;
      if (!highFloorLabel) highFloorLabel = "Andar alto";
      if (!floorTag) floorTag = { label: "Andar alto", rarity: "epic" };
      highlights.push("Andar alto");
    } else if (minFloor >= 4) {
      pts += 2.5;
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
        /\bandar (m[eé]dio|intermedi[aá]rio)\b/i.test(fullDesc))
    ) {
      pts += 2.5;
      floorTag = { label: "Andar médio", rarity: "rare" };
      highlights.push("Andar médio");
    }
  } else if (
    !highFloorLabel &&
    (amenities.has("andar alto") ||
      comfort.has("andar alto") ||
      /\bandar alto\b/i.test(fullDesc))
  ) {
    pts += 5.0;
    highFloorLabel = "Andar alto";
    if (!floorTag) floorTag = { label: "Andar alto", rarity: "epic" };
    highlights.push("Andar alto");
  } else if (
    !floorTag &&
    (amenities.has("andar médio") ||
      amenities.has("andar intermediário") ||
      /\bandar (m[eé]dio|intermedi[aá]rio)\b/i.test(fullDesc))
  ) {
    pts += 2.5;
    floorTag = { label: "Andar médio", rarity: "rare" };
    highlights.push("Andar médio");
  }

  if (hasFreeView) {
    greenTags.push("Vista livre");
  } else if (hasMorningSun) {
    greenTags.push("Sol da manhã");
  }

  if (!isTopFloor && !isPenthouseOrDuplex && !highFloorLabel && !floorTag) {
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
      if (/\bandar baixo\b/i.test(fullDesc)) {
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
        minFloor === 1 ||
        /\b1[º°]\s*andar\b/i.test(lowFloorLabel ?? "");
      const hasPrivatePatio =
        amenities.has("área privativa") ||
        amenities.has("area privativa") ||
        amenities.has("garden") ||
        amenities.has("quintal") ||
        /\b([aá]rea privativa(?!\s*(?:de\s*)?\d)|apartamento garden|apto garden|tipo garden|quintal privativo|terra[cç]o privativo)\b/i.test(
          fullDesc,
        );
      const isSlopedNeighborhood = SLOPED_HILLSIDE_NEIGHBORHOODS.has(
        `${prop.cityCode.toLowerCase()}:${prop.neighborhood.trim().toLowerCase()}`,
      );

      let lowFloorPenalty = isFirstFloor ? 18.0 : 14.0;
      const isAmbiguousZeroToThreeRange =
        effectiveFloor === null &&
        normalizedFloorRange !== null &&
        normalizedFloorRange.min === 0 &&
        normalizedFloorRange.max === 3;
      if (hasFreeView && isSlopedNeighborhood) {
        lowFloorPenalty = isAmbiguousZeroToThreeRange ? 21.0 : 2.0;
        warnings.push(
          `${lowFloorLabel ?? "Andar baixo"} compensado por topografia em desnível e vista livre (-${lowFloorPenalty} pts base)`,
        );
      } else if (hasFreeView || hasPrivatePatio) {
        lowFloorPenalty = isAmbiguousZeroToThreeRange ? 22.0 : 6.0;
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
    /\b[aá]rea de servi[cç]o\b/i.test(fullDesc);
  if (hasServiceArea) {
    pts += 2.0;
    highlights.push("Área de serviço p/ máquinas");
  }

  const hasBalcony =
    amenities.has("varanda") ||
    amenities.has("varanda gourmet") ||
    amenities.has("balcony") ||
    captions.includes("varanda") ||
    /\b(varanda|sacada)\b/i.test(fullDesc);
  if (hasBalcony) {
    pts += 2.0;
    highlights.push("Varanda");
  }

  const has24hDoorman =
    prop.doorman === "NightAndDayShift" ||
    prop.doorman === "24h" ||
    installs.has("portaria_24h") ||
    amenities.has("concierge_24h") ||
    /\b(portaria 24|porteiro 24|portaria virtual|biometria)\b/i.test(fullDesc);
  if (has24hDoorman) {
    pts += 2.5;
    highlights.push("Portaria 24h / Biometria");
  } else if (prop.doorman === "NotAvailable") {
    pts -= 6.0;
    warnings.push("Sem portaria 24h (-6 pts base)");
  }

  if (prop.salePrice !== null && prop.salePrice > 0) {
    pts -= 4.0;
    warnings.push("Imóvel também à venda (-4 pts base)");
  }

  if (/\bvagas? (de garagem )?(livres?|individuais?|demarcadas?)\b/i.test(fullDesc)) {
    pts += 3.0;
    highlights.push("Vaga livre e demarcada");
  } else if (hasTrappedParking) {
    pts -= 4.0;
    warnings.push("Vaga presa");
  }

  if (/\b([aá]gua e g[aá]s inclusos|g[aá]s incluso)\b/i.test(fullDesc)) {
    pts += 2.5;
    highlights.push("Água/gás inclusos no condomínio");
  }

  // 5. Alerta de Megacondomínio Familiar ("Cidade dentro do condomínio") vs Torre Única
  const isMegaCondo =
    (installs.has("brinquedoteca") &&
      installs.has("playground") &&
      installs.has("quadra esportiva") &&
      installs.has("salão de jogos")) ||
    /\b(m[uú]ltiplas torres|\d+ torres|bloco [b-z])\b/i.test(fullDesc);

  const isReservedBuilding =
    /\b(torre [uú]nica|pr[eé]dio pequeno|poucos moradores|1 por andar|2 por andar)\b/i.test(
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
    /\b(primeira loca[cç][aã]o|1[aª] loca[cç][aã]o|rec[eé]m[- ]entregue|pr[eé]dio (super )?novo)\b/i.test(
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
    redTags.push("Vaga presa");
  }

  return {
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
    greenTags,
    redTags,
  };
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

/**
 * Normalizes and splits raw commodities/amenities/installations into non-overlapping
 * interior features vs. condominium installations for clean UI display, omitting
 * items already shown in top-level card pills.
 */
export function categorizePropertyFeatures(prop: SlimPropertyRecord): {
  interiorFeatures: string[];
  condoFeatures: string[];
} {
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
    /\b(elevador|portaria|piscina|academia|fitness|sauna|sal[aã]o|churrasqueira|gourmet|playground|quadra|brinquedoteca|jogos|jardim|[aá]rea verde|biciclet[aá]rio|coworking|lavanderia|corrim[aã]o|rampa|acess[ií]vel|g[aá]s encanado|guarita|seguran[cç]a|port[aã]o|interfone|condom[ií]nio|pets)\b/i;

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

  return {
    interiorFeatures: [...interiorMap.values()],
    condoFeatures: [...condoMap.values()],
  };
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
  const rawTime = catalogNb
    ? catalogNb.commuteTime
    : nbCommute
        .replace(/\s*\([^)]*\)/g, "")
        .replace(/\s*do Nubank.*/i, "")
        .replace(/^~/, "")
        .trim();

  return {
    commuteTimeText: rawTime || "20 min",
    officeLabel: officeByCity[cityCode] ?? "escritório do Nubank",
  };
}

export function parseCommuteMinutes(
  commuteText: string,
  isDeepWestBarra?: boolean,
): { minutes: number; label: string } {
  if (isDeepWestBarra) {
    return { minutes: 85, label: "75–100 min" };
  }

  const cleaned = (commuteText ?? "")
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*do Nubank.*/i, "")
    .replace(/^~/, "")
    .trim();

  const rangeMatch = cleaned.match(/(\d+)\s*(?:[-–a]|a)\s*(\d+)\s*min/i);
  if (rangeMatch) {
    const a = Number(rangeMatch[1]);
    const b = Number(rangeMatch[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return {
        minutes: Math.round((a + b) / 2),
        label: `${a}–${b} min`,
      };
    }
  }

  const singleMatch = cleaned.match(/(\d+)\s*min/i);
  if (singleMatch) {
    const m = Number(singleMatch[1]);
    if (Number.isFinite(m)) {
      return {
        minutes: m,
        label: `${m} min`,
      };
    }
  }

  return { minutes: 25, label: cleaned || "20–30 min" };
}

/**
 * Extracts qualitative features from the apartment, condominium, and surroundings
 * that are NOT already displayed in the card header, specs row, floor badge, or green/red pills.
 */
function extractNonRedundantHighlights(
  prop: SlimPropertyRecord,
  nuances: ReturnType<typeof evaluateApartmentNuances>,
): {
  featureHighlights: string[];
  surroundingHighlights: string[];
} {
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
    /\b(porcelanato|piso vin[ií]lico)\b/i.test(fullText)
  ) {
    addFeature("piso em porcelanato/vinílico");
  }

  if (
    prop.positiveSignals.includes("Fechadura eletrônica / USB") ||
    /\bfechadura (eletr[oô]nica|digital|biom[eé]trica)\b/i.test(fullText)
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
    /\b(marcenaria|arm[aá]rios (planejados|sob medida|na cozinha|no quarto)|builtin_wardrobe|kitchen_cabinets|planned_furniture)\b/i.test(
      fullText,
    )
  ) {
    addFeature("marcenaria/armários planejados");
  }

  if (
    prop.positiveSignals.includes("Projeto de iluminação / Gesso") ||
    /\b(projeto de ilumina[cç][aã]o|ilumina[cç][aã]o planejada|rebaixamento em gesso)\b/i.test(
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

  if (/\b(home[- ]?office|escrit[oó]rio)\b/i.test(fullText)) {
    addFeature("espaço home office");
  }

  if (/\bcloset\b/i.test(fullText)) {
    addFeature("closet");
  }

  if (nuances.nuanceHighlights.includes("Área de serviço p/ máquinas")) {
    addFeature("área de serviço separada");
  }

  if (/\b(g[aá]s encanado|chuveiro a g[aá]s|gas_shower|aquecimento a g[aá]s)\b/i.test(fullText)) {
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

  if (/\b(trecho plano|[aá]rea plana|rua plana|100% plano)\b/i.test(prop.description ?? "")) {
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

  return {
    featureHighlights: features,
    surroundingHighlights: surroundings,
  };
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

function resolveNeighborhoodDrawback(
  prop: SlimPropertyRecord,
  catalogNb: ComputedNeighborhood | undefined,
): string | null {
  const nbLower = prop.neighborhood.trim().toLowerCase();
  const normNbLower = normalizeNeighborhoodKey(
    prop.neighborhood,
    prop.cityCode,
  ).toLowerCase();

  if (catalogNb?.cons) {
    for (const rawCon of catalogNb.cons) {
      const cleaned = rawCon
        .replace(/\s*\((?:[^)]*R\$|[^)]*m²|ex\.:)[^)]*\)/gi, "")
        .replace(/\.$/, "")
        .trim();
      if (cleaned.length < 15) continue;
      if (/R\$|\bm²\b|\d+\s*quartos?|\d+\s*vagas?/i.test(cleaned)) continue;
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
      return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
    }
  }

  return (
    NEIGHBORHOOD_DRAWBACK_FALLBACKS[`${prop.cityCode.toLowerCase()}:${nbLower}`] ??
    NEIGHBORHOOD_DRAWBACK_FALLBACKS[`${prop.cityCode.toLowerCase()}:${normNbLower}`] ??
    null
  );
}

function extractConservationDrawbacks(prop: SlimPropertyRecord): string[] {
  const result: string[] = [];
  const addUnique = (text: string) => {
    if (!result.includes(text)) result.push(text);
  };

  for (const sig of prop.negativeSignals) {
    if (/sem elevador|pr[eé]dio escada/i.test(sig)) continue;
    if (/venda|comprad/i.test(sig)) continue;

    if (/piso antigo|cer[aâ]mica|t[aá]bua corrida|taco/i.test(sig)) {
      addUnique("piso antigo de cerâmica ou taco");
    } else if (/constru[cç][aã]o antiga/i.test(sig)) {
      addUnique("prédio mais antigo sem reforma recente");
    } else if (/anos 80\/90|pr[eé]dio\/im[oó]vel antigo/i.test(sig)) {
      addUnique("estrutura predial antiga sem reforma recente");
    } else if (/azulejo/i.test(sig)) {
      addUnique("azulejos e revestimentos datados");
    } else if (/arm[aá]rios? antigos?/i.test(sig)) {
      addUnique("armários antigos");
    } else if (/descri[cç][aã]o gen[eé]rica/i.test(sig)) {
      addUnique("acabamento original sem sinais de reforma recente");
    } else if (!/R\$|\bm²\b/i.test(sig)) {
      const cleanSig = sig.trim().replace(/\.$/, "");
      if (cleanSig) {
        addUnique(cleanSig.charAt(0).toLowerCase() + cleanSig.slice(1));
      }
    }
  }

  if (result.length === 0 && prop.modernityScore < 72) {
    addUnique("acabamento padrão sem reforma moderna recente");
  }

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
  const { featureHighlights, surroundingHighlights } =
    extractNonRedundantHighlights(prop, nuances);

  // === SENTENCE 1: PONTOS POSITIVOS (PRÓS) ===
  const isBunkerCorridor = nuances.redTags.includes(
    "Via Arterial / Efeito Bunker",
  );
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

  const topFeatures = featureHighlights.slice(0, 5);
  const topSurroundings = surroundingHighlights.slice(0, 3);

  const positiveParts: string[] = [];
  if (topFeatures.length > 0) {
    positiveParts.push(`Com ${formatListPt(topFeatures)}`);
  } else if (furnitureTier === "UNFURNISHED" && area >= weights.sweetSpotMinM2) {
    positiveParts.push(
      "Planta bem dimensionada e livre de mobília solta para a mudança de Brasília",
    );
  } else if (furnitureTier === "UNFURNISHED") {
    positiveParts.push(
      "Unidade livre de mobília solta para receber sua mudança de Brasília",
    );
  } else if (area >= weights.sweetSpotMinM2) {
    positiveParts.push("Planta espaçosa pronta para uso");
  } else {
    positiveParts.push("Planta funcional pronta para uso");
  }

  if (topSurroundings.length > 0) {
    positiveParts.push(`em ${formatListPt(topSurroundings)}`);
  }

  let positiveTail = "";
  if (total > 0 && diffIdeal >= 250) {
    positiveTail = ", com folga confortável no orçamento";
  } else if (total > 0 && diffIdeal >= 0) {
    positiveTail = ", enquadrado na meta financeira";
  } else if (furnitureTier === "UNFURNISHED" && topFeatures.length > 0) {
    positiveTail = ", livre de mobília solta para a mudança de Brasília";
  } else if (
    area >= weights.sweetSpotMinM2 &&
    area <= weights.sweetSpotMaxM2 &&
    topFeatures.length > 0
  ) {
    positiveTail = ", com planta bem distribuída para a rotina";
  }

  const sentence1 = `${positiveParts.join(", ")} — fica ${urbanContext}${positiveTail}.`;

  // === SENTENCE 2: PONTOS NEGATIVOS / RESSALVAS (CONTRAS) ===
  const primaryDrawbacks: string[] = [];
  const secondaryDrawbacks: string[] = [];

  // 0. Anti-Bunker / Express Corridor (#1 drawback when detected)
  if (isBunkerCorridor) {
    primaryDrawbacks.push(
      "fica em corredor viário intenso / divisa de centro (efeito bunker: barulho de trânsito e calçada hostil a pé)",
    );
  } else if (
    nuances.nuanceWarnings.some((w) => /avenida de tr[aá]fego intenso/i.test(w))
  ) {
    primaryDrawbacks.push(
      "fica em avenida de tráfego intenso (ruído e menor caminhabilidade)",
    );
  }

  // 1. Hard eligibility exclusions
  if (!eligible) {
    const filterReasons: string[] = [];
    const effectiveMinMod =
      prop.cityCode === "RJ"
        ? Math.max(48, weights.minModernityScore - 8)
        : weights.minModernityScore;
    if (prop.modernityScore < effectiveMinMod) {
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
    if (area < weights.minAreaM2 || area > weights.maxAreaM2) {
      filterReasons.push("planta fora do intervalo ativo");
    }
    const effectiveHardCap =
      prop.cityCode === "RJ" || prop.cityCode === "SP"
        ? Math.max(weights.budgetHardCap, weights.budgetMax + 350)
        : weights.budgetHardCap;
    if (!total || total < 1500 || total > effectiveHardCap) {
      filterReasons.push("acima do teto máximo configurado");
    }

    const reasonText =
      filterReasons.length > 0
        ? formatListPt(filterReasons)
        : "critérios ativos do calibrador";
    primaryDrawbacks.push(`retido pelos filtros (${reasonText})`);
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
  } else if (prop.cityCode === "CP") {
    primaryDrawbacks.push(
      "leva desconto por ficar no interior de SP (dependente de carro e rodovia até Viracopos)",
    );
  }

  // 4. Floor / Elevation drawbacks
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
  } else if (nuances.floorTag === null) {
    secondaryDrawbacks.push("andar não especificado no anúncio");
  }

  // 5. Conservation / Building age drawbacks
  const conservationDrawbacks = extractConservationDrawbacks(prop);
  for (const cd of conservationDrawbacks.slice(0, 2)) {
    primaryDrawbacks.push(cd);
  }

  // 6. High-impact nuance & condominium drawbacks
  const isMegaCondo =
    nuances.redTags.includes("Megacondomínio") ||
    nuances.nuanceWarnings.some((w) => /megacondom[ií]nio/i.test(w));
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

  // 8. Missing unit features
  if (!nuances.acLabel) {
    secondaryDrawbacks.push("sem ar-condicionado instalado");
  }

  const hasBalcony =
    nuances.nuanceHighlights.includes("Varanda") ||
    featureHighlights.includes("varanda") ||
    featureHighlights.includes("varanda gourmet");
  if (!hasBalcony) {
    secondaryDrawbacks.push("planta sem varanda");
  }

  const has24hDoorman =
    nuances.nuanceHighlights.includes("Portaria 24h / Biometria") ||
    featureHighlights.includes("portaria 24h");
  if (!has24hDoorman) {
    secondaryDrawbacks.push("sem portaria 24h presencial informada");
  }

  // 9. Neighborhood-specific cons
  const nbDrawback = resolveNeighborhoodDrawback(prop, catalogNb);

  // Assemble top 2 to 4 drawbacks prioritizing severity + keeping room for neighborhood con when relevant
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

  if (selectedDrawbacks.length < 2) {
    const fallbackCaveats = [
      "exige validar isolamento acústico e vedação das janelas na visita",
      "convém confirmar dimensões da vaga e pressão hidráulica na vistoria",
    ];
    for (const fb of fallbackCaveats) {
      if (selectedDrawbacks.length < 2 && !selectedDrawbacks.includes(fb)) {
        selectedDrawbacks.push(fb);
      }
    }
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
  const { featureHighlights, surroundingHighlights } =
    extractNonRedundantHighlights(prop, nuances);

  // 1. Urban breathing, office commute & surroundings synthesis
  let urbanClause = `Fica a cerca de ${commuteTimeText} do ${officeLabel}`;
  if (catalogNb) {
    const rationaleClean = catalogNb.shortRationale.replace(/\.$/, "");
    urbanClause += ` (${rationaleClean.charAt(0).toLowerCase() + rationaleClean.slice(1)})`;
  }
  if (surroundingHighlights.length > 0) {
    urbanClause += `, somando ${formatListPt(surroundingHighlights)} no entorno imediato.`;
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
    featureHighlights.length > 0
      ? `No interior e condomínio, agrega ${formatListPt(featureHighlights)}. ${acousticClause}.`
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
  if (
    prop.negativeSignals.some((s) =>
      /antig|cer[aâ]mica|t[aá]bua|taco|anos 80/i.test(s),
    )
  ) {
    visitCaveats.push(
      "inspecionar o estado da rede elétrica, pressão hidráulica e vedação das janelas",
    );
  }
  if (catalogNb?.cons?.[0] && visitCaveats.length < 2) {
    const nbCon = catalogNb.cons[0];
    if (!/R\$|\d+\s*m²/i.test(nbCon)) {
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
  "fogão",
  "cooktop",
  "forno",
  "forno embutido",
  "geladeira",
  "refrigerador",
  "microondas",
  "micro-ondas",
  "máquina de lavar",
  "lava e seca",
  "utensílios de cozinha",
]);

export const FURNISHED_COMMODITY_ITEMS = new Set<string>([
  ...FULL_FURNITURE_COMMODITY_ITEMS,
  ...SEMI_FURNISHED_APPLIANCE_ITEMS,
]);

/**
 * Classifies a property into a 3-tier furniture scale tailored for the user's
 * Brasília relocation (bringing Queen bed, sofa, large fridge, washing machine,
 * and countertop dishwasher):
 * - "UNFURNISHED": No loose furniture (only built-in cabinets / marcenaria / box blindex)
 * - "SEMI_FURNISHED": Kitchen/laundry appliances or explicit "semi-mobiliado" WITHOUT bed or sofa
 * - "FULLY_FURNISHED": Has bed, sofa, living/bedroom furniture set, apart-hotel, or full furnished flag
 */
export function classifyFurnitureTier(prop: SlimPropertyRecord): FurnitureTier {
  const propKey = `${prop.provider}:${prop.id}`;
  if (PHOTO_DETECTED_FURNISHED_KEYS.has(propKey)) {
    return "FULLY_FURNISHED";
  }

  if (
    /\b(monet|max savassi|savassi hotel|radisson|mercure|ibis|trypp|golden tulip|caesar business|manhattan flat|liberty palace|transamerica)\b/i.test(
      prop.condominiumName ?? "",
    )
  ) {
    return "FULLY_FURNISHED";
  }

  const structuredCommoditiesLower = [
    ...(prop.comfortCommodities ?? []),
    ...(prop.practicalityCommodities ?? []),
    ...(prop.amenities ?? []),
  ].map((c) => c.trim().toLowerCase());

  const hasCommodityBedOrSofa = structuredCommoditiesLower.some(
    (c) =>
      FULL_FURNITURE_COMMODITY_ITEMS.has(c) ||
      /\b(cama|sof[aá]|poltrona|mesa com cadeiras|mesas e cadeiras)\b/i.test(c),
  );
  const hasCommodityAppliance = structuredCommoditiesLower.some((c) =>
    SEMI_FURNISHED_APPLIANCE_ITEMS.has(c),
  );

  const captionsText = (prop.photoCaptions ?? []).join(" ");
  const hasCaptionBedOrSofa =
    /\b(quarto com arm[aá]rios e cama|quarto mobiliado|sala de estar mobiliada|cama (de )?(casal|solteiro)|cama box|sof[aá])\b/i.test(
      captionsText,
    );
  const hasCaptionAppliance =
    /\b(geladeira|micro[- ]?ondas|cozinha mobiliada|cozinha \(arm[aá]rios e fog[aã]o\)|cozinha \(fog[aã]o\))\b/i.test(
      captionsText,
    );

  const rawDescText = [
    prop.title ?? "",
    prop.description ?? "",
    prop.generatedDescription ?? "",
  ].join("\n");

  const strippedSpacePhrases = rawDescText.replace(
    /\b(?:espa[cç]o|lugar|local|ponto|prepara[cç][aã]o|espera|cabe|cabem|comporta|acomoda|previsto)\s+(?:para\s+|p\/\s+)?(?:uma?\s+)?(?:cama(?:\s+(?:de\s+)?(?:casal|solteiro|box|queen|king))*|sof[aá](?:[- ]?cama|\s+retr[aá]til|\s+de\s+\d+\s+lugares)*|geladeira|refrigerador|m[aá]quina de lavar|lava[- ]?lou[cç]as|lava[- ]?e[- ]?seca|fog[aã]o|micro[- ]?ondas|mesa(?:\s+(?:de\s+jantar|com\s+cadeiras))*|tv)/gi,
    " ",
  );

  const affirmativeClauses = strippedSpacePhrases
    .split(/[.;!\n]+|,\s*(?=mas\b|por[eé]m\b|contudo\b|entretanto\b)/i)
    .filter(
      (clause) =>
        !/ser[aã]o removid|n[aã]o fica|retirad|sem mob[ií]lia|n[aã]o mobiliad/i.test(
          clause,
        ),
    );
  const descText = affirmativeClauses.join(". ");

  const hasTextBedOrSofa =
    /\b(cama (de )?(casal|solteiro)|cama box|cama queen|cama king|\bcama\b|sof[aá][- ]?cama|sof[aá] e cama|\bsof[aá]\b|\bpoltrona\b|mesa com cadeiras|mesas? e cadeiras de jantar|porteira fechada|totalmente mobiliad[oa]|100%\s*mobiliad[oa])\b/i.test(
      descText,
    );

  const hasExplicitSemiFurnished = /\bsemi[- ]?mobiliad[oa]\b/i.test(descText);

  const hasTextGeneralFurnished =
    !hasExplicitSemiFurnished &&
    !/\b(?:aluguel|valor)\s+mobiliad[oa]\s+a\s+consultar\b/i.test(descText) &&
    /\b((?:apartamento|apto\.?|im[oó]vel|flat|loft|studio|kitnet)\s+(?:[^.,;!\n]{0,40}\s+)?mobiliad[oa]|(?:todo|totalmente|completamente|inteiramente|100%)\s+mobiliad[oa]|vai\s+ser\s+alugad[oa]\s+mobiliad[oa]|loca[cç][aã]o\s+mobiliad[oa]|mobiliad[oa]\s+para\s+(?:loca[cç][aã]o|aluguel|venda)|apartamento:\s*mobiliad[oa])\b/i.test(
      descText,
    );

  const hasTextAppliance =
    /\b(geladeira|refrigerador|m[aá]quina de lavar|lava[- ]?e[- ]?seca|micro[- ]?ondas|fog[aã]o|forno|cooktop|cozinha equipada|cozinha mobiliada|utens[ií]lios de cozinha)\b/i.test(
      descText,
    );

  if (hasCommodityBedOrSofa || hasCaptionBedOrSofa || hasTextBedOrSofa) {
    return "FULLY_FURNISHED";
  }

  if (hasExplicitSemiFurnished) {
    return "SEMI_FURNISHED";
  }

  if (hasTextGeneralFurnished) {
    return "FULLY_FURNISHED";
  }

  if (prop.furnished === true) {
    if (hasCommodityAppliance || hasCaptionAppliance || hasTextAppliance) {
      return "SEMI_FURNISHED";
    }
    return "FULLY_FURNISHED";
  }

  if (hasCommodityAppliance || hasCaptionAppliance || hasTextAppliance) {
    return "SEMI_FURNISHED";
  }

  return "UNFURNISHED";
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

  const evaluated: EvaluatedProperty[] = properties.map((prop) => {
    const normNb = normalizeNeighborhoodKey(prop.neighborhood, prop.cityCode);
    const catalogNb =
      nbMap.get(`${prop.cityCode}:${prop.neighborhood.toLowerCase()}`) ??
      nbMap.get(`${prop.cityCode}:${normNb.toLowerCase()}`);

    const calibratedMeta = resolveNeighborhoodSafetyAndMetrics(
      prop.cityCode,
      prop.neighborhood,
    );
    const microEnv = evaluateStreetMicroEnvironment(prop);

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

    // Direct Commute-Distance Impact (heavily penalize far-away neighborhoods like Barra da Tijuca / Barra Olímpica / Ponte Rio-Niterói)
    const commuteWeightScale = weights.commuteLogisticsWeight / 1.8;
    const fullLocationText = [
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
    const isDeepWestBarra =
      prop.cityCode === "RJ" &&
      /\b(barra ol[ií]mpica|estrada dos bandeirantes|shopping metropolitano|curicica|jacarepagu[aá]|recreio|riocentro|abelardo bueno|salvador allende|ad[ií]lio de oliveira)\b/i.test(
        fullLocationText,
      );
    let rawCommutePts = 0;
    if (isDeepWestBarra) {
      rawCommutePts = -48.0;
    } else if (nbCommuteLogistics <= 4.0) {
      rawCommutePts = -32.0;
    } else if (nbCommuteLogistics < 6.5) {
      rawCommutePts = -((6.5 - nbCommuteLogistics) * 6.5);
    } else if (nbCommuteLogistics >= 9.2) {
      rawCommutePts = 4.0;
    }
    const commuteDistanceAdjustment =
      Math.round(rawCommutePts * commuteWeightScale * 10) / 10;

    // Non-linear interior quality & modernity curve (+8 pts >= 82, -10 pts < 68, -18 pts < 58)
    const modernityCurveBonus =
      weights.modernityMultiplier > 0
        ? prop.modernityScore >= 82
          ? 8.0
          : prop.modernityScore < 58
            ? -18.0
            : prop.modernityScore < 68
              ? -10.0
              : 0
        : 0;
    const modernityPoints =
      Math.round(
        (prop.modernityScore * weights.modernityMultiplier +
          modernityCurveBonus) *
          10,
      ) / 10;

    // Nuances evaluation
    const nuances = evaluateApartmentNuances(prop, weights.penalizeMegaCondo);
    if (isDeepWestBarra || nbCommuteLogistics <= 4.0) {
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
    if (nbSafetyCar < 6.0) {
      if (!nuances.redTags.includes("Alerta de Segurança na Rua")) {
        nuances.redTags.unshift("Alerta de Segurança na Rua");
      }
      nuances.nuanceWarnings.unshift(
        `Entorno com alerta de insegurança ao sair do condomínio (nota segurança ${nbSafetyCar.toFixed(1)}/10: ${streetSafetyAdjustment.toFixed(1)} pts)`,
      );
    }
    const nuancesPoints =
      Math.round(nuances.rawNuancePoints * (weights.nuancesMultiplier ?? 1.0) * 10) / 10;

    // Budget points
    const total = prop.totalMonthly;
    let rawBudgetPts = 0;
    let budgetDesc = "";
    const comfortFloor = Math.max(3500, weights.budgetIdeal - 1000);
    if (total > 0 && total <= comfortFloor) {
      rawBudgetPts = 12;
      budgetDesc = `R$ ${total.toLocaleString("pt-BR")}/mês com excelente folga abaixo da meta de R$ ${weights.budgetIdeal.toLocaleString("pt-BR")}`;
    } else if (total > 0 && total <= weights.budgetIdeal) {
      rawBudgetPts = 10;
      budgetDesc = `R$ ${total.toLocaleString("pt-BR")}/mês dentro do teto ideal de R$ ${weights.budgetIdeal.toLocaleString("pt-BR")}`;
    } else if (total <= weights.budgetMax) {
      rawBudgetPts = 6;
      budgetDesc = `R$ ${total.toLocaleString("pt-BR")}/mês dentro do limite máximo de R$ ${weights.budgetMax.toLocaleString("pt-BR")}`;
    } else if (total <= weights.budgetHardCap) {
      rawBudgetPts = -4;
      budgetDesc = `R$ ${total.toLocaleString("pt-BR")}/mês ligeiramente acima de R$ ${weights.budgetMax.toLocaleString("pt-BR")} (negociável)`;
    } else {
      rawBudgetPts = -12;
      budgetDesc = `R$ ${total.toLocaleString("pt-BR")}/mês acima do teto máximo de R$ ${weights.budgetHardCap.toLocaleString("pt-BR")}`;
    }
    const budgetPoints =
      Math.round(rawBudgetPts * weights.budgetWeight * 10) / 10;

    // 3-tier Furniture classification & points
    const furnitureTier = classifyFurnitureTier(prop);
    const effectiveFurnished: boolean | null =
      furnitureTier === "FULLY_FURNISHED"
        ? true
        : furnitureTier === "UNFURNISHED"
          ? false
          : prop.furnished;
    const effectiveProp: SlimPropertyRecord =
      effectiveFurnished !== prop.furnished
        ? { ...prop, furnished: effectiveFurnished }
        : prop;

    let furniturePoints = weights.unfurnishedBonus;
    let furnitureDesc =
      "Não mobiliado / só marcenaria fixa (pronto para receber sua mobília de Brasília)";
    if (furnitureTier === "SEMI_FURNISHED") {
      furniturePoints = Math.round(weights.furnishedPenalty * 0.35);
      furnitureDesc =
        "Semi-mobiliado — apenas eletros/cozinha sem cama ou sofá (penalidade reduzida)";
    } else if (furnitureTier === "FULLY_FURNISHED") {
      furniturePoints = weights.furnishedPenalty;
      furnitureDesc =
        "Totalmente mobiliado com cama/sofá (requer negociar retirada de mobília solta ou adaptar)";
    }

    // Area points (calibrated for bringing Brasília furniture: Queen bed, large sofa, fridge, washer, dishwasher)
    const area = prop.areaM2;
    let areaPoints = 0;
    let areaDesc = "";
    if (area >= weights.sweetSpotMinM2 && area <= weights.sweetSpotMaxM2) {
      areaPoints = 10;
      areaDesc = `${area} m² no sweet spot ideal para a mudança de Brasília (${weights.sweetSpotMinM2}–${weights.sweetSpotMaxM2} m²)`;
    } else if (area > weights.sweetSpotMaxM2 && area <= weights.maxAreaM2) {
      areaPoints = 6;
      areaDesc = `${area} m² planta espaçosa (${weights.sweetSpotMaxM2}–${weights.maxAreaM2} m²)`;
    } else if (area >= 46 && area < weights.sweetSpotMinM2) {
      areaPoints = 0;
      areaDesc = `${area} m² compacta no limite (46–${weights.sweetSpotMinM2 - 1} m²)`;
    } else if (area >= weights.minAreaM2 && area < 46) {
      areaPoints = -10;
      areaDesc = `${area} m² muito enxuta para acomodar toda a mudança de Brasília (${weights.minAreaM2}–45 m²)`;
    } else {
      areaPoints = -18;
      areaDesc = `${area} m² fora da faixa configurada (${weights.minAreaM2}–${weights.maxAreaM2} m²)`;
    }

    // Parking points
    const isRJ = prop.cityCode === "RJ";
    let parkingPoints = 0;
    let parkingDesc = "";
    if (prop.parkingSpaces >= 2) {
      parkingPoints = isRJ ? weights.parkingBonus2 + 14 : weights.parkingBonus2;
      parkingDesc = `${prop.parkingSpaces} vagas de garagem`;
    } else if (prop.parkingSpaces === 1) {
      parkingPoints = isRJ ? weights.parkingBonus1 + 12 : weights.parkingBonus1;
      parkingDesc = `1 vaga de garagem${isRJ ? " (raridade na Zona Sul do RJ)" : ""}`;
    } else {
      parkingPoints = isRJ ? -8 : -18;
      parkingDesc = "Sem vaga de garagem";
    }

    // City Preference Adjustment (User preference: penalize São Paulo Capital heavily, and Campinas moderately for being in SP state)
    const cityPreferencePoints =
      prop.cityCode === "SP" ? -18.0 : prop.cityCode === "CP" ? -7.0 : 0;

    const finalScore =
      Math.round(
        (neighborhoodPoints +
          streetSafetyAdjustment +
          commuteDistanceAdjustment +
          cityPreferencePoints +
          modernityPoints +
          nuancesPoints +
          budgetPoints +
          furniturePoints +
          areaPoints +
          parkingPoints) *
          10,
      ) / 10;

    // Eligibility checks
    const exclusions: string[] = [];
    const effectiveHardCap =
      prop.cityCode === "RJ" || prop.cityCode === "SP"
        ? Math.max(weights.budgetHardCap, weights.budgetMax + 350)
        : weights.budgetHardCap;
    if (!total || total < 1500 || total > effectiveHardCap) {
      exclusions.push(
        `Total mensal R$ ${total.toLocaleString("pt-BR")} fora do teto (máx R$ ${effectiveHardCap.toLocaleString("pt-BR")})`,
      );
    }
    if (area < weights.minAreaM2 || area > weights.maxAreaM2) {
      exclusions.push(
        `Área ${area} m² fora do intervalo ${weights.minAreaM2}–${weights.maxAreaM2} m²`,
      );
    }
    if (weights.requireParking && prop.parkingSpaces < 1) {
      exclusions.push("Sem vaga de garagem (filtro exigir vaga ativo)");
    }
    if (nuances.hasNoElevator) {
      exclusions.push("Sem elevador (eliminado)");
    }
    if (nuances.hasTrappedParking) {
      exclusions.push("Vaga presa (eliminado)");
    }
    const effectiveMinMod =
      prop.cityCode === "RJ"
        ? Math.max(48, weights.minModernityScore - 8)
        : weights.minModernityScore;
    if (prop.modernityScore < effectiveMinMod) {
      exclusions.push(
        `Modernidade ${prop.modernityScore}/100 abaixo do mínimo (${effectiveMinMod}/100)`,
      );
    }

    const eligible = exclusions.length === 0;
    const exclusionReason = eligible ? null : exclusions.join(" · ");

    const fmtSign = (n: number) => (n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1));
    const signalsSummary =
      prop.positiveSignals.length > 0
        ? prop.positiveSignals.join(", ")
        : "padrão conservado";
    const filteredNegativeSignals = prop.negativeSignals.filter(
      (s) => !/venda|comprad|visita[cç][aã]o/i.test(s),
    );
    const negSummary =
      filteredNegativeSignals.length > 0
        ? ` | Alertas: ${filteredNegativeSignals.join(", ")}`
        : "";
    const nuancesSummary =
      nuances.nuanceHighlights.length > 0
        ? nuances.nuanceHighlights.join(", ")
        : "sem destaques extras de micro-localização/andar";
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

    const justificationParts = [
      `Score Final ${finalScore.toFixed(1)} pts (${eligible ? "Qualificado" : `Filtrado: ${exclusionReason}`}):`,
      `[Bairro ${fmtSign(neighborhoodPoints)} pts] ${prop.neighborhood} (${prop.cityCode}) tem nota dinâmica ${nbScore.toFixed(2)}/10 × peso ${weights.neighborhoodMultiplier.toFixed(1)} (${nbCommute});${safetyClause}${cityPrefClause}`,
      `[Modernidade ${fmtSign(modernityPoints)} pts] Score ${prop.modernityScore}/100 (${prop.modernityTier}: ${signalsSummary}${negSummary}) × peso ${weights.modernityMultiplier.toFixed(2)};`,
      `[Nuances & Micro-Localização ${fmtSign(nuancesPoints)} pts] (${nuancesSummary}${nuancesWarnSummary}) × peso ${(weights.nuancesMultiplier ?? 1).toFixed(1)};`,
      `[Orçamento ${fmtSign(budgetPoints)} pts] ${budgetDesc};`,
      `[Mobília ${fmtSign(furniturePoints)} pts] ${furnitureDesc};`,
      `[Planta ${fmtSign(areaPoints)} pts] ${areaDesc};`,
      `[Garagem ${fmtSign(parkingPoints)} pts] ${parkingDesc}.`,
    ];

    const parsedCommute = parseCommuteMinutes(
      catalogNb?.commuteTime ?? nbCommute,
      isDeepWestBarra,
    );

    return {
      ...effectiveProp,
      furnitureTier,
      commuteMinutes: parsedCommute.minutes,
      commuteLabel: parsedCommute.label,
      eligible,
      exclusionReason,
      finalScore,
      cityRank: null,
      overallRank: null,
      neighborhoodRank: null,
      neighborhoodDynamicScore: nbScore,
      breakdown: {
        neighborhoodPoints,
        modernityPoints,
        nuancesPoints,
        budgetPoints,
        furniturePoints,
        areaPoints,
        parkingPoints,
        safetyPoints: streetSafetyAdjustment,
        commutePoints: commuteDistanceAdjustment,
        cityPreferencePoints,
      },
      cardTags: {
        acLabel: nuances.acLabel,
        floorTag: nuances.floorTag,
        highFloorLabel: nuances.highFloorLabel,
        lowFloorLabel: nuances.lowFloorLabel,
        noParking: prop.parkingSpaces < 1,
        greenTags: nuances.greenTags,
        redTags: nuances.redTags,
      },
      nuanceHighlights: nuances.nuanceHighlights,
      nuanceWarnings: nuances.nuanceWarnings,
      parksNearby: nuances.parksNearby,
      mallsNearby: nuances.mallsNearby,
      shortJustification: buildShortJustification({
        prop: effectiveProp,
        furnitureTier,
        catalogNb,
        nbScore,
        nbCommute,
        safetyCar: nbSafetyCar,
        weights,
        nuances,
        eligible,
        exclusionReason,
      }),
      narrativeJustification: buildNarrativeJustification({
        prop: effectiveProp,
        furnitureTier,
        catalogNb,
        nbCommute,
        weights,
        nuances,
        eligible,
        exclusionReason,
      }),
      detailedJustification: justificationParts.join(" "),
    };
  });

  evaluated.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    return a.totalMonthly - b.totalMonthly;
  });

  let overallCounter = 0;
  const cityCounters = new Map<CityHubCode, number>();
  const nbCounters = new Map<string, number>();

  for (const item of evaluated) {
    if (!item.eligible || item.isActive === false) continue;

    const cRank = (cityCounters.get(item.cityCode) ?? 0) + 1;
    cityCounters.set(item.cityCode, cRank);
    item.cityRank = cRank;

    const nbKey = `${item.cityCode}:${item.neighborhood}`;
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
