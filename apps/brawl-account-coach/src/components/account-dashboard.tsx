"use client";

import {
  BadgeCheck,
  Clock3,
  Gamepad2,
  LockKeyhole,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
  Users,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import type { AnalysisResponse, PowerDistributionEntry } from "@/lib/types";

import { AnalysisError } from "./analysis-error";
import { BattleDiagnosis } from "./battle-diagnosis";
import { BuildAdvice } from "./build-advice";
import { PushTargets } from "./push-targets";
import { UpgradePriorities } from "./upgrade-priorities";

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; data: AnalysisResponse }
  | { status: "error"; code: string; message: string };

interface ErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

const numberFormatter = new Intl.NumberFormat("en-US");

function CoachHeader() {
  return (
    <header className="border-b-2 border-[#101631] bg-white">
      <div className="mx-auto flex w-full max-w-[1460px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/brawl-mark.svg"
            alt=""
            width={46}
            height={46}
            className="size-11 shrink-0"
            priority
          />
          <div className="min-w-0">
            <p className="font-display truncate text-base leading-tight sm:text-lg">
              Brawl Account Coach
            </p>
            <p className="mt-0.5 text-[11px] font-extrabold text-[#5d6681]">
              Progression dossier for #Y0GLCU0GL
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 border-2 border-[#101631] bg-[#fff8db] px-3 py-1.5 text-xs font-black shadow-[3px_3px_0_#101631] sm:flex">
          <Clock3 aria-hidden="true" className="size-3.5 text-[#a36f00]" />
          Refreshes every 30 minutes
        </div>
      </div>
    </header>
  );
}

function LoadingDashboard() {
  return (
    <>
      <CoachHeader />
      <main className="mx-auto w-full max-w-[1460px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
        <section
          aria-live="polite"
          aria-busy="true"
          className="arcade-panel overflow-hidden rounded-[1.4rem_0.4rem_1.4rem_0.4rem]"
        >
          <div className="dossier-stripe h-4" />
          <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(21rem,0.65fr)]">
            <div className="p-6 sm:p-10 lg:p-12">
              <span className="flex size-12 items-center justify-center border-2 border-[#101631] bg-[#eaf1ff] shadow-[3px_3px_0_#101631]">
                <Sparkles
                  aria-hidden="true"
                  className="size-6 text-[#155eef]"
                />
              </span>
              <p className="mt-7 text-sm font-black text-[#155eef]">
                Building the account dossier
              </p>
              <h1 className="font-display mt-3 max-w-3xl text-3xl leading-tight sm:text-5xl">
                Reading the roster, builds, and recent battles.
              </h1>
              <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
                {["Roster power", "Trophy value", "Battle trends"].map(
                  (label) => (
                    <div
                      key={label}
                      className="border-2 border-[#d7def0] bg-white p-3"
                    >
                      <div className="loading-block h-3 w-3/5" />
                      <p className="mt-3 text-xs font-extrabold text-[#5d6681]">
                        {label}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </div>
            <div className="blueprint-panel flex min-h-80 items-center justify-center border-t-2 border-[#101631] p-8 lg:border-l-2 lg:border-t-0">
              <div className="score-burst loading-block size-52" />
            </div>
          </div>
        </section>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="arcade-panel grid grid-cols-[7rem_1fr] overflow-hidden p-4"
            >
              <div className="loading-block h-28" />
              <div className="space-y-3 p-3">
                <div className="loading-block h-4 w-2/3" />
                <div className="loading-block h-3 w-full" />
                <div className="loading-block h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}

interface StatProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function Stat({ icon, label, value }: StatProps) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <dt className="flex items-center gap-1.5 text-xs font-extrabold text-[#5d6681]">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-lg font-black tabular-nums text-[#101631] sm:text-xl">
        {value}
      </dd>
    </div>
  );
}

function PowerDistribution({
  distribution,
}: {
  distribution: PowerDistributionEntry[];
}) {
  const maxCount = Math.max(...distribution.map((entry) => entry.count), 1);

  return (
    <section aria-labelledby="power-distribution-title" className="p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-extrabold text-[#155eef]">Roster lab</p>
          <h2
            id="power-distribution-title"
            className="font-display mt-1 text-xl sm:text-2xl"
          >
            Power distribution
          </h2>
        </div>
        <p className="text-xs font-bold text-[#5d6681]">
          Owned brawlers by power level
        </p>
      </div>
      <div className="mt-5 space-y-2.5">
        {[...distribution].reverse().map((entry) => (
          <div
            key={entry.power}
            className="grid grid-cols-[3rem_minmax(0,1fr)_3.5rem] items-center gap-3"
          >
            <span className="font-display text-xs">P{entry.power}</span>
            <div className="h-4 overflow-hidden border-2 border-[#101631] bg-white">
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
            <span className="text-right text-xs font-black">
              {entry.count}{" "}
              <span className="text-[#707a97]">({entry.percentage}%)</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AccountDashboard() {
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<DashboardState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    async function loadAnalysis() {
      try {
        const response = await fetch("/api/analysis", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json()) as
          | AnalysisResponse
          | ErrorPayload;

        if (!response.ok) {
          const error = (payload as ErrorPayload).error;
          setState({
            status: "error",
            code: error?.code ?? "ANALYSIS_FAILED",
            message:
              error?.message ??
              "The server could not complete the account analysis.",
          });
          return;
        }

        setState({
          status: "ready",
          data: payload as AnalysisResponse,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setState({
          status: "error",
          code: "NETWORK_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "The account analysis could not be loaded.",
        });
      }
    }

    void loadAnalysis();
    return () => controller.abort();
  }, [requestKey]);

  if (state.status === "loading") {
    return <LoadingDashboard />;
  }

  if (state.status === "error") {
    return (
      <>
        <CoachHeader />
        <AnalysisError
          code={state.code}
          message={state.message}
          onRetry={() => setRequestKey((value) => value + 1)}
        />
      </>
    );
  }

  const { analysis, generatedAt, metrics, player } = state.data;
  const heroBrawlers = [...player.brawlers]
    .sort((left, right) => right.trophies - left.trophies)
    .slice(0, 3);
  const refreshedAt = new Date(generatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const totalVictories =
    player["3vs3Victories"] + player.soloVictories + player.duoVictories;

  return (
    <>
      <CoachHeader />
      <main className="mx-auto w-full max-w-[1460px] px-4 pb-16 pt-7 sm:px-6 lg:px-10 lg:pb-24 lg:pt-10">
        <div className="space-y-12 lg:space-y-16">
          <section className="arcade-panel overflow-hidden rounded-[1.4rem_0.4rem_1.4rem_0.4rem]">
            <div className="dossier-stripe h-4" />
            <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(21rem,0.65fr)]">
              <div>
                <div className="relative overflow-hidden p-6 sm:p-9 lg:p-11">
                  <div
                    aria-hidden="true"
                    className="absolute -right-16 -top-20 size-64 rounded-full border-[34px] border-[#155eef]/5"
                  />
                  <div className="relative">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="border-2 border-[#101631] bg-[#155eef] px-3 py-1 text-xs font-black text-white">
                        {player.tag}
                      </span>
                      <span className="border-2 border-[#101631] bg-[#ffcb2f] px-3 py-1 text-xs font-black">
                        {player.club?.name ?? "No club"}
                      </span>
                    </div>
                    <h1 className="font-display mt-6 max-w-4xl text-[clamp(2.5rem,7vw,5.6rem)] leading-[0.98] tracking-[-0.03em]">
                      {player.name}
                    </h1>
                    <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-[#4b5572] sm:text-lg">
                      A live progression brief built from the full roster,
                      owned loadouts, and the latest battle log.
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-2 border-t-2 border-[#101631] [&>div:nth-child(even)]:border-l-2 [&>div:nth-child(even)]:border-[#101631] [&>div:nth-child(n+3)]:border-t-2 [&>div:nth-child(n+3)]:border-[#101631] sm:grid-cols-4 sm:[&>div:nth-child(n+2)]:border-l-2 sm:[&>div:nth-child(n+3)]:border-t-0">
                  <Stat
                    icon={<Trophy aria-hidden="true" className="size-3.5" />}
                    label="Trophies"
                    value={numberFormatter.format(player.trophies)}
                  />
                  <Stat
                    icon={<Target aria-hidden="true" className="size-3.5" />}
                    label="Highest"
                    value={numberFormatter.format(player.highestTrophies)}
                  />
                  <Stat
                    icon={<Gamepad2 aria-hidden="true" className="size-3.5" />}
                    label="Victories"
                    value={numberFormatter.format(totalVictories)}
                  />
                  <Stat
                    icon={<Users aria-hidden="true" className="size-3.5" />}
                    label="3v3 wins"
                    value={numberFormatter.format(player["3vs3Victories"])}
                  />
                </dl>
              </div>

              <aside className="blueprint-panel relative flex flex-col justify-between overflow-hidden border-t-2 border-[#101631] p-6 sm:p-8 lg:border-l-2 lg:border-t-0">
                <div className="relative z-10 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-[#155eef]">
                      Account health
                    </p>
                    <p className="font-display mt-1 text-xl">Coach score</p>
                  </div>
                  <BadgeCheck
                    aria-hidden="true"
                    className="size-7 text-[#155eef]"
                  />
                </div>
                <div className="relative z-10 my-5 flex justify-center">
                  <div className="score-burst flex size-52 flex-col items-center justify-center bg-[#ffcb2f] text-center drop-shadow-[7px_8px_0_rgba(16,22,49,0.18)] sm:size-60">
                    <span className="font-display text-7xl leading-none sm:text-8xl">
                      {analysis.health.score}
                    </span>
                    <span className="mt-1 text-xs font-black">out of 100</span>
                  </div>
                </div>
                <p className="relative z-10 border-l-4 border-[#f42f8c] bg-white/90 p-3 text-sm font-bold leading-6 text-[#3d4663]">
                  {analysis.health.verdict}
                </p>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-32 items-end justify-center overflow-hidden opacity-25">
                  {heroBrawlers.map((brawler, index) => (
                    <Image
                      key={brawler.id}
                      src={`https://cdn.brawlify.com/brawlers/borderless/${brawler.id}.png`}
                      alt=""
                      width={130}
                      height={130}
                      className="-mx-4 w-28"
                      style={{ zIndex: heroBrawlers.length - index }}
                    />
                  ))}
                </div>
              </aside>
            </div>

            <div className="grid border-t-2 border-[#101631] lg:grid-cols-[minmax(0,1fr)_18rem]">
              <PowerDistribution distribution={metrics.powerDistribution} />
              <div className="flex flex-col justify-center border-t-2 border-[#101631] bg-[#101631] p-5 text-white lg:border-l-2 lg:border-t-0">
                <p className="text-xs font-extrabold text-[#aeb9d8]">
                  Roster coverage
                </p>
                <p className="font-display mt-2 text-4xl text-[#ffcb2f]">
                  {metrics.rosterCompletion.owned}/
                  {metrics.rosterCompletion.total}
                </p>
                <p className="mt-1 text-sm font-bold">
                  {metrics.rosterCompletion.percentage}% unlocked
                </p>
                <div className="mt-4 h-3 overflow-hidden border-2 border-white bg-[#343d5b]">
                  <div
                    className="h-full bg-[#f42f8c]"
                    style={{
                      width: `${metrics.rosterCompletion.percentage}%`,
                    }}
                  />
                </div>
                <p className="mt-5 text-xs leading-5 text-[#aeb9d8]">
                  {metrics.trophyEfficiency.peakRetentionPercentage}% of
                  combined brawler peak trophies retained.
                </p>
              </div>
            </div>
          </section>

          <div className="flex flex-col gap-3 border-2 border-[#101631] bg-white p-3 shadow-[4px_4px_0_rgba(16,22,49,0.1)] sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm font-black text-[#3d4663]">
              <Clock3
                aria-hidden="true"
                className="size-4 text-[#155eef]"
              />
              Snapshot generated at {refreshedAt}
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#5d6681]">
              <Zap aria-hidden="true" className="size-3.5 text-[#f42f8c]" />
              Complete analysis cached for 30 minutes
            </span>
          </div>

          <UpgradePriorities
            priorities={analysis.upgradePriorities}
            brawlers={player.brawlers}
          />

          <PushTargets
            targets={analysis.pushTargets}
            brawlers={player.brawlers}
          />

          <BuildAdvice
            builds={analysis.buildAdvice}
            brawlers={player.brawlers}
          />

          <BattleDiagnosis
            diagnoses={analysis.battleDiagnosis}
            recentTrend={metrics.recentTrend}
            brawlers={player.brawlers}
          />

          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <section
              aria-labelledby="avoid-title"
              className="arcade-panel overflow-hidden rounded-[1.2rem_0.35rem_1.2rem_0.35rem]"
            >
              <div className="border-b-2 border-[#101631] bg-[#fff0f7] p-5 sm:p-6">
                <p className="flex items-center gap-2 text-sm font-extrabold text-[#a51458]">
                  <ShieldAlert aria-hidden="true" className="size-4" />
                  Resource guardrail
                </p>
                <h2 id="avoid-title" className="font-display mt-2 text-2xl">
                  Avoid for now
                </h2>
              </div>
              {analysis.avoidForNow.length > 0 ? (
                <ul className="divide-y-2 divide-[#101631]">
                  {analysis.avoidForNow.map((investment) => (
                    <li
                      key={investment.brawlerName}
                      className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-5"
                    >
                      <span className="flex size-9 items-center justify-center rounded-full border-2 border-[#101631] bg-[#f42f8c] font-black text-white">
                        !
                      </span>
                      <div>
                        <h3 className="font-display text-base">
                          {investment.brawlerName}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-[#5d6681]">
                          {investment.reason}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-6 text-sm leading-6 text-[#5d6681]">
                  No low-value investment stands out in this snapshot.
                </p>
              )}
            </section>

            <section
              aria-labelledby="action-plan-title"
              className="arcade-panel overflow-hidden rounded-[1.2rem_0.35rem_1.2rem_0.35rem]"
            >
              <div className="border-b-2 border-[#101631] bg-[#155eef] p-5 text-white sm:p-6">
                <p className="text-sm font-extrabold text-[#cbdcff]">
                  Next session
                </p>
                <h2
                  id="action-plan-title"
                  className="font-display mt-2 text-2xl"
                >
                  Three-step action plan
                </h2>
              </div>
              <ol className="grid divide-y-2 divide-[#101631] md:grid-cols-3 md:divide-x-2 md:divide-y-0">
                {analysis.actionPlan.map((step, index) => (
                  <li key={step.title} className="p-5 sm:p-6">
                    <span className="font-display flex size-10 items-center justify-center rounded-full border-2 border-[#101631] bg-[#ffcb2f] text-lg shadow-[3px_3px_0_#101631]">
                      {index + 1}
                    </span>
                    <h3 className="font-display mt-5 text-base leading-snug">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#5d6681]">
                      {step.detail}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>

        <footer className="mt-16 flex flex-col gap-3 border-t-2 border-[#101631] py-6 text-xs font-bold text-[#5d6681] sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <LockKeyhole
              aria-hidden="true"
              className="size-4 text-[#155eef]"
            />
            Brawl Stars and AI provider credentials stay server-only.
          </span>
          <span>Personal coach for {player.tag}</span>
        </footer>
      </main>
    </>
  );
}
