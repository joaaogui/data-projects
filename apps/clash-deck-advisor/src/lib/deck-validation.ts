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

function cardNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/^the\s+/, "")
    .replace(/[^a-z0-9]/g, "");
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

  const evolvedCardCount = analysis.improvedDeck.filter((cardName) => {
    const card = ownedCards.get(cardName);
    return (card?.evolutionLevel ?? 0) > 0;
  }).length;

  if (evolvedCardCount < 2) {
    throw new Error(
      "Improved deck must contain at least 2 evolution-capable cards",
    );
  }

  const championCount = analysis.improvedDeck.filter(
    (cardName) => ownedCards.get(cardName)?.rarity.toLowerCase() === "champion",
  ).length;

  if (championCount !== 1) {
    throw new Error("Improved deck must contain exactly 1 champion");
  }

  return analysis;
}
