import { describe, expect, it } from "vitest";

import { buildCardProfile } from "./card-knowledge";
import {
  diffDecks,
  rankCandidates,
  selectWinner,
  type RankedCandidate,
} from "./deck-candidates";
import type { ClashCard } from "./types";

function card(
  name: string,
  options: { elixir?: number; champion?: boolean; evolution?: boolean } = {},
): ClashCard {
  return {
    id: name.length,
    name,
    level: options.champion ? 6 : 14,
    maxLevel: options.champion ? 6 : 16,
    rarity: options.champion ? "champion" : "common",
    elixirCost: options.elixir ?? 3,
    evolutionLevel: options.evolution ? 1 : undefined,
    maxEvolutionLevel: options.evolution ? 1 : undefined,
    iconUrls: { medium: "https://example.com/c.png" },
  };
}

const ownedCards = [
  card("Hog Rider", { elixir: 4 }),
  card("Musketeer", { elixir: 4 }),
  card("Ice Golem", { elixir: 2 }),
  card("Cannon", { elixir: 3 }),
  card("Skeletons", { elixir: 1, evolution: true }),
  card("Ice Spirit", { elixir: 1 }),
  card("The Log", { elixir: 2 }),
  card("Fireball", { elixir: 4 }),
  card("Valkyrie", { elixir: 4 }),
  card("Golden Knight", { elixir: 4, champion: true }),
  card("Mighty Miner", { elixir: 4, champion: true }),
  card("Skeleton Army", { elixir: 3, evolution: true }),
  card("Archers", { elixir: 3, evolution: true }),
];

const ownedProfiles = ownedCards.map(buildCardProfile);

const strongDeck = [
  "Hog Rider",
  "Musketeer",
  "Ice Golem",
  "Cannon",
  "Skeletons",
  "Ice Spirit",
  "The Log",
  "Fireball",
];

describe("rankCandidates", () => {
  it("drops a candidate containing a card the player does not own", () => {
    const ranked = rankCandidates(
      [
        {
          modelLabel: "a",
          deck: [...strongDeck.slice(0, 7), "Mega Knight"],
          archetype: "Hog Cycle",
          rationale: "test",
        },
      ],
      ownedProfiles,
    );

    expect(ranked.accepted).toHaveLength(0);
    expect(ranked.rejected[0].reason).toMatch(/does not own/i);
  });

  it("drops a candidate that breaks the special slot limits", () => {
    const ranked = rankCandidates(
      [
        {
          modelLabel: "a",
          deck: [
            "Skeletons",
            "Skeleton Army",
            "Archers",
            "Golden Knight",
            "Hog Rider",
            "Musketeer",
            "The Log",
            "Fireball",
          ],
          archetype: "Test",
          rationale: "three evolutions plus a champion",
        },
      ],
      ownedProfiles,
    );

    expect(ranked.accepted).toHaveLength(0);
    expect(ranked.rejected[0].reason).toMatch(/special/i);
  });

  it("drops a candidate that repeats a card", () => {
    const ranked = rankCandidates(
      [
        {
          modelLabel: "a",
          deck: [...strongDeck.slice(0, 7), "Hog Rider"],
          archetype: "Test",
          rationale: "duplicate",
        },
      ],
      ownedProfiles,
    );

    expect(ranked.accepted).toHaveLength(0);
  });

  it("orders accepted candidates by deterministic score", () => {
    const ranked = rankCandidates(
      [
        {
          modelLabel: "weak",
          deck: [
            "Hog Rider",
            "Valkyrie",
            "Ice Golem",
            "Cannon",
            "Skeletons",
            "Ice Spirit",
            "Golden Knight",
            "Mighty Miner",
          ],
          archetype: "No spells",
          rationale: "weak",
        },
        {
          modelLabel: "strong",
          deck: strongDeck,
          archetype: "Hog Cycle",
          rationale: "strong",
        },
      ],
      ownedProfiles,
    );

    expect(ranked.accepted).toHaveLength(2);
    expect(ranked.accepted[0].modelLabel).toBe("strong");
    expect(ranked.accepted[0].score.total).toBeGreaterThan(
      ranked.accepted[1].score.total,
    );
  });

  it("canonicalizes card names so Log matches The Log", () => {
    const ranked = rankCandidates(
      [
        {
          modelLabel: "a",
          deck: [...strongDeck.slice(0, 6), "Log", "Fireball"],
          archetype: "Hog Cycle",
          rationale: "uses the short name",
        },
      ],
      ownedProfiles,
    );

    expect(ranked.accepted).toHaveLength(1);
    expect(ranked.accepted[0].deck).toContain("The Log");
  });
});

