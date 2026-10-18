import type {
  CityHubCode,
  ModernityTier,
  PlaceNearby,
  PropertyProvider,
  PropertyQuestionItem,
  SamplePhoto,
  ScoringWeights,
} from "@/types/housing";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const housingSchema = pgSchema("housing");

/** Unused since neighborhoods ship inside the snapshot payload (kept, not dropped). */
export const neighborhoods = housingSchema.table(
  "neighborhoods",
  {
    cityCode: text("city_code").$type<CityHubCode>().notNull(),
    neighborhood: text("neighborhood").notNull(),
    cityName: text("city_name").notNull(),
    overallPosition: integer("overall_position").notNull(),
    cityPosition: integer("city_position").notNull(),
    baseScore: real("base_score").notNull(),
    idhm: real("idhm").notNull(),
    commuteTime: text("commute_time").notNull(),
    nubankHub: text("nubank_hub").notNull(),
    urbanBreathingScore: real("urban_breathing_score").notNull(),
    commuteLogisticsScore: real("commute_logistics_score").notNull(),
    buildingStockFitScore: real("building_stock_fit_score").notNull(),
    budgetFitScore: real("budget_fit_score").notNull(),
    safetyCarScore: real("safety_car_score").notNull(),
    shortRationale: text("short_rationale").notNull(),
    detailedJustification: text("detailed_justification").notNull(),
    pros: jsonb("pros").$type<string[]>().notNull().default([]),
    cons: jsonb("cons").$type<string[]>().notNull().default([]),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.cityCode, table.neighborhood] }),
    index("housing_nb_pos_idx").on(table.overallPosition),
  ],
);

/** Row mirror of the listings; unused since listings ship as versioned snapshots (kept, not dropped). */
export const properties = housingSchema.table(
  "properties",
  {
    provider: text("provider")
      .$type<PropertyProvider>()
      .notNull(),
    id: text("id").notNull(),
    cityCode: text("city_code").$type<CityHubCode>().notNull(),
    city: text("city").notNull(),
    neighborhood: text("neighborhood").notNull(),
    street: text("street").notNull(),
    streetNumber: text("street_number"),
    condominiumName: text("condominium_name"),
    doorman: text("doorman"),
    url: text("url").notNull(),
    title: text("title").notNull(),
    rent: integer("rent").notNull(),
    condoFee: integer("condo_fee").notNull(),
    iptu: integer("iptu").notNull(),
    totalMonthly: integer("total_monthly").notNull(),
    salePrice: integer("sale_price"),
    areaM2: real("area_m2").notNull(),
    bedrooms: integer("bedrooms").notNull(),
    suites: integer("suites").notNull(),
    bathrooms: integer("bathrooms").notNull(),
    parkingSpaces: integer("parking_spaces").notNull(),
    floor: integer("floor"),
    floorRange: jsonb("floor_range").$type<{ min: number; max: number } | null>(),
    totalFloors: integer("total_floors"),
    furnished: boolean("furnished"),
    acceptsPets: boolean("accepts_pets"),
    nearSubway: boolean("near_subway"),
    constructionYear: integer("construction_year"),
    condition: text("condition"),
    installations: jsonb("installations").$type<string[]>().notNull().default([]),
    amenities: jsonb("amenities").$type<string[]>().notNull().default([]),
    comfortCommodities: jsonb("comfort_commodities")
      .$type<string[]>()
      .notNull()
      .default([]),
    practicalityCommodities: jsonb("practicality_commodities")
      .$type<string[]>()
      .notNull()
      .default([]),
    placesNearby: jsonb("places_nearby")
      .$type<PlaceNearby[]>()
      .notNull()
      .default([]),
    photoCaptions: jsonb("photo_captions")
      .$type<string[]>()
      .notNull()
      .default([]),
    photosCount: integer("photos_count").notNull().default(0),
    modernityScore: integer("modernity_score").notNull(),
    modernityTier: text("modernity_tier").$type<ModernityTier>().notNull(),
    positiveSignals: jsonb("positive_signals")
      .$type<string[]>()
      .notNull()
      .default([]),
    negativeSignals: jsonb("negative_signals")
      .$type<string[]>()
      .notNull()
      .default([]),
    samplePhotos: jsonb("sample_photos")
      .$type<SamplePhoto[]>()
      .notNull()
      .default([]),
    description: text("description"),
    generatedDescription: text("generated_description"),
    sourceSearch: text("source_search"),
    isNewEntry: boolean("is_new_entry").notNull().default(false),
    publishedAt: text("published_at"),
    isActive: boolean("is_active").notNull().default(true),
    deactivatedAt: text("deactivated_at"),
    isFavorite: boolean("is_favorite").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.id] }),
    index("housing_prop_city_nb_idx").on(table.cityCode, table.neighborhood),
    index("housing_prop_total_idx").on(table.cityCode, table.totalMonthly),
  ],
);

