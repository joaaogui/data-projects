import {
  Crosshair,
  Flame,
  ShieldAlert,
  Swords,
  TrendingDown,
} from "lucide-react";

import type { CardSwap } from "@/lib/schemas";
import type { LossAutopsy, ThreatCategory } from "@/lib/types";

interface LossAutopsyProps {
  lossAutopsy: LossAutopsy;
  changes: CardSwap[];
}

const CATEGORY_BADGES: Record<
  ThreatCategory,
  { label: string; className: string }
> = {
  heavyTank: {
    label: "Heavy Tank",
    className: "bg-[#fff0ef] text-[#b42318]",
  },
  airBeatdown: {
    label: "Air Threat",
    className: "bg-[#eef4ff] text-[#164fc9]",
  },
  fastCycleWinCon: {
    label: "Tower Rusher",
    className: "bg-[#fff5d6] text-[#76530a]",
  },
  spellBait: {
    label: "Swarm / Bait",
    className: "bg-[#e8f6f0] text-[#087454]",
  },
  splashSupport: {
    label: "Splash Support",
    className: "bg-[#f3e8ff] text-[#6b21a8]",
  },
  buildingSiege: {
    label: "Building / Siege",
    className: "bg-[#eef1f5] text-[#33445c]",
  },
  other: {
    label: "Utility",
    className: "bg-[#eef1f5] text-[#526175]",
  },
};

