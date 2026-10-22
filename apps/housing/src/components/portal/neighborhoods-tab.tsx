"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";

import { CITY_BADGE_INFO } from "@/components/portal/constants";
import {
  commuteUpperBound,
  nextSort,
  sortItems,
  type SortDir,
  type SortState,
  type SortValue,
} from "@/components/portal/neighborhood-sort";
import { NeighborhoodResearchPanel } from "@/components/portal/neighborhood-research-panel";
import { decimal, formatDensity, subScoreText } from "@/components/portal/neighborhood-research-strip";
import type { PortalController } from "@/components/portal/use-portal-controller";
import {
  rankWithReferences,
  REFERENCE_NEIGHBORHOODS,
  type ReferenceNeighborhood,
  type ReferenceNeighborhoodRow,
} from "@/lib/reference-neighborhood";
import { URBAN_LIFE_CRITERIA_TEXT } from "@/lib/urban-breathing";
import { normalizeNeighborhoodKey } from "@/lib/scoring-engine";
import type { ComputedNeighborhood, ScoringWeights } from "@/types/housing";
import { QOL_COLUMNS } from "@/lib/neighborhood-qol";
import type { NeighborhoodResearchSummary, QolColumnId, QolRow } from "@/types/neighborhood-research";

type ScoreRow = Pick<
  ComputedNeighborhood,
  | "urbanBreathingScore"
  | "commuteLogisticsScore"
  | "safetyCarScore"
>;

/** The three sub-scores that feed the dynamic score, in the engine's effective (capped) values. */
const SUB_SCORES: {
  id: string;
  label: string;
  short: string;
  weightKey: keyof ScoringWeights;
  value: (n: ScoreRow) => number;
}[] = [
  { id: "urban", label: "Vida urbana", short: "Vida urb.", weightKey: "urbanBreathingWeight", value: (n) => n.urbanBreathingScore },
  { id: "commute", label: "Deslocamento", short: "Desloc.", weightKey: "commuteLogisticsWeight", value: (n) => n.commuteLogisticsScore },
  { id: "safety", label: "Segurança", short: "Segur.", weightKey: "safetyCarWeight", value: (n) => n.safetyCarScore },
];

function weightTitle(label: string, weights: ScoringWeights, key: keyof ScoringWeights): string {
  const w = weights[key];
  const weight = `peso atual ${typeof w === "number" ? decimal(w) : "—"}×`;
  return key === "urbanBreathingWeight" ? `${URBAN_LIFE_CRITERIA_TEXT} · ${weight}` : `${label} (0–10) · ${weight}`;
}

function subScoreCellTitle(
  s: (typeof SUB_SCORES)[number],
  score: number,
  weights: ScoringWeights,
): string {
  const w = Number(weights[s.weightKey]) || 0;
  const wSum =
    (Number(weights.urbanBreathingWeight) || 0) +
    (Number(weights.commuteLogisticsWeight) || 0) +
    (Number(weights.safetyCarWeight) || 0);
  const contrib = wSum > 0 ? (score * w) / wSum : 0;
  const sharePct = wSum > 0 ? Math.round((w / wSum) * 100) : 0;
  return `${s.label}: ${subScoreText(score)}/10 × peso ${decimal(w)}× (${sharePct}%) → contribuição ponderada +${contrib.toFixed(2)} pts na Nota Dinâmica`;
}

function densityCellTitle(
  s: NeighborhoodResearchSummary | undefined,
  weights: ScoringWeights,
  urbanScore?: number,
): string {
  const parts: string[] = [];
  if (s?.densityPerKm2 != null) {
    parts.push(`Densidade: ${formatDensity(s.densityPerKm2)} hab/km² (IBGE Censo 2022)`);
  } else {
    parts.push("Densidade demográfica, hab/km² (IBGE Censo 2022)");
  }
  if (s?.apartmentsShare != null) {
    parts.push(
      `${s.apartmentsShare.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de apartamentos`,
    );
  }
  if (urbanScore !== undefined) {
    const w = Number(weights.urbanBreathingWeight) || 0;
    const wSum =
      (Number(weights.urbanBreathingWeight) || 0) +
      (Number(weights.commuteLogisticsWeight) || 0) +
      (Number(weights.safetyCarWeight) || 0);
    const contrib = wSum > 0 ? (urbanScore * w) / wSum : 0;
    parts.push(
      `Compõe Vida urbana (${subScoreText(urbanScore)}/10, peso ${decimal(w)}× → +${contrib.toFixed(2)} pts na Nota Dinâmica)`,
    );
  }
  return parts.join(" · ");
}

