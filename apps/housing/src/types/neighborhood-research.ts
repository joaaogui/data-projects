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

/** Public quality-of-life metrics (src/data/neighborhood-qol.json); display only, they enter no score. */
export type QolMetricId =
  | "idhm"
  | "life_expectancy"
  | "income_per_capita_2010"
  | "income_household_head_2022"
  | "crime_robbery"
  | "crime_homicide"
  | "park_area_1km_ha"
  | "nearest_large_park_m"
  | "street_trees_faces"
  | "sewer_network"
  | "street_lighting"
  | "sidewalk"
  | "paved_road";

export interface QolMetric {
  value: number | null;
  unit: string;
  year: string;
  scope: string;
  source: string;
  url: string;
  note?: string;
  /** Why `value` is null. */
  reason?: string;
  /** The same metric for the city in `NeighborhoodQol.cityRef`. */
  cityValue?: number;
  /** Crime only: unit rate ÷ the same city's rate (indicators and windows differ by state). */
  ratio?: number | null;
  count?: number;
  /** Nearest park only: the ≥10 ha park measured; `accessNote` flags restricted visitation. */
  park?: { name: string; ha: number | null; url: string; accessNote?: string };
}

export interface NeighborhoodQol {
  /** City reference key: "BH", "NOVA_LIMA", "RJ", "SP", "CP", "GO", "BSB". */
  cityRef: string;
  metrics: Partial<Record<QolMetricId, QolMetric | null>>;
}

export type QolColumnId = "idhm" | "lifeExpectancy" | "income" | "robbery" | "homicide" | "parks" | "trees" | "sewer";

/** One Top Bairros cell: the sort value (null = "—"), its text and tooltip. */
export interface QolCell {
  value: number | null;
  text: string;
  hint: string;
}

export type QolRow = Partial<Record<QolColumnId, QolCell>>;

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
  qol?: NeighborhoodQol;
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
  /** Listing cards only: the ranking table's Vida urbana for this neighbourhood (engine scale, 0–10). */
  urbanLife?: number;
}

/** Ranking-tab text for a researched row outside the catalog, written from its dossier (src/data/neighborhood-rationales.json). */
export interface NeighborhoodRationale {
  shortRationale: string;
  detailedJustification: string;
}

export interface NeighborhoodResearchFile {
  builtAt: string;
  dossiers: Record<string, NeighborhoodDossier>;
  /** Engine keys covered by a combined dossier (e.g. "BH:Vale do Sereno" → "BH:Vila da Serra - Vale do Sereno"). */
  aliases?: Record<string, string>;
  /** By ranking-row key (extras and references); every key resolves to a dossier directly or via `aliases`. */
  rationales?: Record<string, NeighborhoodRationale>;
}
