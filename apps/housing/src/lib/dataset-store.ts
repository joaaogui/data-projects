import "server-only";

import { getDb, schema } from "@/db";
import {
  applyListingDeactivations,
  loadListingDeactivations,
} from "@/lib/listing-deactivations";
import { hashContent } from "@/lib/listing-features-store";
import { cleanListingText } from "@/lib/listing-normalization";
import { logger } from "@/lib/logger";
import {
  loadSharedPreferences,
  toggleSharedFavorite,
} from "@/lib/preferences-store";
import {
  computeDynamicNeighborhoods,
  computeDynamicProperties,
  DEFAULT_WEIGHTS,
} from "@/lib/scoring-engine";
import type {
  CityHubCode,
  HousingDatasetPayload,
  NeighborhoodEntry,
  SlimPropertyRecord,
} from "@/types/housing";
import { eq, sql } from "drizzle-orm";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const LOCAL_SNAPSHOT_FILE = join(process.cwd(), "src/data/seed-snapshot.json");
const FALLBACK_SNAPSHOT_FILE = join(
  process.cwd(),
  "apps/housing/src/data/seed-snapshot.json",
);
const LOCAL_FAVORITES_FILE = join(process.cwd(), "src/data/favorites.json");
const TMP_FAVORITES_FILE = join(tmpdir(), "housing-favorites.json");
const LOCAL_PHOTOS_CACHE_FILE = join(process.cwd(), "src/data/photos-cache.json");
const FALLBACK_PHOTOS_CACHE_FILE = join(
  process.cwd(),
  "apps/housing/src/data/photos-cache.json",
);
const TMP_PHOTOS_CACHE_FILE = join(tmpdir(), "housing-photos-cache.json");

type PhotosCacheMap = Record<string, Array<{ room: string | null; url: string }>>;

const photosFileCacheByPath = new Map<
  string,
  { mtimeMs: number; data: PhotosCacheMap }
>();
let mergedPhotosCacheSig = "";
let mergedPhotosCacheData: PhotosCacheMap | null = null;

function readPhotosCacheFile(filePath: string): {
  mtimeMs: number;
  data: PhotosCacheMap;
} {
  if (!existsSync(/*turbopackIgnore: true*/ filePath)) {
    return { mtimeMs: -1, data: {} };
  }
  try {
    const mtimeMs = statSync(/*turbopackIgnore: true*/ filePath).mtimeMs;
    const hit = photosFileCacheByPath.get(filePath);
    if (hit && hit.mtimeMs === mtimeMs) {
      return hit;
    }
    const raw = JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ filePath, "utf8"),
    ) as unknown;
    const data =
      raw && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as PhotosCacheMap)
        : {};
    const entry = { mtimeMs, data };
    photosFileCacheByPath.set(filePath, entry);
    return entry;
  } catch {
    return { mtimeMs: -1, data: {} };
  }
}

function loadPhotosCache(): PhotosCacheMap {
  const f1 = readPhotosCacheFile(FALLBACK_PHOTOS_CACHE_FILE);
  const f2 = readPhotosCacheFile(LOCAL_PHOTOS_CACHE_FILE);
  const f3 = readPhotosCacheFile(TMP_PHOTOS_CACHE_FILE);
  const sig = `${f1.mtimeMs}:${f2.mtimeMs}:${f3.mtimeMs}`;
  if (mergedPhotosCacheData && mergedPhotosCacheSig === sig) {
    return mergedPhotosCacheData;
  }
  mergedPhotosCacheSig = sig;
  mergedPhotosCacheData = {
    ...f1.data,
    ...f2.data,
    ...f3.data,
  };
  return mergedPhotosCacheData;
}

function parseFavoritesRaw(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return [
      ...new Set(
        raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0),
      ),
    ];
  }
  if (
    raw &&
    typeof raw === "object" &&
    "favorites" in raw &&
    Array.isArray((raw as { favorites: unknown }).favorites)
  ) {
    return [
      ...new Set(
        (raw as { favorites: unknown[] }).favorites.filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        ),
      ),
    ];
  }
  return [];
}

