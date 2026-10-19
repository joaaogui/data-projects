/** Compiled neighbourhood dossiers (src/data/neighborhood-research.json, built by scripts/build-neighborhood-research.ts). */

export interface ResearchNumber {
  metric: "density" | "apartments" | "idh" | "homicides" | "rentM2";
  label: string;
  value: number;
  unit: string;
  year: number | null;
  scope: string;
  source: string;
  url: string;
  note?: string;
}

export interface ResearchCrimeSeries {
  kind: "robbery" | "theft" | "homicide";
  indicator: string;
  period: string;
  value: number;
  perCapita: number | null;
  /** Unit rate ÷ city rate (or ÷ per-DP average in Campinas); null when no comparable city figure exists. */
  ratioToCity: number | null;
  comparison: string;
  source: string;
  url: string;
}

export interface ResearchOpinion {
  stance: "positive" | "negative" | "mixed";
  theme: string;
  quote: string;
  source: string;
  url: string;
  date: string | null;
}

export interface ResearchNews {
  date: string;
  headline: string;
  outlet: string;
  url: string;
}

export interface ResearchFact {
  fact: string;
  source: string;
  url: string;
}

export interface ResearchEvidence {
  text: string;
  url: string | null;
}

export interface ResearchRubric {
  total: number;
  measuredShare: number | null;
  /** `basis`: "measured" | "measured_coarse_unit" | "half_measured" | "judgement". */
  criteria: { name: string; basis?: string; score: number | null; evidence: ResearchEvidence[] }[];
}

export interface NeighborhoodDossier {
  key: string;
  city: string;
  neighborhood: string;
  researchedAt: string;
  numbers: ResearchNumber[];
  crime: {
    officialUnit: string;
    /** Short label of the unit the robbery/theft figures cover (e.g. "CISP 10", "4º DP", "bairro"). */
    scope: string;
    summary: string;
    series: ResearchCrimeSeries[];
  };
  highlights: string[];
  redFlags: string[];
  opinions: ResearchOpinion[];
  news: ResearchNews[];
  facts: ResearchFact[];
  gaps: string[];
  /** The researcher's own 0–10 "Setor Marista" judgement (not measured). */
  maristaJudgement: { score: number; why: string } | null;
  rubric: ResearchRubric | null;
}

/** What each listing card carries; the full dossier loads from /api/neighborhoods/[key]. */
export interface NeighborhoodResearchSummary {
  key: string;
  marista: number | null;
  maristaSource: "rubric" | "judgement" | null;
  robberyRatio: number | null;
  densityPerKm2: number | null;
  /** Share of households that are apartments (%). */
  apartmentsShare: number | null;
  highlight: string | null;
  redFlag: string | null;
}

export interface NeighborhoodResearchFile {
  builtAt: string;
  dossiers: Record<string, NeighborhoodDossier>;
}