/** Research column: density; "—" without research. */
export function researchCells(s: NeighborhoodResearchSummary | undefined): { density: string } {
  return { density: s?.densityPerKm2 == null ? "—" : formatDensity(s.densityPerKm2) };
}

const RESEARCH_HEADERS = [
  { id: "density", label: "Densidade", short: "Densid.", title: "Densidade demográfica, hab/km² (IBGE Censo 2022)" },
] as const;

const EMPTY_QOL: Record<string, QolRow> = {};

/** Public quality-of-life cells (display only): "—" without data, the scope and caveats on hover. */
function QolCells({ row }: { row: QolRow | undefined }) {
  return QOL_COLUMNS.map((c) => {
    const cell = row?.[c.id];
    return (
      <td key={c.id} title={cell?.hint || undefined} className="px-3 py-3 text-right font-mono whitespace-nowrap">
        {cell?.text ?? "—"}
      </td>
    );
  });
}

const COMMUTE_NEUTRAL_TEXT = "neutro";

export const TOP_NEIGHBORHOODS_LIMIT = 20;

const EXTRA_TITLE = "Bairro pesquisado fora da lista original";

const REFERENCE_BY_KEY = new Map(REFERENCE_NEIGHBORHOODS.map((r) => [r.key, r]));

type ListItem =
  | { kind: "catalog"; n: ComputedNeighborhood; rank: number }
  | { kind: "reference"; ref: ReferenceNeighborhoodRow; info: ReferenceNeighborhood; rank: number };

/** Every desktop column, in table order; the mobile "Ordenar por" select offers the same list. */
const SORT_COLUMNS: { key: string; label: string; defaultDir: SortDir; align?: "right"; title?: (w: ScoringWeights) => string }[] = [
  { key: "rank", label: "Pos. Dinâmica", defaultDir: "asc" },
  { key: "city", label: "Cidade", defaultDir: "asc" },
  { key: "name", label: "Bairro", defaultDir: "asc" },
  { key: "score", label: "Nota Dinâmica", defaultDir: "desc", align: "right" },
  ...SUB_SCORES.map((s) => ({
    key: s.id,
    label: s.label,
    defaultDir: "desc" as const,
    align: "right" as const,
    title: (w: ScoringWeights) => weightTitle(s.label, w, s.weightKey),
  })),
  ...RESEARCH_HEADERS.map((h) => ({ key: h.id, label: h.label, defaultDir: "desc" as const, align: "right" as const, title: () => h.title })),
  ...QOL_COLUMNS.map((c) => ({ key: c.id, label: c.label, defaultDir: c.defaultDir, align: "right" as const, title: () => c.title })),
  { key: "commuteTime", label: "Tempo Nubank", defaultDir: "asc" },
  { key: "rationale", label: "Justificativa Detalhada", defaultDir: "asc" },
];
const COLUMN_BY_KEY = new Map(SORT_COLUMNS.map((c) => [c.key, c]));
const DEFAULT_SORT: SortState = { key: "score", dir: "desc" };

const textOrNull = (s: string) => (s.trim() ? s : null);

const QOL_COLUMN_IDS = new Set<string>(QOL_COLUMNS.map((c) => c.id));

const rowKeyOf = (item: ListItem) => (item.kind === "catalog" ? `${item.n.cityCode}:${item.n.neighborhood}` : item.ref.key);

