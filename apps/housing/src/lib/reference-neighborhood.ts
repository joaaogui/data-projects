import { computeWeightedNeighborhoodScore } from "@/lib/scoring-engine";
import { rubricToUrbanBreathing } from "@/lib/urban-breathing";
import type { ComputedNeighborhood, ScoringWeights } from "@/types/housing";
import type { NeighborhoodRationale } from "@/types/neighborhood-research";

export interface ReferenceNeighborhood {
  key: string;
  neighborhood: string;
  cityLabel: string;
  ufLabel: string;
  badge: string;
  subScores: { urbanBreathing: number; safetyCar: number };
  commuteLabel: string;
  subtitle: string;
}

/** No Nubank office near a reference: commute takes the median of the visible catalog neighbourhoods. */
const NEUTRAL_COMMUTE_LABEL = "deslocamento neutro (sem escritório)";

/**
 * The user's reference neighbourhoods. They are not catalog neighbourhoods and never enter
 * `computeDynamicNeighborhoods`, so listing scores and ranks, counts, city averages, filters and facets ignore
 * them. The ranking tab merges them into its list by score (`rankWithReferences`), numbered like any row.
 *
 * Sources: dossiers .tmp/nb-research/out/<key>.json (in the Empty workspace) and the rubric
 * .tmp/nb-research/rubric-scores.json. Urban breathing is derived from a measured rubric; safety is an estimate
 * written from the dossier, not a measured score.
 */
export const REFERENCE_NEIGHBORHOODS: readonly ReferenceNeighborhood[] = [
  {
    key: "GO:Setor Marista",
    neighborhood: "Setor Marista",
    cityLabel: "Goiânia",
    ufLabel: "GO",
    badge: "Referência",
    subScores: {
      // Rubric total 8.03 (rubric-scores.json) → 8.6.
      urbanBreathing: rubricToUrbanBreathing(8.03),
      // Estimate, not a measured score: SSP-GO only publishes state totals, no bairro or city crime series.
      safetyCar: 8.5,
    },
    commuteLabel: NEUTRAL_COMMUTE_LABEL,
    subtitle: "Seu bairro de referência — fora do catálogo, não altera as notas dos imóveis",
  },
  {
    key: "BSB:Águas Claras",
    neighborhood: "Águas Claras",
    cityLabel: "Brasília",
    ufLabel: "DF",
    badge: "Onde você mora hoje",
    subScores: {
      // Rubric total 6.33 (dossier BSB__Águas Claras.json, rubric block) → 7.4.
      urbanBreathing: rubricToUrbanBreathing(6.33),
      // Estimate from the dossier, not a measured score: SSP-DF 2025 pedestrian robbery at 43% of the DF rate;
      // homicides 1.6/100 mil.
      safetyCar: 8.8,
    },
    commuteLabel: NEUTRAL_COMMUTE_LABEL,
    subtitle: "Onde você mora hoje — fora do catálogo, não altera as notas dos imóveis",
  },
];

export interface ReferenceNeighborhoodRow {
  key: string;
  neighborhood: string;
  dynamicScore: number;
  urbanBreathingScore: number;
  commuteLogisticsScore: number;
  safetyCarScore: number;
  shortRationale: string;
  detailedJustification: string;
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
  rationales: Readonly<Record<string, NeighborhoodRationale>> = {},
): ReferenceNeighborhoodRow[] {
  if (ranked.length === 0) return [];
  const commuteLogistics = median(ranked.map((n) => n.commuteLogisticsScore));
  return REFERENCE_NEIGHBORHOODS.map((ref) => {
    const { urbanBreathing, safetyCar } = ref.subScores;
    return {
      key: ref.key,
      neighborhood: ref.neighborhood,
      dynamicScore: computeWeightedNeighborhoodScore(
        { urbanBreathing, commuteLogistics, safetyCar },
        weights,
      ),
      urbanBreathingScore: urbanBreathing,
      commuteLogisticsScore: commuteLogistics,
      safetyCarScore: safetyCar,
      shortRationale: rationales[ref.key]?.shortRationale ?? "",
      detailedJustification: rationales[ref.key]?.detailedJustification ?? "",
    };
  });
}

/** Index in a score-descending list where a reference goes; ties stay above it. */
export function referenceInsertIndex(rows: readonly { dynamicScore: number }[], score: number): number {
  const idx = rows.findIndex((r) => r.dynamicScore < score);
  return idx === -1 ? rows.length : idx;
}

export type RankedListItem<T> =
  | { kind: "catalog"; n: T; rank: number }
  | { kind: "reference"; ref: ReferenceNeighborhoodRow; rank: number };

/**
 * The ranking with the references merged in by score (ties stay above a reference; equal-scoring references keep
 * their order), every row numbered 1..n. Display only: the engine ranks of catalog rows are left as they are.
 */
export function rankWithReferences<T extends { dynamicScore: number }>(
  ranking: readonly T[],
  references: readonly ReferenceNeighborhoodRow[],
): RankedListItem<T>[] {
  type Unranked = { kind: "catalog"; n: T } | { kind: "reference"; ref: ReferenceNeighborhoodRow };
  const merged: Unranked[] = ranking.map((n) => ({ kind: "catalog", n }));
  for (const ref of [...references].sort((a, b) => b.dynamicScore - a.dynamicScore)) {
    const scored = merged.map((it) => (it.kind === "catalog" ? it.n : it.ref));
    merged.splice(referenceInsertIndex(scored, ref.dynamicScore), 0, { kind: "reference", ref });
  }
  return merged.map((it, i) => ({ ...it, rank: i + 1 }));
}