export function loadFavorites(): string[] {
  if (existsSync(/*turbopackIgnore: true*/ TMP_FAVORITES_FILE)) {
    try {
      const raw = JSON.parse(
        readFileSync(/*turbopackIgnore: true*/ TMP_FAVORITES_FILE, "utf8"),
      ) as unknown;
      return parseFavoritesRaw(raw);
    } catch {
      // Fallback to local favorites file
    }
  }
  if (existsSync(/*turbopackIgnore: true*/ LOCAL_FAVORITES_FILE)) {
    try {
      const raw = JSON.parse(
        readFileSync(/*turbopackIgnore: true*/ LOCAL_FAVORITES_FILE, "utf8"),
      ) as unknown;
      return parseFavoritesRaw(raw);
    } catch {
      return [];
    }
  }
  return [];
}

export function toggleFavoriteInStore(
  key: string,
  favorite?: boolean,
): string[] {
  const trimmedKey = key.trim();
  const current = new Set(loadFavorites());
  if (trimmedKey) {
    const shouldBeFav =
      typeof favorite === "boolean" ? favorite : !current.has(trimmedKey);
    if (shouldBeFav) {
      current.add(trimmedKey);
    } else {
      current.delete(trimmedKey);
    }
  }
  const updated = [...current];
  const serialized = `${JSON.stringify(updated, null, 2)}\n`;
  try {
    mkdirSync(dirname(LOCAL_FAVORITES_FILE), { recursive: true });
    writeFileSync(LOCAL_FAVORITES_FILE, serialized, "utf8");
  } catch {
    // Fallback to /tmp in read-only serverless environments (e.g. Vercel)
  }
  try {
    writeFileSync(TMP_FAVORITES_FILE, serialized, "utf8");
  } catch {
    // Ignore /tmp write errors
  }
  return updated;
}

interface SeedSnapshotData {
  updatedAt: string;
  source?: string;
  neighborhoods?: unknown[];
  properties?: unknown[];
}

let cachedSnapshotPath: string | null = null;
let cachedSnapshotMtimeMs = -1;
let cachedSnapshotData: SeedSnapshotData | null = null;
let cachedSnapshotHash = "";

/** Content hash of the snapshot currently served (stable across instances for the same file). */
export function getSnapshotContentHash(): string {
  loadSnapshotFromDiskOrBundle();
  return cachedSnapshotHash;
}

function loadSnapshotFromDiskOrBundle(): {
  data: SeedSnapshotData;
  cacheHit: boolean;
} {
  for (const candidate of [LOCAL_SNAPSHOT_FILE, FALLBACK_SNAPSHOT_FILE]) {
    if (existsSync(/*turbopackIgnore: true*/ candidate)) {
      try {
        const mtimeMs = statSync(/*turbopackIgnore: true*/ candidate).mtimeMs;
        if (
          cachedSnapshotData &&
          cachedSnapshotPath === candidate &&
          cachedSnapshotMtimeMs === mtimeMs
        ) {
          return { data: cachedSnapshotData, cacheHit: true };
        }
        const rawText = readFileSync(/*turbopackIgnore: true*/ candidate, "utf8");
        const parsed = JSON.parse(rawText) as SeedSnapshotData;
        cachedSnapshotHash = hashContent(rawText);
        cachedSnapshotPath = candidate;
        cachedSnapshotMtimeMs = mtimeMs;
        cachedSnapshotData = parsed;
        return { data: parsed, cacheHit: false };
      } catch (err) {
        logger.warn("dataset-store", "Failed reading snapshot candidate", {
          candidate,
          error: err,
        });
      }
    }
  }
  return {
    data: {
      updatedAt: new Date(0).toISOString(),
      neighborhoods: [],
      properties: [],
    },
    cacheHit: false,
  };
}

const MAX_INITIAL_CARD_PHOTOS = 3;

