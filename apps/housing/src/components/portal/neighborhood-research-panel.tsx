"use client";

import { ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import type {
  NeighborhoodDossier,
  ResearchCrimeSeries,
  ResearchNumber,
  ResearchOpinion,
} from "@/types/neighborhood-research";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; dossier: NeighborhoodDossier };

const STANCE_BADGE: Record<ResearchOpinion["stance"], { label: string; className: string }> = {
  positive: {
    label: "Positiva",
    className: "border-emerald-600/30 bg-emerald-500/12 text-emerald-800 dark:text-emerald-200",
  },
  negative: { label: "Negativa", className: "border-rose-600/30 bg-rose-500/12 text-rose-800 dark:text-rose-200" },
  mixed: { label: "Mista", className: "border-amber-600/30 bg-amber-500/12 text-amber-800 dark:text-amber-200" },
};

const CRIME_LABEL: Record<ResearchCrimeSeries["kind"], string> = {
  robbery: "Roubos",
  theft: "Furtos",
  homicide: "Homicídios / letalidade",
};

const fmt = (v: number, digits = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: digits });

function formatNumber(n: ResearchNumber): string {
  if (n.metric === "idh") return n.value.toLocaleString("pt-BR", { minimumFractionDigits: 3 });
  return `${fmt(n.value)} ${n.unit}`.trim();
}

function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(iso);
  if (!m) return iso;
  return m[3] ? `${m[3]}/${m[2]}/${m[1]}` : `${m[2]}/${m[1]}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "fonte";
  }
}

function SourceLink({ url, label }: { url: string; label?: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center gap-1 text-primary underline-offset-2 hover:underline"
    >
      <span className="truncate">{label || hostOf(url)}</span>
      <ExternalLink className="h-3 w-3 shrink-0" />
    </a>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-b py-3 last:border-b-0">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function ScoreBar({ score }: { score: number | null }) {
  const pct = score === null ? 0 : Math.max(0, Math.min(100, score * 10));
  return (
    <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-secondary" aria-hidden="true">
      <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${pct}%` }} />
    </span>
  );
}

