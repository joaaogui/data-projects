"use client";

import { copyToClipboard } from "@data-projects/shared";
import { Ban, Check, Clock, Copy, ExternalLink, Lock, Sparkles, X } from "lucide-react";
import { useState } from "react";

import { buildDeckLink } from "@/lib/deck-link";
import type { AnalysisMode } from "@/lib/engine-context";
import { MIN_BATTLES_FOR_SWAP } from "@/lib/learning-engine";
import type { DeckAnalysis } from "@/lib/schemas";
import type { ClashCard, DeckVersionSummary } from "@/lib/types";

import { CardTile } from "./card-tile";
import { SwapList } from "./swap-list";

interface ChangePlanProps {
  analysis: DeckAnalysis;
  mode: AnalysisMode;
  cardsByName: Map<string, ClashCard>;
  lockedCards: string[];
  excludedCards: string[];
  currentDeckVersion?: DeckVersionSummary;
  onToggleLock: (cardName: string) => void;
  onToggleExclude: (cardName: string) => void;
  onClearRules: () => void;
  onSwitchToBestMode?: () => void;
}

function headlineFor(
  mode: AnalysisMode,
  swapCount: number,
  remainingSampleBattles: number,
): string {
  if (swapCount === 0) {
    if (mode === "improve" && remainingSampleBattles > 0) {
      return `Need ${remainingSampleBattles} more battle${remainingSampleBattles === 1 ? "" : "s"} with this deck.`;
    }
    return mode === "best"
      ? "Your deck is already your best build."
      : "Keep your deck as it is.";
  }
  const cards = `${swapCount} card${swapCount === 1 ? "" : "s"}`;
  return mode === "best" ? `Rebuild with ${cards} changed.` : `Swap ${cards}.`;
}

function RuleChip({
  kind,
  cardName,
  onRemove,
}: {
  kind: "keep" | "avoid";
  cardName: string;
  onRemove: (cardName: string) => void;
}) {
  const isKeep = kind === "keep";
  const Icon = isKeep ? Lock : Ban;
  return (
    <li>
      <button
        type="button"
        onClick={() => onRemove(cardName)}
        aria-label={`Stop ${isKeep ? "keeping" : "avoiding"} ${cardName}`}
        className={[
          "royal-focus inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-colors",
          isKeep
            ? "bg-[#eaf1ff] text-[#164fc9] hover:bg-[#dbe7ff]"
            : "bg-[#fff0ef] text-[#b42318] hover:bg-[#ffe3e0]",
        ].join(" ")}
      >
        <Icon aria-hidden="true" className="size-3.5" />
        {isKeep ? "Keep" : "Avoid"} {cardName}
        <X aria-hidden="true" className="size-3.5 opacity-70" />
      </button>
    </li>
  );
}

