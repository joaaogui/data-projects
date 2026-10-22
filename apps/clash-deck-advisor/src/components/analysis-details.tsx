import { ChevronDown } from "lucide-react";

import type { DeckAnalysis, DeckProblem, Matchup, WeaknessScores } from "@/lib/schemas";
import type { LevelWarning } from "@/lib/types";

interface AnalysisDetailsProps {
  analysis: DeckAnalysis;
  levelWarnings: LevelWarning[];
}

const RATING: Record<Matchup["rating"], { label: string; className: string }> = {
  favored: { label: "Favored", className: "bg-[#e8f6f0] text-[#087454]" },
  even: { label: "Even", className: "bg-[#fff5d6] text-[#76530a]" },
  unfavored: { label: "Unfavored", className: "bg-[#fff0ef] text-[#b42318]" },
};

const PROBLEM_SEVERITY: Record<
  DeckProblem["severity"],
  { label: string; className: string }
> = {
  high: { label: "High", className: "bg-[#fff0ef] text-[#b42318]" },
  medium: { label: "Medium", className: "bg-[#fff5d6] text-[#76530a]" },
  low: { label: "Low", className: "bg-[#eef1f5] text-[#33445c]" },
};

const WEAKNESS_AXES: Array<{ key: keyof WeaknessScores; label: string }> = [
  { key: "airDefense", label: "Air defense" },
  { key: "tankStopping", label: "Tank stopping" },
  { key: "swarmControl", label: "Swarm control" },
  { key: "spellCoverage", label: "Spell coverage" },
  { key: "cycle", label: "Cycle speed" },
  { key: "synergy", label: "Archetype synergy" },
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#5c6b7f]">
        {title}
      </h3>
      <div className="mt-3 text-sm leading-6 text-[#33445c]">{children}</div>
    </section>
  );
}

export function AnalysisDetails({ analysis, levelWarnings }: AnalysisDetailsProps) {
  const { evidence } = analysis;
  const shownSummary =
    analysis.metaTier.summary !== analysis.strategy
      ? analysis.metaTier.summary
      : null;
  const strengths = (evidence?.strengths ?? []).filter(
    (item) => item !== analysis.strategy && item !== analysis.metaTier.summary,
  );

  return (
    <details className="disclosure paper-panel group rounded-2xl">
      <summary className="royal-focus grid min-h-14 cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl px-5 py-4 sm:px-6">
        <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
          Details
        </h2>
        <ChevronDown
          aria-hidden="true"
          className="col-start-2 row-span-2 row-start-1 size-5 text-[#5c6b7f] motion-safe:transition-transform group-open:rotate-180"
        />
        <span className="text-xs font-bold text-[#5c6b7f]">
          How to play it, matchups, and why this deck
        </span>
      </summary>

      <div className="grid gap-8 border-t border-[#e2e7ee] px-5 py-6 sm:px-6 md:grid-cols-2">
        <Block title="How to play it">
          <p>{analysis.strategy}</p>
        </Block>

        <Block title="6-axis deck profile">
          <dl className="space-y-2.5">
            {WEAKNESS_AXES.map(({ key, label }) => {
              const value = Math.round(analysis.weaknessScores[key]);
              const barColor =
                value >= 75
                  ? "bg-[#087454]"
                  : value >= 50
                    ? "bg-[#164fc9]"
                    : "bg-[#b42318]";
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs font-bold">
                    <dt className="text-[#0b1f3a]">{label}</dt>
                    <dd className="tabular-nums text-[#5c6b7f]">{value}/100</dd>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-[#e2e7ee]">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </dl>
        </Block>

        {analysis.problems.length > 0 ? (
          <Block title="Deck problems">
            <ul className="space-y-3">
              {analysis.problems.map((problem) => (
                <li key={problem.title}>
                  <p className="flex flex-wrap items-center gap-2 font-extrabold text-[#0b1f3a]">
                    {problem.title}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${PROBLEM_SEVERITY[problem.severity].className}`}
                    >
                      {PROBLEM_SEVERITY[problem.severity].label}
                    </span>
                  </p>
                  <p className="text-[#5c6b7f]">{problem.description}</p>
                </li>
              ))}
            </ul>
          </Block>
        ) : null}

        {analysis.matchups.length > 0 ? (
          <Block title="Matchups">
            <ul className="space-y-3">
              {analysis.matchups.map((matchup) => (
                <li key={`${matchup.archetype}-${matchup.rating}`}>
                  <p className="flex flex-wrap items-center gap-2 font-extrabold text-[#0b1f3a]">
                    {matchup.archetype}
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${RATING[matchup.rating].className}`}
                    >
                      {RATING[matchup.rating].label}
                    </span>
                  </p>
                  <p className="text-[#5c6b7f]">{matchup.advice}</p>
                </li>
              ))}
            </ul>
          </Block>
        ) : null}

        <Block title="Why this deck">
          <p className="font-extrabold text-[#0b1f3a]">
            {analysis.metaTier.archetype} · {analysis.metaTier.tier} tier
          </p>
          {shownSummary ? (
            <p className="text-[#5c6b7f]">{shownSummary}</p>
          ) : null}
          {evidence ? (
            <>
              <p className="mt-2 text-xs font-bold text-[#5c6b7f]">
                {evidence.confidence} confidence · {evidence.levelReadiness}% of
                cards at level · {evidence.liveMetaOverlap} top-ladder decks
                share the core
              </p>
              {strengths.length > 0 ? (
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  {strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {evidence.weaknesses.length > 0 ? (
                <>
                  <p className="mt-3 font-extrabold text-[#0b1f3a]">
                    Still weak to
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-[#5c6b7f]">
                    {evidence.weaknesses.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          ) : null}
        </Block>

        {analysis.replayAdvice.length > 0 ? (
          <Block title="Lessons from recent losses">
            <ul className="space-y-3">
              {analysis.replayAdvice.map((advice) => (
                <li key={advice.title}>
                  <p className="font-extrabold text-[#0b1f3a]">{advice.title}</p>
                  <p className="text-[#5c6b7f]">{advice.detail}</p>
                </li>
              ))}
            </ul>
          </Block>
        ) : null}

        {levelWarnings.length > 0 ? (
          <Block title="Level warnings">
            <ul className="space-y-3">
              {levelWarnings.map((warning) => (
                <li key={warning.cardName}>
                  <p className="font-extrabold text-[#0b1f3a]">
                    {warning.cardName}
                  </p>
                  <p className="text-[#5c6b7f]">{warning.message}</p>
                </li>
              ))}
            </ul>
          </Block>
        ) : null}
      </div>
    </details>
  );
}
