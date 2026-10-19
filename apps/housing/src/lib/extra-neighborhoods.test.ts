import { describe, expect, it } from "vitest";

import researchFile from "@/data/neighborhood-research.json";
import snapshot from "@/data/seed-snapshot.json";
import { filterVisibleCities } from "@/lib/city-config";
import { buildExtraNeighborhoods } from "@/lib/extra-neighborhoods";
import {
  computeDynamicNeighborhoods,
  computeWeightedNeighborhoodScore,
  DEFAULT_WEIGHTS,
  NEIGHBORHOOD_SAFETY_AND_METRICS,
  normalizeNeighborhoodKey,
} from "@/lib/scoring-engine";
import type { CityHubCode, NeighborhoodEntry } from "@/types/housing";
import type { NeighborhoodResearchFile } from "@/types/neighborhood-research";

const SNAPSHOT = snapshot as unknown as {
  neighborhoods: NeighborhoodEntry[];
  properties: { cityCode: CityHubCode; neighborhood: string; isActive?: boolean }[];
};
const CATALOG = SNAPSHOT.neighborhoods;

const keyOf = (n: { cityCode: CityHubCode; neighborhood: string }) =>
  `${n.cityCode}:${normalizeNeighborhoodKey(n.neighborhood, n.cityCode)}`;

const RESEARCH = researchFile as unknown as NeighborhoodResearchFile;
/** Same rule as the server: a compiled dossier (directly or via an alias) with a rubric; references excluded. */
function hasRubric(city: CityHubCode, name: string): boolean {
  const key = `${city}:${name}`;
  if (key === "GO:Setor Marista" || key === "BSB:Águas Claras") return false;
  return Boolean(RESEARCH.dossiers[RESEARCH.aliases?.[key] ?? key]?.rubric);
}
const EXTRAS = buildExtraNeighborhoods(CATALOG, SNAPSHOT.properties, hasRubric);
const anyResearch = () => true;

function catalogEntry(cityCode: CityHubCode, neighborhood: string): NeighborhoodEntry {
  return { ...CATALOG[0]!, cityCode, neighborhood };
}