function DossierBody({ d }: { d: NeighborhoodDossier }) {
  return (
    <>
      {(d.numbers.length > 0 || d.crime.series.length > 0) && (
        <Section title="Números-chave">
          <ul className="space-y-1.5 text-xs">
            {d.numbers.map((n) => (
              <li key={n.metric} className="space-y-0.5">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-semibold">{n.label}:</span>
                  <span className="font-mono">{formatNumber(n)}</span>
                  <span className="text-muted-foreground">
                    ({[n.scope, n.year].filter(Boolean).join(", ")})
                  </span>
                </div>
                {n.note && <p className="text-[11px] text-muted-foreground">{n.note}</p>}
                <SourceLink url={n.url} label={n.source} />
              </li>
            ))}
            {d.crime.series.map((s) => (
              <li key={s.kind} className="space-y-0.5">
                <div className="flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-semibold">{CRIME_LABEL[s.kind]}:</span>
                  <span className="font-mono">
                    {fmt(s.value, 0)}
                    {s.perCapita !== null ? ` (${fmt(s.perCapita)}/100 mil)` : ""}
                  </span>
                  {s.ratioToCity !== null && (
                    <span className="font-mono font-semibold">{fmt(s.ratioToCity, 2)}× média da cidade</span>
                  )}
                  <span className="text-muted-foreground">
                    ({d.crime.scope}, {s.period})
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {s.indicator}
                  {s.comparison ? ` — ${s.comparison}` : ""}
                </p>
                <SourceLink url={s.url} label={s.source} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {d.crime.summary && (
        <Section title="Segurança">
          <p className="text-xs leading-relaxed">{d.crime.summary}</p>
          {d.crime.officialUnit && (
            <p className="rounded-md border border-amber-600/30 bg-amber-500/10 px-2 py-1.5 text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
              <span className="font-semibold">Unidade oficial dos dados: </span>
              {d.crime.officialUnit}
            </p>
          )}
        </Section>
      )}

      <Section title="Sensação Setor Marista">
        {d.rubric ? (
          <div className="space-y-2 text-xs">
            <p>
              <span className="font-mono text-base font-bold text-primary">{fmt(d.rubric.total)}/10</span>
              {d.rubric.measuredShare !== null && (
                <span className="ml-2 text-muted-foreground">
                  {fmt(d.rubric.measuredShare <= 1 ? d.rubric.measuredShare * 100 : d.rubric.measuredShare, 0)}% dos
                  critérios medidos
                </span>
              )}
            </p>
            <ul className="space-y-2" aria-label="Critérios da rubrica">
              {d.rubric.criteria.map((c) => (
                <li key={c.name} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate font-medium">{c.name}</span>
                    <span className="shrink-0 font-mono">{c.score === null ? "—" : `${fmt(c.score)}/10`}</span>
                  </div>
                  <ScoreBar score={c.score} />
                  {c.evidence.map((e) => (
                    <p key={e.text} className="text-[11px] text-muted-foreground">
                      {e.text} {e.url && <SourceLink url={e.url} />}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ) : d.maristaJudgement ? (
          <div className="space-y-1 text-xs">
            <p>
              <span className="font-mono text-base font-bold text-primary">≈{fmt(d.maristaJudgement.score)}/10</span>
              <span className="ml-2 text-muted-foreground">juízo do pesquisador, sem rubrica medida ainda</span>
            </p>
            <p className="text-[11px] leading-relaxed text-muted-foreground">{d.maristaJudgement.why}</p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sem avaliação.</p>
        )}
      </Section>

      {(d.highlights.length > 0 || d.redFlags.length > 0) && (
        <Section title="Destaques e alertas">
          <ul className="space-y-1 text-xs">
            {d.highlights.map((h) => (
              <li key={`h-${h}`} className="flex gap-1.5">
                <span aria-hidden="true" className="text-emerald-600">
                  +
                </span>
                <span>{h}</span>
              </li>
            ))}
            {d.redFlags.map((r) => (
              <li key={`r-${r}`} className="flex gap-1.5">
                <span aria-hidden="true" className="text-rose-600">
                  !
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">Cada item se apoia em números, notícias ou fatos com fonte neste painel.</p>
        </Section>
      )}

      {d.opinions.length > 0 && (
        <Section title="O que dizem moradores e visitantes">
          <ul className="space-y-2.5 text-xs">
            {d.opinions.map((o) => (
              <li key={`${o.url}-${o.quote}`} className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`rounded border px-1.5 py-0.5 text-[11px] font-medium ${STANCE_BADGE[o.stance].className}`}>
                    {STANCE_BADGE[o.stance].label}
                  </span>
                  {o.theme && <span className="text-[11px] text-muted-foreground">{o.theme}</span>}
                </div>
                <blockquote className="border-l-2 pl-2 italic leading-relaxed">“{o.quote}”</blockquote>
                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                  <SourceLink url={o.url} label={o.source} />
                  {o.date && <span>{formatDate(o.date)}</span>}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {d.news.length > 0 && (
        <Section title="Notícias recentes">
          <ul className="space-y-2 text-xs">
            {d.news.map((n) => (
              <li key={n.url} className="space-y-0.5">
                <div className="flex flex-wrap gap-x-1.5 text-[11px] text-muted-foreground">
                  <span className="font-mono">{formatDate(n.date)}</span>
                  <span>· {n.outlet}</span>
                </div>
                <SourceLink url={n.url} label={n.headline} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {d.facts.length > 0 && (
        <Section title="Fatos do bairro">
          <ul className="space-y-1.5 text-xs">
            {d.facts.map((f) => (
              <li key={f.url + f.fact} className="space-y-0.5">
                <p className="leading-relaxed">{f.fact}</p>
                <SourceLink url={f.url} label={f.source} />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {d.gaps.length > 0 && (
        <Section title="O que a pesquisa não encontrou">
          <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted-foreground">
            {d.gaps.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

export function NeighborhoodResearchPanel({
  researchKey,
  neighborhood,
  onClose,
}: {
  researchKey: string;
  neighborhood: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/neighborhoods/${encodeURIComponent(researchKey)}`, { signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json().catch(() => null)) as { dossier?: NeighborhoodDossier; error?: string } | null;
        if (!res.ok || !data?.dossier) throw new Error(data?.error ?? "Não foi possível carregar a pesquisa.");
        setState({ status: "ready", dossier: data.dossier });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Não foi possível carregar a pesquisa.",
        });
      });
    return () => controller.abort();
  }, [researchKey]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50"
      data-card-stop-expand="true"
      data-testid="neighborhood-research-panel"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Fechar pesquisa do bairro"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/35 backdrop-blur-[1px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Pesquisa do bairro ${neighborhood}`}
        className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col rounded-t-2xl border-t bg-card shadow-2xl sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-auto sm:w-[480px] sm:rounded-none sm:border-l sm:border-t-0"
      >
        <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5 sm:px-5">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold">{neighborhood}</h2>
            <p className="text-[11px] text-muted-foreground">
              Pesquisa de bairro
              {state.status === "ready" && state.dossier.researchedAt
                ? ` · ${formatDate(state.dossier.researchedAt)}`
                : ""}
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border hover:bg-secondary sm:h-8 sm:w-8"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
          {state.status === "loading" && (
            <p className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Carregando pesquisa…
            </p>
          )}
          {state.status === "error" && <p className="py-6 text-xs text-rose-700 dark:text-rose-300">{state.message}</p>}
          {state.status === "ready" && <DossierBody d={state.dossier} />}
        </div>
      </aside>
    </div>
  );
}
