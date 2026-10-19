import { describe, expect, it } from "vitest";

import snapshot from "@/data/seed-snapshot.json";
import { filterVisibleCities } from "@/lib/city-config";
import {
  computeReferenceNeighborhood,
  REFERENCE_NEIGHBORHOOD,
  referenceInsertIndex,
} from "@/lib/reference-neighborhood";
import {
  computeDynamicNeighborhoods,
  computeWeightedNeighborhoodScore,
  DEFAULT_WEIGHTS,
} from "@/lib/scoring-engine";
import type { NeighborhoodEntry, ScoringWeights } from "@/types/housing";

const VISIBLE = filterVisibleCities(
  (snapshot as unknown as { neighborhoods: NeighborhoodEntry[] }).neighborhoods,
  [],
);

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

describe("computeReferenceNeighborhood", () => {
  it("leaves the catalog ranking, counts and city ranks untouched", () => {
    const { ranked, cityAverages } = computeDynamicNeighborhoods(VISIBLE, DEFAULT_WEIGHTS);
    const before = structuredClone({ ranked, cityAverages });
    const ref = computeReferenceNeighborhood(ranked, DEFAULT_WEIGHTS);
    expect(ref).not.toBeNull();
    expect({ ranked, cityAverages }).toEqual(before);
    expect(ranked).toHaveLength(VISIBLE.length);
    expect(ranked.map((n) => n.dynamicOverallRank)).toEqual(ranked.map((_, i) => i + 1));
    expect(ranked.some((n) => n.neighborhood === REFERENCE_NEIGHBORHOOD.neighborhood)).toBe(false);
  });

  it("scores with the engine formula, the constant sub-scores and the median commute", () => {
    const { ranked } = computeDynamicNeighborhoods(VISIBLE, DEFAULT_WEIGHTS);
    const ref = computeReferenceNeighborhood(ranked, DEFAULT_WEIGHTS)!;
    const commute = median(ranked.map((n) => n.commuteLogisticsScore));
    expect(ref.commuteLogisticsScore).toBe(commute);
    expect(ref.dynamicScore).toBe(
      computeWeightedNeighborhoodScore(
        { ...REFERENCE_NEIGHBORHOOD.subScores, commuteLogistics: commute },
        DEFAULT_WEIGHTS,
      ),
    );
  });

  it("sits between the catalog rows that score above and below it", () => {
    const { ranked } = computeDynamicNeighborhoods(VISIBLE, DEFAULT_WEIGHTS);
    const ref = computeReferenceNeighborhood(ranked, DEFAULT_WEIGHTS)!;
    const idx = referenceInsertIndex(ranked, ref.dynamicScore);
    expect(ranked.slice(0, idx).every((n) => n.dynamicScore >= ref.dynamicScore)).toBe(true);
    expect(ranked.slice(idx).every((n) => n.dynamicScore < ref.dynamicScore)).toBe(true);
  });

  it("moves when the weights change", () => {
    const weights: ScoringWeights = { ...DEFAULT_WEIGHTS, commuteLogisticsWeight: 0, urbanBreathingWeight: 3 };
    const { ranked } = computeDynamicNeighborhoods(VISIBLE, DEFAULT_WEIGHTS);
    const a = computeReferenceNeighborhood(ranked, DEFAULT_WEIGHTS)!;
    const b = computeReferenceNeighborhood(computeDynamicNeighborhoods(VISIBLE, weights).ranked, weights)!;
    expect(b.dynamicScore).not.toBe(a.dynamicScore);
  });

  it("is null without visible catalog neighbourhoods", () => {
    expect(computeReferenceNeighborhood([], DEFAULT_WEIGHTS)).toBeNull();
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
