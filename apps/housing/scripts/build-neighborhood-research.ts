/**
 * Compiles the neighbourhood research dossiers into src/data/neighborhood-research.json.
 *
 *   TSX_DISABLE_CACHE=1 pnpm exec tsx --conditions=react-server scripts/build-neighborhood-research.ts [--in <dir>] [--rubric <file>]
 *
 * Run from apps/housing. Defaults read ~/.cursor/Empty/.tmp/nb-research/out/*.json and, when present,
 * ../rubric-scores.json. Keys follow the engine's neighbourhood keys (`<cityCode>:<normalizeNeighborhoodKey>`).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { normalizeNeighborhoodKey } from "../src/lib/scoring-engine";
import type { CityHubCode } from "../src/types/housing";
import type {
  NeighborhoodDossier,
  NeighborhoodResearchFile,
  ResearchCrimeSeries,
  ResearchEvidence,
  ResearchNumber,
  ResearchOpinion,
  ResearchRubric,
} from "../src/types/neighborhood-research";

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const isUrl = (v: string) => /^https?:\/\//.test(v);
const clip = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`);

const MAX_OPINIONS = 4;
const MAX_NEWS = 5;
const MAX_FACTS = 6;
const MAX_EVIDENCE = 1;
const MAX_GAPS = 4;
const TEXT_MAX = { fact: 130, note: 100, comparison: 140, why: 240, gap: 130, summary: 400, quote: 180, source: 70, evidence: 140 };

export function researchKey(city: string, neighborhood: string): string {
  return `${city}:${normalizeNeighborhoodKey(neighborhood, city as CityHubCode)}`;
}

const PERSON_NAME = String.raw`[A-ZÀ-Ý][\p{Ll}]+(?:\s+[A-ZÀ-Ý][\p{Ll}]+)*`;
const ROLE_THEN_NAME = new RegExp(
  String.raw`\b([Mm]oradora?|[Aa]triz|[Aa]tor|[Tt]reinadora?|[Cc]orretora?)\s+(?:\(\s*${PERSON_NAME}\s*\)|${PERSON_NAME})`,
  "gu",
);
const LEADING_NAME_COMMA = new RegExp(String.raw`^${PERSON_NAME}\s+${PERSON_NAME},\s*`, "u");
const AUTHORS_YEAR = new RegExp(String.raw`\(${PERSON_NAME}(?:\s+(?:e|&)\s+${PERSON_NAME})*,\s*(\d{4})\)`, "gu");

/** Strips people's names and usernames ("r/sub (u/name)", "Moradora Fulana", "@handle"), keeping the venue/role. */
export function scrubAuthor(source: string): string {
  let out = source
    .replace(/\bu\/[\w-]+,?\s*/gi, "")
    .replace(/@[\w.]{3,}/g, "")
    .replace(ROLE_THEN_NAME, "$1")
    .replace(AUTHORS_YEAR, "($1)");
  if (LEADING_NAME_COMMA.test(out)) {
    out = out.replace(LEADING_NAME_COMMA, "");
    out = out.charAt(0).toUpperCase() + out.slice(1);
  }
  return out
    .replace(/\s*\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const NUMBER_RULES: { metric: ResearchNumber["metric"]; label: string; match: RegExp }[] = [
  { metric: "density", label: "Densidade", match: /^(population[_ ]density|densidade demogr[aá]fica)$/i },
  { metric: "apartments", label: "Domicílios em apartamento", match: /^(share_apartments|share of households in apartments)$/i },
  { metric: "idh", label: "IDH", match: /^(IDH|IDHM)$/i },
  { metric: "homicides", label: "Homicídios", match: /^homic[ií]dios$/i },
  { metric: "rentM2", label: "Aluguel anunciado por m²", match: /^(aluguel_m2_anuncio|rent_price_m2)$/i },
];

function pickNumbers(raw: unknown[]): ResearchNumber[] {
  const out: ResearchNumber[] = [];
  for (const rule of NUMBER_RULES) {
    const hit = raw.map(asRec).find((n) => rule.match.test(str(n.metric)) && num(n.value) !== null && isUrl(str(n.url)));
    if (!hit) continue;
    let value = num(hit.value)!;
    let unit = str(hit.unit);
    if (rule.metric === "density" && /hab\/ha/i.test(unit)) {
      value = Math.round(value * 100);
      unit = "hab/km²";
    }
    const note = clip(str(hit.note), TEXT_MAX.note);
    out.push({
      metric: rule.metric,
      label: rule.label,
      value,
      unit,
      year: num(hit.year),
      scope: str(hit.scope),
      source: clip(str(hit.source), TEXT_MAX.source),
      url: str(hit.url),
      ...(note ? { note } : {}),
    });
  }
  return out;
}

/** "1.234,5" / "1,234" / "191" → number (pt-BR and en separators). */
function parseLocaleNumber(s: string): number | null {
  const t = s.trim();
  const normalized = /,\d{1,2}$/.test(t) ? t.replace(/\./g, "").replace(",", ".") : t.replace(/[.,](?=\d{3}\b)/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Unit vs city ratio from a series: per-capita vs the first "<n>/100 mil", or count vs "per-DP average ~<n>". */
export function cityRatio(series: Rec): number | null {
  const comparison = str(series.comparison);
  const perCapita = num(series.perCapita);
  const value = num(series.value);
  if (/\bESTADO\b/.test(comparison)) return null;
  const rate = /(\d[\d.,]*)\s*\/\s*100\s*mil/i.exec(comparison);
  if (perCapita !== null && rate?.[1]) {
    const cityRate = parseLocaleNumber(rate[1]);
    if (cityRate) return Math.round((perCapita / cityRate) * 100) / 100;
  }
  const avg = /(?:per-DP average|average per DP)[^~]*~\s*(\d[\d.,]*)/i.exec(comparison);
  if (value !== null && avg?.[1]) {
    const cityAvg = parseLocaleNumber(avg[1]);
    if (cityAvg) return Math.round((value / cityAvg) * 100) / 100;
  }
  return null;
}

const SERIES_RULES: { kind: ResearchCrimeSeries["kind"]; match: RegExp }[] = [
  { kind: "robbery", match: /^(roubo de rua|roubo consumado|roubo \(total de roubo|roubo \(outros\)|roubo a transeunte)/i },
  { kind: "theft", match: /^(total de furtos|furto \(outros\)|furto a transeunte)/i },
  { kind: "homicide", match: /^(homic[ií]dio (doloso|consumado)|letalidade violenta)/i },
];

function pickSeries(raw: unknown[]): ResearchCrimeSeries[] {
  const out: ResearchCrimeSeries[] = [];
  for (const rule of SERIES_RULES) {
    const hit = raw
      .map(asRec)
      .find((s) => rule.match.test(str(s.indicator)) && num(s.value) !== null && isUrl(str(s.url)));
    if (!hit) continue;
    out.push({
      kind: rule.kind,
      indicator: str(hit.indicator),
      period: str(hit.period),
      value: num(hit.value)!,
      perCapita: num(hit.perCapita),
      ratioToCity: cityRatio(hit),
      comparison: clip(str(hit.comparison), TEXT_MAX.comparison),
      source: clip(str(hit.source), TEXT_MAX.source),
      url: str(hit.url),
    });
  }
  return out;
}

/** Short label for the unit the crime figures cover. */
export function crimeScope(officialUnit: string, robbery: ResearchCrimeSeries | undefined): string {
  if (/^MG:/i.test(officialUnit)) return "bairro (SEJUSP)";
  if (/\bESTADO\b/.test(officialUnit)) return "estado";
  const cisp = /CISP\s*\d+/i.exec(officialUnit);
  if (cisp) return cisp[0].toUpperCase().replace(/\s+/, " ");
  const dp = /\d+[ºª°]\s*DP/.exec(robbery?.comparison ?? "") ?? /\d+[ºª°]\s*DP/.exec(officialUnit);
  return dp ? dp[0].replace(/\s+/, " ") : "unidade policial";
}

/** Up to `max` opinions with a URL, alternating positive and negative first. */
function pickOpinions(raw: unknown[], max: number): ResearchOpinion[] {
  const all: ResearchOpinion[] = raw
    .map(asRec)
    .filter((o) => str(o.quote) && isUrl(str(o.url)))
    .map((o) => {
      const stance = str(o.stance);
      return {
        stance: stance === "positive" || stance === "negative" ? stance : "mixed",
        theme: str(o.theme),
        quote: clip(str(o.quote), TEXT_MAX.quote),
        source: clip(scrubAuthor(str(o.source)), TEXT_MAX.source),
        url: str(o.url),
        date: str(o.date) || null,
      };
    });
  const queues = {
    positive: all.filter((o) => o.stance === "positive"),
    negative: all.filter((o) => o.stance === "negative"),
    mixed: all.filter((o) => o.stance === "mixed"),
  };
  const order: ResearchOpinion["stance"][] = ["positive", "negative", "mixed"];
  const out: ResearchOpinion[] = [];
  const usedThemes = new Set<string>();
  while (out.length < max && order.some((s) => queues[s].length > 0)) {
    for (const s of order) {
      if (out.length >= max) break;
      const q = queues[s];
      const idx = q.findIndex((o) => !usedThemes.has(`${o.stance}:${o.theme}`));
      const [next] = q.splice(idx === -1 ? 0 : idx, 1);
      if (!next) continue;
      usedThemes.add(`${next.stance}:${next.theme}`);
      out.push(next);
    }
  }
  return out;
}

function toEvidence(v: unknown): ResearchEvidence | null {
  if (typeof v === "string") {
    const url = /https?:\/\/\S+/.exec(v)?.[0] ?? null;
    return v.trim() ? { text: clip(scrubAuthor(v.trim()), TEXT_MAX.evidence), url } : null;
  }
  const r = asRec(v);
  const text = str(r.text) || str(r.quote) || str(r.fact) || str(r.note) || str(r.source);
  const url = str(r.url);
  return text ? { text: clip(scrubAuthor(text), TEXT_MAX.evidence), url: isUrl(url) ? url : null } : null;
}

const CITY_CODES: Record<string, string> = {
  "belo horizonte": "BH",
  campinas: "CP",
  "rio de janeiro": "RJ",
  "são paulo": "SP",
  goiânia: "GO",
};

/** Accepts `[...]` or `{ neighborhoods: [...] }`, with city codes or full city names. */
export function buildRubricIndex(raw: unknown): Map<string, ResearchRubric> {
  const index = new Map<string, ResearchRubric>();
  const entries = Array.isArray(raw) ? raw : asArr(asRec(raw).neighborhoods);
  for (const entry of entries.map(asRec)) {
    const cityRaw = str(entry.city);
    const city = CITY_CODES[cityRaw.toLowerCase()] ?? cityRaw;
    const nb = str(entry.neighborhood);
    const total = num(entry.total_0_10);
    if (!city || !nb || total === null) continue;
    const criteria = Object.entries(asRec(entry.criteria)).map(([id, c]) => {
      const cr = asRec(c);
      const basis = str(cr.basis);
      return {
        name: str(cr.name) || id,
        ...(basis ? { basis } : {}),
        score: num(cr.score),
        evidence: asArr(cr.evidence)
          .map(toEvidence)
          .filter((e): e is ResearchEvidence => e !== null)
          .slice(0, MAX_EVIDENCE),
      };
    });
    index.set(researchKey(city, nb).toLowerCase(), {
      total,
      measuredShare: num(entry.measured_share),
      criteria,
    });
  }
  return index;
}

export function buildDossier(raw: unknown, rubrics: Map<string, ResearchRubric>): NeighborhoodDossier {
  const d = asRec(raw);
  const city = str(d.city);
  const neighborhood = str(d.neighborhood);
  const key = researchKey(city, neighborhood);
  const crime = asRec(d.crime);
  const series = pickSeries(asArr(crime.series));
  const officialUnit = str(crime.officialUnit);
  const marista = asRec(d.marista);
  const maristaScore = num(marista.score_0_10);
  return {
    key,
    city,
    neighborhood,
    researchedAt: str(d.researchedAt),
    numbers: pickNumbers(asArr(d.numbers)),
    crime: {
      officialUnit,
      scope: crimeScope(officialUnit, series.find((s) => s.kind === "robbery")),
      summary: clip(str(crime.summary), TEXT_MAX.summary),
      series,
    },
    highlights: asArr(d.highlights).map(str).filter(Boolean),
    redFlags: asArr(d.redFlags).map(str).filter(Boolean),
    opinions: pickOpinions(asArr(d.opinions), MAX_OPINIONS),
    news: asArr(d.news)
      .map(asRec)
      .filter((n) => str(n.headline) && isUrl(str(n.url)))
      .map((n) => ({
        date: str(n.date),
        headline: str(n.headline),
        outlet: str(n.outlet),
        url: str(n.url),
      }))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_NEWS),
    facts: asArr(d.facts)
      .map(asRec)
      .filter((f) => str(f.fact) && isUrl(str(f.url)))
      .map((f) => ({
        fact: clip(str(f.fact), TEXT_MAX.fact),
        source: clip(scrubAuthor(str(f.source)), TEXT_MAX.source),
        url: str(f.url),
      }))
      .slice(0, MAX_FACTS),
    gaps: asArr(d.gaps)
      .map((g) => clip(str(g), TEXT_MAX.gap))
      .filter(Boolean)
      .slice(0, MAX_GAPS),
    maristaJudgement:
      maristaScore !== null ? { score: maristaScore, why: clip(str(marista.why), TEXT_MAX.why) } : null,
    rubric: rubrics.get(key.toLowerCase()) ?? null,
  };
}

export function buildResearchFile(
  dossiers: unknown[],
  rubricRaw: unknown,
  builtAt = new Date().toISOString(),
): NeighborhoodResearchFile {
  const rubrics = buildRubricIndex(rubricRaw);
  const out: NeighborhoodResearchFile = { builtAt, dossiers: {} };
  for (const raw of dossiers) {
    const dossier = buildDossier(raw, rubrics);
    if (dossier.city && dossier.neighborhood) out.dossiers[dossier.key] = dossier;
  }
  return out;
}

function argValue(flag: string): string | null {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

function main() {
  const base = join(homedir(), ".cursor/Empty/.tmp/nb-research");
  const inDir = argValue("--in") ?? join(base, "out");
  const rubricPath = argValue("--rubric") ?? join(base, "rubric-scores.json");
  const files = readdirSync(inDir).filter((f) => f.endsWith(".json")).sort((a, b) => a.localeCompare(b));
  const dossiers = files.map((f) => JSON.parse(readFileSync(join(inDir, f), "utf8")) as unknown);
  const rubricRaw = existsSync(rubricPath) ? (JSON.parse(readFileSync(rubricPath, "utf8")) as unknown) : [];
  const built = buildResearchFile(dossiers, rubricRaw);
  const outPath = join(process.cwd(), "src/data/neighborhood-research.json");
  const json = `${JSON.stringify(built)}\n`;
  writeFileSync(outPath, json);
  const withRubric = Object.values(built.dossiers).filter((d) => d.rubric).length;
  console.log(
    `wrote ${outPath}: ${Object.keys(built.dossiers).length} dossiers, ${withRubric} with rubric, ${(Buffer.byteLength(json) / 1024).toFixed(1)} KB`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
