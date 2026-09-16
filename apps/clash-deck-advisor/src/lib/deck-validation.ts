import { buildCardProfile } from "./card-knowledge";
import { cardNameKey } from "./card-names";
import { checkDeckLegality } from "./deck-rules";
import { deckAnalysisSchema, type DeckAnalysis } from "./schemas";
import type { ClashCard, Player } from "./types";

function assertUniqueDeck(deck: string[], label: "Original" | "Improved") {
  if (deck.length !== 8 || new Set(deck).size !== 8) {
    throw new Error(`${label} deck must contain exactly 8 unique cards`);
  }
}

function sameMembers(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((cardName) => right.includes(cardName))
  );
}

function cardLookup(player: Player): Map<string, ClashCard> {
  return new Map(
    [...player.cards, ...player.currentDeck].map((card) => [card.name, card]),
  );
}

function canonicalizeCardNames(
  analysis: DeckAnalysis,
  ownedCards: Map<string, ClashCard>,
): DeckAnalysis {
  const canonicalNames = new Map(
    [...ownedCards.keys()].map((name) => [cardNameKey(name), name]),
  );
  const canonicalize = (name: string) =>
    canonicalNames.get(cardNameKey(name)) ?? name;

  return {
    ...analysis,
    originalDeck: analysis.originalDeck.map(canonicalize),
    improvedDeck: analysis.improvedDeck.map(canonicalize),
    changes: analysis.changes.map((change) => ({
      ...change,
      out: canonicalize(change.out),
      in: canonicalize(change.in),
    })),
  };
}

export function validateAnalysis(input: unknown, player: Player): DeckAnalysis {
  const parsedAnalysis = deckAnalysisSchema.parse(input);
  const ownedCards = cardLookup(player);
  const analysis = canonicalizeCardNames(parsedAnalysis, ownedCards);

  assertUniqueDeck(analysis.originalDeck, "Original");
  assertUniqueDeck(analysis.improvedDeck, "Improved");

  for (const cardName of [...analysis.originalDeck, ...analysis.improvedDeck]) {
    if (!ownedCards.has(cardName)) {
      throw new Error(`Player does not own card: ${cardName}`);
    }
  }

  const currentDeckNames = player.currentDeck.map((card) => card.name);
  if (!sameMembers(analysis.originalDeck, currentDeckNames)) {
    throw new Error("Original deck does not match the player's current deck");
  }

  const removed = analysis.originalDeck.filter(
    (cardName) => !analysis.improvedDeck.includes(cardName),
  );
  const added = analysis.improvedDeck.filter(
    (cardName) => !analysis.originalDeck.includes(cardName),
  );
  const listedRemoved = analysis.changes.map((change) => change.out);
  const listedAdded = analysis.changes.map((change) => change.in);

  if (
    removed.length !== added.length ||
    analysis.changes.length !== removed.length ||
    !sameMembers(removed, listedRemoved) ||
    !sameMembers(added, listedAdded)
  ) {
    throw new Error(
      "Listed changes do not match the original and improved deck difference",
    );
  }

  const deckChanged = removed.length > 0;
  if (
    (analysis.verdict === "keep" && deckChanged) ||
    (analysis.verdict === "improve" && !deckChanged)
  ) {
    throw new Error("Verdict does not match the proposed deck changes");
  }

  const improvedProfiles = analysis.improvedDeck.map((cardName) =>
    buildCardProfile(ownedCards.get(cardName)!),
  );
  const legality = checkDeckLegality(improvedProfiles);

  if (!legality.legal) {
    throw new Error(`Improved deck is not legal: ${legality.violations.join("; ")}`);
  }

  return analysis;
}
