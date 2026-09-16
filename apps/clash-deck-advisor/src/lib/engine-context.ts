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
  ownedCards: CardProfile[];
  context: AnalysisContext;
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

export function buildSharedBrief(engine: EngineContext): string {
  const { context, currentDeck, currentScore } = engine;

  return [
    `Player: ${context.player.name} (${context.player.tag}), ${context.player.trophies} trophies, arena ${context.player.arena.name}.`,
    "",
    "Current deck:",
    describeCurrentDeck(currentDeck),
    "",
    "Deterministic evaluation of the current deck:",
    describeScore(currentScore),
    "",
    describeLosses(engine),
    "",
    describeMeta(engine),
    "",
    DECK_RULES_BRIEF,
    "",
    "Cards this player owns, with level on the unified 1-16 scale:",
    describeOwnedCards(engine.ownedCards),
  ].join("\n");
}
