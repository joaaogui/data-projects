"use client";

import { Skeleton } from "@data-projects/ui";
import { RefreshCw, ServerCog, Sparkles } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import type { AnalysisMode } from "@/lib/engine-context";
import {
  clearCardConstraints,
  emptyLedger,
  hasLedgerData,
  loadLedger,
  recordAnalysis,
  saveLedger,
  toFeedbackInput,
  toggleExcludedCard,
  toggleLockedCard,
  type LearningLedger,
} from "@/lib/feedback-store";
import type { AnalysisResponse, ClashCard } from "@/lib/types";

import { AnalysisDetails } from "./analysis-details";
import { AnalysisError } from "./analysis-error";
import { ChangePlan } from "./change-plan";
import { LastChangeCard } from "./learning-tracker";
import { LossReasons } from "./loss-autopsy";
import { StatusStrip } from "./status-strip";

interface AnalysisRequestState {
  id: number;
  mode: AnalysisMode;
  refresh: boolean;
}

interface ViewState {
  data: AnalysisResponse | null;
  loading: boolean;
  error: { code: string; message: string } | null;
}

interface ErrorPayload {
  error?: {
    code?: string;
    message?: string;
  };
}

const MODES: Record<AnalysisMode, { label: string; caption: string }> = {
  improve: {
    label: "Improve my deck",
    caption: "A few targeted swaps that keep your deck recognisable.",
  },
  best: {
    label: "Best possible",
    caption: "The strongest deck your whole collection can build.",
  },
};

function Header() {
  return (
    <header className="border-b border-[#d9e1ec]/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/crown-mark.svg"
            alt=""
            width={36}
            height={36}
            className="size-9 shrink-0"
            priority
          />
          <div className="min-w-0">
            <p className="font-display truncate text-lg font-semibold leading-none tracking-[-0.02em]">
              Clash Deck Advisor
            </p>
            <p className="mt-1 text-[11px] font-bold text-[#6d7a8b]">
              Personal advisor for #VGURQ0QQ2
            </p>
          </div>
        </div>
        <a
          href="https://joaog.space"
          className="royal-focus inline-flex min-h-10 shrink-0 items-center rounded-xl border border-[#cdd8e8] bg-white px-3 py-1.5 text-xs font-extrabold text-[#0b1f3a] shadow-sm transition-colors hover:bg-[#f8faff]"
        >
          ← joaog.space
        </a>
      </div>
    </header>
  );
}

