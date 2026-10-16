import {
  loadSharedPreferences,
  saveSharedPreferences,
} from "@/lib/preferences-store";
import type { ScoringWeights } from "@/types/moradia";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const preferences = await loadSharedPreferences();
    return NextResponse.json(
      { ok: true, preferences },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
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
  try {
    const body = (await request.json()) as {
      filters?: Record<string, unknown>;
      weights?: Partial<ScoringWeights>;
      activePresetId?: string;
      favorites?: string[];
      compareKeys?: string[];
    };

    const preferences = await saveSharedPreferences({
      filters: body.filters,
      weights: body.weights,
      activePresetId: body.activePresetId,
      favorites: body.favorites,
      compareKeys: body.compareKeys,
    });

    return NextResponse.json(
      { ok: true, preferences },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
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
