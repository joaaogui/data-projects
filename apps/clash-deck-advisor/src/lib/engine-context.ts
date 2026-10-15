import { buildCardProfiles, type CardProfile } from "./card-knowledge";
import type { AnalysisContext, PlayerFeedbackInput } from "./types";

export type AnalysisMode = "improve" | "best";

export interface EngineContext {
  mode: AnalysisMode;
  currentDeck: CardProfile[];
  /** Everything the player owns, used to validate candidates. */
  ownedCards: CardProfile[];
  context: AnalysisContext;
  feedback?: PlayerFeedbackInput;
}

/** How far below the current deck's level a card can be and still be worth offering. */
const LEVEL_TOLERANCE = 2;

function medianLevel(deck: CardProfile[]): number {
  if (deck.length === 0) return 0;
  const levels = deck.map((card) => card.level).sort((a, b) => a - b);
  return levels[Math.floor(levels.length / 2)]!;
}

/**
 * Narrows the collection to cards worth suggesting.
 *
 * Recommending a level 7 card to a player running a level 13 deck is bad
 * advice however good the card is.
 */
export function selectViableCards(
  ownedCards: CardProfile[],
  currentDeck: CardProfile[],
): CardProfile[] {
  const threshold = medianLevel(currentDeck) - LEVEL_TOLERANCE;
  const currentDeckNames = new Set(currentDeck.map((card) => card.name));

  return ownedCards.filter(
    (card) =>
      card.level >= threshold ||
      currentDeckNames.has(card.name) ||
      card.isChampion ||
      card.isEvolutionUnlocked,
  );
}

export function buildEngineContext(
  context: AnalysisContext,
  mode: AnalysisMode,
  feedback?: PlayerFeedbackInput,
): EngineContext {
  const currentDeck = buildCardProfiles(context.player.currentDeck);
  const ownedCards = buildCardProfiles(context.player.cards);

  return {
    mode,
    currentDeck,
    ownedCards,
    context,
    feedback,
  };
}