let cachedFullByKeyMtimeMs = -1;
let cachedFullByKeyMap: Map<string, SlimPropertyRecord> | null = null;
let cachedSlimmedSnapshotSig = "";
let cachedSlimmedSnapshotProps: SlimPropertyRecord[] | null = null;
let deferredDescriptionKeys: { snapshotHash: string; keys: Set<string> } | null = null;

/**
 * Listings whose description changes nothing in the default-weights evaluation are scored
 * (and were historically shipped) without it.
 */
function getDeferredDescriptionKeys(
  rawProps: SlimPropertyRecord[],
  rawNbs: NeighborhoodEntry[],
): Set<string> {
  if (deferredDescriptionKeys?.snapshotHash === cachedSnapshotHash) {
    return deferredDescriptionKeys.keys;
  }
  const { ranked } = computeDynamicNeighborhoods(rawNbs, DEFAULT_WEIGHTS);
  const fullEval = computeDynamicProperties(rawProps, ranked, DEFAULT_WEIGHTS, {
    includeBsbBenchmark: true,
  });
  const noDescEval = computeDynamicProperties(
    rawProps.map((p) => ({ ...p, description: null, generatedDescription: null })),
    ranked,
    DEFAULT_WEIGHTS,
    { includeBsbBenchmark: true },
  );
  const noDescByKey = new Map(noDescEval.map((p) => [`${p.provider}:${p.id}`, p]));
  const keys = new Set<string>();
  for (const fp of fullEval) {
    const key = `${fp.provider}:${fp.id}`;
    const np = noDescByKey.get(key);
    if (
      np &&
      fp.finalScore === np.finalScore &&
      fp.eligible === np.eligible &&
      fp.furnitureTier === np.furnitureTier &&
      JSON.stringify(fp.cardTags) === JSON.stringify(np.cardTags) &&
      JSON.stringify(fp.nuanceHighlights) === JSON.stringify(np.nuanceHighlights) &&
      JSON.stringify(fp.nuanceWarnings) === JSON.stringify(np.nuanceWarnings)
    ) {
      keys.add(key);
    }
  }
  deferredDescriptionKeys = { snapshotHash: cachedSnapshotHash, keys };
  return keys;
}

/** Snapshot listings normalized for the portal (all cached photos; deactivations not applied yet). */
function getSlimmedSnapshotProps(): SlimPropertyRecord[] {
  const { data: snap } = loadSnapshotFromDiskOrBundle();
  const photosCache = loadPhotosCache();
  const slimSig = `${cachedSnapshotHash}:${mergedPhotosCacheSig}`;
  if (cachedSlimmedSnapshotProps && cachedSlimmedSnapshotSig === slimSig) {
    return cachedSlimmedSnapshotProps;
  }
  const rawProps = (snap.properties ?? []) as unknown as SlimPropertyRecord[];
  const rawNbs = (snap.neighborhoods ?? []) as unknown as NeighborhoodEntry[];
  const deferred = getDeferredDescriptionKeys(rawProps, rawNbs);
  cachedSlimmedSnapshotProps = rawProps.map((p) => ({
    ...p,
    ...mergeCachedPhotos(p, photosCache),
    placesNearby: capRelevantPlaces(p.placesNearby),
    description: deferred.has(`${p.provider}:${p.id}`)
      ? null
      : cleanListingText(p.description),
    generatedDescription: null,
    sourceSearch: null,
    publishedAt: p.publishedAt ?? null,
    listingUpdatedAt: p.listingUpdatedAt ?? null,
    isActive: p.isActive ?? true,
    deactivatedAt: p.deactivatedAt ?? null,
  }));
  cachedSlimmedSnapshotSig = slimSig;
  return cachedSlimmedSnapshotProps;
}

