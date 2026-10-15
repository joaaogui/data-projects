"use client";

import {
  AlertTriangle,
  Ban,
  BrainCircuit,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Gauge,
  History,
  Lock,
  MapPinned,
  RefreshCw,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  WandSparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { buildDeckLink } from "@/lib/deck-link";
import type { AnalysisMode } from "@/lib/engine-context";
import {
  clearCardConstraints,
  emptyFeedbackState,
  loadFeedbackState,
  recordSuggestion,
  saveFeedbackState,
  toggleExcludedCard,
  toggleLockedCard,
} from "@/lib/feedback-store";
import type {
  AnalysisResponse,
  ClashCard,
  PlayerFeedbackInput,
} from "@/lib/types";

import { AnalysisError } from "./analysis-error";
import { DeckComparison } from "./deck-comparison";
import { EvidencePanel } from "./evidence-panel";
import { LearningTracker } from "./learning-tracker";
import { LossAutopsyPanel } from "./loss-autopsy";
import { Matchups } from "./matchups";
import { StrengthBars } from "./strength-bars";
import { SwapList } from "./swap-list";

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

function WorkshopHeader() {
  return (
    <header className="border-b border-[#d9e1ec] bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1480px] items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <Image
            src="/crown-mark.svg"
            alt=""
            width={42}
            height={42}
            className="size-10"
            priority
          />
          <div>
            <p className="font-display text-lg font-semibold leading-none tracking-[-0.02em]">
              Clash Deck Advisor
            </p>
            <p className="mt-1 text-[11px] font-bold text-[#6d7a8b]">
              Personal demo for #VGURQ0QQ2 · Closed-loop battle learning
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[#cdd8e8] bg-[#f8faff] px-3 py-1.5 text-xs font-bold text-[#33445c] sm:flex">
          <span className="size-2 rounded-full bg-[#087454]" />
          Live battle-log tracking
        </div>
      </div>
    </header>
  );
}

const MODE_LABELS: Record<AnalysisMode, { title: string; caption: string }> = {
  improve: {
    title: "Improve current deck",
    caption: "Targeted swaps that keep your deck recognisable",
  },
  best: {
    title: "Best from collection",
    caption: "The strongest deck your cards can build",
  },
};

function ModeControls({
  mode,
  onSelectMode,
  onRefresh,
  busy,
}: {
  mode: AnalysisMode;
  onSelectMode: (mode: AnalysisMode) => void;
  onRefresh: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div
        aria-label="Analysis mode"
        className="inline-flex rounded-xl border border-[#cdd8e8] bg-white p-1 shadow-sm"
      >
        {(Object.keys(MODE_LABELS) as AnalysisMode[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={mode === option}
            disabled={busy}
            onClick={() => onSelectMode(option)}
            className={[
              "royal-focus min-h-11 rounded-lg px-4 py-2 text-sm font-extrabold transition-colors disabled:cursor-not-allowed",
              mode === option
                ? "bg-[#164fc9] text-white shadow-[0_6px_16px_rgba(22,79,201,0.18)]"
                : "text-[#33445c] hover:bg-[#f2f6ff] disabled:opacity-50",
            ].join(" ")}
          >
            {MODE_LABELS[option].title}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={busy}
        className="royal-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#bdcbe0] bg-white px-4 py-2.5 text-sm font-extrabold text-[#0b1f3a] transition-colors hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw
          aria-hidden="true"
          className={["size-4", busy ? "animate-spin" : ""].join(" ")}
        />
        {busy ? "Analyzing" : "Refresh recommendation"}
      </button>
    </div>
  );
}

function LoadingDashboard({
  mode,
  controls,
}: {
  mode: AnalysisMode;
  controls: React.ReactNode;
}) {
  const stages =
    mode === "best"
      ? [
          "Reading the full collection",
          "Building candidate decks",
          "Scoring them against recent threats and meta",
        ]
      : [
          "Tracking deck versions across battle log",
          "Running loss autopsy on recent defeats",
          "Scoring counter-swaps and win-rate deltas",
        ];

  return (
    <>
      <WorkshopHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12"
      >
        <div className="mb-7">{controls}</div>
        <section
          aria-live="polite"
          aria-busy="true"
          className="paper-panel overflow-hidden rounded-[1.6rem]"
        >
          <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
            <div className="p-6 sm:p-10 lg:p-14">
              <div className="workshop-pulse flex size-12 items-center justify-center rounded-2xl border border-[#cbd8f3] bg-[#eaf1ff] text-[#164fc9]">
                <Sparkles aria-hidden="true" className="size-6" />
              </div>
              <p className="mt-7 text-sm font-extrabold text-[#164fc9]">
                Analysis in progress
              </p>
              <h1 className="font-display mt-2 max-w-2xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                The workshop is inspecting all eight cards.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-[#5c6b7f]">
                The advisor audits your recent battle log, measures deck version
                win rates, and adapts swaps to counter the cards beating you.
              </p>
              <ol className="mt-8 space-y-3">
                {stages.map((stage, index) => (
                  <li
                    key={stage}
                    className="flex items-center gap-3 text-sm font-bold text-[#33445c]"
                  >
                    <span
                      className="flex size-7 items-center justify-center rounded-full border border-[#ced9e8] bg-white text-[11px] text-[#164fc9]"
                      aria-hidden="true"
                    >
                      {index + 1}
                    </span>
                    {stage}
                  </li>
                ))}
              </ol>
            </div>

            <div className="blueprint-grid border-t border-[#d9e1ec] p-5 sm:p-8 lg:border-l lg:border-t-0">
              <div className="grid grid-cols-4 gap-2.5">
                {Array.from({ length: 8 }, (_, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-[#d7dfeb] bg-white p-1.5 shadow-sm"
                  >
                    <div className="loading-shimmer aspect-[4/5] rounded-lg" />
                    <div className="loading-shimmer mx-auto mt-2 h-2 w-4/5 rounded-full" />
                  </div>
                ))}
              </div>
              <div className="loading-shimmer mt-6 h-4 w-2/3 rounded-full" />
              <div className="loading-shimmer mt-3 h-3 w-full rounded-full" />
              <div className="loading-shimmer mt-2 h-3 w-5/6 rounded-full" />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function fallbackCopy(value: string): boolean {
  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();
  return copied;
}

export function DeckDashboard() {
  const [requestKey, setRequestKey] = useState(0);
  const [mode, setMode] = useState<AnalysisMode>("improve");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [feedback, setFeedback] = useState<PlayerFeedbackInput>(() =>
    loadFeedbackState(),
  );
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    async function loadAnalysis() {
      try {
        const currentFeedback = loadFeedbackState();
        const hasConstraintsOrHistory =
          currentFeedback.lockedCards.length > 0 ||
          currentFeedback.excludedCards.length > 0 ||
          currentFeedback.suggestionHistory.length > 0;

        let response: Response;
        if (hasConstraintsOrHistory) {
          response = await fetch("/api/analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode,
              refresh: forceRefresh,
              feedback: currentFeedback,
            }),
            cache: "no-store",
            signal: controller.signal,
          });
        } else {
          const query = new URLSearchParams({ mode });
          if (forceRefresh) {
            query.set("refresh", "1");
          }
          response = await fetch(`/api/analysis?${query}`, {
            cache: "no-store",
            signal: controller.signal,
          });
        }

        const payload = (await response.json()) as
          | AnalysisResponse
          | ErrorPayload;

        if (!response.ok) {
          const error = (payload as ErrorPayload).error;
          setState({
            status: "error",
            code: error?.code ?? "ANALYSIS_FAILED",
            message:
              error?.message ?? "The server could not complete the analysis.",
          });
          return;
        }

        const analysisData = payload as AnalysisResponse;
        const updatedFeedback = recordSuggestion(currentFeedback, analysisData);
        saveFeedbackState(updatedFeedback);
        setFeedback(updatedFeedback);

        setState({
          status: "ready",
          data: analysisData,
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
              : "The live analysis could not be loaded.",
        });
      }
    }

    void loadAnalysis();
    return () => controller.abort();
  }, [requestKey, mode, forceRefresh]);

  function switchMode(next: AnalysisMode) {
    if (next === mode) {
      return;
    }
    setForceRefresh(false);
    setMode(next);
  }

  function refreshNow() {
    setForceRefresh(true);
    setRequestKey((value) => value + 1);
  }

  function handleToggleLock(cardName: string) {
    const next = toggleLockedCard(feedback, cardName);
    saveFeedbackState(next);
    setFeedback(next);
    setForceRefresh(true);
    setRequestKey((value) => value + 1);
  }

  function handleToggleExclude(cardName: string) {
    const next = toggleExcludedCard(feedback, cardName);
    saveFeedbackState(next);
    setFeedback(next);
    setForceRefresh(true);
    setRequestKey((value) => value + 1);
  }

  function handleResetConstraints() {
    const next = clearCardConstraints(feedback);
    saveFeedbackState(next);
    setFeedback(next);
    setForceRefresh(true);
    setRequestKey((value) => value + 1);
  }

  function handleClearFullLedger() {
    const next = emptyFeedbackState();
    saveFeedbackState(next);
    setFeedback(next);
    setForceRefresh(true);
    setRequestKey((value) => value + 1);
  }

  const modeControls = (
    <ModeControls
      mode={mode}
      onSelectMode={switchMode}
      onRefresh={refreshNow}
      busy={state.status === "loading"}
    />
  );

  if (state.status === "loading") {
    return <LoadingDashboard mode={mode} controls={modeControls} />;
  }

  if (state.status === "error") {
    return (
      <>
        <WorkshopHeader />
        <AnalysisError
          code={state.code}
          message={state.message}
          onRetry={() => setRequestKey((value) => value + 1)}
        />
      </>
    );
  }

  const {
    analysis,
    player,
    generatedAt,
    levelWarnings,
    metaAvailable,
    lossAutopsy,
    deckVersions,
    changeImpacts,
    appliedFeedback,
  } = state.data;

  const cardsByName = new Map(
    [...player.cards, ...player.currentDeck].map((card) => [card.name, card]),
  );
  const improvedCards = analysis.improvedDeck
    .map((name) => cardsByName.get(name))
    .filter((card): card is ClashCard => Boolean(card));
  const deckLink = buildDeckLink(improvedCards);
  const careerWinRate =
    player.wins + player.losses > 0
      ? (player.wins / (player.wins + player.losses)) * 100
      : 0;
  const recentWinRate =
    lossAutopsy.totalBattlesAnalyzed > 0
      ? lossAutopsy.recentWinRate
      : careerWinRate;
  const verdictKeepsDeck = analysis.verdict === "keep";
  const VerdictIcon = verdictKeepsDeck ? ShieldCheck : WandSparkles;

  const hasActiveConstraints =
    feedback.lockedCards.length > 0 || feedback.excludedCards.length > 0;

  async function copyDeckLink() {
    if (!deckLink) {
      setCopyStatus("failed");
      return;
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(deckLink);
      } else if (!fallbackCopy(deckLink)) {
        throw new Error("Copy command failed");
      }
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2_000);
    } catch {
      setCopyStatus("failed");
    }
  }

  return (
    <>
      <WorkshopHeader />
      <main
        id="main-content"
        className="mx-auto w-full max-w-[1480px] px-4 pb-14 pt-7 sm:px-6 lg:px-10 lg:pb-20 lg:pt-10"
      >
        <div className="mb-8">{modeControls}</div>
        <div className="space-y-12 lg:space-y-16">
          <section className="paper-panel relative overflow-hidden rounded-[1.6rem]">
            <div
              aria-hidden="true"
              className="absolute -left-20 -top-28 size-72 rounded-full border-[48px] border-[#164fc9]/[0.035]"
            />
            <div className="relative grid lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
              <aside className="relative order-1 overflow-hidden bg-[#0b1f3a] p-6 text-white sm:p-9 lg:order-2 lg:p-10">
                <div
                  aria-hidden="true"
                  className="absolute -bottom-16 -right-12 size-56 rounded-full border-[34px] border-white/[0.035]"
                />
                <div className="relative">
                  <span className="flex size-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-[#f3c95e]">
                    <VerdictIcon aria-hidden="true" className="size-6" />
                  </span>
                  <p className="mt-6 text-xs font-extrabold tracking-wide text-[#f3c95e] sm:mt-8">
                    Workshop verdict
                  </p>
                  <h2 className="font-display mt-2 text-3xl font-semibold leading-none tracking-[-0.04em] sm:text-4xl">
                    {verdictKeepsDeck
                      ? "Keep this deck."
                      : "Improve this deck."}
                  </h2>
                  <p className="mt-4 text-sm leading-6 text-[#e8eef6] sm:mt-5">
                    {analysis.verdictReason}
                  </p>
                  <div className="mt-6 border-t border-white/15 pt-5 sm:mt-8">
                    <p className="text-xs font-bold text-[#c5d0e0]">
                      Meta position
                    </p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="font-display text-2xl font-semibold">
                          {analysis.metaTier.archetype}
                        </p>
                        <p className="mt-1 text-xs text-[#d0d9e6]">
                          {metaAvailable
                            ? "Live ladder evidence + battle log"
                            : "Recent battle-log evidence"}
                        </p>
                      </div>
                      <span className="font-display text-6xl font-semibold leading-none text-[#f3c95e]">
                        {analysis.metaTier.tier}
                      </span>
                    </div>
                  </div>
                </div>
              </aside>

              <div className="order-2 p-6 sm:p-9 lg:order-1 lg:p-12">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#cbd7e8] bg-[#f8faff] px-3 py-1 text-xs font-extrabold text-[#33445c]">
                    {player.tag}
                  </span>
                  <span className="rounded-full bg-[#fff5d6] px-3 py-1 text-xs font-extrabold text-[#76530a]">
                    {player.arena.name}
                  </span>
                  <span className="rounded-full border border-[#cdd8e8] bg-white px-3 py-1 text-xs font-extrabold text-[#33445c]">
                    Closed-loop advisor
                  </span>
                </div>
                <h1 className="font-display mt-6 max-w-4xl text-[clamp(2.65rem,7vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.052em]">
                  {mode === "best"
                    ? `The best deck in ${player.name}'s collection.`
                    : `${player.name}'s deck is on the workbench.`}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-[#3d4d63] sm:text-lg sm:leading-8">
                  {mode === "best"
                    ? "Every card you own, scored against recent threats and the live ladder meta to find the strongest legal deck you can field today."
                    : "Tracks every deck version you play, attributes before/after win-rate changes, and targets swaps at the exact cards beating you."}
                </p>

                <dl className="mt-8 grid grid-cols-2 gap-x-5 gap-y-6 border-t border-[#d9e1ec] pt-6 sm:grid-cols-4">
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-bold text-[#526175]">
                      <Trophy aria-hidden="true" className="size-3.5" />
                      Trophies
                    </dt>
                    <dd className="mt-1 text-xl font-extrabold tabular-nums">
                      {numberFormatter.format(player.trophies)}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-bold text-[#526175]">
                      <Target aria-hidden="true" className="size-3.5" />
                      Recent win rate
                    </dt>
                    <dd className="mt-1 text-xl font-extrabold tabular-nums">
                      {recentWinRate.toFixed(1)}%
                      <span className="block text-[11px] font-bold text-[#6d7a8b]">
                        {lossAutopsy.totalBattlesAnalyzed > 0
                          ? `${lossAutopsy.recentWins}W–${lossAutopsy.recentLosses}L (${careerWinRate.toFixed(1)}% career)`
                          : `${careerWinRate.toFixed(1)}% career`}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-bold text-[#526175]">
                      <MapPinned aria-hidden="true" className="size-3.5" />
                      Arena
                    </dt>
                    <dd className="mt-1 truncate text-sm font-extrabold sm:text-base">
                      {player.arena.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-bold text-[#526175]">
                      <Clock3 aria-hidden="true" className="size-3.5" />
                      Refreshed
                    </dt>
                    <dd className="mt-1 text-sm font-extrabold sm:text-base">
                      {new Date(generatedAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>

          {hasActiveConstraints ? (
            <div className="flex flex-col gap-3 rounded-[1.25rem] border border-[#164fc9]/30 bg-[#f2f6ff] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[#164fc9]">
                  Active feedback constraints:
                </span>
                {feedback.lockedCards.map((name) => (
                  <button
                    key={`lock-${name}`}
                    type="button"
                    onClick={() => handleToggleLock(name)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#164fc9] px-3 py-1 text-xs font-extrabold text-white"
                  >
                    <Lock aria-hidden="true" className="size-3" />
                    Keep: {name}
                    <X aria-hidden="true" className="size-3" />
                  </button>
                ))}
                {feedback.excludedCards.map((name) => (
                  <button
                    key={`ban-${name}`}
                    type="button"
                    onClick={() => handleToggleExclude(name)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#b42318] px-3 py-1 text-xs font-extrabold text-white"
                  >
                    <Ban aria-hidden="true" className="size-3" />
                    Avoid: {name}
                    <X aria-hidden="true" className="size-3" />
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetConstraints}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#bdcbe0] bg-white px-3 py-1.5 text-xs font-extrabold text-[#0b1f3a] hover:bg-[#f8faff]"
                >
                  <RotateCcw aria-hidden="true" className="size-3.5" />
                  Reset constraints
                </button>
                {feedback.suggestionHistory.length > 0 ? (
                  <button
                    type="button"
                    onClick={handleClearFullLedger}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#d9e1ec] bg-white px-3 py-1.5 text-xs font-bold text-[#6d7a8b] hover:text-[#b42318]"
                  >
                    Clear ledger
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 rounded-[1.25rem] border border-[#cdd8e8] bg-[#eef4ff] p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
            <p className="px-1 text-sm font-bold text-[#33445c]">
              Final deck ready to inspect in Clash Royale.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <a
                href={deckLink || undefined}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!deckLink}
                className="royal-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#164fc9] px-4 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(22,79,201,0.16)] transition-colors hover:bg-[#103fa5] aria-disabled:pointer-events-none aria-disabled:opacity-50"
              >
                <ExternalLink aria-hidden="true" className="size-4" />
                Open in Clash Royale
              </a>
              <button
                type="button"
                onClick={copyDeckLink}
                disabled={!deckLink}
                className="royal-focus inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#bdcbe0] bg-white px-4 py-2.5 text-sm font-extrabold text-[#0b1f3a] transition-colors hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {copyStatus === "copied" ? (
                  <Check aria-hidden="true" className="size-4 text-[#087454]" />
                ) : (
                  <Copy aria-hidden="true" className="size-4" />
                )}
                {copyStatus === "copied"
                  ? "Deck link copied"
                  : "Copy deck link"}
              </button>
              <span className="sr-only" aria-live="polite">
                {copyStatus === "copied"
                  ? "Deck link copied"
                  : copyStatus === "failed"
                    ? "Deck link could not be copied"
                    : ""}
              </span>
            </div>
          </div>

          <DeckComparison
            analysis={analysis}
            player={player}
            lockedCards={feedback.lockedCards}
            excludedCards={feedback.excludedCards}
            onToggleLock={handleToggleLock}
            onToggleExclude={handleToggleExclude}
          />

          <SwapList
            changes={analysis.changes}
            player={player}
            onKeepOutgoing={handleToggleLock}
            onRejectIncoming={handleToggleExclude}
          />

          <LossAutopsyPanel
            lossAutopsy={lossAutopsy}
            changes={analysis.changes}
          />

          <LearningTracker
            deckVersions={deckVersions}
            changeImpacts={changeImpacts}
            appliedFeedback={appliedFeedback}
            evidence={analysis.evidence}
          />

          {analysis.evidence ? (
            <EvidencePanel evidence={analysis.evidence} />
          ) : null}

          {analysis.problems.length > 0 ? (
            <section aria-labelledby="problems-title">
              <div className="mb-5">
                <p className="flex items-center gap-2 text-sm font-bold text-[#b42318]">
                  <AlertTriangle aria-hidden="true" className="size-4" />
                  Current deck pressure points
                </p>
                <h2
                  id="problems-title"
                  className="font-display mt-1 text-3xl font-semibold tracking-[-0.035em]"
                >
                  What the workshop found
                </h2>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {analysis.problems.map((problem) => (
                  <article
                    key={problem.title}
                    className="border-l-[3px] border-[#d6a11f] bg-white px-5 py-4 shadow-[0_8px_24px_rgba(11,31,58,0.045)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-extrabold">{problem.title}</h3>
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-[10px] font-extrabold capitalize",
                          problem.severity === "high"
                            ? "bg-[#fff0ef] text-[#b42318]"
                            : problem.severity === "medium"
                              ? "bg-[#fff5d6] text-[#76530a]"
                              : "bg-[#eef1f5] text-[#526175]",
                        ].join(" ")}
                      >
                        {problem.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#5c6b7f]">
                      {problem.description}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <section className="relative overflow-hidden rounded-[1.35rem] border border-[#cdb254] bg-[#fff8df] p-5 sm:p-7">
              <Gauge
                aria-hidden="true"
                className="absolute -bottom-5 -right-5 size-32 text-[#d6a11f]/10"
              />
              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-[#76530a]">
                      Meta position
                    </p>
                    <h2 className="font-display mt-1 text-3xl font-semibold">
                      {analysis.metaTier.archetype}
                    </h2>
                  </div>
                  <span className="font-display text-7xl font-semibold leading-none text-[#164fc9]">
                    {analysis.metaTier.tier}
                  </span>
                </div>
                <p className="mt-5 max-w-xl text-sm leading-6 text-[#5f573d]">
                  {analysis.metaTier.summary}
                </p>
              </div>
            </section>

            <section className="paper-panel rounded-[1.35rem] p-5 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#eaf1ff] text-[#164fc9]">
                  <BrainCircuit aria-hidden="true" className="size-5" />
                </span>
                <h2 className="font-display text-2xl font-semibold">
                  How to pilot it
                </h2>
              </div>
              <p className="font-display mt-5 text-xl leading-8 text-[#233650] sm:text-2xl sm:leading-9">
                {analysis.strategy}
              </p>
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <StrengthBars scores={analysis.weaknessScores} />
            <Matchups matchups={analysis.matchups} />
          </div>

          {analysis.replayAdvice.length > 0 ? (
            <section
              aria-labelledby="replay-title"
              className="overflow-hidden rounded-[1.35rem] border border-[#bed0ef] bg-[#f5f8ff]"
            >
              <div className="border-b border-[#ccd9ee] px-5 py-5 sm:px-7">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-white text-[#164fc9] shadow-sm">
                    <History aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <h2
                      id="replay-title"
                      className="font-display text-2xl font-semibold"
                    >
                      Replay notes
                    </h2>
                    <p className="text-sm text-[#5c6b7f]">
                      Lessons grounded in the recent losses
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid divide-y divide-[#d5e0f1] md:grid-cols-3 md:divide-x md:divide-y-0">
                {analysis.replayAdvice.map((advice, index) => (
                  <article key={advice.title} className="p-5 sm:p-6">
                    <span className="flex size-7 items-center justify-center rounded-full bg-[#164fc9] text-xs font-extrabold text-white">
                      {index + 1}
                    </span>
                    <h3 className="mt-4 font-extrabold">{advice.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#5c6b7f]">
                      {advice.detail}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {levelWarnings.length > 0 ? (
            <section
              aria-labelledby="level-warning-title"
              className="rounded-[1.35rem] border border-[#ecc8a3] bg-[#fffaf3] p-5 sm:p-7"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#fff0d5] text-[#9a5b0b]">
                  <AlertTriangle aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2
                    id="level-warning-title"
                    className="font-display text-2xl font-semibold"
                  >
                    Level-impact warnings
                  </h2>
                  <div className="mt-4 space-y-3">
                    {levelWarnings.map((warning) => (
                      <article
                        key={warning.cardName}
                        className="border-t border-[#ecd9c4] pt-3 first:border-0 first:pt-0"
                      >
                        <h3 className="text-sm font-extrabold">
                          {warning.cardName}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-[#705f4b]">
                          {warning.message}
                        </p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <footer className="mt-14 flex flex-col gap-4 border-t border-[#d9e1ec] py-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-[#526175]">
            <ServerCog aria-hidden="true" className="size-4 text-[#164fc9]" />
            Clash Royale and Gemini credentials stay on the server.
          </div>
          <p className="text-xs text-[#7a8798]">
            Personal advisor for player #VGURQ0QQ2
          </p>
        </footer>
      </main>
    </>
  );
}
