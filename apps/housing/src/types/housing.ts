import type {
  NegativeSignalKey,
  PositiveSignalKey,
  ScrapeJobStatus,
} from "@data-projects/housing-contract";

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
  /** Display labels; scoring logic reads the keys (see listing-signals.ts). */
  positiveSignals: string[];
  negativeSignals: string[];
  positiveSignalKeys?: PositiveSignalKey[];
  negativeSignalKeys?: NegativeSignalKey[];
  samplePhotos: SamplePhoto[];
  description: string | null;
  generatedDescription: string | null;
  sourceSearch: string | null;
  isNewEntry: boolean;
  publishedAt?: string | null;
  listingUpdatedAt?: string | null;
  isActive?: boolean;
  deactivatedAt?: string | null;
  /** Portal rent, set only when `rent` was raised to the rent stated in the description. */
  listedRent?: number;
  /** Portal IPTU, set only when `iptu` holds an estimate (missing / "sob estimativa" / implausibly low). */
  listedIptu?: number;
  /** "provider:id" of the same unit listed on other portals. */
  alsoListedOn?: string[];
  /** A cross-portal twin's photo audit confirmed an installed AC. */
  twinAcConfirmed?: boolean;
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
  listingAgeDays?: number | null;
  listingAgeLabel?: string | null;
  /** Set only when a relisting's first publication is meaningfully older than the current one. */
  firstPublicationAgeLabel?: string | null;
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
    /** Amber "check before trusting" pills, e.g. AC only claimed by a portal checkbox. */
    warningTags: string[];
  };
  nuanceHighlights: string[];
  nuanceWarnings: string[];
  parksNearby: string[];
  mallsNearby: string[];
  shortJustification: string;
  narrativeJustification: string;
  detailedJustification: string;
}

export interface SavedView {
  id: string;
  name: string;
  /** Filter fields only (same shape as the saved `filters` preference). */
  filters: Record<string, unknown>;
  createdAt: string;
}

export interface SharedUserPreferences {
  schemaVersion?: number;
  filters: Record<string, unknown>;
  weights: Partial<ScoringWeights>;
  activePresetId: string;
  favorites: string[];
  /** Since schema v3. */
  savedViews?: SavedView[];
  updatedAt: string;
}

export interface HousingDatasetPayload {
  updatedAt: string;
  source: "neon" | "snapshot";
  neighborhoods: NeighborhoodEntry[];
  properties: SlimPropertyRecord[];
  favorites?: string[];
  preferences?: SharedUserPreferences;
}

export type { ScrapeJobStatus };

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
  eligible?: boolean;
  exclusionReason?: string | null;
}

export interface PropertyQuestionItem {
  id: string;
  propertyKey: string; // e.g. "quintoandar:895354338" or "general"
  question: string;
  status: "pending" | "answered";
  answer: string | null;
  answerSource?: "instant_diagnostic" | "cursor_session" | "llm";
  /** Instant answer kept after a `cursor_session` answer replaces `answer`. */
  instantAnswer?: string | null;
  /** True while the question sits in the Cursor queue waiting for a detailed answer. */
  awaitingDetailedAnswer?: boolean;
  createdAt: string;
  answeredAt: string | null;
  propertySnapshot: PropertyQuestionSnapshot;
}


