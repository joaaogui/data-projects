import { describe, expect, it } from "vitest";

import { buildCardProfile } from "./card-knowledge";
import { assignSlots, checkDeckLegality } from "./deck-rules";
import type { ClashCard } from "./types";

function card(
  name: string,
  options: {
    evolution?: boolean;
    champion?: boolean;
    elixir?: number;
  } = {},
): ClashCard {
  return {
    id: name.length * 7,
    name,
    level: options.champion ? 6 : 16,
    maxLevel: options.champion ? 6 : 16,
    rarity: options.champion ? "champion" : "common",
    elixirCost: options.elixir ?? 3,
    evolutionLevel: options.evolution ? 1 : undefined,
    maxEvolutionLevel: options.evolution ? 1 : undefined,
    iconUrls: { medium: "https://example.com/c.png" },
  };
}

function profiles(cards: ClashCard[]) {
  return cards.map(buildCardProfile);
}

/** Eight distinct filler cards with no special status. */
function plain(count: number, offset = 0): ClashCard[] {
  const names = [
    "Knight",
    "Archers",
    "Fireball",
    "The Log",
    "Cannon",
    "Ice Spirit",
    "Musketeer",
    "Bomber",
    "Guards",
    "Minions",
  ];
  return names.slice(offset, offset + count).map((name) => card(name));
}

describe("assignSlots", () => {
  it("puts one evolution in the Evo slot and a champion in the Hero slot", () => {
    const deck = profiles([
      card("P.E.K.K.A", { evolution: true }),
      card("Golden Knight", { champion: true }),
      ...plain(6),
    ]);

    const slots = assignSlots(deck);

    expect(slots.evolutionSlot?.name).toBe("P.E.K.K.A");
    expect(slots.heroSlot?.name).toBe("Golden Knight");
    expect(slots.wildSlot).toBeNull();
  });

  it("uses the Wild slot for a second evolution", () => {
    const deck = profiles([
      card("P.E.K.K.A", { evolution: true }),
      card("Skeleton Army", { evolution: true }),
      card("Golden Knight", { champion: true }),
      ...plain(5),
    ]);

    const slots = assignSlots(deck);

    expect(slots.evolutionCount).toBe(2);
    expect(slots.heroChampionCount).toBe(1);
    expect(slots.wildSlot).not.toBeNull();
    expect(slots.totalSpecial).toBe(3);
  });
});

describe("checkDeckLegality", () => {
  it("accepts two evolutions plus one champion", () => {
    const deck = profiles([
      card("P.E.K.K.A", { evolution: true }),
      card("Skeleton Army", { evolution: true }),
      card("Golden Knight", { champion: true }),
      ...plain(5),
    ]);

    expect(checkDeckLegality(deck).legal).toBe(true);
  });

  it("accepts one evolution plus one champion", () => {
    const deck = profiles([
      card("P.E.K.K.A", { evolution: true }),
      card("Golden Knight", { champion: true }),
      ...plain(6),
    ]);

    expect(checkDeckLegality(deck).legal).toBe(true);
  });

  it("accepts one evolution plus two champions", () => {
    const deck = profiles([
      card("P.E.K.K.A", { evolution: true }),
      card("Golden Knight", { champion: true }),
      card("Mighty Miner", { champion: true }),
      ...plain(5),
    ]);

    expect(checkDeckLegality(deck).legal).toBe(true);
  });

  it("accepts a deck with no special cards at all", () => {
    expect(checkDeckLegality(profiles(plain(8))).legal).toBe(true);
  });

  it("rejects three evolutions", () => {
    const deck = profiles([
      card("P.E.K.K.A", { evolution: true }),
      card("Skeleton Army", { evolution: true }),
      card("Archers", { evolution: true }),
      ...plain(5, 2),
    ]);

    const result = checkDeckLegality(deck);

    expect(result.legal).toBe(false);
    expect(result.violations.join(" ")).toMatch(/at most 2 Evolutions/i);
  });

  it("rejects three champions", () => {
    const deck = profiles([
      card("Golden Knight", { champion: true }),
      card("Mighty Miner", { champion: true }),
      card("Skeleton King", { champion: true }),
      ...plain(5),
    ]);

    const result = checkDeckLegality(deck);

    expect(result.legal).toBe(false);
    expect(result.violations.join(" ")).toMatch(
      /at most 2 Hero or Champion/i,
    );
  });

  it("rejects more than three special cards in total", () => {
    const deck = profiles([
      card("P.E.K.K.A", { evolution: true }),
      card("Skeleton Army", { evolution: true }),
      card("Golden Knight", { champion: true }),
      card("Mighty Miner", { champion: true }),
      ...plain(4),
    ]);

    const result = checkDeckLegality(deck);

    expect(result.legal).toBe(false);
    expect(result.violations.join(" ")).toMatch(/at most 3 special/i);
  });

  it("rejects a deck that is not exactly eight unique cards", () => {
    expect(checkDeckLegality(profiles(plain(7))).legal).toBe(false);

    const duplicated = profiles([...plain(7), card("Knight")]);
    expect(checkDeckLegality(duplicated).legal).toBe(false);
  });
});
