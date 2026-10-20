import { describe, expect, it } from "vitest";

import snapshot from "@/data/seed-snapshot.json";
import researchFile from "@/data/neighborhood-research.json";
import { filterVisibleCities } from "@/lib/city-config";
import {
  computeReferenceNeighborhoods,
  rankWithReferences,
  REFERENCE_NEIGHBORHOODS,
  referenceInsertIndex,
  type ReferenceNeighborhoodRow,
} from "@/lib/reference-neighborhood";
import { rubricToUrbanBreathing } from "@/lib/urban-breathing";
import {
  computeDynamicNeighborhoods,
  computeWeightedNeighborhoodScore,
  DEFAULT_WEIGHTS,
} from "@/lib/scoring-engine";
import type { NeighborhoodEntry, ScoringWeights } from "@/types/housing";
import type { NeighborhoodResearchFile } from "@/types/neighborhood-research";

const VISIBLE = filterVisibleCities(
  (snapshot as unknown as { neighborhoods: NeighborhoodEntry[] }).neighborhoods,
  [],
);

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

describe("REFERENCE_NEIGHBORHOODS", () => {
  it("lists Setor Marista and Águas Claras, each with a compiled dossier", () => {
    expect(REFERENCE_NEIGHBORHOODS.map((r) => r.key)).toEqual(["GO:Setor Marista", "BSB:Águas Claras"]);
    const dossiers = (researchFile as unknown as NeighborhoodResearchFile).dossiers;
    for (const ref of REFERENCE_NEIGHBORHOODS) expect(dossiers[ref.key]?.rubric?.total).toBeGreaterThan(0);
    expect(REFERENCE_NEIGHBORHOODS[0]).toMatchObject({
      badge: "Referência",
      subScores: { urbanBreathing: 8.6, safetyCar: 8.5 },
    });
    expect(REFERENCE_NEIGHBORHOODS[1]).toMatchObject({
      badge: "Onde você mora hoje",
      subScores: { urbanBreathing: 7.4, safetyCar: 8.8 },
      subtitle: "Onde você mora hoje — fora do catálogo, não altera as notas dos imóveis",
    });
  });

  it("maps each reference's compiled rubric total to its urban breathing, Marista included (no 10 for the reference)", () => {
    const dossiers = (researchFile as unknown as NeighborhoodResearchFile).dossiers;
    for (const ref of REFERENCE_NEIGHBORHOODS) {
      expect(ref.subScores.urbanBreathing).toBe(rubricToUrbanBreathing(dossiers[ref.key]!.rubric!.total));
    }
    expect(REFERENCE_NEIGHBORHOODS[0]!.subScores.urbanBreathing).toBeLessThan(10);
  });
});

describe("rankWithReferences", () => {
  const ref = (key: string, dynamicScore: number) =>
    ({ key, dynamicScore }) as unknown as ReferenceNeighborhoodRow;
  const rows = [{ dynamicScore: 9 }, { dynamicScore: 8 }, { dynamicScore: 7 }];

  it("merges references by score and numbers every row, shifting the rows below", () => {
    const merged = rankWithReferences(rows, [ref("b", 7.5), ref("a", 8.5)]);
    expect(merged.map((it) => [it.kind, it.rank])).toEqual([
      ["catalog", 1],
      ["reference", 2],
      ["catalog", 3],
      ["reference", 4],
      ["catalog", 5],
    ]);
    expect(merged.filter((it) => it.kind === "reference").map((it) => it.ref.key)).toEqual(["a", "b"]);
  });

  it("keeps ties above a reference and equal references in their order", () => {
    const merged = rankWithReferences(rows, [ref("a", 8), ref("b", 8)]);
    expect(merged.map((it) => (it.kind === "catalog" ? it.n.dynamicScore : it.ref.key))).toEqual([9, 8, "a", "b", 7]);
  });

  it("does not touch the catalog rows", () => {
    const before = structuredClone(rows);
    rankWithReferences(rows, [ref("a", 10)]);
    expect(rows).toEqual(before);
  });
});

describe("computeReferenceNeighborhoods", () => {
  it("leaves the catalog ranking, counts and city ranks untouched", () => {
    const { ranked, cityAverages } = computeDynamicNeighborhoods(VISIBLE, DEFAULT_WEIGHTS);
    const before = structuredClone({ ranked, cityAverages });
    const refs = computeReferenceNeighborhoods(ranked, DEFAULT_WEIGHTS);
    expect(refs).toHaveLength(2);
    expect({ ranked, cityAverages }).toEqual(before);
    expect(ranked).toHaveLength(VISIBLE.length);
    expect(ranked.map((n) => n.dynamicOverallRank)).toEqual(ranked.map((_, i) => i + 1));
    for (const ref of REFERENCE_NEIGHBORHOODS) {
      expect(ranked.some((n) => n.neighborhood === ref.neighborhood)).toBe(false);
    }
  });

  it("scores each with the engine formula, its constant sub-scores and the median commute", () => {
    const { ranked } = computeDynamicNeighborhoods(VISIBLE, DEFAULT_WEIGHTS);
    const commute = median(ranked.map((n) => n.commuteLogisticsScore));
    const refs = computeReferenceNeighborhoods(ranked, DEFAULT_WEIGHTS);
    REFERENCE_NEIGHBORHOODS.forEach((info, i) => {
      expect(refs[i]!.key).toBe(info.key);
      expect(refs[i]!.commuteLogisticsScore).toBe(commute);
      expect(refs[i]!.dynamicScore).toBe(
        computeWeightedNeighborhoodScore({ ...info.subScores, commuteLogistics: commute }, DEFAULT_WEIGHTS),
      );
    });
  });

  it("sits between the catalog rows that score above and below it", () => {
    const { ranked } = computeDynamicNeighborhoods(VISIBLE, DEFAULT_WEIGHTS);
    for (const ref of computeReferenceNeighborhoods(ranked, DEFAULT_WEIGHTS)) {
      const idx = referenceInsertIndex(ranked, ref.dynamicScore);
      expect(ranked.slice(0, idx).every((n) => n.dynamicScore >= ref.dynamicScore)).toBe(true);
      expect(ranked.slice(idx).every((n) => n.dynamicScore < ref.dynamicScore)).toBe(true);
    }
  });

  it("moves when the weights change", () => {
    const weights: ScoringWeights = { ...DEFAULT_WEIGHTS, commuteLogisticsWeight: 0, urbanBreathingWeight: 3 };
    const { ranked } = computeDynamicNeighborhoods(VISIBLE, DEFAULT_WEIGHTS);
    const a = computeReferenceNeighborhoods(ranked, DEFAULT_WEIGHTS);
    const b = computeReferenceNeighborhoods(computeDynamicNeighborhoods(VISIBLE, weights).ranked, weights);
    expect(b[0]!.dynamicScore).not.toBe(a[0]!.dynamicScore);
    expect(b[1]!.dynamicScore).not.toBe(a[1]!.dynamicScore);
  });

  it("is empty without visible catalog neighbourhoods", () => {
    expect(computeReferenceNeighborhoods([], DEFAULT_WEIGHTS)).toEqual([]);
  });
});

describe("referenceInsertIndex", () => {
  const rows = [{ dynamicScore: 9 }, { dynamicScore: 8 }, { dynamicScore: 8 }, { dynamicScore: 7 }];
  it("keeps ties above the reference", () => {
    expect(referenceInsertIndex(rows, 8)).toBe(3);
  });
  it("goes first or last at the extremes", () => {
    expect(referenceInsertIndex(rows, 9.5)).toBe(0);
    expect(referenceInsertIndex(rows, 1)).toBe(4);
  });
});
