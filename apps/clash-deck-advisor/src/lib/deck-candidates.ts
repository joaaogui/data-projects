import type { CardProfile } from "./card-knowledge";
import { buildCanonicalNameMap, canonicalizeName } from "./card-names";
import { checkDeckLegality, DECK_SIZE } from "./deck-rules";
import { scoreDeck, type DeckScore } from "./deck-score";

export interface DeckCandidate {
  /** Which model proposed this deck, for attribution and logging. */
  modelLabel: string;
  deck: string[];
  archetype: string;
  rationale: string;
}

export interface RankedCandidate extends DeckCandidate {
  profiles: CardProfile[];
  score: DeckScore;
}

export interface RejectedCandidate {
  modelLabel: string;
  deck: string[];
  reason: string;
}

export interface RankingResult {
  accepted: RankedCandidate[];
  rejected: RejectedCandidate[];
}

export interface CardSwapPair {
  out: string;
  in: string;
}

/**
 * Keeps only candidates that are playable for this specific player, then
 * orders them by the deterministic score.
 *
 * Ranking locally rather than asking a model to pick means the comparison is
 * reproducible and cannot be talked into a bad deck by a confident rationale.
 */
export function rankCandidates(
  candidates: DeckCandidate[],
  ownedProfiles: CardProfile[],
): RankingResult {
  const canonicalNames = buildCanonicalNameMap(
    ownedProfiles.map((card) => card.name),
  );
  const profileByName = new Map(
    ownedProfiles.map((card) => [card.name, card]),
  );

  const accepted: RankedCandidate[] = [];
  const rejected: RejectedCandidate[] = [];

  for (const candidate of candidates) {
    const deck = candidate.deck.map((name) =>
      canonicalizeName(name, canonicalNames),
    );

    const unowned = deck.filter((name) => !profileByName.has(name));
    if (unowned.length > 0) {
      rejected.push({
        modelLabel: candidate.modelLabel,
        deck,
        reason: `Player does not own: ${unowned.join(", ")}`,
      });
      continue;
    }

    if (new Set(deck).size !== DECK_SIZE) {
      rejected.push({
        modelLabel: candidate.modelLabel,
        deck,
        reason: `Deck must contain ${DECK_SIZE} unique cards`,
      });
      continue;
    }

    const profiles = deck.map((name) => profileByName.get(name)!);
    const legality = checkDeckLegality(profiles);
    if (!legality.legal) {
      rejected.push({
        modelLabel: candidate.modelLabel,
        deck,
        reason: legality.violations.join("; "),
      });
      continue;
    }

    accepted.push({
      ...candidate,
      deck,
      profiles,
      score: scoreDeck(profiles),
    });
  }

  accepted.sort(
    (left, right) =>
      right.score.total - left.score.total ||
      left.modelLabel.localeCompare(right.modelLabel),
  );

  return { accepted, rejected };
}

/**
 * How much better a proposed deck must score before a swap is worth making.
 *
 * Without a margin, a candidate that ties the current deck would still be
 * recommended, and the next run would happily swap the cards back. Requiring
 * a clear gain keeps advice stable between runs.
 */
export const IMPROVEMENT_MARGIN = 3;

/** An improvement means a few targeted swaps, not a different deck. */
export const MAX_IMPROVE_SWAPS = 3;

export interface WinnerSelection {
  winner: RankedCandidate;
  keptCurrentDeck: boolean;
  discardedForTooManySwaps: number;
}

/**
 * Picks the deck to recommend, with the current deck as the incumbent.
 */
export function selectWinner(
  candidates: RankedCandidate[],
  currentDeck: RankedCandidate,
  mode: "improve" | "best",
): WinnerSelection {
  if (mode === "best") {
    const best = [...candidates].sort(
      (left, right) => right.score.total - left.score.total,
    )[0];
    return {
      winner: best ?? currentDeck,
      keptCurrentDeck: !best,
      discardedForTooManySwaps: 0,
    };
  }

  const withinSwapBudget = candidates.filter(
    (candidate) =>
      diffDecks(currentDeck.deck, candidate.deck).length <= MAX_IMPROVE_SWAPS,
  );

  const challenger = [...withinSwapBudget].sort(
    (left, right) => right.score.total - left.score.total,
  )[0];

  const beatsIncumbent =
    challenger !== undefined &&
    challenger.score.total >= currentDeck.score.total + IMPROVEMENT_MARGIN;

  return {
    winner: beatsIncumbent ? challenger : currentDeck,
    keptCurrentDeck: !beatsIncumbent,
    discardedForTooManySwaps: candidates.length - withinSwapBudget.length,
  };
}

/**
 * Derives the swaps between two decks.
 *
 * The model is never asked to report its own changes, because a list it writes
 * by hand can disagree with the deck it actually returned.
 */
export function diffDecks(
  originalDeck: string[],
  improvedDeck: string[],
): CardSwapPair[] {
  const removed = originalDeck.filter((name) => !improvedDeck.includes(name));
  const added = improvedDeck.filter((name) => !originalDeck.includes(name));

  return removed.map((out, index) => ({ out, in: added[index] ?? "" }))
    .filter((swap) => swap.in !== "");
}
