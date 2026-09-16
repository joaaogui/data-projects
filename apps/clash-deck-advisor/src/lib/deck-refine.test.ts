import { describe, expect, it } from "vitest";

import { buildCardProfile } from "./card-knowledge";
import { checkDeckLegality } from "./deck-rules";
import { scoreDeck } from "./deck-score";
import { refineDeck } from "./deck-refine";
import type { ClashCard } from "./types";

function card(
  name: string,
  elixir: number,
  options: { champion?: boolean; evolution?: boolean; level?: number } = {},
): ClashCard {
  return {
    id: name.length * 11,
    name,
    level: options.level ?? (options.champion ? 6 : 14),
    maxLevel: options.champion ? 6 : 16,
    rarity: options.champion ? "champion" : "common",
    elixirCost: elixir,
    evolutionLevel: options.evolution ? 1 : undefined,
    maxEvolutionLevel: options.evolution ? 1 : undefined,
    iconUrls: { medium: "https://example.com/c.png" },
  };
}

const pool = [
  card("P.E.K.K.A", 7),
  card("Golden Knight", 4, { champion: true }),
  card("Mega Minion", 3),
  card("Ice Wizard", 3),
  card("Bomb Tower", 4),
  card("Goblin Gang", 3),
  card("Skeleton Army", 3, { evolution: true }),
  card("Fireball", 4),
  card("The Log", 2),
  card("Ice Spirit", 1),
  card("Skeletons", 1, { evolution: true }),
  card("Musketeer", 4),
  card("Knight", 3),
  card("Zap", 2),
].map(buildCardProfile);

function deckOf(names: string[]) {
  return names.map((name) => pool.find((card) => card.name === name)!);
}

/** Missing a small spell, so The Log or Zap is an obvious upgrade. */
const deckMissingSmallSpell = deckOf([
  "P.E.K.K.A",
  "Golden Knight",
  "Mega Minion",
  "Ice Wizard",
  "Bomb Tower",
  "Goblin Gang",
  "Skeleton Army",
  "Fireball",
]);

describe("refineDeck", () => {
  it("finds an improvement the model missed", () => {
    const before = scoreDeck(deckMissingSmallSpell);
    const result = refineDeck(deckMissingSmallSpell, pool);

    expect(result.score.total).toBeGreaterThan(before.total);
    expect(result.swapsApplied).toBeGreaterThan(0);
    expect(result.score.components.spellCoverage).toBe(1);
  });

  it("only returns legal decks", () => {
    const result = refineDeck(deckMissingSmallSpell, pool);
    expect(checkDeckLegality(result.deck).violations).toEqual([]);
  });

  it("only uses cards from the supplied pool", () => {
    const poolNames = new Set(pool.map((card) => card.name));
    for (const card of refineDeck(deckMissingSmallSpell, pool).deck) {
      expect(poolNames).toContain(card.name);
    }
  });

  it("never lowers the score", () => {
    const before = scoreDeck(deckMissingSmallSpell);
    expect(
      refineDeck(deckMissingSmallSpell, pool).score.total,
    ).toBeGreaterThanOrEqual(before.total);
  });

  it("respects a swap budget", () => {
    const result = refineDeck(deckMissingSmallSpell, pool, { maxSwaps: 1 });
    expect(result.swapsApplied).toBeLessThanOrEqual(1);
  });

  it("makes no change to a deck that cannot be improved", () => {
    const refined = refineDeck(deckMissingSmallSpell, pool);
    const again = refineDeck(refined.deck, pool);

    expect(again.swapsApplied).toBe(0);
    expect(again.deck.map((card) => card.name)).toEqual(
      refined.deck.map((card) => card.name),
    );
  });

  it("will not trade a tank for a utility spell to chase card levels", () => {
    // Regression: hill climbing once swapped P.E.K.K.A for Rage because the
    // replacement was higher levelled, gutting the deck for a few points.
    const poolWithLevels = [
      card("P.E.K.K.A", 7, { level: 9 }),
      card("Golden Knight", 4, { champion: true }),
      card("Mega Minion", 3, { level: 10 }),
      card("Ice Wizard", 3),
      card("Bomb Tower", 4),
      card("Goblin Gang", 3),
      card("Skeleton Army", 3, { evolution: true }),
      card("Fireball", 4),
      card("Rage", 2, { level: 16 }),
      card("Archers", 3, { level: 16, evolution: true }),
    ].map(buildCardProfile);

    const deck = poolWithLevels.slice(0, 8);
    const result = refineDeck(deck, poolWithLevels);

    expect(result.deck.map((entry) => entry.name)).toContain("P.E.K.K.A");
    expect(result.deck.map((entry) => entry.name)).not.toContain("Rage");
  });

  it("will not remove the deck's last heavy threat", () => {
    // Regression: the search traded P.E.K.K.A for Arrows, gaining spell
    // coverage but leaving the deck with no way to pressure a tower.
    const result = refineDeck(deckMissingSmallSpell, pool);
    const names = result.deck.map((entry) => entry.name);

    expect(names).toContain("P.E.K.K.A");
  });

  it("is deterministic", () => {
    const first = refineDeck(deckMissingSmallSpell, pool);
    const second = refineDeck(deckMissingSmallSpell, pool);
    expect(first.deck.map((card) => card.name)).toEqual(
      second.deck.map((card) => card.name),
    );
  });

  it("keeps the deck at eight unique cards", () => {
    const result = refineDeck(deckMissingSmallSpell, pool);
    expect(result.deck).toHaveLength(8);
    expect(new Set(result.deck.map((card) => card.name)).size).toBe(8);
  });
});
