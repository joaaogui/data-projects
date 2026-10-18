import {
  buildAddressCacheKey,
  isCoordinateInsideCityBox,
  type PropertyCoordinate,
  resolveInstantPropertyCoordinate,
} from "@/lib/geocoding";
import { enforceRateLimit, geocodeSchema, parseJsonBody } from "@/lib/api-guards";
import { logger } from "@/lib/logger";
import { createRuntimeKv } from "@/lib/runtime-kv";
import type { CityHubCode } from "@/types/housing";
import { NextResponse } from "next/server";

interface CachedGeoEntry {
  lat: number;
  lng: number;
  source?: "nominatim" | "cache";
  updatedAt: string;
}

type GeoCacheMap = Record<string, CachedGeoEntry>;

interface GeocodeRequestItem {
  key: string;
  cityCode: CityHubCode;
  city: string;
  neighborhood: string;
  street: string;
  streetNumber: string | null;
}

const geoStore = createRuntimeKv<CachedGeoEntry>("geocode", 5 * 60_000);

const STATE_BY_CITY: Record<CityHubCode, string> = {
  BH: "Minas Gerais",
  RJ: "Rio de Janeiro",
  CP: "São Paulo",
  SP: "São Paulo",
  BSB: "Distrito Federal",
};

const NEGATIVE_RETRY_COOLDOWN_MS = 60_000;
const negativeGeocodeCooldownUntil = new Map<string, number>();
const unfoundOsmAddresses = new Set<string>();

async function queryOsmGeocoder(
  item: GeocodeRequestItem,
): Promise<
  | { status: "found"; lat: number; lng: number }
  | { status: "not_found" }
  | { status: "transient_error" }
> {
  const streetClean = item.street.trim();
  if (!streetClean) return { status: "not_found" };

  const numPart = item.streetNumber ? ` ${item.streetNumber.trim()}` : "";
  const query = `${streetClean}${numPart}, ${item.neighborhood}, ${item.city}, ${STATE_BY_CITY[item.cityCode]}, Brasil`;
  let receivedDefinitiveEmptyResponse = false;

  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(photonUrl, {
      headers: {
        "User-Agent": "HousingPortal/1.0 (internal-relocation-tool)",
      },
      signal: AbortSignal.timeout(2200),
    });
    if (res.ok) {
      receivedDefinitiveEmptyResponse = true;
      const data = (await res.json()) as {
        features?: Array<{
          geometry?: { coordinates?: [number, number] };
        }>;
      };
      const coords = data.features?.[0]?.geometry?.coordinates;
      if (coords && coords.length === 2) {
        const [lng, lat] = coords;
        if (isCoordinateInsideCityBox(item.cityCode, lat, lng)) {
          return {
            status: "found",
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
          };
        }
      }
    }
  } catch {
    // Fallback to Nominatim or instant local coordinate
  }

  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
    const res = await fetch(nominatimUrl, {
      headers: {
        "User-Agent": "HousingPortal/1.0 (internal-relocation-tool)",
      },
      signal: AbortSignal.timeout(2200),
    });
    if (res.ok) {
      receivedDefinitiveEmptyResponse = true;
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      const first = data[0];
      if (first?.lat && first?.lon) {
        const lat = Number.parseFloat(first.lat);
        const lng = Number.parseFloat(first.lon);
        if (isCoordinateInsideCityBox(item.cityCode, lat, lng)) {
          return {
            status: "found",
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
          };
        }
      }
    }
  } catch {
    // Ignore network timeout / offline mode
  }

  return receivedDefinitiveEmptyResponse
    ? { status: "not_found" }
    : { status: "transient_error" };
}