describe("buildExtraNeighborhoods", () => {
  it("adds only table neighbourhoods with an active listing", () => {
    const extras = buildExtraNeighborhoods(
      [catalogEntry("BH", "Lourdes")],
      [
        { cityCode: "BH", neighborhood: "Carmo" },
        { cityCode: "BH", neighborhood: "Gutierrez", isActive: false },
        { cityCode: "BH", neighborhood: "Bairro Sem Tabela" },
        { cityCode: "BH", neighborhood: "Lourdes" },
      ],
      anyResearch,
    );
    expect(extras.map((n) => n.neighborhood)).toEqual(["Carmo"]);
    const m = NEIGHBORHOOD_SAFETY_AND_METRICS["BH:Carmo"]!;
    expect(extras[0]).toMatchObject({
      isExtra: true,
      commuteTime: "8-20 min",
      urbanBreathingScore: m.urbanBreathing,
      commuteLogisticsScore: m.commuteLogistics,
      buildingStockFitScore: m.buildingStock,
      budgetFitScore: m.budgetFit,
      safetyCarScore: m.safetyCar,
      overallPosition: 2,
    });
  });

  it("excludes neighbourhoods without research instead of padding the list", () => {
    const extras = buildExtraNeighborhoods(
      [catalogEntry("BH", "Lourdes")],
      [
        { cityCode: "BH", neighborhood: "Carmo" },
        { cityCode: "BH", neighborhood: "Anchieta" },
        { cityCode: "RJ", neighborhood: "Urca" },
      ],
      (city, name) => `${city}:${name}` === "BH:Carmo",
    );
    expect(extras.map((n) => n.neighborhood)).toEqual(["Carmo"]);
  });

  it("skips aliases of catalog rows and collapses alias rows into one entry", () => {
    const extras = buildExtraNeighborhoods(
      [catalogEntry("CP", "Jd. Guanabara"), catalogEntry("RJ", "Botafogo (Orla)")],
      [
        { cityCode: "CP", neighborhood: "Jardim Guanabara" },
        { cityCode: "CP", neighborhood: "Guanabara" },
        { cityCode: "RJ", neighborhood: "Botafogo" },
        { cityCode: "RJ", neighborhood: "Barra da Tijuca" },
        { cityCode: "RJ", neighborhood: "Jardim Oceanico" },
        { cityCode: "RJ", neighborhood: "Grajau" },
        { cityCode: "RJ", neighborhood: "Grajaú" },
        { cityCode: "SP", neighborhood: "Pompéia" },
        { cityCode: "SP", neighborhood: "Vila Pompéia" },
        { cityCode: "CP", neighborhood: "Botafogo" },
      ],
      anyResearch,
    );
    expect(extras.map((n) => `${n.cityCode}:${n.neighborhood}`).sort()).toEqual(
      ["CP:Botafogo", "RJ:Grajaú", "RJ:Jd. Oceânico", "SP:Pompeia"].sort(),
    );
  });

  it("has no duplicates against the catalog or among themselves on the seed snapshot", () => {
    const keys = [...CATALOG, ...EXTRAS].map(keyOf);
    expect(new Set(keys).size).toBe(keys.length);
    expect(EXTRAS.every((n) => n.isExtra)).toBe(true);
    expect(CATALOG.some((n) => n.isExtra)).toBe(false);
  });

  it("only keeps researched neighbourhoods (with rubric) on the seed snapshot, never the references", () => {
    expect(EXTRAS.length).toBeGreaterThan(0);
    expect(EXTRAS.every((n) => hasRubric(n.cityCode, n.neighborhood))).toBe(true);
    expect(EXTRAS.some((n) => n.neighborhood === "Águas Claras")).toBe(false);
    // Unresearched table neighbourhoods with listings stay out (Urca/Anchieta are in the table, no dossier yet)
    const unresearched = buildExtraNeighborhoods(CATALOG, SNAPSHOT.properties, anyResearch).filter(
      (n) => !hasRubric(n.cityCode, n.neighborhood),
    );
    expect(unresearched.length).toBeGreaterThan(0);
    for (const n of unresearched) expect(EXTRAS.map(keyOf)).not.toContain(keyOf(n));
  });
});

describe("ranking tab list (catalog + researched extras, seed snapshot)", () => {
  const visible = filterVisibleCities([...CATALOG, ...EXTRAS], []);
  const ranked = computeDynamicNeighborhoods(visible, DEFAULT_WEIGHTS).ranked;

  it("keeps SP and BSB out with the hidden cities off, and SP extras in when enabled", () => {
    expect(ranked.some((n) => n.cityCode === "SP" || n.cityCode === "BSB")).toBe(false);
    expect(new Set(ranked.map(keyOf)).size).toBe(ranked.length);
    const withSp = filterVisibleCities([...CATALOG, ...EXTRAS], ["SP"]);
    expect(withSp.some((n) => n.cityCode === "SP" && n.isExtra)).toBe(true);
  });

  it("ranks extras by the same weighted score as the catalog, sorted descending", () => {
    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1]!.dynamicScore).toBeGreaterThanOrEqual(ranked[i]!.dynamicScore);
    }
    const extra = ranked.find((n) => n.isExtra)!;
    expect(extra.dynamicScore).toBe(
      computeWeightedNeighborhoodScore(
        {
          urbanBreathing: extra.urbanBreathingScore,
          commuteLogistics: extra.commuteLogisticsScore,
          buildingStock: extra.buildingStockFitScore,
          budgetFit: extra.budgetFitScore,
          safetyCar: extra.safetyCarScore,
        },
        DEFAULT_WEIGHTS,
      ),
    );
  });

  it("leaves the catalog-only ranking used for listing scores unchanged", () => {
    const catalogOnly = computeDynamicNeighborhoods(filterVisibleCities(CATALOG, []), DEFAULT_WEIGHTS).ranked;
    expect(ranked.filter((n) => !n.isExtra).map((n) => [n.neighborhood, n.dynamicScore])).toEqual(
      catalogOnly.map((n) => [n.neighborhood, n.dynamicScore]),
    );
  });
});
