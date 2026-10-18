/**
 * Data contract between the housing scraper (writer) and the housing portal (reader).
 *
 * The scraper repo vendors this file verbatim (src/contract/housing-contract.ts) and runs it with
 * Node's type stripping, so it must stay a single file of erasable TypeScript (no enums,
 * namespaces or parameter properties) whose only import is zod. Bump HOUSING_CONTRACT_VERSION on
 * any breaking change; the scraper test suite fails while its copy is out of date.
 */
import { z } from "zod";

export const HOUSING_CONTRACT_VERSION = 1;

// ── Modernity signals ────────────────────────────────────────────────────────────────────────
// Logic keys off these keys; labels are display copy only.

export const POSITIVE_SIGNAL_KEYS = [
  "CONSTRUCTION_RECENT",
  "CONSTRUCTION_2010S",
  "CONSTRUCTION_2000S",
  "NEW_OR_RECENTLY_RENOVATED",
  "RENOVATED_MODERN",
  "MODERN_FLOORING",
  "MODERN_COUNTERTOP_OR_GLAZED_BALCONY",
  "LIGHTING_PROJECT",
  "SMART_LOCK_OR_USB",
  "BUILTIN_KITCHEN_APPLIANCES",
  "SPLIT_AC",
  "GENERIC_AC",
  "PLANNED_CABINETRY",
  "SOUNDPROOF_OR_BLACKOUT",
  "POOL_AND_GYM",
  "ROOFTOP_GOURMET_OR_LAUNDRY",
  "NEW_OR_RENOVATED_FLAG",
] as const;

export const NEGATIVE_SIGNAL_KEYS = [
  "CONSTRUCTION_OLD",
  "SERVICE_QUARTERS_LAYOUT",
  "OLD_BUILDING_MENTION",
  "OLD_FLOORS",
  "UNRENOVATED_LAMINATE",
  "OLD_FRAMES_OR_WINDOW_AC",
  "OLD_TILES_OR_CABINETS",
  "NO_ELEVATOR",
  "DATED_NAMED_BUILDING",
] as const;

export type PositiveSignalKey = (typeof POSITIVE_SIGNAL_KEYS)[number];
export type NegativeSignalKey = (typeof NEGATIVE_SIGNAL_KEYS)[number];
export type SignalKey = PositiveSignalKey | NegativeSignalKey;

export const positiveSignalKeySchema = z.enum(POSITIVE_SIGNAL_KEYS);
export const negativeSignalKeySchema = z.enum(NEGATIVE_SIGNAL_KEYS);

const FIXED_SIGNAL_LABELS: Partial<Record<SignalKey, string>> = {
  NEW_OR_RECENTLY_RENOVATED: "Imóvel/prédio novo ou recém-reformado",
  RENOVATED_MODERN: "Reformado / Moderno",
  MODERN_FLOORING: "Porcelanato / Vinílico",
  MODERN_COUNTERTOP_OR_GLAZED_BALCONY: "Bancada moderna / Varanda envidraçada",
  LIGHTING_PROJECT: "Projeto de iluminação / Gesso",
  SMART_LOCK_OR_USB: "Fechadura eletrônica / USB",
  BUILTIN_KITCHEN_APPLIANCES: "Cooktop / Coifa / Forno embutido",
  SPLIT_AC: "Ar-condicionado Split",
  GENERIC_AC: "Ar-condicionado",
  PLANNED_CABINETRY: "Marcenaria planejada / Painel",
  SOUNDPROOF_OR_BLACKOUT: "Janela antirruído / Blackout",
  POOL_AND_GYM: "Lazer com piscina e academia",
  ROOFTOP_GOURMET_OR_LAUNDRY: "Rooftop / Gourmet / Lavanderia",
  NEW_OR_RENOVATED_FLAG: "Flag Novo/Reformado",
  SERVICE_QUARTERS_LAYOUT: "Planta antiga c/ dependência de serviço (DCE) s/ reforma declarada",
  OLD_BUILDING_MENTION: "Menção a prédio/imóvel antigo",
  OLD_FLOORS: "Piso antigo (cerâmica / tábua corrida / taco)",
  UNRENOVATED_LAMINATE: "Piso laminado sem reforma declarada",
  OLD_FRAMES_OR_WINDOW_AC: "Esquadrias antigas / ar de janela",
  OLD_TILES_OR_CABINETS: "Azulejos / armários embutidos antigos",
  NO_ELEVATOR: "Sem elevador",
  DATED_NAMED_BUILDING: "Edifício anos 80/90 sem reforma declarada",
};