export async function POST(request: Request) {
  const t0 = performance.now();
  try {
    const limited = enforceRateLimit(request, "geocode", 90, 60_000);
    if (limited) return limited;
    const parsedBody = await parseJsonBody(request, geocodeSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const items: GeocodeRequestItem[] = parsedBody.data.items.slice(0, 35);

    const cache = Object.fromEntries(await geoStore.all()) as GeoCacheMap;
    const resolvedEntries: Array<[string, CachedGeoEntry]> = [];
    const coordinates: Record<string, PropertyCoordinate> = {};

    const MAX_LIVE_LOOKUPS_PER_REQUEST = 6;
    let liveLookupsRemaining = MAX_LIVE_LOOKUPS_PER_REQUEST;
    let cacheHits = 0;
    let liveLookups = 0;
    let streetApproximations = 0;
    let neighborhoodFallbacks = 0;
    let finalCount = 0;
    let pendingCount = 0;
    let deferredByBudgetCount = 0;

    const recordFallbackStats = (
      instant: PropertyCoordinate,
      isFinal: boolean,
    ) => {
      if (instant.source === "street") streetApproximations++;
      else neighborhoodFallbacks++;
      if (isFinal) finalCount++;
      else pendingCount++;
    };

    for (const item of items) {
      if (!item?.key || !item?.cityCode) continue;
      const addrKey = buildAddressCacheKey(item);
      const cached = cache[addrKey];

      if (
        cached &&
        isCoordinateInsideCityBox(item.cityCode, cached.lat, cached.lng)
      ) {
        cacheHits++;
        finalCount++;
        coordinates[item.key] = {
          lat: cached.lat,
          lng: cached.lng,
          source: "cache",
          final: true,
        };
        continue;
      }

      const instant = resolveInstantPropertyCoordinate(item);
      const canAttemptLiveLookup =
        item.street.trim().length > 3 && !unfoundOsmAddresses.has(addrKey);
      if (!canAttemptLiveLookup) {
        recordFallbackStats(instant, true);
        coordinates[item.key] = {
          ...instant,
          final: true,
        };
        continue;
      }

      const nowMs = Date.now();
      const cooldownUntil = negativeGeocodeCooldownUntil.get(addrKey) ?? 0;
      if (cooldownUntil > nowMs) {
        recordFallbackStats(instant, false);
        coordinates[item.key] = {
          ...instant,
          final: false,
        };
        continue;
      }

      if (liveLookupsRemaining > 0) {
        liveLookupsRemaining -= 1;
        liveLookups++;
        const resolved = await queryOsmGeocoder(item);
        if (resolved.status === "found") {
          negativeGeocodeCooldownUntil.delete(addrKey);
          const entry: CachedGeoEntry = {
            lat: resolved.lat,
            lng: resolved.lng,
            source: "nominatim",
            updatedAt: new Date().toISOString(),
          };
          cache[addrKey] = entry;
          resolvedEntries.push([addrKey, entry]);
          finalCount++;
          coordinates[item.key] = {
            lat: resolved.lat,
            lng: resolved.lng,
            source: "nominatim",
            final: true,
          };
          continue;
        }
        if (resolved.status === "not_found") {
          unfoundOsmAddresses.add(addrKey);
          negativeGeocodeCooldownUntil.delete(addrKey);
          recordFallbackStats(instant, true);
          coordinates[item.key] = {
            ...instant,
            final: true,
          };
          continue;
        }
        negativeGeocodeCooldownUntil.set(
          addrKey,
          Date.now() + NEGATIVE_RETRY_COOLDOWN_MS,
        );
        recordFallbackStats(instant, false);
        coordinates[item.key] = {
          ...instant,
          final: false,
        };
        continue;
      }

      deferredByBudgetCount++;
      recordFallbackStats(instant, false);
      coordinates[item.key] = {
        ...instant,
        final: false,
      };
    }

    await Promise.all(
      resolvedEntries.map(([addrKey, entry]) =>
        geoStore.set(addrKey, entry).catch((err: unknown) => {
          logger.warn("api/geocode", "saving geocode result failed", { addrKey, error: err });
        }),
      ),
    );

    const nextRetryDelayMs =
      pendingCount === 0
        ? null
        : deferredByBudgetCount > 0
          ? 800
          : NEGATIVE_RETRY_COOLDOWN_MS;

    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.info("api/geocode", "POST completed", {
      requestedCount: items.length,
      cacheHits,
      liveLookups,
      streetApproximations,
      neighborhoodFallbacks,
      finalCount,
      pendingCount,
      durationMs,
    });

    return NextResponse.json({ ok: true, coordinates, nextRetryDelayMs });
  } catch (err) {
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.error("api/geocode", "POST failed", {
      durationMs,
      error: err,
    });
    return NextResponse.json({ ok: false, coordinates: {} }, { status: 200 });
  }
}