function Controls({
  mode,
  busy,
  updating,
  onSelectMode,
  onRefresh,
}: {
  mode: AnalysisMode;
  busy: boolean;
  updating: boolean;
  onSelectMode: (mode: AnalysisMode) => void;
  onRefresh: () => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          role="group"
          aria-label="Recommendation type"
          className="grid flex-1 grid-cols-2 rounded-xl border border-[#cdd8e8] bg-white p-1 shadow-sm sm:flex-none"
        >
          {(Object.keys(MODES) as AnalysisMode[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={mode === option}
              disabled={busy}
              onClick={() => onSelectMode(option)}
              className={[
                "royal-focus min-h-11 rounded-lg px-2 text-[13px] font-extrabold transition-colors disabled:cursor-not-allowed sm:px-4 sm:text-sm",
                mode === option
                  ? "bg-[#164fc9] text-white"
                  : "text-[#33445c] hover:bg-[#f2f6ff] disabled:opacity-50",
              ].join(" ")}
            >
              {MODES[option].label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={busy}
          aria-label="Refresh analysis"
          className="royal-focus inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border border-[#cdd8e8] bg-white px-3 text-sm font-extrabold text-[#0b1f3a] shadow-sm transition-colors hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto sm:px-4"
        >
          <RefreshCw
            aria-hidden="true"
            className={[
              "size-4",
              busy ? "animate-spin motion-reduce:animate-none" : "",
            ].join(" ")}
          />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
      <p className="mt-2 px-1 text-xs text-[#5c6b7f]" aria-live="polite">
        {updating ? "Updating with your latest choice…" : MODES[mode].caption}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div aria-busy="true" className="mt-5 space-y-5">
      <div className="paper-panel flex items-center gap-4 rounded-2xl px-5 py-5 sm:px-6">
        <span className="workshop-pulse flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#eaf1ff] text-[#164fc9]">
          <Sparkles aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-[#0b1f3a]" aria-live="polite">
            Reading your recent battles and scoring swaps…
          </p>
          <Skeleton className="mt-2 h-3 w-2/3 rounded-full" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="paper-panel space-y-3 rounded-2xl p-5 sm:p-6">
          <Skeleton className="h-6 w-1/2 rounded-full" />
          <Skeleton className="h-4 w-3/4 rounded-full" />
          <Skeleton className="h-28 rounded-xl" />
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="aspect-[4/5] rounded-xl" />
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div className="paper-panel h-44 rounded-2xl p-5 sm:p-6">
            <Skeleton className="h-6 w-2/3 rounded-full" />
          </div>
          <div className="paper-panel h-40 rounded-2xl p-5 sm:p-6">
            <Skeleton className="h-6 w-1/2 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function DeckDashboard() {
  const [request, setRequest] = useState<AnalysisRequestState>({
    id: 0,
    mode: "improve",
    refresh: false,
  });
  const [ledger, setLedger] = useState<LearningLedger>(() => loadLedger());
  const [view, setView] = useState<ViewState>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();
    setView((current) => ({ ...current, loading: true, error: null }));

    async function loadAnalysis() {
      try {
        const saved = loadLedger();
        let response: Response;
        if (hasLedgerData(saved)) {
          response = await fetch("/api/analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              mode: request.mode,
              refresh: request.refresh,
              feedback: toFeedbackInput(saved),
              battleHistory: saved.battleHistory,
            }),
            cache: "no-store",
            signal: controller.signal,
          });
        } else {
          const query = new URLSearchParams({ mode: request.mode });
          if (request.refresh) {
            query.set("refresh", "1");
          }
          response = await fetch(`/api/analysis?${query}`, {
            cache: "no-store",
            signal: controller.signal,
          });
        }

        const payload = (await response.json().catch(() => null)) as
          | AnalysisResponse
          | ErrorPayload
          | null;

        if (!response.ok || !payload || !("analysis" in payload)) {
          const error = (payload as ErrorPayload | null)?.error;
          setView((current) => ({
            ...current,
            loading: false,
            error: {
              code: error?.code ?? "ANALYSIS_FAILED",
              message:
                error?.message ?? "The server could not complete the analysis.",
            },
          }));
          return;
        }

        const updated = recordAnalysis(loadLedger(), payload);
        saveLedger(updated);
        setLedger(updated);
        setView({ data: payload, loading: false, error: null });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setView((current) => ({
          ...current,
          loading: false,
          error: {
            code: "NETWORK_ERROR",
            message:
              error instanceof Error
                ? error.message
                : "The live analysis could not be loaded.",
          },
        }));
      }
    }

    void loadAnalysis();
    return () => controller.abort();
  }, [request]);

  function reanalyze() {
    setRequest((current) => ({ ...current, id: current.id + 1, refresh: false }));
  }

  function refreshNow() {
    setRequest((current) => ({ ...current, id: current.id + 1, refresh: true }));
  }

  function switchMode(next: AnalysisMode) {
    if (next === request.mode) {
      return;
    }
    setView({ data: null, loading: true, error: null });
    setRequest((current) => ({ id: current.id + 1, mode: next, refresh: false }));
  }

  function updateLedger(next: LearningLedger) {
    saveLedger(next);
    setLedger(next);
    reanalyze();
  }

  function clearHistory() {
    if (
      !window.confirm(
        "Forget the saved battles, suggestions, and card rules in this browser?",
      )
    ) {
      return;
    }
    updateLedger(emptyLedger());
  }

  const { data, loading, error } = view;

  if (!data && error) {
    return (
      <>
        <Header />
        <AnalysisError
          code={error.code}
          message={error.message}
          onRetry={reanalyze}
          onClearHistory={hasLedgerData(ledger) ? clearHistory : undefined}
        />
      </>
    );
  }

  const cardsByName = new Map<string, ClashCard>(
    data
      ? [...data.player.cards, ...data.player.currentDeck].map((card) => [
          card.name,
          card,
        ])
      : [],
  );

  return (
    <>
      <Header />
      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl px-4 pb-12 pt-6 sm:px-6 lg:px-8 lg:pt-8"
      >
        <Controls
          mode={request.mode}
          busy={loading}
          updating={loading && Boolean(data)}
          onSelectMode={switchMode}
          onRefresh={refreshNow}
        />

        {error && data ? (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ecc8a3] bg-[#fffaf3] px-4 py-2 text-sm text-[#5f4630]"
          >
            <p>
              <strong className="font-extrabold">Could not update.</strong>{" "}
              {error.message}
            </p>
            <button
              type="button"
              onClick={reanalyze}
              className="royal-focus inline-flex min-h-11 items-center rounded-lg px-3 font-extrabold text-[#164fc9] hover:underline"
            >
              Try again
            </button>
          </div>
        ) : null}

        {data ? (
          <div className="mt-5 space-y-5 lg:space-y-6">
            <StatusStrip
              player={data.player}
              lossAutopsy={data.lossAutopsy}
              generatedAt={data.generatedAt}
            />

            <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-6">
              <div className="lg:col-start-2 lg:row-start-1">
                <LastChangeCard
                  changeImpacts={data.changeImpacts}
                  deckVersions={data.deckVersions}
                  historyStats={data.historyStats}
                  avoidedCards={data.analysis.evidence?.avoidedFailedSwaps ?? []}
                  onClearHistory={clearHistory}
                />
              </div>
              <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
                <ChangePlan
                  analysis={data.analysis}
                  mode={data.mode}
                  cardsByName={cardsByName}
                  lockedCards={ledger.lockedCards}
                  excludedCards={ledger.excludedCards}
                  currentDeckVersion={data.deckVersions.find(
                    (v) => v.isCurrentActiveDeck,
                  )}
                  onToggleLock={(name) =>
                    updateLedger(toggleLockedCard(ledger, name))
                  }
                  onToggleExclude={(name) =>
                    updateLedger(toggleExcludedCard(ledger, name))
                  }
                  onClearRules={() => updateLedger(clearCardConstraints(ledger))}
                  onSwitchToBestMode={() => switchMode("best")}
                />
              </div>
              <div className="lg:col-start-2 lg:row-start-2">
                <LossReasons
                  lossAutopsy={data.lossAutopsy}
                  changes={data.analysis.changes}
                  cardsByName={cardsByName}
                />
              </div>
            </div>

            <AnalysisDetails
              analysis={data.analysis}
              levelWarnings={data.levelWarnings}
            />
          </div>
        ) : (
          <LoadingSkeleton />
        )}

        <footer className="mt-12 flex flex-col gap-2 border-t border-[#d9e1ec] pt-6 text-xs text-[#6d7a8b] sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 font-bold text-[#526175]">
            <ServerCog aria-hidden="true" className="size-4 text-[#164fc9]" />
            Clash Royale and AI keys stay on the server.
          </p>
          <div className="flex items-center gap-4">
            <p>Battles, deck versions, and card rules are persisted in Postgres.</p>
            <a
              href="https://joaog.space"
              className="royal-focus font-extrabold text-[#164fc9] hover:underline"
            >
              ← joaog.space
            </a>
          </div>
        </footer>
      </main>
    </>
  );
}
