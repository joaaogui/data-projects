import "server-only";

import { getDb, schema } from "@/db";
import {
  loadSharedPreferences,
  toggleSharedFavorite,
} from "@/lib/preferences-store";
import type {
  CityHubCode,
  MoradiaDatasetPayload,
  NeighborhoodEntry,
  SlimPropertyRecord,
} from "@/types/moradia";
import { eq, sql } from "drizzle-orm";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const LOCAL_SNAPSHOT_FILE = join(process.cwd(), "src/data/seed-snapshot.json");
const FALLBACK_SNAPSHOT_FILE = join(
  process.cwd(),
  "apps/moradia/src/data/seed-snapshot.json",
);
const LOCAL_FAVORITES_FILE = join(process.cwd(), "src/data/favorites.json");
const TMP_FAVORITES_FILE = join(tmpdir(), "moradia-favorites.json");
const LOCAL_PHOTOS_CACHE_FILE = join(process.cwd(), "src/data/photos-cache.json");
const FALLBACK_PHOTOS_CACHE_FILE = join(
  process.cwd(),
  "apps/moradia/src/data/photos-cache.json",
);
const TMP_PHOTOS_CACHE_FILE = join(tmpdir(), "moradia-photos-cache.json");

type PhotosCacheMap = Record<string, Array<{ room: string | null; url: string }>>;

function readPhotosCacheFile(filePath: string): PhotosCacheMap {
  if (!existsSync(/*turbopackIgnore: true*/ filePath)) return {};
  try {
    const raw = JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ filePath, "utf8"),
    ) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as PhotosCacheMap;
    }
    return {};
  } catch {
    return {};
  }
}

function loadPhotosCache(): PhotosCacheMap {
  return {
    ...readPhotosCacheFile(FALLBACK_PHOTOS_CACHE_FILE),
    ...readPhotosCacheFile(LOCAL_PHOTOS_CACHE_FILE),
    ...readPhotosCacheFile(TMP_PHOTOS_CACHE_FILE),
  };
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

function loadSnapshotFromDiskOrBundle(): SeedSnapshotData {
  for (const candidate of [LOCAL_SNAPSHOT_FILE, FALLBACK_SNAPSHOT_FILE]) {
    if (existsSync(/*turbopackIgnore: true*/ candidate)) {
      try {
        return JSON.parse(
          readFileSync(/*turbopackIgnore: true*/ candidate, "utf8"),
        ) as SeedSnapshotData;
      } catch {
        // try next
      }
    }
  }
  return { updatedAt: new Date(0).toISOString(), neighborhoods: [], properties: [] };
}

export async function loadMoradiaDataset(
  cityFilter?: CityHubCode | "ALL",
): Promise<MoradiaDatasetPayload> {
  const snap = loadSnapshotFromDiskOrBundle();
  const snapUpdatedAtMs = snap.updatedAt ? Date.parse(snap.updatedAt) : 0;
  const photosCache = loadPhotosCache();
  const preferencesPromise = loadSharedPreferences();

  const db = getDb();
  if (db && process.env.MORADIA_USE_NEON_PROPERTIES === "true") {
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
            properties: dbProps.map((p) => {
              const cachedPhotos = photosCache[`${p.provider}:${p.id}`];
              const basePhotos = p.samplePhotos ?? [];
              const resolvedPhotos =
                Array.isArray(cachedPhotos) && cachedPhotos.length > basePhotos.length
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
                placesNearby: p.placesNearby ?? [],
                photoCaptions: p.photoCaptions ?? [],
                photosCount: Math.max(p.photosCount ?? 0, resolvedPhotos.length),
                modernityScore: p.modernityScore,
                modernityTier: p.modernityTier,
                positiveSignals: p.positiveSignals ?? [],
                negativeSignals: p.negativeSignals ?? [],
                samplePhotos: resolvedPhotos,
                description: p.description,
                generatedDescription: p.generatedDescription,
                sourceSearch: p.sourceSearch,
                isNewEntry: p.isNewEntry,
                isActive: p.isActive ?? true,
                deactivatedAt: p.deactivatedAt ?? null,
              };
            }),
            favorites: preferences.favorites,
            preferences,
          };
        }
      }
    } catch {
      // Fallback to seed-snapshot.json when Neon schema isn't migrated yet
    }
  }

  const preferences = await preferencesPromise;
  const allProps = ((snap.properties ??
    []) as unknown as SlimPropertyRecord[]).map((p) => {
    const cachedPhotos = photosCache[`${p.provider}:${p.id}`];
    const basePhotos = p.samplePhotos ?? [];
    const resolvedPhotos =
      Array.isArray(cachedPhotos) && cachedPhotos.length > basePhotos.length
        ? cachedPhotos
        : basePhotos;
    return {
      ...p,
      photosCount: Math.max(p.photosCount ?? 0, resolvedPhotos.length),
      samplePhotos: resolvedPhotos,
      isActive: p.isActive ?? true,
      deactivatedAt: p.deactivatedAt ?? null,
    };
  });
  const filteredProps =
    cityFilter && cityFilter !== "ALL"
      ? allProps.filter((p) => p.cityCode === cityFilter)
      : allProps;

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
          isActive: p.isActive ?? true,
          deactivatedAt: p.deactivatedAt ?? null,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [schema.properties.provider, schema.properties.id],
        set: {
          cityCode: sql`excluded.city_code`,
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
          isNewEntry: sql`excluded.is_new_entry`,
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
