import "server-only";

import { unstable_cache } from "next/cache";

import { toStoredBattle } from "./battle-history";
import { getAnalysisContext, PLAYER_TAG } from "./clash-royale";
import { runDeckEngine } from "./deck-engine";
import { buildEngineContext, type AnalysisMode } from "./engine-context";
import { mergeSuggestionHistories } from "./feedback-store";
import { getLevelWarnings } from "./level-warnings";
import type { StoredBattle } from "./schemas";
import type { AnalysisResponse, PlayerFeedbackInput } from "./types";

const ANALYSIS_CACHE_SECONDS = 30 * 60;

export const ANALYSIS_CACHE_TAG = "clash-deck-advisor-analysis";

/**
 * Everything the advisor has learned arrives with the request. The server
 * keeps no ledger of its own: serverless instances do not share memory and
 * lose it on cold starts, so the browser's saved history is the only record.
 */
export interface AnalysisInput {
  feedback?: PlayerFeedbackInput;
  battleHistory?: StoredBattle[];
}

export function hasPersonalInput(input: AnalysisInput): boolean {
  return Boolean(
    input.feedback?.lockedCards.length ||
      input.feedback?.excludedCards.length ||
      input.feedback?.suggestionHistory.length ||
      input.battleHistory?.length,
  );
}

export async function generateDeckAnalysis(
  mode: AnalysisMode = "improve",
  input: AnalysisInput = {},
): Promise<AnalysisResponse> {
  const startedAt = Date.now();
  const feedback: PlayerFeedbackInput = {
    lockedCards: [...new Set(input.feedback?.lockedCards ?? [])],
    excludedCards: [...new Set(input.feedback?.excludedCards ?? [])],
    suggestionHistory: mergeSuggestionHistories(
      input.feedback?.suggestionHistory ?? [],
      [],
    ),
  };

  const context = await getAnalysisContext({
    suggestionHistory: feedback.suggestionHistory,
    storedBattles: input.battleHistory,
  });
  const engine = buildEngineContext(context, mode, feedback);
  const { analysis, penalizedDecks, diagnostics } = await runDeckEngine(engine);

  const historyStats = context.historyStats ?? {
    battlesTracked: 0,
    fromBattleLog: 0,
    fromBrowser: 0,
    oldestBattleTime: null,
  };

  console.info("[clash-deck-advisor] generated analysis", {
    mode,
    durationMs: Date.now() - startedAt,
    recentLossCount: context.recentLosses.length,
    metaDeckCount: context.metaDecks.length,
    lockedCount: feedback.lockedCards.length,
    excludedCount: feedback.excludedCards.length,
    suggestionCount: feedback.suggestionHistory.length,
    battlesTracked: historyStats.battlesTracked,
    battlesFromBrowser: historyStats.fromBrowser,
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
    generatedAt: new Date().toISOString(),
    metaAvailable: context.metaAvailable,
    mode,
    lossAutopsy: context.lossAutopsy,
    deckVersions: context.deckVersions,
    changeImpacts: context.changeImpacts,
    appliedFeedback: {
      lockedCards: feedback.lockedCards,
      excludedCards: feedback.excludedCards,
      penalizedDecks,
    },
    battleLog: (context.freshBattles ?? []).map(toStoredBattle),
    historyStats,
  };
}

const cachedByMode: Record<AnalysisMode, () => Promise<AnalysisResponse>> = {
  improve: unstable_cache(
    () => generateDeckAnalysis("improve"),
    ["clash-deck-advisor", PLAYER_TAG, "analysis-v7", "improve"],
    { revalidate: ANALYSIS_CACHE_SECONDS, tags: [ANALYSIS_CACHE_TAG] },
  ),
  best: unstable_cache(
    () => generateDeckAnalysis("best"),
    ["clash-deck-advisor", PLAYER_TAG, "analysis-v7", "best"],
    { revalidate: ANALYSIS_CACHE_SECONDS, tags: [ANALYSIS_CACHE_TAG] },
  ),
};

/** Only a first visit, with nothing saved in the browser yet, can share the cache. */
export function getCachedDeckAnalysis(
  mode: AnalysisMode = "improve",
  input: AnalysisInput = {},
): Promise<AnalysisResponse> {
  if (hasPersonalInput(input)) {
    return generateDeckAnalysis(mode, input);
  }

  return cachedByMode[mode]();
}
