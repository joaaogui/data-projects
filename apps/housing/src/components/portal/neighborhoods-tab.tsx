"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";

import { CITY_BADGE_INFO } from "@/components/portal/constants";
import { NeighborhoodResearchPanel } from "@/components/portal/neighborhood-research-panel";
import { decimal, formatDensity } from "@/components/portal/neighborhood-research-strip";
import type { PortalController } from "@/components/portal/use-portal-controller";
import {
  REFERENCE_NEIGHBORHOOD,
  referenceInsertIndex,
  type ReferenceNeighborhoodRow,
} from "@/lib/reference-neighborhood";
import type { ComputedNeighborhood, ScoringWeights } from "@/types/housing";
import type { NeighborhoodResearchSummary } from "@/types/neighborhood-research";

type ScoreRow = Pick<
  ComputedNeighborhood,
  | "urbanBreathingScore"
  | "commuteLogisticsScore"
  | "buildingStockFitScore"
  | "budgetFitScore"
  | "safetyCarScore"
>;

/** The five sub-scores that feed the dynamic score, in the engine's effective (capped) values. */
const SUB_SCORES: {
  id: string;
  label: string;
  short: string;
  weightKey: keyof ScoringWeights;
  value: (n: ScoreRow) => number;
}[] = [
  { id: "urban", label: "Vida urbana", short: "Vida urb.", weightKey: "urbanBreathingWeight", value: (n) => n.urbanBreathingScore },
  { id: "commute", label: "Deslocamento", short: "Desloc.", weightKey: "commuteLogisticsWeight", value: (n) => n.commuteLogisticsScore },
  { id: "stock", label: "Prédios", short: "Prédios", weightKey: "buildingStockWeight", value: (n) => n.buildingStockFitScore },
  { id: "budget", label: "Preço", short: "Preço", weightKey: "budgetFitWeight", value: (n) => n.budgetFitScore },
  { id: "safety", label: "Segurança", short: "Segur.", weightKey: "safetyCarWeight", value: (n) => n.safetyCarScore },
];

function weightTitle(label: string, weights: ScoringWeights, key: keyof ScoringWeights): string {
  const w = weights[key];
  return `${label} (0–10) · peso atual ${typeof w === "number" ? decimal(w) : "—"}×`;
}

/** Research columns: Marista rubric, density and apartment share; "—" without research. */
export function researchCells(s: NeighborhoodResearchSummary | undefined): {
  marista: string;
  density: string;
  apartments: string;
} {
  return {
    marista:
      s?.marista == null ? "—" : s.maristaSource === "rubric" ? decimal(s.marista) : `≈${decimal(s.marista)}`,
    density: s?.densityPerKm2 == null ? "—" : formatDensity(s.densityPerKm2),
    apartments:
      s?.apartmentsShare == null ? "—" : `${s.apartmentsShare.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}%`,
  };
}

const RESEARCH_HEADERS = [
  { id: "marista", label: "Marista", short: "Marista", title: "Semelhança com o Setor Marista (rubrica 0–10; ≈ = juízo do pesquisador)" },
  { id: "density", label: "Densidade", short: "Densid.", title: "Densidade demográfica, hab/km² (IBGE Censo 2022)" },
  { id: "apartments", label: "Aptos", short: "Aptos", title: "Domicílios que são apartamentos (%, IBGE Censo 2022)" },
] as const;

const COMMUTE_NEUTRAL_TEXT = "neutro";

type ListItem =
  | { kind: "catalog"; n: ComputedNeighborhood }
  | { kind: "reference"; ref: ReferenceNeighborhoodRow };

