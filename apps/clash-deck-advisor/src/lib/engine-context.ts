import { buildCardProfiles, type CardProfile } from "./card-knowledge";
import {
  META_ARCHETYPES,
  META_BALANCE_NOTES,
  META_LAST_REVIEWED,
} from "./meta-archetypes.data";
import { scoreDeck, type DeckScore } from "./deck-score";
import type { AnalysisContext } from "./types";

export type AnalysisMode = "improve" | "best";

export interface EngineContext {
  mode: AnalysisMode;
  currentDeck: CardProfile[];
  currentScore: DeckScore;
  /** Everything the player owns, used to validate candidates. */
  ownedCards: CardProfile[];
  /** The subset worth offering to a model, used to build prompts. */
  viableCards: CardProfile[];
  context: AnalysisContext;
}

/** How far below the current deck's level a card can be and still be worth offering. */
const LEVEL_TOLERANCE = 2;

function medianLevel(deck: CardProfile[]): number {
  if (deck.length === 0) return 0;
  const levels = deck.map((card) => card.level).sort((a, b) => a - b);
  return levels[Math.floor(levels.length / 2)];
}

/**
 * Narrows the collection to cards worth suggesting.
 *
 * Recommending a level 7 card to a player running a level 13 deck is bad
 * advice however good the card is, and listing every card the player has ever
 * touched wastes prompt budget that the meta evidence uses better.
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
): EngineContext {
  const currentDeck = buildCardProfiles(context.player.currentDeck);
  const ownedCards = buildCardProfiles(context.player.cards);

  return {
    mode,
    currentDeck,
    currentScore: scoreDeck(currentDeck),
    ownedCards,
    viableCards: selectViableCards(ownedCards, currentDeck),
    context,
  };
}

/** One compact line per card keeps 119 owned cards affordable in the prompt. */
function describeCard(card: CardProfile): string {
  const tags: string[] = [...card.roles];
  if (card.isEvolutionUnlocked) tags.push("EVOLUTION-UNLOCKED");
  if (card.isChampion) tags.push("CHAMPION");
  if (card.isAirUnit) tags.push("air-unit");
  return `${card.name} | ${card.elixirCost} elixir | level ${card.level} | hits ${card.targets} | ${tags.join(", ")}`;
}

export function describeOwnedCards(cards: CardProfile[]): string {
  return [...cards]
    .sort(
      (left, right) =>
        left.elixirCost - right.elixirCost ||
        left.name.localeCompare(right.name),
    )
    .map(describeCard)
    .join("\n");
}

export function describeCurrentDeck(deck: CardProfile[]): string {
  return deck.map(describeCard).join("\n");
}

function describeScore(score: DeckScore): string {
  const lines = [
    `Overall score: ${score.total}/100`,
    `Average elixir: ${score.averageElixir}`,
  ];
  if (score.weaknesses.length > 0) {
    lines.push("Measured weaknesses:");
    lines.push(...score.weaknesses.map((item) => `  - ${item}`));
  } else {
    lines.push("No structural weaknesses measured.");
  }
  return lines.join("\n");
}

function describeMeta(engine: EngineContext): string {
  const { context } = engine;
  const sections: string[] = [];

  if (context.metaDecks.length > 0) {
    sections.push(
      "Decks that top Path of Legend players actually won with recently:",
      ...context.metaDecks.map(
        (deck) => `  - ${deck.playerName} (${deck.rating}): ${deck.deck.join(", ")}`,
      ),
    );
  } else {
    sections.push("No live top-ladder decks were available for this request.");
  }

  sections.push(
    "",
    `Curated meta reference (${META_LAST_REVIEWED}):`,
    ...META_ARCHETYPES.map(
      (archetype) =>
        `  - [${archetype.tier}] ${archetype.name}: ${archetype.coreCards.join(", ")}. ${archetype.summary}`,
    ),
    "",
    "Recent balance changes that affect card value:",
    ...META_BALANCE_NOTES.map((note) => `  - ${note}`),
  );

  return sections.join("\n");
}