export const weightPresets = housingSchema.table("weight_presets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  weights: jsonb("weights").$type<ScoringWeights>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userPreferences = housingSchema.table("user_preferences", {
  id: text("id").primaryKey(),
  filters: jsonb("filters")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  weights: jsonb("weights")
    .$type<Partial<ScoringWeights>>()
    .notNull()
    .default({}),
  activePresetId: text("active_preset_id")
    .notNull()
    .default("balanced-original"),
  favorites: jsonb("favorites").$type<string[]>().notNull().default([]),
  // Legacy comparator column: no longer read or written; kept so a schema push does not drop it.
  compareKeys: jsonb("compare_keys").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const propertyQa = housingSchema.table("property_qa", {
  id: text("id").primaryKey(),
  items: jsonb("items").$type<PropertyQuestionItem[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});


const bytea = customType<{ data: Buffer; driverData: Buffer | string }>({
  dataType: () => "bytea",
});

/** Versioned listing snapshots published by the scraper: gzip JSON validated by @data-projects/housing-contract. */
export const snapshots = housingSchema.table(
  "snapshots",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    contentHash: text("content_hash").notNull().unique(),
    contractVersion: integer("contract_version").notNull(),
    propertyCount: integer("property_count").notNull(),
    sourceUpdatedAt: text("source_updated_at").notNull(),
    payloadGzip: bytea("payload_gzip").notNull(),
    /** Full photo galleries keyed by "provider:id" (gzip JSON), resolved during the scrape. */
    galleriesGzip: bytea("galleries_gzip"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
);

/** Single row (id = "active") naming the snapshot the portal serves. */
export const snapshotPointer = housingSchema.table("snapshot_pointer", {
  id: text("id").primaryKey(),
  snapshotId: integer("snapshot_id")
    .notNull()
    .references(() => snapshots.id),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Small runtime maps written by request handlers: listing deactivations, geocoder results and
 * photo galleries resolved on demand. One namespace per map.
 */
export const runtimeKv = housingSchema.table(
  "runtime_kv",
  {
    namespace: text("namespace").notNull(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.namespace, table.key] }),
    index("housing_runtime_kv_ns_updated_idx").on(table.namespace, table.updatedAt),
  ],
);

/**
 * Scrape jobs requested from the portal and executed by the runner on the owner's Mac
 * (scraper repo scripts/runner.ts). `progress` holds the job's ScrapeJobStatus as the runner sees it.
 */
export const scrapeJobs = housingSchema.table(
  "scrape_jobs",
  {
    id: text("id").primaryKey(),
    status: text("status").$type<"queued" | "running" | "completed" | "failed" | "cancelled">().notNull(),
    mode: text("mode").$type<"full_sync" | "verify_only" | "custom_url">().notNull(),
    params: jsonb("params").$type<Record<string, unknown>>().notNull().default({}),
    progress: jsonb("progress").$type<Record<string, unknown>>(),
    cancelRequested: boolean("cancel_requested").notNull().default(false),
    requestedBy: text("requested_by").notNull().default("portal"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    heartbeatAt: timestamp("heartbeat_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: text("error"),
  },
  (table) => [index("housing_scrape_jobs_status_idx").on(table.status, table.requestedAt)],
);