describe("selectWinner", () => {
  function ranked(
    modelLabel: string,
    deck: string[],
    total: number,
  ): RankedCandidate {
    return {
      modelLabel,
      deck,
      archetype: "Test",
      rationale: "test",
      profiles: [],
      score: { total, components: {}, weaknesses: [], averageElixir: 3 } as never,
    };
  }

  const currentDeck = ranked("current", strongDeck, 80);

  it("keeps the current deck when a candidate only ties it", () => {
    const selection = selectWinner(
      [ranked("a", [...strongDeck.slice(0, 7), "Valkyrie"], 80)],
      currentDeck,
      "improve",
    );

    expect(selection.keptCurrentDeck).toBe(true);
    expect(selection.winner.deck).toEqual(strongDeck);
  });

  it("keeps the current deck when the gain is inside the margin", () => {
    const selection = selectWinner(
      [ranked("a", [...strongDeck.slice(0, 7), "Valkyrie"], 82)],
      currentDeck,
      "improve",
    );

    expect(selection.keptCurrentDeck).toBe(true);
  });

  it("swaps when a candidate clearly beats the current deck", () => {
    const selection = selectWinner(
      [ranked("a", [...strongDeck.slice(0, 7), "Valkyrie"], 88)],
      currentDeck,
      "improve",
    );

    expect(selection.keptCurrentDeck).toBe(false);
    expect(selection.winner.modelLabel).toBe("a");
  });

  it("rejects a candidate that rebuilds the deck instead of improving it", () => {
    const rebuilt = [
      "Valkyrie",
      "Golden Knight",
      "Mighty Miner",
      "Skeleton Army",
      "Archers",
      "Hog Rider",
      "Musketeer",
      "Ice Golem",
    ];
    const selection = selectWinner(
      [ranked("a", rebuilt, 99)],
      currentDeck,
      "improve",
    );

    expect(selection.keptCurrentDeck).toBe(true);
    expect(selection.discardedForTooManySwaps).toBe(1);
  });

  it("never returns a deck worse than the current one in best-deck mode", () => {
    const selection = selectWinner(
      [ranked("a", [...strongDeck.slice(0, 7), "Valkyrie"], 70)],
      currentDeck,
      "best",
    );

    expect(selection.keptCurrentDeck).toBe(true);
    expect(selection.winner.deck).toEqual(strongDeck);
  });

  it("takes the highest scorer in best-deck mode regardless of swap count", () => {
    const rebuilt = [
      "Valkyrie",
      "Golden Knight",
      "Mighty Miner",
      "Skeleton Army",
      "Archers",
      "Hog Rider",
      "Musketeer",
      "Ice Golem",
    ];
    const selection = selectWinner(
      [ranked("a", rebuilt, 90)],
      currentDeck,
      "best",
    );

    expect(selection.winner.modelLabel).toBe("a");
  });

  it("falls back to the current deck when nothing legal was produced", () => {
    expect(selectWinner([], currentDeck, "improve").winner).toBe(currentDeck);
    expect(selectWinner([], currentDeck, "best").winner).toBe(currentDeck);
  });
});

describe("diffDecks", () => {
  it("derives swaps from the two decks rather than trusting the model", () => {
    const swaps = diffDecks(strongDeck, [
      ...strongDeck.slice(0, 7),
      "Valkyrie",
    ]);

    expect(swaps).toEqual([{ out: "Fireball", in: "Valkyrie" }]);
  });

  it("returns no swaps for an unchanged deck", () => {
    expect(diffDecks(strongDeck, [...strongDeck].reverse())).toEqual([]);
  });

  it("pairs multiple swaps in a stable order", () => {
    const swaps = diffDecks(strongDeck, [
      ...strongDeck.slice(0, 6),
      "Valkyrie",
      "Golden Knight",
    ]);

    expect(swaps).toHaveLength(2);
    expect(swaps.map((swap) => swap.out)).toEqual(["The Log", "Fireball"]);
  });
});