/** The value a row sorts by; references have no commute ("neutro") and sort last on both commute columns. */
function sortValue(
  item: ListItem,
  key: string,
  research: (key: string) => NeighborhoodResearchSummary | undefined,
  qol: (key: string) => QolRow | undefined,
): SortValue {
  const row = item.kind === "catalog" ? item.n : item.ref;
  const rowKey = rowKeyOf(item);
  if (QOL_COLUMN_IDS.has(key)) return qol(rowKey)?.[key as QolColumnId]?.value ?? null;
  const sub = SUB_SCORES.find((s) => s.id === key);
  if (key === "rank") return item.rank;
  if (key === "score") return row.dynamicScore;
  if (key === "name") return row.neighborhood;
  if (key === "city") return item.kind === "catalog" ? CITY_BADGE_INFO[item.n.cityCode].ufLabel : item.info.ufLabel;
  if (sub) return item.kind === "reference" && sub.id === "commute" ? null : sub.value(row);
  if (key === "density") return research(rowKey)?.densityPerKm2 ?? null;
  if (key === "commuteTime") return item.kind === "catalog" ? commuteUpperBound(item.n.commuteTime) : null;
  return textOrNull(row.shortRationale || (item.kind === "reference" ? item.info.subtitle : ""));
}

export function NeighborhoodsTab({ ctl }: { ctl: PortalController }) {
  const {
    activeTab,
    dynamicNeighborhoods,
    neighborhoodRanking,
    referenceNeighborhoods,
    neighborhoodResearch,
    selectedCities,
    setActiveTab,
    setSelectedCities,
    setSelectedNeighborhoods,
    weights,
  } = ctl;
  const neighborhoodQol = ctl.neighborhoodQol ?? EMPTY_QOL;
  const neighborhoodOptions =
    (ctl as { neighborhoodOptions?: PortalController["availableNeighborhoodOptions"] }).neighborhoodOptions ??
    ctl.availableNeighborhoodOptions ??
    [];
  const [researchOpenKey, setResearchOpenKey] = useState<string | null>(null);
  const [showMoreMetrics, setShowMoreMetrics] = useState(false);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const closeResearch = useCallback(() => setResearchOpenKey(null), []);
  const sortBy = (key: string) => setSort((s) => nextSort(s, key, COLUMN_BY_KEY.get(key)?.defaultDir ?? "desc"));

  if (activeTab !== "neighborhoods") return null;

  const supplyCountByKey = new Map<string, number>();
  for (const opt of neighborhoodOptions) {
    const exactKey = `${opt.cityCode}:${opt.name}`;
    supplyCountByKey.set(exactKey, (supplyCountByKey.get(exactKey) ?? 0) + opt.count);
    const normKey = `${opt.cityCode}:${normalizeNeighborhoodKey(opt.name, opt.cityCode)}`;
    if (normKey !== exactKey) {
      supplyCountByKey.set(normKey, (supplyCountByKey.get(normKey) ?? 0) + opt.count);
    }
  }
  const supplyCountOf = (n: ComputedNeighborhood): number =>
    supplyCountByKey.get(`${n.cityCode}:${n.neighborhood}`) ??
    supplyCountByKey.get(`${n.cityCode}:${normalizeNeighborhoodKey(n.neighborhood, n.cityCode)}`) ??
    0;

  // Ranks come from the whole list with the references merged in, so a city filter keeps each row's number.
  let items: ListItem[] = [];
  let catalogShown = 0;
  for (const it of rankWithReferences(neighborhoodRanking, referenceNeighborhoods)) {
    if (it.kind === "reference") {
      const info = REFERENCE_BY_KEY.get(it.ref.key);
      if (info) items.push({ ...it, info });
      continue;
    }
    if (selectedCities.length > 0 && !selectedCities.includes(it.n.cityCode)) continue;
    if (catalogShown === TOP_NEIGHBORHOODS_LIMIT) continue;
    catalogShown++;
    items.push(it);
  }
  if (catalogShown === 0) items = [];
  // Sorting reorders the rows shown; each row keeps its score rank number.
  items = sortItems(
    items,
    sort,
    (it, key) => sortValue(it, key, (k) => neighborhoodResearch[k], (k) => neighborhoodQol[k]),
    (it) => it.rank,
  );
  // Catalog rows compare their base position with their catalog-only dynamic rank, so extras don't inflate the diff.
  const catalogRank = new Map(
    dynamicNeighborhoods.map((n) => [`${n.cityCode}:${n.neighborhood}`, n.dynamicOverallRank]),
  );
  const rankDiffOf = (n: ComputedNeighborhood) => {
    const rank = n.isExtra ? undefined : catalogRank.get(`${n.cityCode}:${n.neighborhood}`);
    return rank === undefined ? 0 : n.overallPosition - rank;
  };
  const researchFor = (n: ComputedNeighborhood) => neighborhoodResearch[`${n.cityCode}:${n.neighborhood}`];
  const commuteNeutralTitle = (ref: ReferenceNeighborhoodRow, info: ReferenceNeighborhood) =>
    `${info.commuteLabel}: mediana dos bairros visíveis, ${decimal(ref.commuteLogisticsScore)}`;
  const goToNeighborhood = (n: ComputedNeighborhood) => {
    setSelectedCities([n.cityCode]);
    setSelectedNeighborhoods([`${n.cityCode}:${n.neighborhood}`]);
    setActiveTab("properties");
  };


  return (
    <section className="space-y-4">
      {/* Mobile / Compact Neighborhood Cards (< md) */}
      <div className="space-y-3 md:hidden">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            Ordenar por
            <select
              data-testid="neighborhood-sort-select"
              value={sort.key}
              onChange={(e) => {
                const key = e.target.value;
                setSort({ key, dir: COLUMN_BY_KEY.get(key)?.defaultDir ?? "desc" });
              }}
              className="min-h-11 min-w-0 max-w-[11rem] rounded-lg border bg-background px-2 text-xs font-semibold text-foreground"
            >
              {SORT_COLUMNS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="neighborhood-sort-direction"
            aria-label={sort.dir === "asc" ? "Ordem crescente" : "Ordem decrescente"}
            onClick={() => setSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }))}
            className="min-h-11 min-w-11 rounded-lg border px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary"
          >
            <span aria-hidden="true">{sort.dir === "asc" ? "▲" : "▼"}</span>
          </button>
          <button
            type="button"
            aria-pressed={showMoreMetrics}
            onClick={() => setShowMoreMetrics((v) => !v)}
            className="min-h-11 rounded-lg border px-3 text-xs font-semibold text-muted-foreground hover:bg-secondary"
          >
            {showMoreMetrics ? "Menos métricas" : "Mais métricas"}
          </button>
        </div>
        {items.map((item) => {
          if (item.kind === "reference") {
            const { ref, info } = item;
            return (
              <article
                key={`mob-reference-${ref.key}`}
                data-testid="reference-neighborhood-card"
                className="space-y-2.5 rounded-xl border-2 border-dashed border-muted-foreground/40 bg-muted/30 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs font-bold">#{item.rank}</span>
                    <span className="rounded-md border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                      {info.badge}
                    </span>
                    <span className="inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-muted-foreground">
                      {info.ufLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => setResearchOpenKey(ref.key)}
                      aria-haspopup="dialog"
                      className="text-sm font-bold text-foreground hover:underline"
                    >
                      {ref.neighborhood}
                    </button>
                  </div>
                  <span className="font-mono text-base font-bold text-muted-foreground">
                    {ref.dynamicScore.toFixed(2)}/10
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{info.subtitle}</p>
                <div className="space-y-1 text-xs leading-relaxed">
                  <RationaleText short={ref.shortRationale} detailed={ref.detailedJustification} />
                </div>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-background/60 p-2 text-center">
                  {SUB_SCORES.map((s) => (
                    <div
                      key={s.id}
                      title={
                        s.id === "commute"
                          ? commuteNeutralTitle(ref, info)
                          : subScoreCellTitle(s, s.value(ref), weights)
                      }
                    >
                      <span className="block text-xs leading-tight text-muted-foreground">{s.short}</span>
                      <strong className="font-mono text-xs">
                        {s.id === "commute" ? COMMUTE_NEUTRAL_TEXT : subScoreText(s.value(ref))}
                      </strong>
                    </div>
                  ))}
                </div>
                {showMoreMetrics && (
                  <MobileResearchRow
                    cells={researchCells(neighborhoodResearch[ref.key])}
                    qol={neighborhoodQol[ref.key]}
                    densityTitle={densityCellTitle(neighborhoodResearch[ref.key], weights, ref.urbanBreathingScore)}
                  />
                )}
              </article>
            );
          }
          const n = item.n;
          const rankDiff = rankDiffOf(n);
          const supplyCount = supplyCountOf(n);
          const summary = researchFor(n);
          return (
            <article
              key={`mob-${n.cityCode}:${n.neighborhood}`}
              className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs font-bold">
                    #{item.rank}
                    {rankDiff !== 0 && (
                      <span
                        className={`ml-1 text-[10px] ${
                          rankDiff > 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400"
                        }`}
                      >
                        ({rankDiff > 0 ? `+${rankDiff}` : rankDiff})
                      </span>
                    )}
                  </span>
                  <span
                    className={`inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${
                      CITY_BADGE_INFO[n.cityCode].className
                    }`}
                  >
                    {CITY_BADGE_INFO[n.cityCode].ufLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() => goToNeighborhood(n)}
                    className="text-sm font-bold text-primary hover:underline"
                  >
                    {n.neighborhood}
                  </button>
                  {n.isExtra && <ExtraBadge />}
                  {supplyCount > 0 && (
                    <span
                      data-testid="neighborhood-supply-badge"
                      title={`${supplyCount} ${supplyCount === 1 ? "imóvel ativo neste bairro" : "imóveis ativos neste bairro"}`}
                      className="inline-flex items-center rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
                    >
                      {supplyCount} {supplyCount === 1 ? "imóvel" : "imóveis"}
                    </span>
                  )}
                  <button
                    type="button"
                    data-testid="neighborhood-dossier-button"
                    aria-haspopup="dialog"
                    aria-label={`Abrir dossiê de ${n.neighborhood}`}
                    title={`Abrir dossiê de pesquisa de ${n.neighborhood}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setResearchOpenKey(summary?.key ?? `${n.cityCode}:${n.neighborhood}`);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-sky-600/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 hover:bg-sky-500/20 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-200"
                  >
                    <span aria-hidden="true">📊</span>
                    <span>Dossiê</span>
                  </button>
                </div>
                <span className="font-mono text-base font-bold text-primary">
                  {n.dynamicScore.toFixed(2)}/10
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/50 p-2 text-center">
                {SUB_SCORES.map((s) => (
                  <div key={s.id} title={subScoreCellTitle(s, s.value(n), weights)}>
                    <span className="block text-xs leading-tight text-muted-foreground">{s.short}</span>
                    <strong className="font-mono text-xs">{subScoreText(s.value(n))}</strong>
                  </div>
                ))}
              </div>
              {showMoreMetrics && (
                <MobileResearchRow
                  cells={researchCells(summary)}
                  qol={neighborhoodQol[rowKeyOf(item)]}
                  densityTitle={densityCellTitle(summary, weights, n.urbanBreathingScore)}
                />
              )}

              <p className="text-xs font-medium text-foreground">
                <span className="font-mono text-[11px] text-muted-foreground mr-1.5">
                  [{n.commuteTime}]
                </span>
                {n.shortRationale}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">{stripNotePrefix(n.detailedJustification)}</p>
            </article>
          );
        })}
      </div>

      {/* Desktop Full Table (>= md) */}
      <div className="hidden md:block rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/50 text-[11px] font-bold uppercase text-muted-foreground">
              <tr>
                {SORT_COLUMNS.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      title={c.title?.(weights)}
                      className={`px-3 py-3 whitespace-nowrap ${c.align === "right" ? "text-right" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => sortBy(c.key)}
                        className="inline-flex items-center gap-1 font-bold uppercase hover:text-foreground"
                      >
                        {c.label}
                        <span aria-hidden="true" className="w-2 text-[9px]">
                          {active ? (sort.dir === "asc" ? "▲" : "▼") : ""}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                if (item.kind === "reference") {
                  const { ref, info } = item;
                  const research = researchCells(neighborhoodResearch[ref.key]);
                  return (
                    <tr
                      key={`reference-${ref.key}`}
                      data-testid="reference-neighborhood-row"
                      onClick={() => setResearchOpenKey(ref.key)}
                      className="cursor-pointer border-2 border-dashed border-muted-foreground/40 bg-muted/30 align-top text-muted-foreground hover:bg-muted/50"
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="font-mono font-bold">#{item.rank}</span>
                        <span className="ml-1.5 rounded-md border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-xs font-semibold">
                          {info.badge}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider">
                          {info.ufLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold whitespace-nowrap">
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          onClick={(e) => {
                            e.stopPropagation();
                            setResearchOpenKey(ref.key);
                          }}
                          className="text-foreground hover:underline"
                        >
                          {ref.neighborhood}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-sm font-bold">
                        {ref.dynamicScore.toFixed(2)}
                      </td>
                      {SUB_SCORES.map((s) =>
                        s.id === "commute" ? (
                          <td key={s.id} className="px-3 py-3 text-right" title={commuteNeutralTitle(ref, info)}>
                            {COMMUTE_NEUTRAL_TEXT}
                          </td>
                        ) : (
                          <td
                            key={s.id}
                            title={subScoreCellTitle(s, s.value(ref), weights)}
                            className="px-3 py-3 text-right font-mono"
                          >
                            {subScoreText(s.value(ref))}
                          </td>
                        ),
                      )}
                      {RESEARCH_HEADERS.map((h) => (
                        <td
                          key={h.id}
                          title={densityCellTitle(neighborhoodResearch[ref.key], weights, ref.urbanBreathingScore)}
                          className="px-3 py-3 text-right font-mono"
                        >
                          {research[h.id]}
                        </td>
                      ))}
                      <QolCells row={neighborhoodQol[ref.key]} />
                      <td className="px-3 py-3 whitespace-nowrap">{info.commuteLabel}</td>
                      <td className="px-3 py-3 min-w-[560px] max-w-xl leading-relaxed space-y-1.5">
                        <p>{info.subtitle}</p>
                        <RationaleText short={ref.shortRationale} detailed={ref.detailedJustification} />
                      </td>
                    </tr>
                  );
                }
                const n = item.n;
                const rankDiff = rankDiffOf(n);
                const summary = researchFor(n);
                const research = researchCells(summary);
                const supplyCount = supplyCountOf(n);
                return (
                  <tr
                    key={`${n.cityCode}:${n.neighborhood}`}
                    className="hover:bg-muted/30 align-top"
                  >
                    <td className="px-3 py-3 font-mono font-bold whitespace-nowrap">
                      #{item.rank}
                      {rankDiff !== 0 && (
                        <span
                          className={`ml-1.5 text-[10px] ${
                            rankDiff > 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          ({rankDiff > 0 ? `+${rankDiff}` : rankDiff})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 font-semibold whitespace-nowrap">
                      <span
                        className={`inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider ${
                          CITY_BADGE_INFO[n.cityCode].className
                        }`}
                      >
                        {CITY_BADGE_INFO[n.cityCode].ufLabel}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-bold whitespace-nowrap">
                      <div className="inline-flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => goToNeighborhood(n)}
                          className="text-primary hover:underline"
                        >
                          {n.neighborhood}
                        </button>
                        {n.isExtra && <ExtraBadge />}
                        {supplyCount > 0 && (
                          <span
                            data-testid="neighborhood-supply-badge"
                            title={`${supplyCount} ${supplyCount === 1 ? "imóvel ativo neste bairro" : "imóveis ativos neste bairro"}`}
                            className="inline-flex items-center rounded-md border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
                          >
                            {supplyCount} {supplyCount === 1 ? "imóvel" : "imóveis"}
                          </span>
                        )}
                        <button
                          type="button"
                          data-testid="neighborhood-dossier-button"
                          aria-haspopup="dialog"
                          aria-label={`Abrir dossiê de ${n.neighborhood}`}
                          title={`Abrir dossiê de pesquisa de ${n.neighborhood}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setResearchOpenKey(summary?.key ?? `${n.cityCode}:${n.neighborhood}`);
                          }}
                          className="inline-flex items-center gap-1 rounded border border-sky-600/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800 hover:bg-sky-500/20 dark:border-sky-400/30 dark:bg-sky-500/15 dark:text-sky-200"
                        >
                          <span aria-hidden="true">📊</span>
                          <span>Dossiê</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-bold text-primary">
                      {n.dynamicScore.toFixed(2)}
                    </td>
                    {SUB_SCORES.map((s) => (
                      <td
                        key={s.id}
                        title={subScoreCellTitle(s, s.value(n), weights)}
                        className="px-3 py-3 text-right font-mono"
                      >
                        {subScoreText(s.value(n))}
                      </td>
                    ))}
                    {RESEARCH_HEADERS.map((h) => (
                      <td
                        key={h.id}
                        title={densityCellTitle(summary, weights, n.urbanBreathingScore)}
                        className="px-3 py-3 text-right font-mono"
                      >
                        {research[h.id]}
                      </td>
                    ))}
                    <QolCells row={neighborhoodQol[rowKeyOf(item)]} />
                    <td className="px-3 py-3 whitespace-nowrap font-mono">
                      {n.commuteTime}
                    </td>
                    <td className="px-3 py-3 min-w-[560px] max-w-xl leading-relaxed text-muted-foreground space-y-1.5">
                      <RationaleText short={n.shortRationale} detailed={n.detailedJustification} />
                      <details className="group rounded-lg border bg-background/60 p-2.5 text-[11px]">
                        <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                          Ver memória de cálculo e notas quebradas
                        </summary>
                        <p className="mt-1.5 leading-relaxed text-muted-foreground">
                          {n.dynamicJustification}
                        </p>
                      </details>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {researchOpenKey &&
        createPortal(
          <NeighborhoodResearchPanel
            researchKey={researchOpenKey}
            neighborhood={
              REFERENCE_BY_KEY.get(researchOpenKey)?.neighborhood ??
              neighborhoodRanking.find(
                (n) =>
                  `${n.cityCode}:${n.neighborhood}` === researchOpenKey ||
                  researchFor(n)?.key === researchOpenKey,
              )?.neighborhood ??
              researchOpenKey.replace(/^[A-Z]+:/, "")
            }
            onClose={closeResearch}
          />,
          document.body,
        )}
    </section>
  );
}

const stripNotePrefix = (text: string) => text.replace(/^Nota\s+[\d.]+\/10\s*\([^)]*\):\s*/i, "");

/** Justification text: the one-line rationale, then the detailed one without its "Nota X/10 (...):" prefix. */
function RationaleText({ short, detailed }: { short: string; detailed: string }) {
  if (!short && !detailed) return null;
  return (
    <>
      <p className="font-medium text-foreground">{short}</p>
      <p className="text-xs text-muted-foreground">{stripNotePrefix(detailed)}</p>
    </>
  );
}

function ExtraBadge({ className = "" }: { className?: string }) {
  return (
    <span
      title={EXTRA_TITLE}
      data-testid="extra-neighborhood-badge"
      className={`rounded border border-dashed border-muted-foreground/40 px-1 py-px text-[10px] font-medium text-muted-foreground ${className}`}
    >
      extra
    </span>
  );
}

function MobileResearchRow({
  cells,
  qol,
  densityTitle,
}: {
  cells: ReturnType<typeof researchCells>;
  qol: QolRow | undefined;
  densityTitle?: string;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg border border-dashed p-2 text-center">
      {RESEARCH_HEADERS.map((h) => (
        <div key={h.id} title={densityTitle ?? h.title} className="min-w-0">
          <span className="block text-xs leading-tight text-muted-foreground">{h.short}</span>
          <strong className="font-mono text-xs">{cells[h.id]}</strong>
        </div>
      ))}
      {QOL_COLUMNS.map((c) => {
        const cell = qol?.[c.id];
        return (
          <div key={c.id} title={cell?.hint || c.title} className="min-w-0" data-testid={`mobile-qol-${c.id}`}>
            <span className="block truncate text-xs leading-tight text-muted-foreground">{c.short}</span>
            <strong className="font-mono text-xs whitespace-nowrap">{cell?.text ?? "—"}</strong>
          </div>
        );
      })}
    </div>
  );
}
