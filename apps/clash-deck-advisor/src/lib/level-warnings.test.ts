import { describe, expect, it } from "vitest";

import { getLevelWarnings, normalizeCardLevel } from "./level-warnings";
import type { ClashCard } from "./types";

function card(
  name: string,
  level: number,
  maxLevel: number,
  rarity = "common",
): ClashCard {
  return {
    id: name.length,
    name,
    level,
    maxLevel,
    rarity,
    elixirCost: 3,
    iconUrls: {
      medium: `https://api-assets.clashroyale.com/cards/300/${name}.png`,
    },
  };
}

const levelSixteenCards = [
  card("Knight", 16, 16),
  card("Musketeer", 14, 14, "rare"),
  card("Guards", 11, 11, "epic"),
  card("Miner", 8, 8, "legendary"),
  card("Little Prince", 6, 6, "champion"),
  card("Skeletons", 16, 16),
  card("Tesla", 14, 14, "rare"),
  card("Ice Spirit", 16, 16),
];

describe("normalizeCardLevel", () => {
  it.each([
    ["common", 16, 16],
    ["rare", 14, 14],
    ["epic", 11, 11],
    ["legendary", 8, 8],
    ["champion", 6, 6],
  ])(
    "normalizes a max-level %s card to level 16",
    (rarity, level, maxLevel) => {
      expect(normalizeCardLevel(card("Card", level, maxLevel, rarity))).toBe(
        16,
      );
    },
  );
});

describe("getLevelWarnings", () => {
  it("does not warn for equally leveled cards across rarities", () => {
    expect(getLevelWarnings(levelSixteenCards)).toEqual([]);
  });

  it("marks a card two levels below the deck benchmark as high impact", () => {
    const deck = [...levelSixteenCards.slice(0, 7), card("Cannon", 14, 16)];

    expect(getLevelWarnings(deck)).toEqual([
      {
        cardName: "Cannon",
        severity: "high",
        message:
          "Level 14 is 2 levels below this deck's level 16 benchmark. Upgrade it before relying on ladder interactions.",
      },
    ]);
  });

  it("adds a known spell-breakpoint warning for under-leveled Arrows", () => {
    const deck = [...levelSixteenCards.slice(0, 7), card("Arrows", 15, 16)];

    expect(getLevelWarnings(deck)).toEqual([
      {
        cardName: "Arrows",
        severity: "medium",
        message:
          "Level 15 is 1 level below this deck's level 16 benchmark. Under-leveled Arrows can miss Firecracker and Archers damage breakpoints.",
      },
    ]);
  });
});
