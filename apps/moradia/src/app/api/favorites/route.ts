import {
  loadSharedPreferences,
  toggleSharedFavorite,
} from "@/lib/preferences-store";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const prefs = await loadSharedPreferences();
  return NextResponse.json(
    { favorites: prefs.favorites, updatedAt: prefs.updatedAt },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      key?: string;
      favorite?: boolean;
    };

    if (!body.key || typeof body.key !== "string" || !body.key.trim()) {
      return NextResponse.json(
        { ok: false, error: "Chave do imóvel inválida." },
        { status: 400 },
      );
    }

    const favorites = await toggleSharedFavorite(body.key, body.favorite);
    return NextResponse.json(
      { ok: true, favorites },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erro ao salvar favorito.",
      },
      { status: 500 },
    );
  }
}
