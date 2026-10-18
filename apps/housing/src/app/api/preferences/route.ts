import { parseJsonBody, preferencesSaveSchema } from "@/lib/api-guards";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  loadSharedPreferences,
  saveSharedPreferences,
  wasLastPreferencesLoadedFromDb,
} from "@/lib/preferences-store";
import type { ScoringWeights } from "@/types/housing";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function extractActiveCities(filters: Record<string, unknown> | undefined): unknown {
  if (!filters || typeof filters !== "object") return ["ALL"];
  if (Array.isArray(filters.selectedCities) && filters.selectedCities.length > 0) {
    return filters.selectedCities;
  }
  if (Array.isArray(filters.activeCities) && filters.activeCities.length > 0) {
    return filters.activeCities;
  }
  if (typeof filters.selectedCity === "string" && filters.selectedCity.trim()) {
    return [filters.selectedCity.trim()];
  }
  if (typeof filters.cityFilter === "string" && filters.cityFilter.trim()) {
    return [filters.cityFilter.trim()];
  }
  return ["ALL"];
}

function preferencesEtag(updatedAt: string): string {
  return `W/"prefs-${updatedAt}"`;
}

export async function GET(request: Request) {
  const t0 = performance.now();
  try {
    const preferences = await loadSharedPreferences();
    const persistedToDb = wasLastPreferencesLoadedFromDb();
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    const etag = preferencesEtag(preferences.updatedAt);
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { "Cache-Control": "no-store, max-age=0", ETag: etag },
      });
    }

    logger.info("api/preferences", "GET completed", {
      method: "GET",
      schemaVersion: preferences.schemaVersion ?? 2,
      persistedToDb,
      activePresetId: preferences.activePresetId,
      activeCities: extractActiveCities(preferences.filters),
      favoritesCount: preferences.favorites.length,
      durationMs,
    });

    return NextResponse.json(
      {
        ok: true,
        persistedToDb,
        preferences,
      },
      { headers: { "Cache-Control": "no-store, max-age=0", ETag: etag } },
    );
  } catch (err) {
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.error("api/preferences", "GET failed", {
      method: "GET",
      durationMs,
      error: err,
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro ao carregar preferências compartilhadas.",
      },
      { status: 500 },
    );
  }
}

async function handleSave(request: Request) {
  const t0 = performance.now();
  const method = request.method || "POST";
  const unauthorized = requireAuth(request);
  if (unauthorized) return unauthorized;
  try {
    const parsedBody = await parseJsonBody(request, preferencesSaveSchema);
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data as typeof parsedBody.data & {
      weights?: Partial<ScoringWeights>;
    };

    const dbConfigured = Boolean(
      (process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "").trim(),
    );
    const saved = await saveSharedPreferences({
      filters: body.filters,
      weights: body.weights,
      activePresetId: body.activePresetId,
      favorites: body.favorites,
      savedViews: body.savedViews?.map((v) => ({ ...v, createdAt: v.createdAt ?? new Date().toISOString() })),
      clientUpdatedAt: body.clientUpdatedAt,
    });
    const { persistedToDb: rawPersistedToDb, ...preferences } = saved;
    const persistedToDb = dbConfigured ? rawPersistedToDb : true;
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;

    logger.info("api/preferences", `${method} completed`, {
      method,
      schemaVersion: preferences.schemaVersion ?? 2,
      persistedToDb,
      dbConfigured,
      activePresetId: preferences.activePresetId,
      activeCities: extractActiveCities(preferences.filters),
      favoritesCount: preferences.favorites.length,
      durationMs,
    });

    return NextResponse.json(
      { ok: true, persistedToDb, dbConfigured, preferences },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.error("api/preferences", `${method} failed`, {
      method,
      durationMs,
      error: err,
    });
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro ao salvar preferências compartilhadas.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return handleSave(request);
}

export async function PUT(request: Request) {
  return handleSave(request);
}