function describeLosses(engine: EngineContext): string {
  const { recentLosses } = engine.context;
  if (recentLosses.length === 0) {
    return "No recent losses were recorded.";
  }
  return [
    "Recent losses, with the deck that beat this player:",
    ...recentLosses.map(
      (loss) =>
        `  - lost ${loss.playerCrowns}-${loss.opponentCrowns} to ${loss.opponentName}: ${loss.opponentDeck.join(", ")}`,
    ),
  ].join("\n");
}

/**
 * The deck-building rules the model must respect.
 *
 * Stated as hard constraints because a candidate that breaks them is discarded
 * before it ever reaches the player.
 */
export const DECK_RULES_BRIEF = [
  "Deck construction rules:",
  "  - Exactly 8 unique cards, all owned by this player.",
  "  - A deck has three special slots: one Evolution slot, one Hero slot, and one Wild slot.",
  "  - The Evolution slot takes an Evolution. The Hero slot takes a Hero or Champion. The Wild slot takes either.",
  "  - So: at most 2 Evolutions, at most 2 Champions, and at most 3 special cards in total.",
  "  - Only cards marked EVOLUTION-UNLOCKED count as Evolutions for this player.",
  "  - Using the special slots is valuable, but a legal deck that wins beats an illegal one that looks stronger.",
  "",
  "What makes a deck good:",
  "  - A win condition that can reliably threaten a tower.",
  "  - Two dependable air answers, not counting spells or 1-elixir spirits.",
  "  - One small spell and one big spell.",
  "  - A tank answer: high single-target damage or a defensive building.",
  "  - Splash damage to clear swarms.",
  "  - Average elixir between 2.8 and 4.2, with at least three cards costing 3 or less.",
  "  - Cards at a competitive level; a strong card at a low level loses to a weaker card at a high level.",
].join("\n");

function playerLine(engine: EngineContext): string {
  const { player } = engine.context;
  return `Player: ${player.name} (${player.tag}), ${player.trophies} trophies, arena ${player.arena.name}.`;
}

/** The full brief a model needs in order to build a deck from scratch. */
export function buildGenerationBrief(engine: EngineContext): string {
  return [
    playerLine(engine),
    "",
    "Current deck:",
    describeCurrentDeck(engine.currentDeck),
    "",
    "Deterministic evaluation of the current deck:",
    describeScore(engine.currentScore),
    "",
    describeLosses(engine),
    "",
    describeMeta(engine),
    "",
    DECK_RULES_BRIEF,
    "",
    "Cards this player owns at a competitive level, on the unified 1-16 scale.",
    "You may only choose from this list:",
    describeOwnedCards(engine.viableCards),
  ].join("\n");
}

/**
 * A much smaller brief for explaining a deck that is already chosen.
 *
 * Leaving out the collection keeps this call well inside provider rate limits
 * and makes it noticeably faster, and the reviewer cannot pick cards anyway.
 */
export function buildExplanationBrief(
  engine: EngineContext,
  chosenDeck: CardProfile[],
  chosenScore: DeckScore,
  archetype: string,
  swaps: { out: string; in: string }[],
): string {
  return [
    playerLine(engine),
    "",
    "Current deck:",
    describeCurrentDeck(engine.currentDeck),
    `Current deck score: ${engine.currentScore.total}/100`,
    "",
    "Deck that was selected, which you must explain rather than change:",
    describeCurrentDeck(chosenDeck),
    `Archetype: ${archetype}`,
    "",
    "Deterministic evaluation of the selected deck:",
    describeScore(chosenScore),
    "",
    swaps.length > 0
      ? `Changes from the current deck: ${swaps.map((swap) => `${swap.out} out, ${swap.in} in`).join("; ")}`
      : "The selected deck is the current deck, unchanged.",
    "",
    describeLosses(engine),
    "",
    describeMeta(engine),
  ].join("\n");
}
