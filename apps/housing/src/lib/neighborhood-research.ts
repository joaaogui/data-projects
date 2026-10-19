import "server-only";

import researchFile from "@/data/neighborhood-research.json";
import { normalizeNeighborhoodKey } from "@/lib/scoring-engine";
import type { CityHubCode } from "@/types/housing";
import type {
  NeighborhoodDossier,
  NeighborhoodRationale,
  NeighborhoodResearchFile,
  NeighborhoodResearchSummary,
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

/** Adds the card-sized research summary to listings whose neighbourhood was researched. */
export function withNeighborhoodResearch<T extends { cityCode: string; neighborhood: string }>(
  items: T[],
): (T & { neighborhoodResearch?: NeighborhoodResearchSummary })[] {
  return items.map((item) => {
    if (typeof item.cityCode !== "string" || typeof item.neighborhood !== "string") return item;
    const summary = getNeighborhoodSummary(item.cityCode, item.neighborhood);
    return summary ? { ...item, neighborhoodResearch: summary } : item;
  });
}
