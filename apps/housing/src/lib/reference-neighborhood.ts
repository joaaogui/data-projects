import { computeWeightedNeighborhoodScore } from "@/lib/scoring-engine";
import type { ComputedNeighborhood, ScoringWeights } from "@/types/housing";

export interface ReferenceNeighborhood {
  key: string;
  neighborhood: string;
  cityLabel: string;
  ufLabel: string;
  subScores: { urbanBreathing: number; buildingStock: number; budgetFit: number; safetyCar: number };
  commuteLabel: string;
  subtitle: string;
}

/** No Nubank office near a reference: commute takes the median of the visible catalog neighbourhoods. */
const NEUTRAL_COMMUTE_LABEL = "deslocamento neutro (sem escritório)";

/**
 * The user's reference neighbourhoods. They are not catalog neighbourhoods and never enter
 * `computeDynamicNeighborhoods`, so ranks, counts, city averages, filters, facets and listing scores ignore
 * them. The ranking tab only shows each one as an unranked row at its score's position.
 *
 * Sources: dossiers .tmp/nb-research/out/<key>.json (in the Empty workspace) and the rubric
 * .tmp/nb-research/rubric-scores.json; rubric totals map to urban breathing with 6 + (total - 4.4) * 4 / 3.63
 * (capped at 10).
 */
export const REFERENCE_NEIGHBORHOODS: readonly ReferenceNeighborhood[] = [
  {
    key: "GO:Setor Marista",
    neighborhood: "Setor Marista",
    cityLabel: "Goiânia",
    ufLabel: "GO",
    subScores: {
      // Rubric total 8.03 → 10.0 (capped at 10).
      urbanBreathing: 10,
      // Judgement backed by the dossier: 87.3% of households are apartments (IBGE Censo 2022).
      buildingStock: 9.5,
      // Judgement backed by the dossier: rent ≈ R$ 67/m²/mês.
      budgetFit: 8.5,
      // Estimate: SSP-GO only publishes state totals, no bairro or city crime series (dossier crime summary).
      safetyCar: 8.5,
    },
    commuteLabel: NEUTRAL_COMMUTE_LABEL,
    subtitle: "Seu bairro de referência — não entra no ranking",
  },
  {
    key: "BSB:Águas Claras",
    neighborhood: "Águas Claras",
    cityLabel: "Brasília",
    ufLabel: "DF",
    subScores: {
      // Rubric total 6.33 → 8.1 (dossier BSB__Águas Claras.json, rubric block).
      urbanBreathing: 8.1,
      // Dossier: 99.0% of households are apartments (IBGE Censo 2022); towers built in the 2000s–2010s.
      buildingStock: 9.0,
      // Dossier: FipeZap asking rent R$ 54,4/m²/mês, below Setor Marista's ≈ R$ 67.
      budgetFit: 8.5,
      // Dossier: SSP-DF 2025 pedestrian robbery at 43% of the DF rate; homicides 1.6/100 mil.
      safetyCar: 8.8,
    },
    commuteLabel: NEUTRAL_COMMUTE_LABEL,
    subtitle: "Onde você mora hoje — não entra no ranking",
  },
];

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

/** Scores every reference with the current weights; empty when no catalog neighbourhood is visible. */
export function computeReferenceNeighborhoods(
  ranked: readonly ComputedNeighborhood[],
  weights: ScoringWeights,
): ReferenceNeighborhoodRow[] {
  if (ranked.length === 0) return [];
  const commuteLogistics = median(ranked.map((n) => n.commuteLogisticsScore));
  return REFERENCE_NEIGHBORHOODS.map((ref) => {
    const { urbanBreathing, buildingStock, budgetFit, safetyCar } = ref.subScores;
    return {
      key: ref.key,
      neighborhood: ref.neighborhood,
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
  });
}

/** Index in a score-descending list where a reference goes; ties stay above it. */
export function referenceInsertIndex(rows: readonly { dynamicScore: number }[], score: number): number {
  const idx = rows.findIndex((r) => r.dynamicScore < score);
  return idx === -1 ? rows.length : idx;
}