export function NeighborhoodsTab({ ctl }: { ctl: PortalController }) {
  const {
    activeTab,
    dynamicNeighborhoods,
    referenceNeighborhood,
    neighborhoodResearch,
    selectedCities,
    setActiveTab,
    setSelectedCities,
    setSelectedNeighborhoods,
    weights,
  } = ctl;
  const [researchOpen, setResearchOpen] = useState(false);
  const [showMoreMetrics, setShowMoreMetrics] = useState(false);
  const closeResearch = useCallback(() => setResearchOpen(false), []);

  if (activeTab !== "neighborhoods") return null;

  const rows = dynamicNeighborhoods.filter(
    (n) => selectedCities.length === 0 || selectedCities.includes(n.cityCode),
  );
  const items: ListItem[] = rows.map((n) => ({ kind: "catalog", n }));
  if (referenceNeighborhood && rows.length > 0) {
    items.splice(referenceInsertIndex(rows, referenceNeighborhood.dynamicScore), 0, {
      kind: "reference",
      ref: referenceNeighborhood,
    });
  }
  const researchFor = (n: ComputedNeighborhood) => neighborhoodResearch[`${n.cityCode}:${n.neighborhood}`];
  const referenceResearch = researchCells(neighborhoodResearch[REFERENCE_NEIGHBORHOOD.key]);
  const commuteNeutralTitle = (ref: ReferenceNeighborhoodRow) =>
    `${REFERENCE_NEIGHBORHOOD.commuteLabel}: mediana dos bairros visíveis, ${decimal(ref.commuteLogisticsScore)}`;
  const goToNeighborhood = (n: ComputedNeighborhood) => {
    setSelectedCities([n.cityCode]);
    setSelectedNeighborhoods([`${n.cityCode}:${n.neighborhood}`]);
    setActiveTab("properties");
  };
  const openResearch = () => setResearchOpen(true);

  return (
    <section className="space-y-4">
      {/* Mobile / Compact Neighborhood Cards (< md) */}
      <div className="space-y-3 md:hidden">
        <div className="flex justify-end">
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
            const ref = item.ref;
            return (
              <article
                key="mob-reference"
                data-testid="reference-neighborhood-card"
                className="space-y-2.5 rounded-xl border-2 border-dashed border-muted-foreground/40 bg-muted/30 p-3.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-xs font-semibold text-muted-foreground">
                      Referência
                    </span>
                    <span className="inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-muted-foreground">
                      {REFERENCE_NEIGHBORHOOD.ufLabel}
                    </span>
                    <button
                      type="button"
                      onClick={openResearch}
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
                <p className="text-xs text-muted-foreground">{REFERENCE_NEIGHBORHOOD.subtitle}</p>
                <div className="grid grid-cols-5 gap-1 rounded-lg bg-background/60 p-2 text-center">
                  {SUB_SCORES.map((s) => (
                    <div key={s.id} title={s.id === "commute" ? commuteNeutralTitle(ref) : undefined}>
                      <span className="block text-xs leading-tight text-muted-foreground">{s.short}</span>
                      <strong className="font-mono text-xs">
                        {s.id === "commute" ? COMMUTE_NEUTRAL_TEXT : s.value(ref).toFixed(1)}
                      </strong>
                    </div>
                  ))}
                </div>
                {showMoreMetrics && <MobileResearchRow cells={referenceResearch} />}
              </article>
            );
          }
          const n = item.n;
          const rankDiff = n.overallPosition - n.dynamicOverallRank;
          return (
            <article
              key={`mob-${n.cityCode}:${n.neighborhood}`}
              className="rounded-xl border bg-card p-3.5 shadow-2xs space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-xs font-bold">
                    #{n.dynamicOverallRank}
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
                </div>
                <span className="font-mono text-base font-bold text-primary">
                  {n.dynamicScore.toFixed(2)}/10
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1 rounded-lg bg-muted/50 p-2 text-center">
                {SUB_SCORES.map((s) => (
                  <div key={s.id}>
                    <span className="block text-xs leading-tight text-muted-foreground">{s.short}</span>
                    <strong className="font-mono text-xs">{s.value(n).toFixed(1)}</strong>
                  </div>
                ))}
              </div>
              {showMoreMetrics && <MobileResearchRow cells={researchCells(researchFor(n))} />}

              <p className="text-xs font-medium text-foreground">
                <span className="font-mono text-[11px] text-muted-foreground mr-1.5">
                  [{n.commuteTime}]
                </span>
                {n.shortRationale}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {n.detailedJustification.replace(
                  /^Nota\s+[\d.]+\/10\s*\([^)]*\):\s*/i,
                  "",
                )}
              </p>
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
                <th className="px-3 py-3">Pos. Dinâmica</th>
                <th className="px-3 py-3">Cidade</th>
                <th className="px-3 py-3">Bairro</th>
                <th className="px-3 py-3 text-right">Nota Dinâmica</th>
                {SUB_SCORES.map((s) => (
                  <th
                    key={s.id}
                    className="px-3 py-3 text-right whitespace-nowrap"
                    title={weightTitle(s.label, weights, s.weightKey)}
                  >
                    {s.label}
                  </th>
                ))}
                {RESEARCH_HEADERS.map((h) => (
                  <th key={h.id} className="px-3 py-3 text-right whitespace-nowrap" title={h.title}>
                    {h.label}
                  </th>
                ))}
                <th className="px-3 py-3">Tempo Nubank</th>
                <th className="px-3 py-3">Justificativa Detalhada</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((item) => {
                if (item.kind === "reference") {
                  const ref = item.ref;
                  return (
                    <tr
                      key="reference"
                      data-testid="reference-neighborhood-row"
                      onClick={openResearch}
                      className="cursor-pointer border-2 border-dashed border-muted-foreground/40 bg-muted/30 align-top text-muted-foreground hover:bg-muted/50"
                    >
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="rounded-md border border-dashed border-muted-foreground/50 px-1.5 py-0.5 text-xs font-semibold">
                          Referência
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="inline-block rounded-md border px-2 py-0.5 font-mono text-xs font-bold tracking-wider">
                          {REFERENCE_NEIGHBORHOOD.ufLabel}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-bold whitespace-nowrap">
                        <button
                          type="button"
                          aria-haspopup="dialog"
                          onClick={(e) => {
                            e.stopPropagation();
                            openResearch();
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
                          <td key={s.id} className="px-3 py-3 text-right" title={commuteNeutralTitle(ref)}>
                            {COMMUTE_NEUTRAL_TEXT}
                          </td>
                        ) : (
                          <td key={s.id} className="px-3 py-3 text-right font-mono">
                            {s.value(ref).toFixed(1)}
                          </td>
                        ),
                      )}
                      {RESEARCH_HEADERS.map((h) => (
                        <td key={h.id} className="px-3 py-3 text-right font-mono">
                          {referenceResearch[h.id]}
                        </td>
                      ))}
                      <td className="px-3 py-3 whitespace-nowrap">{REFERENCE_NEIGHBORHOOD.commuteLabel}</td>
                      <td className="px-3 py-3">{REFERENCE_NEIGHBORHOOD.subtitle}</td>
                    </tr>
                  );
                }
                const n = item.n;
                const rankDiff = n.overallPosition - n.dynamicOverallRank;
                const research = researchCells(researchFor(n));
                return (
                  <tr
                    key={`${n.cityCode}:${n.neighborhood}`}
                    className="hover:bg-muted/30 align-top"
                  >
                    <td className="px-3 py-3 font-mono font-bold whitespace-nowrap">
                      #{n.dynamicOverallRank}
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
                      <button
                        type="button"
                        onClick={() => goToNeighborhood(n)}
                        className="text-primary hover:underline"
                      >
                        {n.neighborhood}
                      </button>
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-sm font-bold text-primary">
                      {n.dynamicScore.toFixed(2)}
                    </td>
                    {SUB_SCORES.map((s) => (
                      <td key={s.id} className="px-3 py-3 text-right font-mono">
                        {s.value(n).toFixed(1)}
                      </td>
                    ))}
                    {RESEARCH_HEADERS.map((h) => (
                      <td key={h.id} className="px-3 py-3 text-right font-mono">
                        {research[h.id]}
                      </td>
                    ))}
                    <td className="px-3 py-3 whitespace-nowrap font-mono">
                      {n.commuteTime}
                    </td>
                    <td className="px-3 py-3 min-w-[340px] max-w-xl leading-relaxed text-muted-foreground space-y-1.5">
                      <p className="font-medium text-foreground">
                        {n.shortRationale}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {n.detailedJustification.replace(
                          /^Nota\s+[\d.]+\/10\s*\([^)]*\):\s*/i,
                          "",
                        )}
                      </p>
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
      {researchOpen &&
        createPortal(
          <NeighborhoodResearchPanel
            researchKey={REFERENCE_NEIGHBORHOOD.key}
            neighborhood={REFERENCE_NEIGHBORHOOD.neighborhood}
            onClose={closeResearch}
          />,
          document.body,
        )}
    </section>
  );
}

function MobileResearchRow({ cells }: { cells: ReturnType<typeof researchCells> }) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-lg border border-dashed p-2 text-center">
      {RESEARCH_HEADERS.map((h) => (
        <div key={h.id} title={h.title}>
          <span className="block text-xs leading-tight text-muted-foreground">{h.short}</span>
          <strong className="font-mono text-xs">{cells[h.id]}</strong>
        </div>
      ))}
    </div>
  );
}