export function LossAutopsyPanel({ lossAutopsy, changes }: LossAutopsyProps) {
  if (lossAutopsy.totalBattlesAnalyzed === 0) {
    return null;
  }

  const incomingSwapNames = new Set(changes.map((c) => c.in));

  return (
    <section
      aria-labelledby="loss-autopsy-title"
      className="paper-panel overflow-hidden rounded-[1.5rem] border border-[#e4a09b]/60"
    >
      <div className="border-b border-[#d9e1ec] bg-[#fff9f8] px-5 py-5 sm:px-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#b42318] text-white shadow-sm">
              <Crosshair aria-hidden="true" className="size-5" />
            </span>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#b42318]">
                Battle-Log Threat Forensics
              </p>
              <h2
                id="loss-autopsy-title"
                className="font-display text-2xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-3xl"
              >
                Why You&apos;re Losing Right Now — Loss Autopsy
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[#d9e1ec] bg-white px-3 py-1.5 text-xs font-extrabold text-[#0b1f3a]">
              Recent Form: {lossAutopsy.recentWins}W–{lossAutopsy.recentLosses}L
              {lossAutopsy.recentDraws > 0
                ? `–${lossAutopsy.recentDraws}D`
                : ""}{" "}
              ({lossAutopsy.recentWinRate.toFixed(1)}%)
            </span>
            {lossAutopsy.currentStreak.type !== "none" &&
            lossAutopsy.currentStreak.count >= 2 ? (
              <span
                className={[
                  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-extrabold",
                  lossAutopsy.currentStreak.type === "win"
                    ? "bg-[#e8f6f0] text-[#087454]"
                    : "bg-[#fff0ef] text-[#b42318]",
                ].join(" ")}
              >
                <Flame aria-hidden="true" className="size-3.5" />
                {lossAutopsy.currentStreak.count}{" "}
                {lossAutopsy.currentStreak.type === "win"
                  ? "win streak"
                  : "loss streak"}
              </span>
            ) : null}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-[#e5d5d3] bg-white px-3.5 py-2.5">
            <dt className="text-[11px] font-bold text-[#6d7a8b]">
              Recent Win Rate
            </dt>
            <dd className="mt-0.5 text-xl font-extrabold tabular-nums text-[#0b1f3a]">
              {lossAutopsy.recentWinRate.toFixed(1)}%
              <span className="ml-1.5 text-xs font-bold text-[#6d7a8b]">
                ({lossAutopsy.totalBattlesAnalyzed} battles)
              </span>
            </dd>
          </div>
          <div className="rounded-xl border border-[#e5d5d3] bg-white px-3.5 py-2.5">
            <dt className="text-[11px] font-bold text-[#6d7a8b]">
              Net Trophy Delta
            </dt>
            <dd
              className={[
                "mt-0.5 text-xl font-extrabold tabular-nums",
                lossAutopsy.netTrophies > 0
                  ? "text-[#087454]"
                  : lossAutopsy.netTrophies < 0
                    ? "text-[#b42318]"
                    : "text-[#0b1f3a]",
              ].join(" ")}
            >
              {lossAutopsy.netTrophies > 0 ? "+" : ""}
              {lossAutopsy.netTrophies}
            </dd>
          </div>
          <div className="rounded-xl border border-[#e5d5d3] bg-white px-3.5 py-2.5">
            <dt className="text-[11px] font-bold text-[#6d7a8b]">
              Close 1-Crown Losses
            </dt>
            <dd className="mt-0.5 text-xl font-extrabold tabular-nums text-[#0b1f3a]">
              {lossAutopsy.oneCrownLosses}
            </dd>
          </div>
          <div className="rounded-xl border border-[#e5d5d3] bg-white px-3.5 py-2.5">
            <dt className="text-[11px] font-bold text-[#6d7a8b]">
              3-Crown Blowouts
            </dt>
            <dd className="mt-0.5 text-xl font-extrabold tabular-nums text-[#b42318]">
              {lossAutopsy.threeCrownLosses}
            </dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#526175]">
            <TrendingDown aria-hidden="true" className="size-4 text-[#b42318]" />
            Cards Beating You Most Often
          </h3>

          {lossAutopsy.topThreatCards.length === 0 ? (
            <p className="mt-3 text-sm text-[#5c6b7f]">
              No recent losses recorded in the battle log window.
            </p>
          ) : (
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              {lossAutopsy.topThreatCards.map((threat) => {
                const badge = CATEGORY_BADGES[threat.threatCategory];
                const activeRecommendedCounters =
                  threat.recommendedCounters.filter((name) =>
                    incomingSwapNames.has(name),
                  );

                return (
                  <article
                    key={threat.cardName}
                    className="rounded-xl border border-[#d9e1ec] bg-white p-3.5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-[#0b1f3a]">
                          {threat.cardName}
                        </h4>
                        <p className="mt-0.5 text-xs font-bold text-[#b42318]">
                          Lost {threat.lossesAgainst} of {threat.totalSeen}{" "}
                          encounters ({threat.lossRateAgainst}% loss rate)
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    {threat.recommendedCounters.length > 0 ? (
                      <div className="mt-2.5 border-t border-[#eef1f5] pt-2 text-[11px] text-[#526175]">
                        <span className="font-bold text-[#33445c]">
                          Owned answers:{" "}
                        </span>
                        {threat.recommendedCounters.slice(0, 3).join(", ")}
                        {activeRecommendedCounters.length > 0 ? (
                          <span className="ml-1.5 inline-block rounded bg-[#e8f6f0] px-1.5 py-0.5 text-[10px] font-extrabold text-[#087454]">
                            +{activeRecommendedCounters.join(", ")} in swap
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#526175]">
            <ShieldAlert aria-hidden="true" className="size-4 text-[#d6a11f]" />
            Dominant Blind Spots &amp; Counter Plan
          </h3>

          {lossAutopsy.dominantBlindSpots.length === 0 ? (
            <p className="mt-3 text-sm text-[#5c6b7f]">
              No recurring structural blind spots detected in recent losses.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {lossAutopsy.dominantBlindSpots.map((spot) => (
                <article
                  key={spot.category}
                  className="rounded-xl border border-[#d9e1ec] bg-[#f8faff] p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-[#0b1f3a]">
                      {spot.label}
                    </h4>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase",
                        spot.severity === "high"
                          ? "bg-[#fff0ef] text-[#b42318]"
                          : spot.severity === "medium"
                            ? "bg-[#fff5d6] text-[#76530a]"
                            : "bg-[#eef1f5] text-[#526175]",
                      ].join(" ")}
                    >
                      {spot.severity} risk
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-[#526175]">
                    {spot.evidence}
                  </p>
                  <p className="mt-2 text-xs font-bold text-[#164fc9]">
                    Needed fix: {spot.neededRole}
                  </p>
                  {spot.counterCards.length > 0 ? (
                    <p className="mt-1 text-[11px] text-[#33445c]">
                      <span className="font-bold">Best owned counters:</span>{" "}
                      {spot.counterCards.join(", ")}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}

          {lossAutopsy.topThreatArchetypes.length > 0 ? (
            <div className="mt-5">
              <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-[#526175]">
                <Swords aria-hidden="true" className="size-3.5 text-[#164fc9]" />
                Toughest Opposing Archetypes
              </h4>
              <div className="mt-2 flex flex-wrap gap-2">
                {lossAutopsy.topThreatArchetypes.map((arch) => (
                  <span
                    key={arch.archetype}
                    className="rounded-lg border border-[#d9e1ec] bg-white px-2.5 py-1 text-xs font-bold text-[#33445c]"
                  >
                    {arch.archetype}: {arch.wins}W–{arch.losses}L (
                    {arch.lossRate}% loss)
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
