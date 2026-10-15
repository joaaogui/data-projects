import { mergeBattleHistory } from "./battle-history";
import { deckKeyOf } from "./learning-engine";
import {
  battleHistorySchema,
  playerFeedbackInputSchema,
  type StoredBattle,
} from "./schemas";
import type {
  AnalysisResponse,
  PlayerFeedbackInput,
  StoredSuggestionEntry,
} from "./types";

/**
 * The browser is the advisor's only durable memory. Serverless instances keep
 * nothing between requests, so this ledger is sent with every analysis.
 */
export const LEARNING_LEDGER_STORAGE_KEY =
  "clash-deck-advisor:learning-ledger:v1";

const MAX_SUGGESTION_HISTORY = 20;

export interface LearningLedger extends PlayerFeedbackInput {
  battleHistory: StoredBattle[];
}

export function emptyLedger(): LearningLedger {
  return {
    lockedCards: [],
    excludedCards: [],
    suggestionHistory: [],
    battleHistory: [],
  };
}

/**
 * Reads each half on its own so one malformed battle cannot wipe the saved
 * suggestions and card rules, or the other way round.
 */
export function parseLedger(raw: unknown): LearningLedger {
  const feedback = playerFeedbackInputSchema.safeParse(raw);
  const battles = battleHistorySchema.safeParse(
    raw && typeof raw === "object"
      ? (raw as { battleHistory?: unknown }).battleHistory
      : undefined,
  );
  return {
    ...(feedback.success ? feedback.data : emptyLedger()),
    battleHistory: battles.success ? battles.data : [],
  };
}

export function loadLedger(): LearningLedger {
  if (typeof window === "undefined") {
    return emptyLedger();
  }
  try {
    const raw = window.localStorage.getItem(LEARNING_LEDGER_STORAGE_KEY);
    return raw ? parseLedger(JSON.parse(raw)) : emptyLedger();
  } catch {
    return emptyLedger();
  }
}

export function saveLedger(ledger: LearningLedger): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(
      LEARNING_LEDGER_STORAGE_KEY,
      JSON.stringify(ledger),
    );
  } catch {
    // Ignore storage quota or private-browsing failures.
  }
}

export function hasLedgerData(ledger: LearningLedger): boolean {
  return (
    ledger.lockedCards.length > 0 ||
    ledger.excludedCards.length > 0 ||
    ledger.suggestionHistory.length > 0 ||
    ledger.battleHistory.length > 0
  );
}

export function toFeedbackInput(ledger: LearningLedger): PlayerFeedbackInput {
  return {
    lockedCards: ledger.lockedCards,
    excludedCards: ledger.excludedCards,
    suggestionHistory: ledger.suggestionHistory,
  };
}

export function toggleLockedCard<T extends PlayerFeedbackInput>(
  state: T,
  cardName: string,
): T {
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

export function toggleExcludedCard<T extends PlayerFeedbackInput>(
  state: T,
  cardName: string,
): T {
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

export function clearCardConstraints<T extends PlayerFeedbackInput>(
  state: T,
): T {
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

export function buildSuggestionEntry(
  response: AnalysisResponse,
): StoredSuggestionEntry | null {
  if (response.analysis.changes.length === 0) {
    return null;
  }

  const activeVersion = response.deckVersions.find(
    (v) => v.isCurrentActiveDeck,
  );
  const baselineWinRate =
    activeVersion && activeVersion.battles > 0
      ? activeVersion.winRate
      : response.lossAutopsy.recentWinRate;

  return {
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
}

/** Folds one analysis into the ledger: its suggestion and its fresh battles. */
export function recordAnalysis(
  ledger: LearningLedger,
  response: AnalysisResponse,
): LearningLedger {
  const entry = buildSuggestionEntry(response);
  return {
    ...ledger,
    suggestionHistory: entry
      ? mergeSuggestionHistories(ledger.suggestionHistory, [entry])
      : ledger.suggestionHistory,
    battleHistory: mergeBattleHistory([
      response.battleLog ?? [],
      ledger.battleHistory,
    ]),
  };
}
