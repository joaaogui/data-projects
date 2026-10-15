import { ChevronDown } from "lucide-react";

import type { DeckAnalysis, Matchup } from "@/lib/schemas";
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
