import { deckKeyOf } from "./learning-engine";
import { playerFeedbackInputSchema } from "./schemas";
import type {
  AnalysisResponse,
  PlayerFeedbackInput,
  StoredSuggestionEntry,
} from "./types";

export const LEARNING_LEDGER_STORAGE_KEY =
  "clash-deck-advisor:learning-ledger:v1";

const MAX_SUGGESTION_HISTORY = 20;

export function emptyFeedbackState(): PlayerFeedbackInput {
  return {
    lockedCards: [],
    excludedCards: [],
    suggestionHistory: [],
  };
}

export function loadFeedbackState(): PlayerFeedbackInput {
  if (typeof window === "undefined") {
    return emptyFeedbackState();
  }
  try {
    const raw = window.localStorage.getItem(LEARNING_LEDGER_STORAGE_KEY);
    if (!raw) return emptyFeedbackState();
    const parsed = playerFeedbackInputSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : emptyFeedbackState();
  } catch {
    return emptyFeedbackState();
  }
}

export function saveFeedbackState(state: PlayerFeedbackInput): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      LEARNING_LEDGER_STORAGE_KEY,
      JSON.stringify(state),
    );
  } catch {
    // Ignore storage quota or private-browsing failures.
  }
}

export function toggleLockedCard(
  state: PlayerFeedbackInput,
  cardName: string,
): PlayerFeedbackInput {
  const isLocked = state.lockedCards.includes(cardName);
  const lockedCards = isLocked
    ? state.lockedCards.filter((name) => name !== cardName)
    : [...state.lockedCards, cardName].slice(-8);
  const excludedCards = state.excludedCards.filter((name) => name !== cardName);

  return {
    ...state,
    lockedCards,
    excludedCards,
  };
}

export function toggleExcludedCard(
  state: PlayerFeedbackInput,
  cardName: string,
): PlayerFeedbackInput {
  const isExcluded = state.excludedCards.includes(cardName);
  const excludedCards = isExcluded
    ? state.excludedCards.filter((name) => name !== cardName)
    : [...state.excludedCards, cardName].slice(-20);
  const lockedCards = state.lockedCards.filter((name) => name !== cardName);

  return {
    ...state,
    lockedCards,
    excludedCards,
  };
}

export function clearCardConstraints(
  state: PlayerFeedbackInput,
): PlayerFeedbackInput {
  return {
    ...state,
    lockedCards: [],
    excludedCards: [],
  };
}

export function mergeSuggestionHistories(
  first: StoredSuggestionEntry[],
  second: StoredSuggestionEntry[],
): StoredSuggestionEntry[] {
  const bySignature = new Map<string, StoredSuggestionEntry>();
  for (const entry of [...first, ...second]) {
    const sig = `${entry.mode}:${deckKeyOf(entry.baselineDeck)}->${deckKeyOf(entry.recommendedDeck)}`;
    const existing = bySignature.get(sig);
    if (!existing || entry.createdAt > existing.createdAt) {
      bySignature.set(sig, entry);
    }
  }
  return [...bySignature.values()]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, MAX_SUGGESTION_HISTORY);
}

export function recordSuggestion(
  state: PlayerFeedbackInput,
  response: AnalysisResponse,
): PlayerFeedbackInput {
  if (response.analysis.changes.length === 0) {
    return state;
  }

  const activeVersion = response.deckVersions.find(
    (v) => v.isCurrentActiveDeck,
  );
  const baselineWinRate =
    activeVersion && activeVersion.battles > 0
      ? activeVersion.winRate
      : response.lossAutopsy.recentWinRate;

  const newEntry: StoredSuggestionEntry = {
    id: `sug-${response.mode}-${deckKeyOf(response.analysis.improvedDeck).slice(0, 24)}`,
    createdAt: response.generatedAt,
    mode: response.mode,
    baselineDeck: response.analysis.originalDeck,
    baselineWinRate,
    recommendedDeck: response.analysis.improvedDeck,
    recommendedSwaps: response.analysis.changes.map((c) => ({
      out: c.out,
      in: c.in,
    })),
    archetypeName: response.analysis.metaTier.archetype,
  };

  return {
    ...state,
    suggestionHistory: mergeSuggestionHistories(state.suggestionHistory, [
      newEntry,
    ]),
  };
}
