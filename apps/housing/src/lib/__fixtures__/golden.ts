import {
  BUILTIN_PRESETS,
  DEFAULT_WEIGHTS,
  computeDynamicNeighborhoods,
  precomputeListingFeatures,
  scorePrecomputedListings,
} from "@/lib/scoring-engine";
import type {
  EvaluatedProperty,
  NeighborhoodEntry,
  ScoringWeights,
  SlimPropertyRecord,
} from "@/types/housing";

/** Listing ages, recency bonuses and "new" tags depend on the clock. */
export const GOLDEN_NOW = "2026-10-17T17:00:00.000Z";

export interface GoldenInput {
  neighborhoods: NeighborhoodEntry[];
  properties: SlimPropertyRecord[];
}

export const GOLDEN_WEIGHT_SETS: Array<{
  id: string;
  weights: ScoringWeights;
  includeBsbBenchmark: boolean;
}> = [
  { id: "default", weights: DEFAULT_WEIGHTS, includeBsbBenchmark: false },
  {
    id: "perfeito+bsb",
    weights: BUILTIN_PRESETS.find((p) => p.id === "perfeito")!.weights,
    includeBsbBenchmark: true,
  },
  {
    id: "custom-nomega-area45-noparking",
    weights: { ...DEFAULT_WEIGHTS, penalizeMegaCondo: false, minAreaM2: 45, requireParking: false },
    includeBsbBenchmark: false,
  },
];

export interface GoldenRow {
  key: string;
  rank: number;
  overallRank: number | null;
  cityRank: number | null;
  eligible: boolean;
  finalScore: number;
  exclusionReason: string | null;
  totalMonthly: number;
  furnitureTier?: string;
  modernityTier: string;
  acLabel: string | null;
  floorTag: string | null;
  noParking: boolean;
  greenTags: string[];
  redTags: string[];
  warningTags: string[];
  alsoListedOn: string[];
}

function toRow(p: EvaluatedProperty, index: number): GoldenRow {
  return {
    key: `${p.provider}:${p.id}`,
    rank: index + 1,
    overallRank: p.overallRank,
    cityRank: p.cityRank,
    eligible: p.eligible,
    finalScore: Math.round(p.finalScore * 100) / 100,
    exclusionReason: p.exclusionReason,
    totalMonthly: p.totalMonthly,
    furnitureTier: p.furnitureTier,
    modernityTier: p.modernityTier,
    acLabel: p.cardTags.acLabel,
    floorTag: p.cardTags.floorTag?.label ?? null,
    noParking: p.cardTags.noParking,
    greenTags: p.cardTags.greenTags,
    redTags: p.cardTags.redTags,
    warningTags: p.cardTags.warningTags,
    alsoListedOn: p.alsoListedOn ?? [],
  };
}

/** Ranked output of the scoring engine for each golden weight set. Call with the clock frozen at GOLDEN_NOW. */
export function computeGoldenRows(input: GoldenInput): Record<string, GoldenRow[]> {
  const precomputed = precomputeListingFeatures(input.properties);
  const out: Record<string, GoldenRow[]> = {};
  for (const set of GOLDEN_WEIGHT_SETS) {
    const { ranked } = computeDynamicNeighborhoods(input.neighborhoods, set.weights);
    out[set.id] = scorePrecomputedListings(precomputed, ranked, set.weights, {
      includeBsbBenchmark: set.includeBsbBenchmark,
    }).map(toRow);
  }
  return out;
}
