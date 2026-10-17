import { logger } from "@/lib/logger";
import {
  loadSharedPreferences,
  toggleSharedFavorite,
  wasLastPreferencesLoadedFromDb,
} from "@/lib/preferences-store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = performance.now();
  const prefs = await loadSharedPreferences();
  const persistedToDb = wasLastPreferencesLoadedFromDb();
  const durationMs = Math.round((performance.now() - t0) * 100) / 100;

  logger.info("api/favorites", "GET completed", {
    favoritesCount: prefs.favorites.length,
    persistedToDb,
    updatedAt: prefs.updatedAt,
    durationMs,
  });

  return NextResponse.json(
    { favorites: prefs.favorites, updatedAt: prefs.updatedAt },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(request: Request) {
  const t0 = performance.now();
  try {
    const body = (await request.json()) as {
      key?: string;
      favorite?: boolean;
    };

    if (!body.key || typeof body.key !== "string" || !body.key.trim()) {
      const durationMs = Math.round((performance.now() - t0) * 100) / 100;
      logger.warn("api/favorites", "POST rejected invalid key", {
        key: body.key ?? null,
        durationMs,
      });
      return NextResponse.json(
        { ok: false, error: "Chave do imóvel inválida." },
        { status: 400 },
      );
    }

    const trimmedKey = body.key.trim();
    const favorites = await toggleSharedFavorite(trimmedKey, body.favorite);
    const persistedToDb = wasLastPreferencesLoadedFromDb();
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;

    logger.info("api/favorites", "POST toggled favorite", {
      key: trimmedKey,
      requestedFavorite: body.favorite ?? "toggle",
      isNowFavorited: favorites.includes(trimmedKey),
      favoritesCount: favorites.length,
      persistedToDb,
      durationMs,
    });

    return NextResponse.json(
      { ok: true, favorites },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.error("api/favorites", "POST failed", {
      durationMs,
      error: err,
    });
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erro ao salvar favorito.",
      },
      { status: 500 },
    );
  }
}
