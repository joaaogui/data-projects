import "server-only";

import { unstable_cache } from "next/cache";

import { getAnalysisContext, PLAYER_TAG } from "./clash-royale";
import { runDeckEngine } from "./deck-engine";
import { buildEngineContext, type AnalysisMode } from "./engine-context";
import { mergeSuggestionHistories } from "./feedback-store";
import { deckKeyOf, evaluateDeckChangeImpacts } from "./learning-engine";
import { getLevelWarnings } from "./level-warnings";
import type {
  AnalysisResponse,
  PlayerFeedbackInput,
  StoredSuggestionEntry,
} from "./types";

const ANALYSIS_CACHE_SECONDS = 30 * 60;

export const ANALYSIS_CACHE_TAG = "clash-deck-advisor-analysis";

const serverSuggestionLedger = new Map<string, StoredSuggestionEntry[]>();

function getMergedServerSuggestions(
  playerTag: string,
  incoming: StoredSuggestionEntry[] = [],
): StoredSuggestionEntry[] {
  const existing = serverSuggestionLedger.get(playerTag) ?? [];
  const merged = mergeSuggestionHistories(existing, incoming);
  serverSuggestionLedger.set(playerTag, merged);
  return merged;
}

export async function generateDeckAnalysis(
  mode: AnalysisMode = "improve",
  feedback?: PlayerFeedbackInput,
): Promise<AnalysisResponse> {
  const startedAt = Date.now();
  const mergedHistory = getMergedServerSuggestions(
    PLAYER_TAG,
    feedback?.suggestionHistory,
  );
  const normalizedFeedback: PlayerFeedbackInput = {
    lockedCards: [...new Set(feedback?.lockedCards ?? [])],
    excludedCards: [...new Set(feedback?.excludedCards ?? [])],
    suggestionHistory: mergedHistory,
  };

  const context = await getAnalysisContext(mergedHistory);
  const engine = buildEngineContext(context, mode, normalizedFeedback);
  const { analysis, penalizedDecks, diagnostics } = await runDeckEngine(engine);

  const generatedAt = new Date().toISOString();

  if (analysis.changes.length > 0) {
    const activeVer = context.deckVersions.find((v) => v.isCurrentActiveDeck);
    const baselineWinRate =
      activeVer && activeVer.battles > 0
        ? activeVer.winRate
        : context.lossAutopsy.recentWinRate;

    const entry: StoredSuggestionEntry = {
      id: `sug-${mode}-${deckKeyOf(analysis.improvedDeck).slice(0, 24)}`,
      createdAt: generatedAt,
      mode,
      baselineDeck: analysis.originalDeck,
      baselineWinRate,
      recommendedDeck: analysis.improvedDeck,
      recommendedSwaps: analysis.changes.map((c) => ({
        out: c.out,
        in: c.in,
      })),
      archetypeName: analysis.metaTier.archetype,
    };
    const updatedHistory = getMergedServerSuggestions(PLAYER_TAG, [entry]);
    context.changeImpacts = evaluateDeckChangeImpacts(
      context.deckVersions,
      updatedHistory,
      context.player.currentDeck.map((c) => c.name),
    );
  }

  console.info("[clash-deck-advisor] generated analysis", {
    mode,
    durationMs: Date.now() - startedAt,
    recentLossCount: context.recentLosses.length,
    metaDeckCount: context.metaDecks.length,
    lockedCount: normalizedFeedback.lockedCards.length,
    excludedCount: normalizedFeedback.excludedCards.length,
    ...diagnostics,
  });

  const recommendedCards = analysis.improvedDeck.flatMap((name) => {
    const card =
      context.player.cards.find((owned) => owned.name === name) ??
      context.player.currentDeck.find((owned) => owned.name === name);
    return card ? [card] : [];
  });

  return {
    analysis,
    player: context.player,
    levelWarnings: getLevelWarnings(recommendedCards),
    generatedAt,
    metaAvailable: context.metaAvailable,
    mode,
    lossAutopsy: context.lossAutopsy,
    deckVersions: context.deckVersions,
    changeImpacts: context.changeImpacts,
    appliedFeedback: {
      lockedCards: normalizedFeedback.lockedCards,
      excludedCards: normalizedFeedback.excludedCards,
      penalizedDecks,
    },
  };
}

const cachedByMode: Record<AnalysisMode, () => Promise<AnalysisResponse>> = {
  improve: unstable_cache(
    () => generateDeckAnalysis("improve"),
    ["clash-deck-advisor", PLAYER_TAG, "analysis-v6", "improve"],
    { revalidate: ANALYSIS_CACHE_SECONDS, tags: [ANALYSIS_CACHE_TAG] },
  ),
  best: unstable_cache(
    () => generateDeckAnalysis("best"),
    ["clash-deck-advisor", PLAYER_TAG, "analysis-v6", "best"],
    { revalidate: ANALYSIS_CACHE_SECONDS, tags: [ANALYSIS_CACHE_TAG] },
  ),
};

export function getCachedDeckAnalysis(
  mode: AnalysisMode = "improve",
  feedback?: PlayerFeedbackInput,
): Promise<AnalysisResponse> {
  const hasCustomFeedback =
    feedback !== undefined &&
    (feedback.lockedCards.length > 0 ||
      feedback.excludedCards.length > 0 ||
      feedback.suggestionHistory.length > 0);

  if (hasCustomFeedback) {
    return generateDeckAnalysis(mode, feedback);
  }

  return cachedByMode[mode]();
}
