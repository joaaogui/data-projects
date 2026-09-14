import { describe, expect, it } from "vitest";

import { validateAnalysis } from "./deck-validation";

const card = (
  name: string,
  options: { evolutionLevel?: number; rarity?: string } = {},
) => ({
  id: name.length,
  name,
  level: 14,
  maxLevel: 14,
  evolutionLevel: options.evolutionLevel,
  rarity: options.rarity ?? "common",
  elixirCost: 3,
  iconUrls: {
    medium: `https://api-assets.clashroyale.com/cards/300/${name}.png`,
  },
});

const ownedCards = [
  card("Knight", { evolutionLevel: 1 }),
  card("Archers", { evolutionLevel: 1 }),
  card("Skeletons", { evolutionLevel: 1 }),
  card("Little Prince", { rarity: "champion" }),
  card("Golden Knight", { rarity: "champion" }),
  card("Fireball", { rarity: "rare" }),
  card("The Log", { rarity: "legendary" }),
  card("Tesla", { rarity: "rare" }),
  card("Miner", { rarity: "legendary" }),
  card("Ice Spirit"),
  card("Poison", { rarity: "epic" }),
  card("Goblins"),
];

const originalDeck = [
  "Knight",
  "Archers",
  "Little Prince",
  "Fireball",
  "The Log",
  "Tesla",
  "Miner",
  "Ice Spirit",
];

const player = {
  tag: "#VGURQ0QQ2",
  name: "Workshop Chief",
  trophies: 9_000,
  bestTrophies: 9_000,
  wins: 500,
  losses: 400,
  battleCount: 900,
  arena: { id: 54_000_000, name: "Legendary Arena" },
  currentDeck: originalDeck.map(
    (name) => ownedCards.find((ownedCard) => ownedCard.name === name)!,
  ),
  cards: ownedCards,
};

const matchups = Array.from({ length: 5 }, (_, index) => ({
  archetype: `Archetype ${index + 1}`,
  rating: "even" as const,
  advice: "Protect the ranged support card.",
}));

function validAnalysis() {
  return {
    originalDeck,
    improvedDeck: originalDeck.map((name) =>
      name === "Miner" ? "Poison" : name,
    ),
    verdict: "improve" as const,
    verdictReason: "Poison gives the deck more reliable control.",
    problems: [
      {
        title: "Limited area denial",
        description: "The current list can struggle to deny support troops.",
        severity: "medium" as const,
      },
    ],
    changes: [
      {
        out: "Miner",
        in: "Poison",
        reason: "Adds dependable area control.",
      },
    ],
    metaTier: {
      archetype: "Control",
      tier: "A" as const,
      summary: "Competitive with careful elixir management.",
    },
    matchups,
    replayAdvice: [
      {
        title: "Track their win condition",
        detail: "Save Tesla for the opponent's primary tower threat.",
      },
    ],
    weaknessScores: {
      airDefense: 78,
      tankStopping: 82,
      swarmControl: 72,
      spellCoverage: 86,
      cycle: 70,
      synergy: 84,
    },
    strategy: "Defend efficiently, then convert surviving troops.",
    averageElixir: 3.4,
  };
}

describe("validateAnalysis", () => {
  it("accepts a valid analysis", () => {
    expect(() => validateAnalysis(validAnalysis(), player)).not.toThrow();
  });

  it("rejects a card the player does not own", () => {
    const analysis = validAnalysis();
    analysis.improvedDeck[6] = "Phoenix";
    analysis.changes[0] = {
      out: "Miner",
      in: "Phoenix",
      reason: "Adds air support.",
    };

    expect(() => validateAnalysis(analysis, player)).toThrow(
      "Player does not own card: Phoenix",
    );
  });

  it("rejects a deck without exactly eight unique cards", () => {
    const analysis = validAnalysis();
    analysis.improvedDeck[7] = "Knight";

    expect(() => validateAnalysis(analysis, player)).toThrow(
      "Improved deck must contain exactly 8 unique cards",
    );
  });

  it("rejects swaps that do not match the deck difference", () => {
    const analysis = validAnalysis();
    analysis.changes[0] = {
      out: "Tesla",
      in: "Poison",
      reason: "Claims the wrong outgoing card.",
    };

    expect(() => validateAnalysis(analysis, player)).toThrow(
      "Listed changes do not match the original and improved deck difference",
    );
  });

  it("rejects fewer than two evolved cards", () => {
    const analysis = validAnalysis();
    analysis.improvedDeck[1] = "Goblins";
    analysis.changes.push({
      out: "Archers",
      in: "Goblins",
      reason: "Removes an evolution.",
    });

    expect(() => validateAnalysis(analysis, player)).toThrow(
      "Improved deck must contain at least 2 evolution-capable cards",
    );
  });

  it("accepts more than two evolution-capable cards", () => {
    const analysis = validAnalysis();
    analysis.improvedDeck[7] = "Skeletons";
    analysis.changes.push({
      out: "Ice Spirit",
      in: "Skeletons",
      reason: "Adds another evolution-capable cycle card.",
    });

    expect(() => validateAnalysis(analysis, player)).not.toThrow();
  });

  it("rejects fewer than one champion", () => {
    const analysis = validAnalysis();
    analysis.improvedDeck[2] = "Goblins";
    analysis.changes.push({
      out: "Little Prince",
      in: "Goblins",
      reason: "Removes the champion.",
    });

    expect(() => validateAnalysis(analysis, player)).toThrow(
      "Improved deck must contain exactly 1 champion",
    );
  });

  it("rejects more than one champion", () => {
    const analysis = validAnalysis();
    analysis.improvedDeck[7] = "Golden Knight";
    analysis.changes.push({
      out: "Ice Spirit",
      in: "Golden Knight",
      reason: "Adds a second champion.",
    });

    expect(() => validateAnalysis(analysis, player)).toThrow(
      "Improved deck must contain exactly 1 champion",
    );
  });
});