export function getPropertyFullDetails(
  provider: string,
  id: string,
): SlimPropertyRecord | null {
  const { data: snap } = loadSnapshotFromDiskOrBundle();
  if (
    !cachedFullByKeyMap ||
    cachedFullByKeyMtimeMs !== cachedSnapshotMtimeMs
  ) {
    const rawProps = (snap.properties ?? []) as unknown as SlimPropertyRecord[];
    const map = new Map<string, SlimPropertyRecord>();
    for (const p of rawProps) {
      map.set(`${p.provider}:${String(p.id)}`, p);
    }
    cachedFullByKeyMap = map;
    cachedFullByKeyMtimeMs = cachedSnapshotMtimeMs;
  }
  return cachedFullByKeyMap.get(`${provider}:${id}`) ?? null;
}

function capRelevantPlaces(
  places: SlimPropertyRecord["placesNearby"] | undefined | null,
): SlimPropertyRecord["placesNearby"] {
  if (!Array.isArray(places) || places.length <= 8) {
    return places ?? [];
  }
  const first6 = places.slice(0, 6);
  const rest = places.slice(6);
  const extras: SlimPropertyRecord["placesNearby"] = [];
  if (!first6.some((p) => p.type === "PARK_OR_GREEN_AREA")) {
    const park = rest.find((p) => p.type === "PARK_OR_GREEN_AREA");
    if (park) extras.push(park);
  }
  if (!first6.some((p) => p.type === "SHOPPING_MALL")) {
    const mall = rest.find((p) => p.type === "SHOPPING_MALL");
    if (mall) extras.push(mall);
  }
  if (
    !first6.some((p) => p.type === "ESTACAO_METRO_OU_TREM") &&
    extras.length < 2
  ) {
    const subway = rest.find((p) => p.type === "ESTACAO_METRO_OU_TREM");
    if (subway) extras.push(subway);
  }
  for (const r of rest) {
    if (first6.length + extras.length >= 8) break;
    if (!extras.includes(r)) extras.push(r);
  }
  return [...first6, ...extras].slice(0, 8);
}

export interface ServedListings {
  updatedAt: string;
  source: "neon" | "snapshot";
  neighborhoods: NeighborhoodEntry[];
  /** Listings as the engine scores them (full description, all cached photos, deactivations applied). */
  properties: SlimPropertyRecord[];
  /** Hash of everything listing features depend on (photos excluded). */
  featureHash: string;
  /** Changes whenever `properties` changes (features + photo cache). */
  servedHash: string;
}

let servedCache: { sig: string; value: ServedListings } | null = null;
let neonServedCache: { expiresAt: number; value: ServedListings } | null = null;
const NEON_SERVED_TTL_MS = 60_000;

function mergeCachedPhotos(
  p: SlimPropertyRecord,
  photosCache: PhotosCacheMap,
): Pick<SlimPropertyRecord, "samplePhotos" | "photosCount"> {
  const cachedPhotos = photosCache[`${p.provider}:${p.id}`];
  const basePhotos = p.samplePhotos ?? [];
  const resolvedPhotos =
    Array.isArray(cachedPhotos) &&
    cachedPhotos.length >= basePhotos.length &&
    cachedPhotos.length > 0
      ? cachedPhotos
      : basePhotos;
  return {
    samplePhotos: resolvedPhotos,
    photosCount: Math.max(
      p.photosCount ?? 0,
      Array.isArray(cachedPhotos) ? cachedPhotos.length : 0,
      basePhotos.length,
    ),
  };
}

/**
 * Listings for server-side scoring. Same field normalization the browser used to receive
 * (capped nearby places, cleaned description, no generated description), but nothing deferred.
 */
