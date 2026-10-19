import { computeWeightedNeighborhoodScore } from "@/lib/scoring-engine";
import type { ComputedNeighborhood, ScoringWeights } from "@/types/housing";

/**
 * Setor Marista (Goiânia) — the user's reference neighbourhood. It is not a catalog neighbourhood: no listings,
 * no city hub, and it never enters `computeDynamicNeighborhoods`, so ranks, counts, city averages, filters,
 * facets and listing scores ignore it. The ranking tab only shows it as an unranked row at its score's position.
 *
 * Sources: dossier .tmp/nb-research/out/GO__Setor Marista.json (in the Empty workspace) and the rubric
 * .tmp/nb-research/rubric-scores.json.
 */
export const REFERENCE_NEIGHBORHOOD = {
  key: "GO:Setor Marista",
  neighborhood: "Setor Marista",
  cityLabel: "Goiânia",
  ufLabel: "GO",
  subScores: {
    // Rubric total 8.03 mapped with the approved 6 + (total - 4.4) * 4 / 3.63 = 10.0 (capped at 10).
    urbanBreathing: 10,
    // Judgement backed by the dossier: 87.3% of households are apartments (IBGE Censo 2022).
    buildingStock: 9.5,
    // Judgement backed by the dossier: rent ≈ R$ 67/m²/mês.
    budgetFit: 8.5,
    // Estimate: SSP-GO only publishes state totals, no bairro or city crime series (dossier crime summary).
    safetyCar: 8.5,
  },
  /** No Nubank office in Goiânia: commute takes the median of the visible catalog neighbourhoods. */
  commuteLabel: "deslocamento neutro (sem escritório)",
  subtitle: "Seu bairro de referência — não entra no ranking",
} as const;

export interface ReferenceNeighborhoodRow {
  key: string;
  neighborhood: string;
  dynamicScore: number;
  urbanBreathingScore: number;
  commuteLogisticsScore: number;
  buildingStockFitScore: number;
  budgetFitScore: number;
  safetyCarScore: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** Scores the reference with the current weights; null when no catalog neighbourhood is visible. */
export function computeReferenceNeighborhood(
  ranked: readonly ComputedNeighborhood[],
  weights: ScoringWeights,
): ReferenceNeighborhoodRow | null {
  if (ranked.length === 0) return null;
  const { urbanBreathing, buildingStock, budgetFit, safetyCar } = REFERENCE_NEIGHBORHOOD.subScores;
  const commuteLogistics = median(ranked.map((n) => n.commuteLogisticsScore));
  return {
    key: REFERENCE_NEIGHBORHOOD.key,
    neighborhood: REFERENCE_NEIGHBORHOOD.neighborhood,
    dynamicScore: computeWeightedNeighborhoodScore(
      { urbanBreathing, commuteLogistics, buildingStock, budgetFit, safetyCar },
      weights,
    ),
    urbanBreathingScore: urbanBreathing,
    commuteLogisticsScore: commuteLogistics,
    buildingStockFitScore: buildingStock,
    budgetFitScore: budgetFit,
    safetyCarScore: safetyCar,
  };
}

/** Index in a score-descending list where the reference goes; ties stay above it. */
export function referenceInsertIndex(rows: readonly { dynamicScore: number }[], score: number): number {
  const idx = rows.findIndex((r) => r.dynamicScore < score);
  return idx === -1 ? rows.length : idx;
}