export function ChangePlan({
  analysis,
  mode,
  cardsByName,
  lockedCards,
  excludedCards,
  currentDeckVersion,
  onToggleLock,
  onToggleExclude,
  onClearRules,
  onSwitchToBestMode,
}: ChangePlanProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const deckCards = analysis.improvedDeck
    .map((name) => cardsByName.get(name))
    .filter((card): card is ClashCard => Boolean(card));
  const deckLink = buildDeckLink(deckCards);
  const originalNames = new Set(analysis.originalDeck);
  const hasRules = lockedCards.length > 0 || excludedCards.length > 0;

  const currentDeckBattles = currentDeckVersion?.battles ?? 0;
  const isSampleGated =
    mode === "improve" &&
    analysis.changes.length === 0 &&
    !hasRules &&
    currentDeckBattles < MIN_BATTLES_FOR_SWAP;
  const remainingSampleBattles = isSampleGated
    ? Math.max(0, MIN_BATTLES_FOR_SWAP - currentDeckBattles)
    : 0;
  const sampleProgressPct = Math.min(
    100,
    Math.round((currentDeckBattles / MIN_BATTLES_FOR_SWAP) * 100),
  );

  async function copyDeckLink() {
    if (!deckLink || !(await copyToClipboard(deckLink))) {
      setCopyStatus("failed");
      return;
    }
    setCopyStatus("copied");
    window.setTimeout(() => setCopyStatus("idle"), 2_000);
  }

  return (
    <section
      aria-labelledby="change-plan-title"
      className="paper-panel rounded-2xl p-5 sm:p-6"
    >
      <h2
        id="change-plan-title"
        className="font-display text-xl font-semibold tracking-[-0.02em] sm:text-2xl"
      >
        What to change now
      </h2>
      <p className="mt-3 text-lg font-extrabold text-[#0b1f3a]">
        {headlineFor(mode, analysis.changes.length, remainingSampleBattles)}
      </p>
      <p className="mt-1 max-w-prose text-sm leading-6 text-[#5c6b7f]">
        {analysis.verdictReason}
      </p>

      {isSampleGated ? (
        <div className="mt-5 rounded-xl border border-[#d8e3f5] bg-[#f5f8ff] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold text-[#164fc9]">
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden="true" className="size-3.5" />
              {currentDeckBattles} / {MIN_BATTLES_FOR_SWAP} battles recorded with your current deck
            </span>
            {currentDeckVersion && currentDeckBattles > 0 ? (
              <span className="text-[#33445c]">
                {currentDeckVersion.wins}W–{currentDeckVersion.losses}L so far
              </span>
            ) : null}
          </div>
          <div
            role="progressbar"
            aria-valuenow={currentDeckBattles}
            aria-valuemin={0}
            aria-valuemax={MIN_BATTLES_FOR_SWAP}
            aria-label="Battles recorded with your current deck"
            className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#dce6f7]"
          >
            <div
              className="h-full rounded-full bg-[#164fc9] transition-all"
              style={{ width: `${sampleProgressPct}%` }}
            />
          </div>
          <p className="mt-2.5 text-xs leading-5 text-[#33445c]">
            The advisor only recommends card swaps from matches actually played
            with this exact 8-card deck — never from older deck versions.
          </p>
          {onSwitchToBestMode ? (
            <button
              type="button"
              onClick={onSwitchToBestMode}
              className="royal-focus mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#c3d4f2] bg-white px-3.5 text-xs font-extrabold text-[#164fc9] transition-colors hover:bg-[#eaf1ff]"
            >
              <Sparkles aria-hidden="true" className="size-3.5" />
              Switch to &ldquo;Best possible&rdquo; collection build
            </button>
          ) : null}
        </div>
      ) : null}

      {analysis.changes.length > 0 ? (
        <div className="mt-6">
          <SwapList
            changes={analysis.changes}
            cardsByName={cardsByName}
            lockedCards={lockedCards}
            excludedCards={excludedCards}
            onToggleLock={onToggleLock}
            onToggleExclude={onToggleExclude}
          />
        </div>
      ) : null}

      <div className="mt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-extrabold text-[#0b1f3a]">
            {analysis.changes.length > 0 ? "Your deck after the swaps" : "Your deck"}
          </h3>
          <span className="text-xs font-bold text-[#5c6b7f]">
            {analysis.averageElixir.toFixed(1)} average elixir
          </span>
        </div>
        <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-8">
          {deckCards.map((card, index) => (
            <li key={card.id}>
              <CardTile
                card={card}
                isNew={!originalNames.has(card.name)}
                priority={index < 4}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href={deckLink || undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!deckLink}
          className="royal-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#164fc9] px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(22,79,201,0.16)] transition-colors hover:bg-[#103fa5] aria-disabled:pointer-events-none aria-disabled:opacity-50"
        >
          <ExternalLink aria-hidden="true" className="size-4" />
          Open in Clash Royale
        </a>
        <button
          type="button"
          onClick={copyDeckLink}
          disabled={!deckLink}
          className="royal-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#cdd8e8] bg-white px-5 text-sm font-extrabold text-[#0b1f3a] transition-colors hover:bg-[#f8faff] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {copyStatus === "copied" ? (
            <Check aria-hidden="true" className="size-4 text-[#087454]" />
          ) : (
            <Copy aria-hidden="true" className="size-4" />
          )}
          {copyStatus === "copied" ? "Link copied" : "Copy link"}
        </button>
        <span className="sr-only" aria-live="polite">
          {copyStatus === "copied"
            ? "Deck link copied"
            : copyStatus === "failed"
              ? "Deck link could not be copied"
              : ""}
        </span>
      </div>

      {hasRules ? (
        <div className="mt-6 border-t border-[#e2e7ee] pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#5c6b7f]">
              Your rules
            </h3>
            <button
              type="button"
              onClick={onClearRules}
              className="royal-focus inline-flex min-h-11 items-center rounded-lg px-2 text-xs font-bold text-[#5c6b7f] underline-offset-2 hover:text-[#0b1f3a] hover:underline"
            >
              Clear all
            </button>
          </div>
          <ul aria-label="Cards you kept or avoided" className="mt-1 flex flex-wrap gap-2">
            {lockedCards.map((name) => (
              <RuleChip
                key={`keep-${name}`}
                kind="keep"
                cardName={name}
                onRemove={onToggleLock}
              />
            ))}
            {excludedCards.map((name) => (
              <RuleChip
                key={`avoid-${name}`}
                kind="avoid"
                cardName={name}
                onRemove={onToggleExclude}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
