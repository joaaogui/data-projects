"use client";

import { normalizeKey } from "@data-projects/shared";
import { Skeleton } from "@data-projects/ui";
import { Ban, LockKeyhole, Pin, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import {
  clearBrawlerRules,
  computeProgressionSummary,
  createSnapshotFromAnalysis,
  emptyProgressionLedger,
  hasPreferences,
  loadProgressionLedger,
  recordAnalysisInLedger,
  saveProgressionLedger,
  toggleExcludedBrawler,
  togglePinnedBrawler,
  type ProgressionLedger,
} from "@/lib/progression-store";
import type { AnalysisResponse } from "@/lib/types";

import { AnalysisError } from "./analysis-error";
import { BattleDiagnosis } from "./battle-diagnosis";
import { ProgressionCard } from "./progression-card";
import { PushTargets } from "./push-targets";
import { RosterLabDetails } from "./roster-lab-details";
import { StatusStrip } from "./status-strip";
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

function CoachHeader() {
  return (
    <header className="border-b-2 border-[#101631] bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/brawl-mark.svg"
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0"
            priority
          />
          <div className="min-w-0">
            <p className="font-display truncate text-base leading-tight sm:text-lg">
              Brawl Account Coach
            </p>
            <p className="mt-0.5 text-xs font-extrabold text-[#3d4663]">
              Personal dossier for #Y0GLCU0GL
            </p>
          </div>
        </div>
        <a
          href="https://joaog.space"
          className="arcade-focus inline-flex min-h-10 shrink-0 items-center border-2 border-[#101631] bg-[#f7f9ff] px-3 py-1.5 text-xs font-black text-[#101631] transition-colors hover:bg-[#eaf1ff]"
        >
          ← joaog.space
        </a>
      </div>
    </header>
  );
}

function LoadingDashboard() {
  return (
    <>
      <CoachHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
      >
        <section
          aria-live="polite"
          aria-busy="true"
          className="arcade-panel overflow-hidden rounded-[1.2rem_0.35rem_1.2rem_0.35rem] p-5 sm:p-6"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex size-11 shrink-0 items-center justify-center border-2 border-[#101631] bg-[#eaf1ff] shadow-[2px_2px_0_#101631]">
              <Sparkles aria-hidden="true" className="size-5 text-[#155eef]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black uppercase tracking-wide text-[#155eef]">
                Building account dossier
              </p>
              <h1 className="font-display mt-1 text-lg leading-tight sm:text-2xl">
                Reading roster, owned builds, and recent battles…
              </h1>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            {["Trophies", "Recent form", "Roster unlock", "Coach score"].map(
              (label) => (
                <div
                  key={label}
                  className="border-2 border-[#d7def0] bg-white p-3"
                >
                  <Skeleton className="h-4 w-3/5" />
                  <p className="mt-2 text-xs font-extrabold text-[#5d6681]">
                    {label}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>
      </main>
    </>
  );
}

function RuleChip({
  kind,
  brawlerName,
  onRemove,
}: {
  kind: "pin" | "skip";
  brawlerName: string;
  onRemove: (brawlerName: string) => void;
}) {
  const isPin = kind === "pin";
  const Icon = isPin ? Pin : Ban;

  return (
    <li>
      <button
        type="button"
        onClick={() => onRemove(brawlerName)}
        aria-label={`Remove ${isPin ? "focus" : "hide"} rule for ${brawlerName}`}
        className={[
          "arcade-focus inline-flex min-h-11 items-center gap-1.5 border-2 border-[#101631] px-3 text-xs font-black transition-colors",
          isPin
            ? "bg-[#eaf1ff] text-[#155eef] hover:bg-[#dbe7ff]"
            : "bg-[#fff0f7] text-[#a51458] hover:bg-[#ffe0ee]",
        ].join(" ")}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {isPin ? "Focused:" : "Hidden:"} {brawlerName}
        <X aria-hidden="true" className="size-3.5 opacity-75" />
      </button>
    </li>
  );
}

export function AccountDashboard() {
  const [request, setRequest] = useState({ id: 0, refresh: false });
  const [ledger, setLedger] = useState<ProgressionLedger>(() =>
    loadProgressionLedger(),
  );
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAnalysis() {
      if (request.refresh) {
        setIsRefreshing(true);
        setRefreshNotice(null);
      }

      try {
        const saved = loadProgressionLedger();
        const usePost = request.refresh || hasPreferences(saved);
        const response = usePost
          ? await fetch(
              request.refresh ? "/api/analysis?refresh=1" : "/api/analysis",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  refresh: request.refresh,
                  pinnedBrawlers: saved.pinnedBrawlers,
                  excludedBrawlers: saved.excludedBrawlers,
                }),
                cache: "no-store",
                signal: controller.signal,
              },
            )
          : await fetch("/api/analysis", {
              cache: "no-store",
              signal: controller.signal,
            });

        const payload = (await response.json()) as
          | AnalysisResponse
          | ErrorPayload;

        if (!response.ok) {
          const error = (payload as ErrorPayload).error;
          if (request.refresh && response.status === 429) {
            setRefreshNotice(
              error?.message ??
                "Too many refreshes. A fresh dossier is available every few minutes.",
            );
            return;
          }
          setState({
            status: "error",
            code: error?.code ?? "ANALYSIS_FAILED",
            message:
              error?.message ??
              "The server could not complete the account analysis.",
          });
          return;
        }

        const data = payload as AnalysisResponse;
        const updatedLedger = recordAnalysisInLedger(
          loadProgressionLedger(),
          data,
        );
        saveProgressionLedger(updatedLedger);
        setLedger(updatedLedger);
        setState({ status: "ready", data });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "The account analysis could not be loaded.";
        if (request.refresh) {
          setRefreshNotice(message);
        } else {
          setState({ status: "error", code: "NETWORK_ERROR", message });
        }
      } finally {
        if (request.refresh) {
          setIsRefreshing(false);
        }
      }
    }

    void loadAnalysis();
    return () => controller.abort();
  }, [request]);

  function applyUpdatedLedger(nextLedger: ProgressionLedger) {
    saveProgressionLedger(nextLedger);
    setLedger(nextLedger);
    setRequest((current) => ({ id: current.id + 1, refresh: false }));
  }

  function handleClearHistory() {
    if (
      !window.confirm(
        "Clear saved progression snapshots and brawler rules from this browser?",
      )
    ) {
      return;
    }
    applyUpdatedLedger(emptyProgressionLedger());
  }

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
          onRetry={() => {
            setState({ status: "loading" });
            setRequest((current) => ({ id: current.id + 1, refresh: false }));
          }}
        />
      </>
    );
  }

  const { analysis, generatedAt, metrics, player } = state.data;
  const currentSnapshot = createSnapshotFromAnalysis(state.data);
  const progressionSummary = computeProgressionSummary(
    ledger.snapshots,
    currentSnapshot,
  );

  const upgradeKeys = new Set(
    analysis.upgradePriorities.map((item) => normalizeKey(item.brawlerName)),
  );
  const standalonePushTargets = analysis.pushTargets.filter(
    (target) => !upgradeKeys.has(normalizeKey(target.brawlerName)),
  );
  const shownBuildKeys = new Set([
    ...upgradeKeys,
    ...analysis.pushTargets.map((item) => normalizeKey(item.brawlerName)),
  ]);
  const remainingBuilds = analysis.buildAdvice.filter(
    (build) => !shownBuildKeys.has(normalizeKey(build.brawlerName)),
  );
  const hasActiveRules = hasPreferences(ledger);

  return (
    <>
      <CoachHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl space-y-6 px-4 pb-14 pt-6 sm:px-6 lg:space-y-8 lg:px-8 lg:pt-8"
      >
        {refreshNotice ? (
          <div
            role="status"
            aria-live="polite"
            className="border-2 border-[#101631] bg-[#fff8db] px-4 py-3 text-xs font-extrabold text-[#101631] shadow-[3px_3px_0_#101631]"
          >
            {refreshNotice}
          </div>
        ) : null}

        {/* Section 1 — Compact Status Strip */}
        <StatusStrip
          player={player}
          metrics={metrics}
          health={analysis.health}
          generatedAt={generatedAt}
          isRefreshing={isRefreshing}
          onRefresh={() =>
            setRequest((current) => ({ id: current.id + 1, refresh: true }))
          }
        />

        {/* Section 2 — Progress Since Last Check-In */}
        <ProgressionCard
          summary={progressionSummary}
          snapshotCount={ledger.snapshots.length}
          currentTrophies={player.trophies}
          ownedCount={metrics.rosterCompletion.owned}
          onClearHistory={handleClearHistory}
        />

        {/* Section 3 — What to Do Next */}
        <section
          aria-labelledby="next-steps-title"
          className="arcade-panel overflow-hidden rounded-[1.2rem_0.35rem_1.2rem_0.35rem]"
        >
          <div className="border-b-2 border-[#101631] bg-[#155eef] px-5 py-4 text-white sm:px-6">
            <p className="text-xs font-extrabold uppercase tracking-wide text-[#cbdcff]">
              Section 3 · Actionable priorities
            </p>
            <h2
              id="next-steps-title"
              className="font-display mt-1 text-xl sm:text-2xl"
            >
              What to do next
            </h2>
          </div>

          <ol className="grid divide-y-2 divide-[#101631] border-b-2 border-[#101631] bg-[#f7f9ff] md:grid-cols-3 md:divide-x-2 md:divide-y-0">
            {analysis.actionPlan.map((step, index) => (
              <li key={step.title} className="p-4 sm:p-5">
                <div className="flex items-center gap-2.5">
                  <span className="font-display flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-[#101631] bg-[#ffcb2f] text-sm text-[#101631] shadow-[2px_2px_0_#101631]">
                    {index + 1}
                  </span>
                  <h3 className="font-display text-sm leading-snug text-[#101631] sm:text-base">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-[#3d4663] sm:text-sm">
                  {step.detail}
                </p>
              </li>
            ))}
          </ol>

          {hasActiveRules ? (
            <div className="border-b-2 border-[#101631] bg-white px-5 py-3.5 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wide text-[#5d6681]">
                  Active brawler rules
                </p>
                <button
                  type="button"
                  onClick={() => applyUpdatedLedger(clearBrawlerRules(ledger))}
                  className="arcade-focus inline-flex min-h-11 items-center px-2 text-xs font-black text-[#155eef] hover:underline"
                >
                  Clear all rules
                </button>
              </div>
              <ul
                aria-label="Pinned and hidden brawlers"
                className="mt-2 flex flex-wrap gap-2.5"
              >
                {ledger.pinnedBrawlers.map((name) => (
                  <RuleChip
                    key={`pin-${name}`}
                    kind="pin"
                    brawlerName={name}
                    onRemove={(brawlerName) =>
                      applyUpdatedLedger(
                        togglePinnedBrawler(ledger, brawlerName),
                      )
                    }
                  />
                ))}
                {ledger.excludedBrawlers.map((name) => (
                  <RuleChip
                    key={`skip-${name}`}
                    kind="skip"
                    brawlerName={name}
                    onRemove={(brawlerName) =>
                      applyUpdatedLedger(
                        toggleExcludedBrawler(ledger, brawlerName),
                      )
                    }
                  />
                ))}
              </ul>
            </div>
          ) : null}

          <div className="space-y-8 p-5 sm:p-6">
            <UpgradePriorities
              priorities={analysis.upgradePriorities}
              brawlers={player.brawlers}
              builds={analysis.buildAdvice}
              pushTargets={analysis.pushTargets}
              pinnedBrawlers={ledger.pinnedBrawlers}
              excludedBrawlers={ledger.excludedBrawlers}
              onTogglePin={(brawlerName) =>
                applyUpdatedLedger(togglePinnedBrawler(ledger, brawlerName))
              }
              onToggleExclude={(brawlerName) =>
                applyUpdatedLedger(toggleExcludedBrawler(ledger, brawlerName))
              }
            />

            {standalonePushTargets.length > 0 ||
            analysis.pushTargets.length === 0 ? (
              <PushTargets
                targets={standalonePushTargets}
                brawlers={player.brawlers}
                builds={analysis.buildAdvice}
                pinnedBrawlers={ledger.pinnedBrawlers}
                excludedBrawlers={ledger.excludedBrawlers}
                onTogglePin={(brawlerName) =>
                  applyUpdatedLedger(togglePinnedBrawler(ledger, brawlerName))
                }
                onToggleExclude={(brawlerName) =>
                  applyUpdatedLedger(toggleExcludedBrawler(ledger, brawlerName))
                }
              />
            ) : null}
          </div>
        </section>

        {/* Section 4 — Recent Battle Tape + Collapsed Details Drawer */}
        <div className="space-y-4">
          <BattleDiagnosis
            diagnoses={analysis.battleDiagnosis}
            recentTrend={metrics.recentTrend}
            brawlers={player.brawlers}
          />

          <RosterLabDetails
            powerDistribution={metrics.powerDistribution}
            rosterCompletion={metrics.rosterCompletion}
            trophyEfficiency={metrics.trophyEfficiency}
            remainingBuilds={remainingBuilds}
            avoidForNow={analysis.avoidForNow}
            brawlers={player.brawlers}
          />
        </div>

        <footer className="mt-10 flex flex-col gap-3 border-t-2 border-[#101631] pt-6 text-xs font-bold text-[#3d4663] sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-center gap-2">
            <LockKeyhole
              aria-hidden="true"
              className="size-4 text-[#155eef]"
            />
            Brawl Stars and AI credentials stay server-only; progression history
            is stored locally in your browser.
          </span>
          <div className="flex items-center gap-4">
            <span>Personal sample for {player.tag}</span>
            <a
              href="https://joaog.space"
              className="arcade-focus font-black text-[#155eef] hover:underline"
            >
              ← joaog.space
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
