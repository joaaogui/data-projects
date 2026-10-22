import { formatSigned } from "@data-projects/shared";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@data-projects/ui";
import { Activity, MapPin, Swords, TrendingDown, TrendingUp } from "lucide-react";
import Image from "next/image";

import type { BattleDiagnosis as BattleDiagnosisItem } from "@/lib/schemas";
import type {
  PlayerBrawler,
  RecentBattleSummary,
  RecentTrend,
} from "@/lib/types";

interface BattleDiagnosisProps {
  diagnoses: BattleDiagnosisItem[];
  recentTrend: RecentTrend;
  recentBattles?: RecentBattleSummary[];
  brawlers: PlayerBrawler[];
}

const outcomeStyles = {
  strength: "border-[#16a779] bg-[#e9fbf4] text-[#08694e]",
  concern: "border-[#f42f8c] bg-[#fff0f7] text-[#a51458]",
  mixed: "border-[#ffcb2f] bg-[#fff8db] text-[#7b5600]",
};

function formatMode(mode: string): string {
  return mode
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (first) => first.toUpperCase());
}

export function BattleDiagnosis({
  diagnoses,
  recentTrend,
  recentBattles = [],
  brawlers,
}: BattleDiagnosisProps) {
  const brawlersByName = new Map(
    brawlers.map((brawler) => [brawler.name, brawler]),
  );

  return (
    <TooltipProvider delayDuration={150}>
      <section
        aria-labelledby="battle-diagnosis-title"
        className="arcade-panel overflow-hidden rounded-[1.15rem_0.35rem_1.15rem_0.35rem]"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-[#101631] bg-[#101631] px-5 py-4 text-white sm:px-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-[#ff8fc2]">
              <Activity aria-hidden="true" className="size-3.5" />
              Section 4 · Recent battle tape
            </p>
            <h2
              id="battle-diagnosis-title"
              className="font-display mt-1 text-xl leading-tight sm:text-2xl"
            >
              What the recent matches say
            </h2>
          </div>

          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-2xl text-[#ffcb2f] sm:text-3xl">
              {recentTrend.winRate}% WR
            </span>
            <span className="text-xs font-extrabold text-[#aeb9d8]">
              {recentTrend.wins}W–{recentTrend.losses}L
              {recentTrend.draws > 0 ? `–${recentTrend.draws}D` : ""} (
              {recentTrend.battles})
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-black ${
                recentTrend.netTrophies >= 0
                  ? "text-[#75e1bd]"
                  : "text-[#ff8fc2]"
              }`}
            >
              {recentTrend.netTrophies >= 0 ? (
                <TrendingUp aria-hidden="true" className="size-3.5" />
              ) : (
                <TrendingDown aria-hidden="true" className="size-3.5" />
              )}
              {recentTrend.netTrophies > 0 ? "+" : ""}
              {recentTrend.netTrophies} trophies
            </span>
          </div>
        </div>

        {recentTrend.byMode.length > 0 ? (
          <div className="flex snap-x gap-2.5 overflow-x-auto border-b-2 border-[#101631] bg-[#eaf1ff] px-4 py-3 sm:px-6">
            {recentTrend.byMode.map((trend) => {
              const modeBattles = recentBattles.filter(
                (battle) => battle.mode === trend.mode,
              );
              return (
                <Tooltip key={trend.mode}>
                  <TooltipTrigger asChild>
                    <div
                      tabIndex={0}
                      className="arcade-focus min-w-36 snap-start cursor-help border-2 border-[#101631] bg-white px-3 py-2 shadow-[2px_2px_0_rgba(16,22,49,0.12)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-[#155eef]">
                          {formatMode(trend.mode)}
                        </p>
                        <span
                          className={[
                            "text-[11px] font-black tabular-nums",
                            trend.netTrophies > 0
                              ? "text-[#08694e]"
                              : trend.netTrophies < 0
                                ? "text-[#a51458]"
                                : "text-[#5d6681]",
                          ].join(" ")}
                        >
                          {formatSigned(trend.netTrophies)} tr
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-extrabold text-[#101631]">
                        {trend.wins}-{trend.losses}
                        {trend.draws > 0 ? `-${trend.draws}` : ""} ·{" "}
                        {trend.winRate}%
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs space-y-1.5 border-2 border-[#101631] bg-white p-2.5 text-xs text-[#101631] shadow-[3px_3px_0_#101631]">
                    <p className="font-black">
                      {formatMode(trend.mode)} ({formatSigned(trend.netTrophies)}{" "}
                      tr)
                    </p>
                    {modeBattles.length > 0 ? (
                      <ul className="space-y-1">
                        {modeBattles.slice(0, 6).map((battle, idx) => (
                          <li
                            key={`${battle.battleTime}-${idx}`}
                            className="flex items-center justify-between gap-3 text-[11px] font-semibold text-[#3d4663]"
                          >
                            <span className="truncate">
                              <strong className="font-black text-[#101631]">
                                {battle.brawlerName}
                              </strong>{" "}
                              · {battle.map}
                            </span>
                            <span className="shrink-0 tabular-nums font-black">
                              {battle.result} (
                              {formatSigned(battle.trophyChange)})
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] font-semibold text-[#5d6681]">
                        {trend.battles} matches recorded in this mode.
                      </p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ) : null}

      {diagnoses.length > 0 ? (
        <div className="grid divide-y-2 divide-[#101631] md:grid-cols-2 md:divide-x-2 md:divide-y-0">
          {diagnoses.slice(0, 4).map((diagnosis, index) => {
            const brawler = brawlersByName.get(diagnosis.brawlerName);
            return (
              <article
                key={`${diagnosis.brawlerName}-${diagnosis.mode}-${index}`}
                className="p-4 sm:p-5 [&:nth-child(n+3)]:border-t-2 [&:nth-child(n+3)]:border-[#101631]"
              >
                <div className="flex items-start gap-3">
                  {brawler ? (
                    <div className="portrait-stage relative size-12 shrink-0 overflow-hidden rounded-full border-2 border-[#101631]">
                      <Image
                        src={`https://cdn.brawlify.com/brawlers/borderless/${brawler.id}.png`}
                        alt=""
                        width={60}
                        height={60}
                        className="absolute bottom-0 left-1/2 w-14 max-w-none -translate-x-1/2"
                      />
                    </div>
                  ) : (
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-[#101631] bg-[#eaf1ff]">
                      <Swords aria-hidden="true" className="size-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm sm:text-base">
                        {diagnosis.brawlerName}
                      </h3>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${outcomeStyles[diagnosis.outcome]}`}
                      >
                        {diagnosis.outcome}
                      </span>
                    </div>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-bold text-[#5d6681]">
                      <span>{formatMode(diagnosis.mode)}</span>
                      {diagnosis.map ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin aria-hidden="true" className="size-3" />
                          {diagnosis.map}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-[#3d4663]">
                  {diagnosis.summary}
                </p>
                <p className="mt-2 border-l-4 border-[#155eef] pl-3 text-xs font-bold leading-5 text-[#3d4663]">
                  {diagnosis.adjustment}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="p-5 text-sm leading-6 text-[#5d6681]">
          There is not enough recent battle evidence for a diagnosis yet.
        </p>
      )}
      </section>
    </TooltipProvider>
  );
}
