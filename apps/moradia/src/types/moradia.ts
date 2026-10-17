export type CityHubCode = "BH" | "CP" | "SP" | "RJ" | "BSB";

export type ModernityTier =
  | "MODERN_OR_RENOVATED"
  | "WELL_MAINTAINED"
  | "STANDARD"
  | "DATED";

export type FurnitureTier =
  | "UNFURNISHED"
  | "SEMI_FURNISHED"
  | "FULLY_FURNISHED";

export type FloorRarity =
  | "legendary"
  | "epic"
  | "rare"
  | "uncommon"
  | "common";

export interface FloorTag {
  label: string;
  rarity: FloorRarity;
}

export interface SamplePhoto {
  room: string | null;
  url: string;
}

export interface PlaceNearby {
  name: string;
  type: string;
}

export interface NeighborhoodEntry {
  cityCode: CityHubCode;
  cityName: string;
  neighborhood: string;
  overallPosition: number;
  cityPosition: number;
  baseScore: number;
  idhm: number;
  commuteTime: string;
  nubankHub: string;
  urbanBreathingScore: number;
  commuteLogisticsScore: number;
  buildingStockFitScore: number;
  budgetFitScore: number;
  safetyCarScore: number;
  shortRationale: string;
  detailedJustification: string;
  pros: string[];
  cons: string[];
}

export type PropertyProvider =
  | "quintoandar"
  | "zapimoveis"
  | "zap"
  | "vivareal"
  | "netimoveis"
  | "imovelweb";

export interface SlimPropertyRecord {
  provider: PropertyProvider;
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
  placesNearby: PlaceNearby[];
  photoCaptions: string[];
  photosCount: number;
  modernityScore: number;
  modernityTier: ModernityTier;
  positiveSignals: string[];
  negativeSignals: string[];
  samplePhotos: SamplePhoto[];
  description: string | null;
  generatedDescription: string | null;
  sourceSearch: string | null;
  isNewEntry: boolean;
  isActive?: boolean;
  deactivatedAt?: string | null;
}

export interface ScoringWeights {
  // Sub-pesos dos Bairros (0.0 a 2.5)
  urbanBreathingWeight: number;
  commuteLogisticsWeight: number;
  buildingStockWeight: number;
  budgetFitWeight: number;
  safetyCarWeight: number;
  // Pesos e limites dos Imoveis
  neighborhoodMultiplier: number;
  modernityMultiplier: number;
  nuancesMultiplier: number;
  minModernityScore: number;
  budgetIdeal: number;
  budgetMax: number;
  budgetHardCap: number;
  budgetWeight: number;
  unfurnishedBonus: number;
  furnishedPenalty: number;
  parkingBonus1: number;
  parkingBonus2: number;
  requireParking: boolean;
  penalizeMegaCondo: boolean;
  minAreaM2: number;
  maxAreaM2: number;
  sweetSpotMinM2: number;
  sweetSpotMaxM2: number;
}

export interface ComputedNeighborhood extends NeighborhoodEntry {
  dynamicScore: number;
  dynamicOverallRank: number;
  dynamicCityRank: number;
  dynamicJustification: string;
}

export interface ScoreBreakdown {
  neighborhoodPoints: number;
  modernityPoints: number;
  nuancesPoints: number;
  budgetPoints: number;
  furniturePoints: number;
  areaPoints: number;
  parkingPoints: number;
  safetyPoints: number;
  commutePoints: number;
  cityPreferencePoints: number;
}

export interface EvaluatedProperty extends SlimPropertyRecord {
  furnitureTier?: FurnitureTier;
  commuteMinutes?: number | null;
  commuteLabel?: string;
  eligible: boolean;
  exclusionReason: string | null;
  finalScore: number;
  cityRank: number | null;
  overallRank: number | null;
  neighborhoodRank: number | null;
  neighborhoodDynamicScore: number;
  breakdown: ScoreBreakdown;
  cardTags: {
    acLabel: string | null;
    floorTag: FloorTag | null;
    highFloorLabel: string | null;
    lowFloorLabel: string | null;
    noParking: boolean;
    greenTags: string[];
    redTags: string[];
  };
  nuanceHighlights: string[];
  nuanceWarnings: string[];
  parksNearby: string[];
  mallsNearby: string[];
  shortJustification: string;
  narrativeJustification: string;
  detailedJustification: string;
}

export interface SharedUserPreferences {
  schemaVersion?: number;
  filters: Record<string, unknown>;
  weights: Partial<ScoringWeights>;
  activePresetId: string;
  favorites: string[];
  compareKeys: string[];
  updatedAt: string;
}

export interface MoradiaDatasetPayload {
  updatedAt: string;
  source: "neon" | "snapshot";
  neighborhoods: NeighborhoodEntry[];
  properties: SlimPropertyRecord[];
  favorites?: string[];
  preferences?: SharedUserPreferences;
}

export interface ScrapeJobStatus {
  jobId: string;
  status: "idle" | "running" | "completed" | "failed";
  workerAvailable?: boolean;
  mode?: "full_sync" | "verify_only" | "custom_url";
  startedAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
  phase?: string;
  currentSearchLabel?: string | null;
  completedSteps?: number;
  totalSteps?: number;
  newListingsAdded?: number;
  deactivatedCount?: number;
  reactivatedCount?: number;
  verifiedCount?: number;
  logs?: string[];
  error?: string | null;
}

export interface PropertyQuestionSnapshot {
  title: string;
  neighborhood: string;
  cityCode: string;
  street: string;
  streetNumber: string | null;
  condominiumName: string | null;
  totalMonthly: number;
  rent: number;
  condoFee: number;
  iptu: number;
  areaM2: number;
  bedrooms: number;
  bathrooms: number;
  parkingSpaces: number;
  floor: number | null;
  floorLabel: string | null;
  furnished: boolean | null;
  modernityScore: number;
  finalScore: number;
  overallRank: number | null;
  cityRank?: number | null;
  furnitureTier?: FurnitureTier;
  url: string;
  shortJustification: string;
  description: string | null;
  thumbnailUrl?: string | null;
  suites?: number;
  totalFloors?: number | null;
  floorRange?: { min: number; max: number } | null;
  constructionYear?: number | null;
  doorman?: string | null;
  acLabel?: string | null;
  greenTags?: string[];
  redTags?: string[];
  nuanceHighlights?: string[];
  nuanceWarnings?: string[];
  breakdown?: ScoreBreakdown;
}

export interface PropertyQuestionItem {
  id: string;
  propertyKey: string; // e.g. "quintoandar:895354338" or "general"
  question: string;
  status: "pending" | "answered";
  answer: string | null;
  answerSource?: "instant_diagnostic" | "cursor_session" | "llm";
  createdAt: string;
  answeredAt: string | null;
  propertySnapshot: PropertyQuestionSnapshot;
}


