import { describe, expect, it } from "vitest";

import rationalesSource from "@/data/neighborhood-rationales.json";
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

describe("ranking-tab rationales (src/data/neighborhood-rationales.json)", () => {
  const RATIONALES = RESEARCH.rationales ?? {};
  const rationaleFor = (city: CityHubCode, name: string) => RATIONALES[`${city}:${name}`] ?? null;
  // A listing in every table neighbourhood: each researched row that live data could turn into an extra
  const everyTableRow = Object.entries(NEIGHBORHOOD_SAFETY_AND_METRICS).map(([key, m]) => ({
    cityCode: m.cityCode,
    neighborhood: key.slice(key.indexOf(":") + 1),
  }));
  const possibleExtras = buildExtraNeighborhoods(CATALOG, everyTableRow, hasRubric, rationaleFor);

  it("has a rationale for every researched extra that can reach the ranking, hidden cities included, and both references", () => {
    expect(possibleExtras.length).toBeGreaterThanOrEqual(EXTRAS.length);
    const missing = [
      ...possibleExtras.map((n) => `${n.cityCode}:${n.neighborhood}`),
      "GO:Setor Marista",
      "BSB:Águas Claras",
    ].filter((key) => !RATIONALES[key]);
    expect(missing).toEqual([]);
    for (const n of possibleExtras) {
      expect(n.shortRationale).not.toBe("");
      expect(n.detailedJustification).not.toBe("");
    }
  });

  it("keeps the one-liner short and drops hardcoded ranks that would go stale", () => {
    for (const [key, r] of Object.entries(RATIONALES)) {
      expect(r.shortRationale.length, key).toBeLessThanOrEqual(160);
      expect(r.shortRationale, key).not.toMatch(/\n/);
      expect(`${r.shortRationale} ${r.detailedJustification}`, key).not.toMatch(/Nota\s+[\d.,]+\/10|#\d+/);
    }
  });

  it("is compiled into neighborhood-research.json as written (rebuild after editing the source)", () => {
    expect(RATIONALES).toEqual(rationalesSource);
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
