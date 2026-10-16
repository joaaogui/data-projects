import {
  buildAddressCacheKey,
  isCoordinateInsideCityBox,
  type PropertyCoordinate,
  resolveInstantPropertyCoordinate,
} from "@/lib/geocoding";
import type { CityHubCode } from "@/types/moradia";
import { NextResponse } from "next/server";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const GEOCACHE_FILE = join(process.cwd(), "src/data/geocache.json");
const TMP_GEOCACHE_FILE = join(tmpdir(), "moradia-geocache.json");

interface CachedGeoEntry {
  lat: number;
  lng: number;
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

function readGeoCacheFile(filePath: string): GeoCacheMap {
  if (!existsSync(/*turbopackIgnore: true*/ filePath)) return {};
  try {
    const raw = JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ filePath, "utf8"),
    ) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as GeoCacheMap;
    }
    return {};
  } catch {
    return {};
  }
}

function loadGeoCache(): GeoCacheMap {
  return {
    ...readGeoCacheFile(GEOCACHE_FILE),
    ...readGeoCacheFile(TMP_GEOCACHE_FILE),
  };
}

function saveGeoCache(cache: GeoCacheMap): void {
  const serialized = `${JSON.stringify(cache, null, 2)}\n`;
  try {
    mkdirSync(dirname(GEOCACHE_FILE), { recursive: true });
    writeFileSync(GEOCACHE_FILE, serialized, "utf8");
  } catch {
    // Ignore read-only filesystem errors in serverless environments
  }
  try {
    writeFileSync(TMP_GEOCACHE_FILE, serialized, "utf8");
  } catch {
    // Ignore /tmp write errors
  }
}

const STATE_BY_CITY: Record<CityHubCode, string> = {
  BH: "Minas Gerais",
  RJ: "Rio de Janeiro",
  CP: "São Paulo",
  SP: "São Paulo",
  BSB: "Distrito Federal",
};

async function queryOsmGeocoder(
  item: GeocodeRequestItem,
): Promise<{ lat: number; lng: number } | null> {
  const streetClean = item.street.trim();
  if (!streetClean) return null;

  const numPart = item.streetNumber ? ` ${item.streetNumber.trim()}` : "";
  const query = `${streetClean}${numPart}, ${item.neighborhood}, ${item.city}, ${STATE_BY_CITY[item.cityCode]}, Brasil`;

  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(photonUrl, {
      headers: {
        "User-Agent": "MoradiaRadarPortal/1.0 (internal-relocation-tool)",
      },
      signal: AbortSignal.timeout(2200),
    });
    if (res.ok) {
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
        "User-Agent": "MoradiaRadarPortal/1.0 (internal-relocation-tool)",
      },
      signal: AbortSignal.timeout(2200),
    });
    if (res.ok) {
      const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
      const first = data[0];
      if (first?.lat && first?.lon) {
        const lat = Number.parseFloat(first.lat);
        const lng = Number.parseFloat(first.lon);
        if (isCoordinateInsideCityBox(item.cityCode, lat, lng)) {
          return {
            lat: Number(lat.toFixed(6)),
            lng: Number(lng.toFixed(6)),
          };
        }
      }
    }
  } catch {
    // Ignore network timeout / offline mode
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { items?: GeocodeRequestItem[] };
    const items = Array.isArray(body.items) ? body.items.slice(0, 35) : [];

    const cache = loadGeoCache();
    let cacheMutated = false;
    const coordinates: Record<string, PropertyCoordinate> = {};

    let liveLookupsRemaining = 6;

    for (const item of items) {
      if (!item?.key || !item?.cityCode) continue;
      const addrKey = buildAddressCacheKey(item);
      const cached = cache[addrKey];

      if (
        cached &&
        isCoordinateInsideCityBox(item.cityCode, cached.lat, cached.lng)
      ) {
        coordinates[item.key] = {
          lat: cached.lat,
          lng: cached.lng,
          source: "cache",
        };
        continue;
      }

      const instant = resolveInstantPropertyCoordinate(item);
      if (instant.source === "street") {
        coordinates[item.key] = instant;
        continue;
      }

      if (liveLookupsRemaining > 0 && item.street.trim().length > 3) {
        liveLookupsRemaining -= 1;
        const resolved = await queryOsmGeocoder(item);
        if (resolved) {
          cache[addrKey] = {
            lat: resolved.lat,
            lng: resolved.lng,
            updatedAt: new Date().toISOString(),
          };
          cacheMutated = true;
          coordinates[item.key] = {
            lat: resolved.lat,
            lng: resolved.lng,
            source: "nominatim",
          };
          continue;
        }
      }

      coordinates[item.key] = instant;
    }

    if (cacheMutated) {
      saveGeoCache(cache);
    }

    return NextResponse.json({ ok: true, coordinates });
  } catch {
    return NextResponse.json({ ok: false, coordinates: {} }, { status: 200 });
  }
}
