import { loadMoradiaDataset } from "@/lib/dataset-store";
import type { CityHubCode } from "@/types/moradia";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCity = searchParams.get("city")?.toUpperCase();
  const cityFilter: CityHubCode | "ALL" =
    rawCity === "BH" || rawCity === "CP" || rawCity === "SP" || rawCity === "RJ"
      ? rawCity
      : "ALL";

  const data = await loadMoradiaDataset(cityFilter);
  return NextResponse.json(data);
}