/** Display label; construction signals embed the construction year. */
export function signalLabel(key: SignalKey, constructionYear?: number | null): string {
  const year = constructionYear ?? "?";
  switch (key) {
    case "CONSTRUCTION_RECENT":
      return `Construção recente (${year})`;
    case "CONSTRUCTION_2010S":
      return `Construção ${year}`;
    case "CONSTRUCTION_2000S":
      return `Construção anos 2000 (${year})`;
    case "CONSTRUCTION_OLD":
      return `Construção antiga (${year})`;
    default:
      return FIXED_SIGNAL_LABELS[key] ?? key;
  }
}

const LABEL_TO_KEY = new Map<string, SignalKey>(
  Object.entries(FIXED_SIGNAL_LABELS).map(([key, label]) => [label as string, key as SignalKey]),
);

/** Maps a label written by scrapers before signal keys existed (contract v0) back to its key. */
export function legacySignalKey(label: string): SignalKey | null {
  const fixed = LABEL_TO_KEY.get(label);
  if (fixed) return fixed;
  if (/^Construção recente \(\d{4}\)$/.test(label)) return "CONSTRUCTION_RECENT";
  if (/^Construção anos 2000 \(\d{4}\)$/.test(label)) return "CONSTRUCTION_2000S";
  if (/^Construção antiga \(\d{4}\)$/.test(label)) return "CONSTRUCTION_OLD";
  if (/^Construção \d{4}$/.test(label)) return "CONSTRUCTION_2010S";
  return null;
}

export function isPositiveSignalKey(key: string): key is PositiveSignalKey {
  return (POSITIVE_SIGNAL_KEYS as readonly string[]).includes(key);
}

export function isNegativeSignalKey(key: string): key is NegativeSignalKey {
  return (NEGATIVE_SIGNAL_KEYS as readonly string[]).includes(key);
}

// ── Published listing snapshot ───────────────────────────────────────────────────────────────

export const cityCodeSchema = z.enum(["BH", "CP", "SP", "RJ", "BSB"]);
export const propertyProviderSchema = z.enum([
  "quintoandar",
  "zapimoveis",
  "zap",
  "vivareal",
  "netimoveis",
  "imovelweb",
]);
export const modernityTierSchema = z.enum(["MODERN_OR_RENOVATED", "WELL_MAINTAINED", "STANDARD", "DATED"]);

const photoSchema = z.object({ room: z.string().nullable(), url: z.string() });

export const neighborhoodEntrySchema = z.object({
  cityCode: cityCodeSchema,
  cityName: z.string(),
  neighborhood: z.string(),
  overallPosition: z.number(),
  cityPosition: z.number(),
  baseScore: z.number(),
  idhm: z.number(),
  commuteTime: z.string(),
  nubankHub: z.string(),
  urbanBreathingScore: z.number(),
  commuteLogisticsScore: z.number(),
  buildingStockFitScore: z.number(),
  budgetFitScore: z.number(),
  safetyCarScore: z.number(),
  shortRationale: z.string(),
  detailedJustification: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
});

