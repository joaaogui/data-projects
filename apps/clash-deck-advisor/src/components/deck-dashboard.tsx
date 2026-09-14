"use client";

import {
  AlertTriangle,
  BrainCircuit,
  Check,
  Clock3,
  Copy,
  ExternalLink,
  Gauge,
  History,
  MapPinned,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  WandSparkles,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { buildDeckLink } from "@/lib/deck-link";
import type { AnalysisResponse, ClashCard } from "@/lib/types";

import { AnalysisError } from "./analysis-error";
import { DeckComparison } from "./deck-comparison";
import { Matchups } from "./matchups";
import { StrengthBars } from "./strength-bars";
import { SwapList } from "./swap-list";

type DashboardState =
  | { status: "loading" }
  | { status: "ready"; data: AnalysisResponse }
  | { status: "error"; message: string };

interface ErrorPayload {
  error?: {
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
              Royal Workshop / #VGURQ0QQ2
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[#cdd8e8] bg-[#f8faff] px-3 py-1.5 text-xs font-bold text-[#33445c] sm:flex">
          <span className="size-2 rounded-full bg-[#087454]" />
          30-minute live snapshot
        </div>
      </div>
    </header>
  );
}

function LoadingDashboard() {
  const stages = [
    "Reading the current deck",
    "Reviewing recent battles",
    "Comparing the ladder meta",
  ];

  return (
    <>
      <WorkshopHeader />
      <main className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
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
                The advisor makes one evidence-based pass and keeps the deck
                intact unless a change is clearly better.
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
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

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
          const message =
            (payload as ErrorPayload).error?.message ??
            "The server could not complete the analysis.";
          throw new Error(message);
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
          message:
            error instanceof Error
              ? error.message
              : "The live analysis could not be loaded.",
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
        <WorkshopHeader />
        <AnalysisError
          message={state.message}
          onRetry={() => setRequestKey((value) => value + 1)}
        />
      </>
    );
  }

  const { analysis, player, generatedAt, levelWarnings, metaAvailable } =
    state.data;
  const cardsByName = new Map(
    [...player.cards, ...player.currentDeck].map((card) => [card.name, card]),
  );
  const improvedCards = analysis.improvedDeck
    .map((name) => cardsByName.get(name))
    .filter((card): card is ClashCard => Boolean(card));
  const deckLink = buildDeckLink(improvedCards);
  const winRate =
    player.wins + player.losses > 0
      ? (player.wins / (player.wins + player.losses)) * 100
      : 0;
  const verdictKeepsDeck = analysis.verdict === "keep";
  const VerdictIcon = verdictKeepsDeck ? ShieldCheck : WandSparkles;

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
      <main className="mx-auto w-full max-w-[1480px] px-4 pb-14 pt-7 sm:px-6 lg:px-10 lg:pb-20 lg:pt-10">
        <div className="space-y-12 lg:space-y-16">
          <section className="paper-panel relative overflow-hidden rounded-[1.6rem]">
            <div
              aria-hidden="true"
              className="absolute -left-20 -top-28 size-72 rounded-full border-[48px] border-[#164fc9]/[0.035]"
            />
            <div className="relative grid lg:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
              <div className="p-6 sm:p-9 lg:p-12">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[#cbd7e8] bg-[#f8faff] px-3 py-1 text-xs font-extrabold text-[#33445c]">
                    {player.tag}
                  </span>
                  <span className="rounded-full bg-[#fff5d6] px-3 py-1 text-xs font-extrabold text-[#76530a]">
                    {player.arena.name}
                  </span>
                </div>
                <h1 className="font-display mt-6 max-w-4xl text-[clamp(2.65rem,7vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.052em]">
                  {player.name}&apos;s deck is on the workbench.
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-[#5c6b7f] sm:text-lg sm:leading-8">
                  One current deck, recent battle evidence, and a live ladder
                  sample—reviewed without chasing changes for their own sake.
                </p>

                <dl className="mt-8 grid grid-cols-2 gap-x-5 gap-y-6 border-t border-[#d9e1ec] pt-6 sm:grid-cols-4">
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-bold text-[#6d7a8b]">
                      <Trophy aria-hidden="true" className="size-3.5" />
                      Trophies
                    </dt>
                    <dd className="mt-1 text-xl font-extrabold tabular-nums">
                      {numberFormatter.format(player.trophies)}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-bold text-[#6d7a8b]">
                      <Target aria-hidden="true" className="size-3.5" />
                      Win rate
                    </dt>
                    <dd className="mt-1 text-xl font-extrabold tabular-nums">
                      {winRate.toFixed(1)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-bold text-[#6d7a8b]">
                      <MapPinned aria-hidden="true" className="size-3.5" />
                      Arena
                    </dt>
                    <dd className="mt-1 truncate text-sm font-extrabold sm:text-base">
                      {player.arena.name}
                    </dd>
                  </div>
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs font-bold text-[#6d7a8b]">
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

              <aside className="relative overflow-hidden bg-[#0b1f3a] p-6 text-white sm:p-9 lg:p-10">
                <div
                  aria-hidden="true"
                  className="absolute -bottom-16 -right-12 size-56 rounded-full border-[34px] border-white/[0.035]"
                />
                <div className="relative">
                  <span className="flex size-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-[#f3c95e]">
                    <VerdictIcon aria-hidden="true" className="size-6" />
                  </span>
                  <p className="mt-8 text-xs font-extrabold text-[#f3c95e]">
                    Workshop verdict
                  </p>
                  <h2 className="font-display mt-2 text-4xl font-semibold leading-none tracking-[-0.04em]">
                    {verdictKeepsDeck
                      ? "Keep this deck."
                      : "Improve this deck."}
                  </h2>
                  <p className="mt-5 text-sm leading-6 text-[#d7e0ed]">
                    {analysis.verdictReason}
                  </p>
                  <div className="mt-8 border-t border-white/15 pt-5">
                    <p className="text-xs font-bold text-[#9fb0c8]">
                      Meta position
                    </p>
                    <div className="mt-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="font-display text-2xl font-semibold">
                          {analysis.metaTier.archetype}
                        </p>
                        <p className="mt-1 text-xs text-[#b9c6d8]">
                          {metaAvailable
                            ? "Live ladder evidence included"
                            : "Recent battles only"}
                        </p>
                      </div>
                      <span className="font-display text-6xl font-semibold leading-none text-[#f3c95e]">
                        {analysis.metaTier.tier}
                      </span>
                    </div>
                  </div>
                </div>
              </aside>
            </div>
          </section>

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

          <DeckComparison analysis={analysis} player={player} />

          <SwapList changes={analysis.changes} player={player} />

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
