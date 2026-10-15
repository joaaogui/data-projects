import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  GitBranch,
  History,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import type { DeckEvidence } from "@/lib/schemas";
import type {
  AppliedFeedback,
  DeckChangeImpact,
  DeckVersionSummary,
} from "@/lib/types";

interface LearningTrackerProps {
  deckVersions: DeckVersionSummary[];
  changeImpacts: DeckChangeImpact[];
  appliedFeedback: AppliedFeedback;
  evidence?: DeckEvidence;
}

const SOURCE_LABELS: Record<
  DeckChangeImpact["source"],
  { label: string; className: string }
> = {
  "advisor-full": {
    label: "Followed Advisor",
    className: "border-[#164fc9]/30 bg-[#eaf1ff] text-[#164fc9]",
  },
  "advisor-partial": {
    label: "Partial Advisor Swap",
    className: "border-[#164fc9]/25 bg-[#f2f6ff] text-[#164fc9]",
  },
  "player-custom": {
    label: "Your Custom Tweak",
    className: "border-[#cdb254] bg-[#fff5d6] text-[#76530a]",
  },
  "battle-log-transition": {
    label: "Deck Transition",
    className: "border-[#cdd8e8] bg-[#f8faff] text-[#33445c]",
  },
};

function ImpactVerdictBadge({ impact }: { impact: DeckChangeImpact }) {
  if (impact.verdict === "helped") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8f6f0] px-3 py-1 text-xs font-extrabold text-[#087454]">
        <TrendingUp aria-hidden="true" className="size-3.5" />
        Change Helped
      </span>
    );
  }
  if (impact.verdict === "hurt") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff0ef] px-3 py-1 text-xs font-extrabold text-[#b42318]">
        <TrendingDown aria-hidden="true" className="size-3.5" />
        Change Hurt — Advisor Adjusting
      </span>
    );
  }
  if (impact.verdict === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fff5d6] px-3 py-1 text-xs font-extrabold text-[#76530a]">
        <Clock aria-hidden="true" className="size-3.5" />
        Active Build — Play 3 Battles
      </span>
    );
  }
  const remaining = Math.max(1, 3 - impact.afterBattles);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-extrabold text-[#164fc9]">
      <Activity aria-hidden="true" className="size-3.5" />
      {impact.afterBattles < 3
        ? `Testing — Play ${remaining} More Battle${remaining === 1 ? "" : "s"}`
        : "Neutral Impact"}
    </span>
  );
}

function VersionVerdictBadge({
  verdict,
}: {
  verdict: DeckVersionSummary["verdict"];
}) {
  switch (verdict) {
    case "working":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8f6f0] px-2.5 py-0.5 text-[11px] font-extrabold text-[#087454]">
          <CheckCircle2 aria-hidden="true" className="size-3" />
          Working
        </span>
      );
    case "underperforming":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#fff0ef] px-2.5 py-0.5 text-[11px] font-extrabold text-[#b42318]">
          <ShieldAlert aria-hidden="true" className="size-3" />
          Underperforming
        </span>
      );
    case "testing":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#fff5d6] px-2.5 py-0.5 text-[11px] font-extrabold text-[#76530a]">
          <Clock aria-hidden="true" className="size-3" />
          Testing
        </span>
      );
    case "untested":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#eef1f5] px-2.5 py-0.5 text-[11px] font-extrabold text-[#526175]">
          Untested
        </span>
      );
  }
}

