import { Activity, MapPin, Swords, TrendingDown, TrendingUp } from "lucide-react";
import Image from "next/image";

import type { BattleDiagnosis as BattleDiagnosisItem } from "@/lib/schemas";
import type { PlayerBrawler, RecentTrend } from "@/lib/types";

interface BattleDiagnosisProps {
  diagnoses: BattleDiagnosisItem[];
  recentTrend: RecentTrend;
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
  brawlers,
}: BattleDiagnosisProps) {
  const brawlersByName = new Map(
    brawlers.map((brawler) => [brawler.name, brawler]),
  );

  return (
    <section aria-labelledby="battle-diagnosis-title">
      <div className="mb-5">
        <p className="flex items-center gap-2 text-sm font-extrabold text-[#f42f8c]">
          <Activity aria-hidden="true" className="size-4" />
          Battle tape
        </p>
        <h2
          id="battle-diagnosis-title"
          className="font-display mt-2 text-2xl leading-tight sm:text-3xl"
        >
          What the recent matches say
        </h2>
      </div>

      <div className="arcade-panel overflow-hidden rounded-[1.15rem_0.35rem_1.15rem_0.35rem]">
        <div className="grid bg-[#101631] text-white sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="p-5 sm:p-6">
            <p className="text-sm font-extrabold text-[#aeb9d8]">
              Latest {recentTrend.battles} recorded battles
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <span className="font-display text-4xl text-[#ffcb2f]">
                {recentTrend.winRate}%
              </span>
              <span className="text-sm font-bold">
                {recentTrend.wins}W / {recentTrend.losses}L /{" "}
                {recentTrend.draws}D
              </span>
              <span
                className={`inline-flex items-center gap-1 text-sm font-black ${
                  recentTrend.netTrophies >= 0
                    ? "text-[#75e1bd]"
                    : "text-[#ff8fc2]"
                }`}
              >
                {recentTrend.netTrophies >= 0 ? (
                  <TrendingUp aria-hidden="true" className="size-4" />
                ) : (
                  <TrendingDown aria-hidden="true" className="size-4" />
                )}
                {recentTrend.netTrophies > 0 ? "+" : ""}
                {recentTrend.netTrophies} trophies
              </span>
            </div>
          </div>
          <div className="dossier-stripe h-3 sm:h-full sm:w-5" />
        </div>

        {recentTrend.byMode.length > 0 ? (
          <div className="flex snap-x gap-3 overflow-x-auto border-b-2 border-[#101631] bg-[#eaf1ff] p-4">
            {recentTrend.byMode.map((trend) => (
              <div
                key={trend.mode}
                className="min-w-40 snap-start border-2 border-[#101631] bg-white px-3 py-2 shadow-[3px_3px_0_rgba(16,22,49,0.12)]"
              >
                <p className="text-xs font-black text-[#155eef]">
                  {formatMode(trend.mode)}
                </p>
                <p className="mt-1 text-sm font-extrabold">
                  {trend.wins}-{trend.losses}-{trend.draws} · {trend.winRate}%
                </p>
              </div>
            ))}
          </div>
        ) : null}

        {diagnoses.length > 0 ? (
          <div className="divide-y-2 divide-[#101631]">
            {diagnoses.map((diagnosis, index) => {
              const brawler = brawlersByName.get(diagnosis.brawlerName);
              return (
                <article
                  key={`${diagnosis.brawlerName}-${diagnosis.mode}-${index}`}
                  className="p-5 sm:p-6"
                >
                  <div className="flex items-start gap-3">
                    {brawler ? (
                      <div className="portrait-stage relative size-14 shrink-0 overflow-hidden rounded-full border-2 border-[#101631]">
                        <Image
                          src={`https://cdn.brawlify.com/brawlers/borderless/${brawler.id}.png`}
                          alt=""
                          width={68}
                          height={68}
                          className="absolute bottom-0 left-1/2 w-16 max-w-none -translate-x-1/2"
                        />
                      </div>
                    ) : (
                      <span className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-[#101631] bg-[#eaf1ff]">
                        <Swords aria-hidden="true" className="size-5" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base">
                          {diagnosis.brawlerName}
                        </h3>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${outcomeStyles[diagnosis.outcome]}`}
                        >
                          {diagnosis.outcome}
                        </span>
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-[#5d6681]">
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
                  <p className="mt-4 text-sm font-semibold leading-6 text-[#3d4663]">
                    {diagnosis.summary}
                  </p>
                  <p className="mt-3 border-l-4 border-[#155eef] pl-3 text-sm leading-6 text-[#3d4663]">
                    {diagnosis.adjustment}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="p-6 text-sm leading-6 text-[#5d6681]">
            There is not enough recent battle evidence for a diagnosis yet.
          </p>
        )}
      </div>
    </section>
  );
}
