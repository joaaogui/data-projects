"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

import { NeighborhoodResearchPanel } from "@/components/portal/neighborhood-research-panel";
import type { NeighborhoodResearchSummary } from "@/types/neighborhood-research";

export const decimal = (v: number) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "14 mil", "5,1 mil" or "850" (hab/km²). */
export function formatDensity(perKm2: number): string {
  const thousands = perKm2 / 1000;
  return thousands >= 1
    ? `${thousands.toLocaleString("pt-BR", { maximumFractionDigits: thousands >= 10 ? 0 : 1 })} mil`
    : perKm2.toLocaleString("pt-BR");
}

/** Commercial bairros whose robbery rate is per resident, so visitor traffic inflates the ratio. */
const PER_RESIDENT_COMMERCIAL_KEYS = new Set(["BH:Funcionários", "BH:Savassi", "BH:Lourdes"]);

/** The 2–3 numbers shown on the card, in display order. */
export function researchStripNumbers(s: NeighborhoodResearchSummary): { id: string; text: string; title: string }[] {
  const out: { id: string; text: string; title: string }[] = [];
  if (s.marista !== null) {
    out.push({
      id: "marista",
      text: s.maristaSource === "rubric" ? `Marista ${decimal(s.marista)}/10` : `Marista ≈${decimal(s.marista)}/10`,
      title:
        s.maristaSource === "rubric"
          ? "Semelhança com o Setor Marista (rubrica com critérios medidos)"
          : "Semelhança com o Setor Marista — juízo do pesquisador, não medido",
    });
  }
  if (s.robberyRatio !== null) {
    const perResident = PER_RESIDENT_COMMERCIAL_KEYS.has(s.key);
    out.push({
      id: "robbery",
      text: `Roubo ${decimal(s.robberyRatio)}×${perResident ? "/morador" : " média"}`,
      title: perResident
        ? "Roubos por morador do bairro ÷ média da cidade; em bairro comercial o fluxo de visitantes infla a razão"
        : "Taxa de roubos da unidade oficial (bairro, DP ou CISP) dividida pela média da cidade",
    });
  }
  if (s.densityPerKm2 !== null) {
    out.push({
      id: "density",
      text: `${formatDensity(s.densityPerKm2)} hab/km²`,
      title: "Densidade demográfica (IBGE Censo 2022)",
    });
  }
  return out;
}

export function NeighborhoodResearchStrip({
  summary,
  neighborhood,
}: {
  summary: NeighborhoodResearchSummary;
  neighborhood: string;
}) {
  const [open, setOpen] = useState(false);
  const numbers = researchStripNumbers(summary);
  if (numbers.length === 0 && !summary.highlight && !summary.redFlag) return null;
  return (
    <div className="@container min-w-0">
      <button
        type="button"
        data-card-stop-expand="true"
        data-testid="neighborhood-research-strip"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-label={`Ver pesquisa do bairro ${neighborhood}`}
        className="flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-1 overflow-hidden rounded-lg border border-sky-600/25 bg-sky-500/8 px-2 py-1 text-left text-[11px] leading-tight transition-colors hover:border-sky-600/45 hover:bg-sky-500/12 @xl:flex-nowrap dark:border-sky-400/25 dark:bg-sky-500/10"
      >
        {numbers.length > 0 && (
          <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 font-semibold tabular-nums text-sky-900 @xl:shrink-0 dark:text-sky-200">
            {numbers.map((n, idx) => (
              <span key={n.id} title={n.title} className="whitespace-nowrap">
                {idx > 0 && (
                  <span aria-hidden="true" className="mr-1.5 text-muted-foreground">
                    ·
                  </span>
                )}
                {n.text}
              </span>
            ))}
          </span>
        )}
        {(summary.highlight || summary.redFlag) && (
          <span className="flex w-full min-w-0 items-center gap-1 @xl:w-auto @xl:flex-1">
            {summary.highlight && (
              <span
                title={summary.highlight}
                className="min-w-0 flex-1 basis-0 truncate rounded border border-emerald-600/30 bg-emerald-500/12 px-1.5 py-0.5 text-emerald-800 dark:border-emerald-400/30 dark:text-emerald-200"
              >
                {summary.highlight}
              </span>
            )}
            {summary.redFlag && (
              <span
                title={summary.redFlag}
                className="min-w-0 flex-1 basis-0 truncate rounded border border-rose-600/30 bg-rose-500/12 px-1.5 py-0.5 text-rose-800 dark:border-rose-400/30 dark:text-rose-200"
              >
                {summary.redFlag}
              </span>
            )}
          </span>
        )}
      </button>
      {open &&
        createPortal(
          <NeighborhoodResearchPanel
            researchKey={summary.key}
            neighborhood={neighborhood}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </div>
  );
}