export function LearningTracker({
  deckVersions,
  changeImpacts,
  appliedFeedback,
  evidence,
}: LearningTrackerProps) {
  const avoidedSwaps = evidence?.avoidedFailedSwaps ?? [];
  const hasClosedLoopAdjustment =
    appliedFeedback.penalizedDecks.length > 0 || avoidedSwaps.length > 0;

  return (
    <section
      aria-labelledby="learning-tracker-title"
      className="paper-panel overflow-hidden rounded-[1.5rem] border border-[#cdd8e8]"
    >
      <div className="border-b border-[#d9e1ec] bg-[#f8faff] px-5 py-5 sm:px-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#164fc9] text-white shadow-sm">
              <GitBranch aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#164fc9]">
                Closed-Loop Learning Ledger
              </p>
              <h2
                id="learning-tracker-title"
                className="font-display text-2xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-3xl"
              >
                Deck Evolution &amp; Win-Rate Impact
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#33445c]">
            <span className="rounded-full border border-[#cdd8e8] bg-white px-3 py-1.5">
              {deckVersions.length} deck version
              {deckVersions.length === 1 ? "" : "s"} tracked
            </span>
            {changeImpacts.length > 0 ? (
              <span className="rounded-full border border-[#cdd8e8] bg-white px-3 py-1.5">
                {changeImpacts.length} change impact
                {changeImpacts.length === 1 ? "" : "s"} measured
              </span>
            ) : null}
          </div>
        </div>

        {hasClosedLoopAdjustment ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#e5c45e] bg-[#fff8df] px-4 py-3 text-xs font-bold text-[#76530a]">
            <ShieldAlert aria-hidden="true" className="size-4 shrink-0" />
            <span>
              Closed-loop adaptation active:
              {appliedFeedback.penalizedDecks.length > 0
                ? ` Penalized underperforming version (${appliedFeedback.penalizedDecks.join(", ")}) so the advisor pivots instead of repeating a losing build.`
                : ""}
              {avoidedSwaps.length > 0
                ? ` Avoided previously failed swap cards (${avoidedSwaps.join(", ")}).`
                : ""}
            </span>
          </div>
        ) : null}
      </div>

      <div className="p-5 sm:p-7">
        {changeImpacts.length > 0 ? (
          <div className="mb-8">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-[#526175]">
              Before vs. After Change Attribution
            </h3>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {changeImpacts.map((impact) => {
                const sourceStyle = SOURCE_LABELS[impact.source];
                const deltaPositive = impact.winRateDelta > 0;
                const deltaNegative = impact.winRateDelta < 0;

                return (
                  <article
                    key={`${impact.fromVersionLabel}-${impact.toVersionLabel}`}
                    className="rounded-2xl border border-[#d9e1ec] bg-white p-4 shadow-sm sm:p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-lg bg-[#0b1f3a] px-2.5 py-1 text-xs font-extrabold text-white">
                          {impact.fromVersionLabel} → {impact.toVersionLabel}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${sourceStyle.className}`}
                        >
                          {sourceStyle.label}
                        </span>
                      </div>
                      <ImpactVerdictBadge impact={impact} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {impact.swaps.map((swap) => (
                        <span
                          key={`${swap.out}-${swap.in}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#d9e1ec] bg-[#f8faff] px-2.5 py-1 text-xs font-bold"
                        >
                          <span className="text-[#b42318]">−{swap.out}</span>
                          <ArrowRight
                            aria-hidden="true"
                            className="size-3 text-[#6d7a8b]"
                          />
                          <span className="text-[#087454]">+{swap.in}</span>
                        </span>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#f5f8ff] p-3 text-center">
                      <div>
                        <p className="text-[11px] font-bold text-[#6d7a8b]">
                          Before ({impact.beforeBattles}g)
                        </p>
                        <p className="mt-0.5 text-lg font-extrabold tabular-nums text-[#0b1f3a]">
                          {impact.beforeWinRate.toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[#6d7a8b]">
                          After ({impact.afterBattles}g)
                        </p>
                        <p className="mt-0.5 text-lg font-extrabold tabular-nums text-[#0b1f3a]">
                          {impact.afterBattles > 0
                            ? `${impact.afterWinRate.toFixed(1)}%`
                            : "Pending"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-[#6d7a8b]">
                          WR Delta
                        </p>
                        <p
                          className={[
                            "mt-0.5 text-lg font-extrabold tabular-nums",
                            impact.afterBattles === 0
                              ? "text-[#6d7a8b]"
                              : deltaPositive
                                ? "text-[#087454]"
                                : deltaNegative
                                  ? "text-[#b42318]"
                                  : "text-[#33445c]",
                          ].join(" ")}
                        >
                          {impact.afterBattles === 0
                            ? "—"
                            : `${deltaPositive ? "+" : ""}${impact.winRateDelta.toFixed(1)}%`}
                        </p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs leading-5 text-[#526175]">
                      {impact.summary}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-[#d9e1ec] bg-[#f8faff] px-4 py-3 text-sm text-[#526175]">
            <p className="font-bold text-[#0b1f3a]">
              Single deck version in recent battle log
            </p>
            <p className="mt-0.5 text-xs leading-5">
              When you swap 1–4 cards and play ladder matches, the advisor
              automatically tracks your before vs. after win-rate delta here and
              adjusts future recommendations if a change underperforms.
            </p>
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wider text-[#526175]">
              <History aria-hidden="true" className="size-4 text-[#164fc9]" />
              Battle-Log Deck Versions
            </h3>
          </div>

          <div className="divide-y divide-[#e2e7ee] overflow-hidden rounded-2xl border border-[#d9e1ec] bg-white">
            {deckVersions.map((version) => (
              <article
                key={version.deckKey}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-[#0b1f3a] px-2.5 py-0.5 text-xs font-extrabold text-white">
                      {version.versionLabel}
                    </span>
                    {version.isCurrentActiveDeck ? (
                      <span className="rounded-full bg-[#eaf1ff] px-2.5 py-0.5 text-[11px] font-extrabold text-[#164fc9]">
                        Active Equipped Deck
                      </span>
                    ) : null}
                    <VersionVerdictBadge verdict={version.verdict} />
                    <span className="text-xs font-bold text-[#526175]">
                      {version.battles > 0
                        ? `${version.wins}W–${version.losses}L${version.draws > 0 ? `–${version.draws}D` : ""} (${version.winRate.toFixed(1)}% WR)`
                        : "0 recent battles played"}
                    </span>
                    {version.netTrophies !== 0 ? (
                      <span
                        className={[
                          "text-xs font-extrabold tabular-nums",
                          version.netTrophies > 0
                            ? "text-[#087454]"
                            : "text-[#b42318]",
                        ].join(" ")}
                      >
                        {version.netTrophies > 0 ? "+" : ""}
                        {version.netTrophies} trophies
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-xs font-bold text-[#33445c]">
                    {version.cards.join(" · ")}
                  </p>

                  {version.swapsFromPrevious.length > 0 ? (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="font-bold text-[#6d7a8b]">
                        Swaps from prior version:
                      </span>
                      {version.swapsFromPrevious.map((swap) => (
                        <span
                          key={`${swap.out}-${swap.in}`}
                          className="rounded-md bg-[#f5f8ff] px-2 py-0.5 font-bold text-[#33445c]"
                        >
                          −{swap.out} / +{swap.in}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {version.topLossesAgainst.length > 0 ? (
                    <p className="mt-1.5 text-[11px] text-[#b42318]">
                      <span className="font-extrabold">Lost against:</span>{" "}
                      {version.topLossesAgainst.join(", ")}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
