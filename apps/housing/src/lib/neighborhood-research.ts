import "server-only";

import researchFile from "@/data/neighborhood-research.json";
import { qolRow } from "@/lib/neighborhood-qol";
import { REFERENCE_NEIGHBORHOODS } from "@/lib/reference-neighborhood";
import { normalizeNeighborhoodKey, resolveNeighborhoodSafetyAndMetrics } from "@/lib/scoring-engine";
import type { CityHubCode, ComputedNeighborhood } from "@/types/housing";
import type {
  NeighborhoodDossier,
  NeighborhoodRationale,
  NeighborhoodResearchFile,
  NeighborhoodResearchSummary,
  QolRow,
} from "@/types/neighborhood-research";

const FILE = researchFile as unknown as NeighborhoodResearchFile;
const DOSSIERS = new Map<string, NeighborhoodDossier>(
  Object.values(FILE.dossiers).map((d) => [d.key.toLowerCase(), d]),
);
for (const [alias, key] of Object.entries(FILE.aliases ?? {})) {
  const dossier = DOSSIERS.get(key.toLowerCase());
  if (dossier && !DOSSIERS.has(alias.toLowerCase())) DOSSIERS.set(alias.toLowerCase(), dossier);
}
const SUMMARIES = new Map<string, NeighborhoodResearchSummary>();
const RATIONALES = new Map<string, NeighborhoodRationale>(
  Object.entries(FILE.rationales ?? {}).map(([key, r]) => [key.toLowerCase(), r]),
);

function lookupKey(cityCode: string, neighborhood: string): string {
  return `${cityCode}:${normalizeNeighborhoodKey(neighborhood, cityCode as CityHubCode)}`.toLowerCase();
}

/** Accepts the canonical key or a listing-style alias ("CP:Jardim Guanabara", "RJ:Botafogo"). */
export function getNeighborhoodDossier(key: string): NeighborhoodDossier | null {
  const sep = key.indexOf(":");
  if (sep <= 0) return null;
  return DOSSIERS.get(lookupKey(key.slice(0, sep).trim(), key.slice(sep + 1))) ?? null;
}

export function summarizeDossier(d: NeighborhoodDossier): NeighborhoodResearchSummary {
  const robbery = d.crime.series.find((s) => s.kind === "robbery");
  const density = d.numbers.find((n) => n.metric === "density");
  const apartments = d.numbers.find((n) => n.metric === "apartments");
  const marista = d.rubric?.total ?? d.maristaJudgement?.score ?? null;
  return {
    key: d.key,
    marista,
    maristaSource: d.rubric ? "rubric" : d.maristaJudgement ? "judgement" : null,
    robberyRatio: robbery?.ratioToCity ?? null,
    densityPerKm2: density?.unit === "hab/km²" ? density.value : null,
    apartmentsShare: apartments?.unit.startsWith("%") ? apartments.value : null,
    highlight: d.highlights[0] ?? null,
    redFlag: d.redFlags[0] ?? null,
  };
}

export function getNeighborhoodSummary(cityCode: string, neighborhood: string): NeighborhoodResearchSummary | null {
  const key = lookupKey(cityCode, neighborhood);
  const cached = SUMMARIES.get(key);
  if (cached) return cached;
  const dossier = DOSSIERS.get(key);
  if (!dossier) return null;
  const summary = summarizeDossier(dossier);
  SUMMARIES.set(key, summary);
  return summary;
}

/** Ranking-tab rationale of a researched non-catalog row (extra or reference), by its own row key. */
export function getNeighborhoodRationale(cityCode: string, neighborhood: string): NeighborhoodRationale | null {
  return RATIONALES.get(lookupKey(cityCode, neighborhood)) ?? null;
}

/** Top Bairros quality-of-life cells of a researched neighbourhood (display only), by row key. */
export function getNeighborhoodQolRow(key: string): QolRow | null {
  const qol = getNeighborhoodDossier(key)?.qol;
  return qol ? qolRow(qol) : null;
}

type UrbanLifeRow = Pick<ComputedNeighborhood, "cityCode" | "neighborhood" | "urbanBreathingScore">;

/**
 * The Vida urbana the ranking table shows for a listing's neighbourhood: the catalog row's effective value,
 * else the reference row's, else the engine-table value an extra row uses.
 */
function urbanLifeLookup(ranked: readonly UrbanLifeRow[]): (cityCode: string, neighborhood: string) => number | null {
  const catalog = new Map(ranked.map((n) => [lookupKey(n.cityCode, n.neighborhood), n.urbanBreathingScore]));
  const references = new Map(
    REFERENCE_NEIGHBORHOODS.map((r) => {
      const sep = r.key.indexOf(":");
      return [lookupKey(r.key.slice(0, sep), r.key.slice(sep + 1)), r.subScores.urbanBreathing];
    }),
  );
  return (cityCode, neighborhood) => {
    const key = lookupKey(cityCode, neighborhood);
    return (
      catalog.get(key) ??
      references.get(key) ??
      resolveNeighborhoodSafetyAndMetrics(cityCode as CityHubCode, neighborhood)?.urbanBreathing ??
      null
    );
  };
}

/**
 * Adds the card-sized research summary to listings whose neighbourhood was researched; `ranked` (the scored
 * set's catalog ranking) gives the card the same Vida urbana as the ranking table.
 */
export function withNeighborhoodResearch<T extends { cityCode: string; neighborhood: string }>(
  items: T[],
  ranked?: readonly UrbanLifeRow[],
): (T & { neighborhoodResearch?: NeighborhoodResearchSummary })[] {
  const urbanLife = urbanLifeLookup(ranked ?? []);
  return items.map((item) => {
    if (typeof item.cityCode !== "string" || typeof item.neighborhood !== "string") return item;
    const summary = getNeighborhoodSummary(item.cityCode, item.neighborhood);
    if (!summary) return item;
    const value = urbanLife(item.cityCode, item.neighborhood);
    return { ...item, neighborhoodResearch: value === null ? summary : { ...summary, urbanLife: value } };
  });
}
