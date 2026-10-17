import { loadHousingDataset } from "@/lib/dataset-store";
import { logger } from "@/lib/logger";
import type { CityHubCode } from "@/types/housing";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const t0 = performance.now();
  const { searchParams } = new URL(request.url);
  const rawCity = searchParams.get("city")?.toUpperCase();
  const cityFilter: CityHubCode | "ALL" =
    rawCity === "BH" ||
    rawCity === "CP" ||
    rawCity === "SP" ||
    rawCity === "RJ" ||
    rawCity === "BSB"
      ? rawCity
      : "ALL";

  try {
    const data = await loadHousingDataset(cityFilter);
    const activeCount = data.properties.filter(
      (p) => p.isActive !== false,
    ).length;
    const deactivatedCount = data.properties.length - activeCount;
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;

    logger.info("api/dataset", "GET completed", {
      source: data.source,
      cityFilter,
      neighborhoodsCount: data.neighborhoods.length,
      propertiesCount: data.properties.length,
      activeCount,
      deactivatedCount,
      favoritesCount: (data.favorites ?? []).length,
      durationMs,
    });

    return NextResponse.json(data);
  } catch (err) {
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.error("api/dataset", "GET failed", {
      cityFilter,
      durationMs,
      error: err,
    });
    throw err;
  }
}
