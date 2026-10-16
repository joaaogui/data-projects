import { loadFavorites, toggleFavoriteInStore } from "@/lib/dataset-store";
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ favorites: loadFavorites() });
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

    const favorites = toggleFavoriteInStore(body.key, body.favorite);
    return NextResponse.json({ ok: true, favorites });
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