export async function loadServedListings(): Promise<ServedListings> {
  const db = getDb();
  if (db && process.env.HOUSING_USE_NEON_PROPERTIES === "true") {
    if (neonServedCache && neonServedCache.expiresAt > Date.now()) {
      return neonServedCache.value;
    }
    const dataset = await loadHousingDataset("ALL");
    const featureHash = hashContent(
      dataset.source,
      dataset.updatedAt,
      JSON.stringify(dataset.properties.map((p) => [p.provider, p.id, p.isActive, p.totalMonthly])),
    );
    const value: ServedListings = {
      updatedAt: dataset.updatedAt,
      source: dataset.source,
      neighborhoods: dataset.neighborhoods,
      properties: dataset.properties,
      featureHash,
      servedHash: featureHash,
    };
    neonServedCache = { expiresAt: Date.now() + NEON_SERVED_TTL_MS, value };
    return value;
  }

  const { data: snap } = loadSnapshotFromDiskOrBundle();
  loadPhotosCache();
  const deactivations = loadListingDeactivations();
  const deactivationsSig = JSON.stringify(
    Object.entries(deactivations).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  const sig = `${cachedSnapshotHash}|${mergedPhotosCacheSig}|${deactivationsSig}`;
  if (servedCache && servedCache.sig === sig) return servedCache.value;

  const properties = applyListingDeactivations(getSlimmedSnapshotProps(), deactivations);
  const featureHash = hashContent("served-v1", cachedSnapshotHash, deactivationsSig);
  const value: ServedListings = {
    updatedAt: snap.updatedAt,
    source: "snapshot",
    neighborhoods: (snap.neighborhoods ?? []) as unknown as NeighborhoodEntry[],
    properties,
    featureHash,
    servedHash: hashContent(featureHash, mergedPhotosCacheSig),
  };
  servedCache = { sig, value };
  return value;
}

export async function loadHousingDataset(
  cityFilter?: CityHubCode | "ALL",
): Promise<HousingDatasetPayload> {
  const t0 = performance.now();
  const { data: snap, cacheHit: snapshotCacheHit } =
    loadSnapshotFromDiskOrBundle();
  const snapUpdatedAtMs = snap.updatedAt ? Date.parse(snap.updatedAt) : 0;
  const photosCache = loadPhotosCache();
  const preferencesPromise = loadSharedPreferences();

  const db = getDb();
  if (db && process.env.HOUSING_USE_NEON_PROPERTIES === "true") {
    try {
      const [dbNbs, dbProps, preferences] = await Promise.all([
        db.select().from(schema.neighborhoods),
        cityFilter && cityFilter !== "ALL"
          ? db
              .select()
              .from(schema.properties)
              .where(eq(schema.properties.cityCode, cityFilter))
          : db.select().from(schema.properties),
        preferencesPromise,
      ]);

      if (dbProps.length > 0 && dbNbs.length > 0) {
        const latestDbUpdatedAtMs = dbProps.reduce((maxMs, p) => {
          const ms = p.updatedAt ? new Date(p.updatedAt).getTime() : 0;
          return ms > maxMs ? ms : maxMs;
        }, 0);

        // If local seed-snapshot.json on disk is newer than Neon DB, prefer the local disk snapshot
        const localDiskIsNewer =
          existsSync(/*turbopackIgnore: true*/ LOCAL_SNAPSHOT_FILE) &&
          snapUpdatedAtMs > latestDbUpdatedAtMs + 1000;

        if (!localDiskIsNewer) {
          const resolvedUpdatedAt =
            latestDbUpdatedAtMs > 0
              ? new Date(latestDbUpdatedAtMs).toISOString()
              : snap.updatedAt;
          const mappedProperties = applyListingDeactivations(dbProps.map((p) => {
            const cachedPhotos = photosCache[`${p.provider}:${p.id}`];
            const basePhotos = p.samplePhotos ?? [];
            const resolvedPhotos =
              Array.isArray(cachedPhotos) &&
              cachedPhotos.length >= basePhotos.length &&
              cachedPhotos.length > 0
                ? cachedPhotos
                : basePhotos;
            return {
              provider: p.provider,
              id: p.id,
              cityCode: p.cityCode,
              city: p.city,
              neighborhood: p.neighborhood,
              street: p.street,
              streetNumber: p.streetNumber,
              condominiumName: p.condominiumName,
              doorman: p.doorman,
              url: p.url,
              title: p.title,
              rent: p.rent,
              condoFee: p.condoFee,
              iptu: p.iptu,
              totalMonthly: p.totalMonthly,
              salePrice: p.salePrice,
              areaM2: p.areaM2,
              bedrooms: p.bedrooms,
              suites: p.suites,
              bathrooms: p.bathrooms,
              parkingSpaces: p.parkingSpaces,
              floor: p.floor,
              floorRange: p.floorRange ?? null,
              totalFloors: p.totalFloors,
              furnished: p.furnished,
              acceptsPets: p.acceptsPets,
              nearSubway: p.nearSubway,
              constructionYear: p.constructionYear,
              condition: p.condition,
              installations: p.installations ?? [],
              amenities: p.amenities ?? [],
              comfortCommodities: p.comfortCommodities ?? [],
              practicalityCommodities: p.practicalityCommodities ?? [],
              placesNearby: capRelevantPlaces(p.placesNearby),
              photoCaptions: p.photoCaptions ?? [],
              photosCount: Math.max(
                p.photosCount ?? 0,
                Array.isArray(cachedPhotos) ? cachedPhotos.length : 0,
                basePhotos.length,
              ),
              modernityScore: p.modernityScore,
              modernityTier: p.modernityTier,
              positiveSignals: p.positiveSignals ?? [],
              negativeSignals: p.negativeSignals ?? [],
              samplePhotos: resolvedPhotos.slice(0, MAX_INITIAL_CARD_PHOTOS),
              description: cleanListingText(p.description),
              generatedDescription: p.description
                ? null
                : (p.generatedDescription ?? null),
              sourceSearch: p.sourceSearch,
              isNewEntry: p.isNewEntry,
              publishedAt: p.publishedAt ?? null,
              isActive: p.isActive ?? true,
              deactivatedAt: p.deactivatedAt ?? null,
            };
          }), loadListingDeactivations());
          const activeCount = mappedProperties.filter(
            (p) => p.isActive !== false,
          ).length;
          const deactivatedCount = mappedProperties.length - activeCount;
          const durationMs = Math.round((performance.now() - t0) * 100) / 100;

          logger.info("dataset-store", "loadHousingDataset from neon", {
            source: "neon",
            cityFilter: cityFilter ?? "ALL",
            cacheHit: false,
            neighborhoodsCount: dbNbs.length,
            propertiesCount: mappedProperties.length,
            activeCount,
            deactivatedCount,
            durationMs,
          });

          return {
            updatedAt: resolvedUpdatedAt,
            source: "neon",
            neighborhoods: dbNbs.map((n) => ({
              cityCode: n.cityCode,
              cityName: n.cityName,
              neighborhood: n.neighborhood,
              overallPosition: n.overallPosition,
              cityPosition: n.cityPosition,
              baseScore: n.baseScore,
              idhm: n.idhm,
              commuteTime: n.commuteTime,
              nubankHub: n.nubankHub,
              urbanBreathingScore: n.urbanBreathingScore,
              commuteLogisticsScore: n.commuteLogisticsScore,
              buildingStockFitScore: n.buildingStockFitScore,
              budgetFitScore: n.budgetFitScore,
              safetyCarScore: n.safetyCarScore,
              shortRationale: n.shortRationale,
              detailedJustification: n.detailedJustification,
              pros: n.pros ?? [],
              cons: n.cons ?? [],
            })),
            properties: mappedProperties,
            favorites: preferences.favorites,
            preferences,
          };
        }
      }
    } catch (err) {
      logger.warn(
        "dataset-store",
        "Neon query failed; falling back to snapshot",
        {
          cityFilter: cityFilter ?? "ALL",
          error: err,
        },
      );
    }
  }

  const preferences = await preferencesPromise;

  const slimmed = getSlimmedSnapshotProps();
  const filteredProps = applyListingDeactivations(
    (cityFilter && cityFilter !== "ALL"
      ? slimmed.filter((p) => p.cityCode === cityFilter)
      : slimmed
    ).map((p) => ({
      ...p,
      samplePhotos: p.samplePhotos.slice(0, MAX_INITIAL_CARD_PHOTOS),
    })),
    loadListingDeactivations(),
  );

  const activeCount = filteredProps.filter((p) => p.isActive !== false).length;
  const deactivatedCount = filteredProps.length - activeCount;
  const durationMs = Math.round((performance.now() - t0) * 100) / 100;

  logger.info("dataset-store", "loadHousingDataset from snapshot", {
    source: "snapshot",
    cityFilter: cityFilter ?? "ALL",
    cacheHit: snapshotCacheHit,
    neighborhoodsCount: Array.isArray(snap.neighborhoods)
      ? snap.neighborhoods.length
      : 0,
    propertiesCount: filteredProps.length,
    activeCount,
    deactivatedCount,
    durationMs,
  });

  return {
    updatedAt: snap.updatedAt,
    source: "snapshot",
    neighborhoods: (snap.neighborhoods ??
      []) as unknown as NeighborhoodEntry[],
    properties: filteredProps,
    favorites: preferences.favorites,
    preferences,
  };
}

export { toggleSharedFavorite };

export async function syncBatchToNeon(payload: {
  neighborhoods?: NeighborhoodEntry[];
  properties?: SlimPropertyRecord[];
}): Promise<{
  neighborhoodsUpserted: number;
  propertiesUpserted: number;
}> {
  const db = getDb();
  if (!db) {
    throw new Error(
      "POSTGRES_URL not configured on the server; cannot sync to Neon Postgres.",
    );
  }

  let nbCount = 0;
  let propCount = 0;

  if (payload.neighborhoods && payload.neighborhoods.length > 0) {
    await db
      .insert(schema.neighborhoods)
      .values(
        payload.neighborhoods.map((n) => ({
          cityCode: n.cityCode,
          neighborhood: n.neighborhood,
          cityName: n.cityName,
          overallPosition: n.overallPosition,
          cityPosition: n.cityPosition,
          baseScore: n.baseScore,
          idhm: n.idhm,
          commuteTime: n.commuteTime,
          nubankHub: n.nubankHub,
          urbanBreathingScore: n.urbanBreathingScore,
          commuteLogisticsScore: n.commuteLogisticsScore,
          buildingStockFitScore: n.buildingStockFitScore,
          budgetFitScore: n.budgetFitScore,
          safetyCarScore: n.safetyCarScore,
          shortRationale: n.shortRationale,
          detailedJustification: n.detailedJustification,
          pros: n.pros,
          cons: n.cons,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [
          schema.neighborhoods.cityCode,
          schema.neighborhoods.neighborhood,
        ],
        set: {
          overallPosition: sql`excluded.overall_position`,
          cityPosition: sql`excluded.city_position`,
          baseScore: sql`excluded.base_score`,
          idhm: sql`excluded.idhm`,
          commuteTime: sql`excluded.commute_time`,
          nubankHub: sql`excluded.nubank_hub`,
          urbanBreathingScore: sql`excluded.urban_breathing_score`,
          commuteLogisticsScore: sql`excluded.commute_logistics_score`,
          buildingStockFitScore: sql`excluded.building_stock_fit_score`,
          budgetFitScore: sql`excluded.budget_fit_score`,
          safetyCarScore: sql`excluded.safety_car_score`,
          shortRationale: sql`excluded.short_rationale`,
          detailedJustification: sql`excluded.detailed_justification`,
          pros: sql`excluded.pros`,
          cons: sql`excluded.cons`,
          updatedAt: new Date(),
        },
      });
    nbCount = payload.neighborhoods.length;
  }

  if (payload.properties && payload.properties.length > 0) {
    await db
      .insert(schema.properties)
      .values(
        payload.properties.map((p) => ({
          provider: p.provider,
          id: p.id,
          cityCode: p.cityCode,
          city: p.city,
          neighborhood: p.neighborhood,
          street: p.street,
          streetNumber: p.streetNumber,
          condominiumName: p.condominiumName,
          doorman: p.doorman,
          url: p.url,
          title: p.title,
          rent: p.rent,
          condoFee: p.condoFee,
          iptu: p.iptu,
          totalMonthly: p.totalMonthly,
          salePrice: p.salePrice,
          areaM2: p.areaM2,
          bedrooms: p.bedrooms,
          suites: p.suites,
          bathrooms: p.bathrooms,
          parkingSpaces: p.parkingSpaces,
          floor: p.floor,
          floorRange: p.floorRange,
          totalFloors: p.totalFloors,
          furnished: p.furnished,
          acceptsPets: p.acceptsPets,
          nearSubway: p.nearSubway,
          constructionYear: p.constructionYear,
          condition: p.condition,
          installations: p.installations,
          amenities: p.amenities,
          comfortCommodities: p.comfortCommodities,
          practicalityCommodities: p.practicalityCommodities,
          placesNearby: p.placesNearby,
          photoCaptions: p.photoCaptions,
          photosCount: p.photosCount,
          modernityScore: p.modernityScore,
          modernityTier: p.modernityTier,
          positiveSignals: p.positiveSignals,
          negativeSignals: p.negativeSignals,
          samplePhotos: p.samplePhotos,
          description: p.description,
          generatedDescription: p.generatedDescription,
          sourceSearch: p.sourceSearch,
          isNewEntry: p.isNewEntry,
          publishedAt: p.publishedAt ?? null,
          isActive: p.isActive ?? true,
          deactivatedAt: p.deactivatedAt ?? null,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [schema.properties.provider, schema.properties.id],
        set: {
          cityCode: sql`excluded.city_code`,
          city: sql`excluded.city`,
          neighborhood: sql`excluded.neighborhood`,
          street: sql`excluded.street`,
          streetNumber: sql`excluded.street_number`,
          condominiumName: sql`excluded.condominium_name`,
          doorman: sql`excluded.doorman`,
          url: sql`excluded.url`,
          title: sql`excluded.title`,
          rent: sql`excluded.rent`,
          condoFee: sql`excluded.condo_fee`,
          iptu: sql`excluded.iptu`,
          totalMonthly: sql`excluded.total_monthly`,
          salePrice: sql`excluded.sale_price`,
          areaM2: sql`excluded.area_m2`,
          bedrooms: sql`excluded.bedrooms`,
          suites: sql`excluded.suites`,
          bathrooms: sql`excluded.bathrooms`,
          parkingSpaces: sql`excluded.parking_spaces`,
          floor: sql`excluded.floor`,
          floorRange: sql`excluded.floor_range`,
          totalFloors: sql`excluded.total_floors`,
          furnished: sql`excluded.furnished`,
          acceptsPets: sql`excluded.accepts_pets`,
          nearSubway: sql`excluded.near_subway`,
          constructionYear: sql`excluded.construction_year`,
          condition: sql`excluded.condition`,
          installations: sql`excluded.installations`,
          amenities: sql`excluded.amenities`,
          comfortCommodities: sql`excluded.comfort_commodities`,
          practicalityCommodities: sql`excluded.practicality_commodities`,
          placesNearby: sql`excluded.places_nearby`,
          photoCaptions: sql`excluded.photo_captions`,
          photosCount: sql`excluded.photos_count`,
          modernityScore: sql`excluded.modernity_score`,
          modernityTier: sql`excluded.modernity_tier`,
          positiveSignals: sql`excluded.positive_signals`,
          negativeSignals: sql`excluded.negative_signals`,
          samplePhotos: sql`excluded.sample_photos`,
          description: sql`excluded.description`,
          generatedDescription: sql`excluded.generated_description`,
          sourceSearch: sql`excluded.source_search`,
          isNewEntry: sql`excluded.is_new_entry`,
          publishedAt: sql`excluded.published_at`,
          isActive: sql`excluded.is_active`,
          deactivatedAt: sql`excluded.deactivated_at`,
          updatedAt: new Date(),
        },
      });
    propCount = payload.properties.length;
  }

  return {
    neighborhoodsUpserted: nbCount,
    propertiesUpserted: propCount,
  };
}
