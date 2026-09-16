import { describe, expect, it } from "vitest";

import { buildCardProfile } from "./card-knowledge";
import { scoreDeck } from "./deck-score";
import type { ClashCard } from "./types";

function card(name: string, elixir: number, level = 14): ClashCard {
  return {
    id: name.length * 3,
    name,
    level,
    maxLevel: 16,
    rarity: "common",
    elixirCost: elixir,
    iconUrls: { medium: "https://example.com/c.png" },
  };
}

function deckOf(entries: [string, number][]) {
  return entries.map(([name, elixir]) => buildCardProfile(card(name, elixir)));
}

/** Well-rounded Hog Cycle style shell. */
const balancedDeck = deckOf([
  ["Hog Rider", 4],
  ["Musketeer", 4],
  ["Ice Golem", 2],
  ["Cannon", 3],
  ["Skeletons", 1],
  ["Ice Spirit", 1],
  ["The Log", 2],
  ["Fireball", 4],
]);

describe("scoreDeck", () => {
  it("is deterministic for identical input", () => {
    expect(scoreDeck(balancedDeck).total).toBe(scoreDeck(balancedDeck).total);
  });

  it("produces a score between 0 and 100", () => {
    const result = scoreDeck(balancedDeck);
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it("rates a deck with weaker air defense below an otherwise identical deck", () => {
    // Swaps only the air-defense card: Musketeer for ground-only Knight,
    // so no other scoring dimension changes.
    const noAirDefense = deckOf([
      ["Hog Rider", 4],
      ["Knight", 4],
      ["Ice Golem", 2],
      ["Cannon", 3],
      ["Skeletons", 1],
      ["Ice Spirit", 1],
      ["The Log", 2],
      ["Fireball", 4],
    ]);

    expect(scoreDeck(noAirDefense).components.airDefense).toBeLessThan(
      scoreDeck(balancedDeck).components.airDefense,
    );
    expect(scoreDeck(noAirDefense).total).toBeLessThan(
      scoreDeck(balancedDeck).total,
    );
  });

  it("heavily penalizes a deck with no win condition", () => {
    const noWinCondition = deckOf([
      ["Musketeer", 4],
      ["Valkyrie", 4],
      ["Ice Golem", 2],
      ["Cannon", 3],
      ["Skeletons", 1],
      ["Ice Spirit", 1],
      ["The Log", 2],
      ["Fireball", 4],
    ]);

    const result = scoreDeck(noWinCondition);
    expect(result.components.winCondition).toBe(0);
    expect(result.total).toBeLessThan(scoreDeck(balancedDeck).total);
    expect(result.weaknesses.join(" ")).toMatch(/win condition/i);
  });

  it("penalizes an elixir curve outside the playable band", () => {
    const tooExpensive = deckOf([
      ["Golem", 8],
      ["Electro Giant", 7],
      ["P.E.K.K.A", 7],
      ["Mega Knight", 7],
      ["Lightning", 6],
      ["Rocket", 6],
      ["Sparky", 6],
      ["Wizard", 5],
    ]);

    expect(scoreDeck(tooExpensive).components.elixirCurve).toBeLessThan(
      scoreDeck(balancedDeck).components.elixirCurve,
    );
  });

  it("rewards spell coverage with both a small and a big spell", () => {
    const noSpells = deckOf([
      ["Hog Rider", 4],
      ["Musketeer", 4],
      ["Ice Golem", 2],
      ["Cannon", 3],
      ["Skeletons", 1],
      ["Ice Spirit", 1],
      ["Knight", 3],
      ["Archers", 3],
    ]);

    expect(scoreDeck(noSpells).components.spellCoverage).toBeLessThan(
      scoreDeck(balancedDeck).components.spellCoverage,
    );
  });

  it("rewards higher card levels", () => {
    const underLevelled = balancedDeck.map((card) => ({ ...card, level: 9 }));

    expect(scoreDeck(underLevelled).components.cardLevels).toBeLessThan(
      scoreDeck(balancedDeck).components.cardLevels,
    );
  });

  it("lists concrete weaknesses for a deficient deck", () => {
    const weak = deckOf([
      ["Valkyrie", 4],
      ["Knight", 3],
      ["Bomber", 2],
      ["Guards", 3],
      ["Barbarians", 5],
      ["Prince", 5],
      ["Mega Knight", 7],
      ["Golem", 8],
    ]);

    const weaknesses = scoreDeck(weak).weaknesses.join(" ").toLowerCase();
    expect(weaknesses).toMatch(/air/);
    expect(weaknesses).toMatch(/spell/);
  });
});