/** One listing as the portal consumes it (already normalized and deduplicated by the scraper). */
export const publishedListingSchema = z.object({
  provider: propertyProviderSchema,
  id: z.string(),
  cityCode: cityCodeSchema,
  city: z.string(),
  neighborhood: z.string(),
  street: z.string(),
  streetNumber: z.string().nullable(),
  condominiumName: z.string().nullable(),
  doorman: z.string().nullable(),
  url: z.string(),
  title: z.string(),
  rent: z.number(),
  condoFee: z.number(),
  iptu: z.number(),
  totalMonthly: z.number(),
  salePrice: z.number().nullable(),
  areaM2: z.number(),
  bedrooms: z.number(),
  suites: z.number(),
  bathrooms: z.number(),
  parkingSpaces: z.number(),
  floor: z.number().nullable(),
  floorRange: z.object({ min: z.number(), max: z.number() }).nullable(),
  totalFloors: z.number().nullable(),
  furnished: z.boolean().nullable(),
  acceptsPets: z.boolean().nullable(),
  nearSubway: z.boolean().nullable(),
  constructionYear: z.number().nullable(),
  condition: z.string().nullable(),
  installations: z.array(z.string()),
  amenities: z.array(z.string()),
  comfortCommodities: z.array(z.string()),
  practicalityCommodities: z.array(z.string()),
  placesNearby: z.array(z.object({ name: z.string(), type: z.string() })),
  photoCaptions: z.array(z.string()),
  photosCount: z.number(),
  modernityScore: z.number(),
  modernityTier: modernityTierSchema,
  /** Display labels; absent in key-only snapshots (the reader derives them with `signalLabel`). */
  positiveSignals: z.array(z.string()),
  negativeSignals: z.array(z.string()),
  positiveSignalKeys: z.array(positiveSignalKeySchema).optional(),
  negativeSignalKeys: z.array(negativeSignalKeySchema).optional(),
  samplePhotos: z.array(photoSchema),
  description: z.string().nullable(),
  generatedDescription: z.string().nullable(),
  sourceSearch: z.string().nullable(),
  isNewEntry: z.boolean(),
  publishedAt: z.string().nullable().optional(),
  listingUpdatedAt: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  deactivatedAt: z.string().nullable().optional(),
  listedRent: z.number().optional(),
  listedIptu: z.number().optional(),
  alsoListedOn: z.array(z.string()).optional(),
  twinAcConfirmed: z.boolean().optional(),
});

export const listingSnapshotSchema = z.object({
  contractVersion: z.number().int().optional(),
  updatedAt: z.string(),
  source: z.string().optional(),
  neighborhoods: z.array(neighborhoodEntrySchema),
  properties: z.array(publishedListingSchema),
  /** Full photo galleries keyed by "provider:id", resolved during the scrape. */
  photoGalleries: z.record(z.string(), z.array(photoSchema)).optional(),
});

export type PublishedListing = z.infer<typeof publishedListingSchema>;
export type ListingSnapshot = z.infer<typeof listingSnapshotSchema>;

// ── Scrape job status ────────────────────────────────────────────────────────────────────────

export const scrapeJobModeSchema = z.enum(["full_sync", "verify_only", "custom_url"]);

export const scrapeJobStatusSchema = z.object({
  jobId: z.string(),
  status: z.enum(["idle", "queued", "running", "completed", "failed", "cancelled"]),
  workerAvailable: z.boolean().optional(),
  mode: scrapeJobModeSchema.optional(),
  startedAt: z.string().optional(),
  updatedAt: z.string().optional(),
  finishedAt: z.string().nullable().optional(),
  heartbeatAt: z.string().nullable().optional(),
  phase: z.string().optional(),
  currentSearchLabel: z.string().nullable().optional(),
  completedSteps: z.number().optional(),
  totalSteps: z.number().optional(),
  newListingsAdded: z.number().optional(),
  deactivatedCount: z.number().optional(),
  reactivatedCount: z.number().optional(),
  verifiedCount: z.number().optional(),
  logs: z.array(z.string()).optional(),
  error: z.string().nullable().optional(),
});

export type ScrapeJobMode = z.infer<typeof scrapeJobModeSchema>;
export type ScrapeJobStatus = z.infer<typeof scrapeJobStatusSchema>;
