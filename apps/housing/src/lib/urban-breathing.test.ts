import { describe, expect, it } from "vitest";

import researchFile from "@/data/neighborhood-research.json";
import snapshot from "@/data/seed-snapshot.json";
import {
  computeDynamicNeighborhoods,
  DEFAULT_WEIGHTS,
  NEIGHBORHOOD_SAFETY_AND_METRICS,
  normalizeNeighborhoodKey,
} from "@/lib/scoring-engine";
import {
  BUNKER_URBAN_BREATHING_CAP,
  HIGH_URBAN_BREATHING_PHRASE_FROM,
  rubricToUrbanBreathing,
  URBAN_BREATHING_BONUS_FROM,
  URBAN_BREATHING_BONUS_FULL_AT,
  URBAN_BREATHING_CALIBRATION_CAP_BELOW,
  URBAN_BREATHING_OVERRIDES,
  URBAN_BREATHING_PENALTY_PER_POINT,
} from "@/lib/urban-breathing";
import type { NeighborhoodEntry } from "@/types/housing";
import type { NeighborhoodResearchFile } from "@/types/neighborhood-research";

const RESEARCH = researchFile as unknown as NeighborhoodResearchFile;
/** References keep their own rows; the Barra dossier covers only Jardim Oceânico, so Barra rows stay as they were. */
const NOT_MAPPED = new Set(["GO:Setor Marista", "BSB:Águas Claras", "RJ:Barra da Tijuca (Jardim Oceânico)"]);

describe("rubricToUrbanBreathing", () => {
  it("maps 4.4 to 6 and only a perfect rubric to 10", () => {
    expect(rubricToUrbanBreathing(4.4)).toBe(6);
    expect(rubricToUrbanBreathing(10)).toBe(10);
    expect(rubricToUrbanBreathing(8.03)).toBe(8.6);
    expect(rubricToUrbanBreathing(6.33)).toBe(7.4);
  });

  it("goes below 6 for totals under 4.4 and rounds to one decimal", () => {
    expect(rubricToUrbanBreathing(3.16)).toBe(5.1);
    expect(rubricToUrbanBreathing(4.89)).toBe(6.4);
  });
});

describe("thresholds converted from the earlier mapping", () => {
  const fromOldScale = (old: number) => 6 + ((old - 6) * 3.63) / 5.6;

  it("puts each threshold where the old one sat, within the rounding", () => {
    expect(Math.abs(URBAN_BREATHING_BONUS_FROM - fromOldScale(7.5))).toBeLessThanOrEqual(0.06);
    expect(Math.abs(URBAN_BREATHING_BONUS_FULL_AT - fromOldScale(9.0))).toBeLessThanOrEqual(0.06);
    expect(URBAN_BREATHING_PENALTY_PER_POINT).toBeCloseTo((0.75 * 5.6) / 3.63, 2);
    expect(Math.abs(URBAN_BREATHING_CALIBRATION_CAP_BELOW - fromOldScale(8.0))).toBeLessThanOrEqual(0.06);
    expect(BUNKER_URBAN_BREATHING_CAP).toBeCloseTo(fromOldScale(5.0), 2);
    expect(Math.abs(HIGH_URBAN_BREATHING_PHRASE_FROM - fromOldScale(9.0))).toBeLessThanOrEqual(0.06);
  });

  it("maps a rubric total to the same side of each threshold as before", () => {
    const oldUb = (t: number) => 6 + ((t - 4.4) * 4) / 3.63;
    for (const t of [4.0, 4.6, 5.3, 5.85, 6.47, 6.68, 7.32]) {
      const ub = rubricToUrbanBreathing(t);
      expect(ub < URBAN_BREATHING_CALIBRATION_CAP_BELOW, String(t)).toBe(oldUb(t) < 8.0);
      expect(ub >= HIGH_URBAN_BREATHING_PHRASE_FROM, String(t)).toBe(oldUb(t) >= 9.0);
    }
  });
});

describe("calibration cap in the neighbourhood ranking", () => {
  const entry = (neighborhood: string, urbanBreathingScore: number): NeighborhoodEntry =>
    ({
      ...(snapshot as unknown as { neighborhoods: NeighborhoodEntry[] }).neighborhoods[0]!,
      cityCode: neighborhood === "Bosque" ? "CP" : "BH",
      neighborhood,
      urbanBreathingScore,
    }) as NeighborhoodEntry;

  it("keeps the catalog value when the table row is at or above 7.3 and caps it below", () => {
    const { ranked } = computeDynamicNeighborhoods([entry("Funcionários", 9.5), entry("Bosque", 9.5)], DEFAULT_WEIGHTS);
    const ub = new Map(ranked.map((n) => [n.neighborhood, n.urbanBreathingScore]));
    expect(NEIGHBORHOOD_SAFETY_AND_METRICS["BH:Funcionários"]!.urbanBreathing).toBeGreaterThanOrEqual(7.3);
    expect(ub.get("Funcionários")).toBe(9.5);
    expect(ub.get("Bosque")).toBe(NEIGHBORHOOD_SAFETY_AND_METRICS["CP:Bosque"]!.urbanBreathing);
  });
});

describe("engine table urban breathing", () => {
  it("follows the rubric mapping for every researched row, except the user's overrides", () => {
    const checked: string[] = [];
    for (const [tableKey, m] of Object.entries(NEIGHBORHOOD_SAFETY_AND_METRICS)) {
      const key = `${m.cityCode}:${normalizeNeighborhoodKey(tableKey.slice(tableKey.indexOf(":") + 1), m.cityCode)}`;
      const dossierKey = RESEARCH.aliases?.[key] ?? key;
      const total = RESEARCH.dossiers[dossierKey]?.rubric?.total;
      if (total === undefined || NOT_MAPPED.has(dossierKey)) continue;
      checked.push(tableKey);
      const expected = URBAN_BREATHING_OVERRIDES[key] ?? rubricToUrbanBreathing(total);
      expect({ tableKey, urbanBreathing: m.urbanBreathing }).toEqual({ tableKey, urbanBreathing: expected });
    }
    expect(checked).toEqual(expect.arrayContaining(["CP:Jardim Guanabara", "BH:Vila da Serra", "RJ:Grajau"]));
  });

  it("keeps the manual Guanabara and Cambuí values", () => {
    for (const k of ["CP:Jd. Guanabara", "CP:Jardim Guanabara", "CP:Guanabara"]) {
      expect(NEIGHBORHOOD_SAFETY_AND_METRICS[k]!.urbanBreathing).toBe(5);
    }
    expect(NEIGHBORHOOD_SAFETY_AND_METRICS["CP:Cambuí"]!.urbanBreathing).toBe(4.5);
  });
});
