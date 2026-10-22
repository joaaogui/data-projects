import { formatNumber } from "@data-projects/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@data-projects/ui";
import { ChevronDown, ShieldAlert, SlidersHorizontal, Trophy } from "lucide-react";

import type {
  AvoidInvestment,
  BuildAdvice as BuildAdviceItem,
} from "@/lib/schemas";
import type {
  PlayerBrawler,
  PowerDistributionEntry,
  PushCandidate,
  RosterCompletion,
  TrophyEfficiency,
} from "@/lib/types";

import { BuildAdvice } from "./build-advice";

interface RosterLabDetailsProps {
  powerDistribution: PowerDistributionEntry[];
  rosterCompletion: RosterCompletion;
  trophyEfficiency: TrophyEfficiency;
  underPushedBrawlers?: PushCandidate[];
  remainingBuilds: BuildAdviceItem[];
  avoidForNow: AvoidInvestment[];
  brawlers: PlayerBrawler[];
}

function PowerDistribution({
  distribution,
  rosterCompletion,
  trophyEfficiency,
  brawlers,
}: {
  distribution: PowerDistributionEntry[];
  rosterCompletion: RosterCompletion;
  trophyEfficiency: TrophyEfficiency;
  brawlers: PlayerBrawler[];
}) {
  const maxCount = Math.max(...distribution.map((entry) => entry.count), 1);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#155eef]">
              Power curve
            </p>
            <h3 className="font-display mt-1 text-lg sm:text-xl">
              Power distribution (P1–P11)
            </h3>
          </div>
          <p className="text-xs font-bold text-[#5d6681]">
            Owned brawlers by power level
          </p>
        </div>
        <div className="mt-4 space-y-2">
          {[...distribution].reverse().map((entry) => {
            const brawlersAtPower = brawlers
              .filter((brawler) => brawler.power === entry.power)
              .sort((a, b) => b.trophies - a.trophies);
            return (
              <Tooltip key={entry.power}>
                <TooltipTrigger asChild>
                  <div
                    tabIndex={0}
                    className="arcade-focus grid cursor-help grid-cols-[2.75rem_minmax(0,1fr)_4.25rem] items-center gap-3"
                  >
                    <span className="font-display text-xs">P{entry.power}</span>
                    <div className="h-3.5 overflow-hidden border-2 border-[#101631] bg-white">
                      <div
                        className={
                          entry.power === 11
                            ? "h-full bg-[#f42f8c]"
                            : entry.power >= 9
                              ? "h-full bg-[#155eef]"
                              : "h-full bg-[#ffcb2f]"
                        }
                        style={{ width: `${(entry.count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-right text-xs font-black tabular-nums">
                      {entry.count}{" "}
                      <span className="text-[#707a97]">({entry.percentage}%)</span>
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs space-y-1 border-2 border-[#101631] bg-white p-2.5 text-xs text-[#101631] shadow-[3px_3px_0_#101631]">
                  <p className="font-black">
                    Power {entry.power} ({brawlersAtPower.length}{" "}
                    {brawlersAtPower.length === 1 ? "brawler" : "brawlers"})
                  </p>
                  {brawlersAtPower.length > 0 ? (
                    <p className="font-semibold leading-5 text-[#3d4663]">
                      {brawlersAtPower
                        .map(
                          (b) => `${b.name} (${formatNumber(b.trophies)} tr)`,
                        )
                        .join(" · ")}
                    </p>
                  ) : (
                    <p className="font-semibold text-[#5d6681]">
                      No brawlers at Power {entry.power}.
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col justify-center border-2 border-[#101631] bg-[#101631] p-4 text-white">
        <p className="text-xs font-extrabold text-[#aeb9d8]">Roster coverage</p>
        <p className="font-display mt-1.5 text-3xl text-[#ffcb2f]">
          {rosterCompletion.owned}/{rosterCompletion.total}
        </p>
        <p className="mt-0.5 text-xs font-bold">
          {rosterCompletion.percentage}% unlocked
        </p>
        <div className="mt-3 h-2.5 overflow-hidden border-2 border-white bg-[#343d5b]">
          <div
            className="h-full bg-[#f42f8c]"
            style={{ width: `${rosterCompletion.percentage}%` }}
          />
        </div>
        <p className="mt-3 text-xs leading-5 text-[#aeb9d8]">
          {trophyEfficiency.peakRetentionPercentage}% of combined brawler peak
          trophies retained (avg {trophyEfficiency.averageTrophies} · median{" "}
          {trophyEfficiency.medianTrophies}).
        </p>
      </div>
    </div>
  );
}

export function RosterLabDetails({
  powerDistribution,
  rosterCompletion,
  trophyEfficiency,
  underPushedBrawlers = [],
  remainingBuilds,
  avoidForNow,
  brawlers,
}: RosterLabDetailsProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <details className="arcade-panel group overflow-hidden rounded-[1.15rem_0.35rem_1.15rem_0.35rem]">
        <summary className="arcade-focus flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 bg-[#f7f9ff] px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center border-2 border-[#101631] bg-white shadow-[2px_2px_0_#101631]">
              <SlidersHorizontal
                aria-hidden="true"
                className="size-4 text-[#155eef]"
              />
            </span>
            <div>
              <h2 className="font-display text-lg leading-tight text-[#101631] sm:text-xl">
                Roster Lab &amp; Details
              </h2>
              <p className="mt-0.5 text-xs font-bold text-[#5d6681]">
                P1–P11 power curve, extra owned builds, and low-priority spending
                guardrails
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 border-2 border-[#101631] bg-white px-3 py-1.5 text-xs font-black text-[#101631]">
            Inspect
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-180"
            />
          </span>
        </summary>

        <div className="space-y-8 border-t-2 border-[#101631] p-5 sm:p-6">
          <PowerDistribution
            distribution={powerDistribution}
            rosterCompletion={rosterCompletion}
            trophyEfficiency={trophyEfficiency}
            brawlers={brawlers}
          />

          {underPushedBrawlers.length > 0 ? (
            <div className="border-t-2 border-[#d7def0] pt-6">
              <div className="mb-3">
                <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#a36f00]">
                  <Trophy aria-hidden="true" className="size-4" />
                  Peak recovery
                </p>
                <h3 className="font-display mt-1 text-lg sm:text-xl">
                  Under-pushed high-power brawlers below peak trophies
                </h3>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {underPushedBrawlers.map((candidate) => (
                  <li
                    key={candidate.id}
                    className="border-2 border-[#101631] bg-[#fff8db] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display text-sm text-[#101631]">
                        {candidate.name}
                      </h4>
                      <span className="rounded-full border border-[#101631] bg-white px-2 py-0.5 text-[10px] font-black text-[#101631]">
                        Power {candidate.power}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-extrabold tabular-nums text-[#3d4663]">
                      {formatNumber(candidate.trophies)} / Peak{" "}
                      {formatNumber(candidate.highestTrophies)} trophies
                    </p>
                    <p className="mt-0.5 text-xs font-black tabular-nums text-[#a51458]">
                      -{formatNumber(candidate.gapToPeak)} from peak
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {remainingBuilds.length > 0 ? (
            <div className="border-t-2 border-[#d7def0] pt-6">
              <BuildAdvice builds={remainingBuilds} brawlers={brawlers} />
            </div>
          ) : null}

          <div className="border-t-2 border-[#d7def0] pt-6">
            <div className="mb-3">
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#a51458]">
                <ShieldAlert aria-hidden="true" className="size-4" />
                Resource guardrail
              </p>
              <h3 className="font-display mt-1 text-lg sm:text-xl">
                Avoid for now
              </h3>
            </div>
            {avoidForNow.length > 0 ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {avoidForNow.map((investment) => (
                  <li
                    key={investment.brawlerName}
                    className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-2 border-[#101631] bg-[#fff0f7] p-4"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full border-2 border-[#101631] bg-[#f42f8c] text-xs font-black text-white">
                      !
                    </span>
                    <div>
                      <h4 className="font-display text-sm text-[#101631]">
                        {investment.brawlerName}
                      </h4>
                      <p className="mt-1 text-xs font-semibold leading-5 text-[#3d4663]">
                        {investment.reason}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-semibold text-[#5d6681]">
                No low-value investment stands out in this snapshot.
              </p>
            )}
          </div>
        </div>
      </details>
    </TooltipProvider>
  );
}
