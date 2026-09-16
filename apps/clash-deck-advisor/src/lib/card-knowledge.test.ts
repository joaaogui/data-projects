import { describe, expect, it } from "vitest";

import { buildCardProfile, hasRole } from "./card-knowledge";
import { CARD_ATTRIBUTES } from "./card-roles.data";
import type { ClashCard } from "./types";

function card(overrides: Partial<ClashCard> & { name: string }): ClashCard {
  return {
    id: 1,
    level: 11,
    maxLevel: 16,
    rarity: "common",
    elixirCost: 3,
    iconUrls: { medium: "https://example.com/card.png" },
    ...overrides,
  };
}

describe("buildCardProfile", () => {
  it("merges live card data with static gameplay attributes", () => {
    const profile = buildCardProfile(
      card({ name: "Musketeer", rarity: "rare", level: 8, maxLevel: 14 }),
    );

    expect(profile.name).toBe("Musketeer");
    expect(profile.roles).toContain("airDefense");
    expect(profile.targets).toBe("both");
  });

  it("normalizes level to the unified 16 scale across rarities", () => {
    expect(
      buildCardProfile(card({ name: "Knight", level: 16, maxLevel: 16 })).level,
    ).toBe(16);
    expect(
      buildCardProfile(
        card({ name: "Musketeer", level: 14, maxLevel: 14 }),
      ).level,
    ).toBe(16);
    expect(
      buildCardProfile(
        card({ name: "Golden Knight", level: 6, maxLevel: 6 }),
      ).level,
    ).toBe(16);
  });

  it("detects an unlocked evolution", () => {
    const unlocked = buildCardProfile(
      card({ name: "Skeleton Army", evolutionLevel: 1, maxEvolutionLevel: 1 }),
    );
    const capableButLocked = buildCardProfile(
      card({ name: "Knight", maxEvolutionLevel: 3 }),
    );

    expect(unlocked.isEvolutionUnlocked).toBe(true);
    expect(capableButLocked.isEvolutionUnlocked).toBe(false);
    expect(capableButLocked.canEvolve).toBe(true);
  });

  it("detects champions by rarity", () => {
    expect(
      buildCardProfile(card({ name: "Golden Knight", rarity: "champion" }))
        .isChampion,
    ).toBe(true);
    expect(buildCardProfile(card({ name: "Knight" })).isChampion).toBe(false);
  });

  it("falls back to a neutral profile for an unknown card", () => {
    const profile = buildCardProfile(card({ name: "Totally New Card" }));

    expect(profile.roles).toEqual(["support"]);
    expect(profile.targets).toBe("ground");
  });
});

describe("CARD_ATTRIBUTES coverage", () => {
  it("covers every deck card in the game", () => {
    // 123 playable cards as of the September 2026 patch. Tower troops are
    // excluded because they are never part of a deck.
    expect(Object.keys(CARD_ATTRIBUTES).length).toBeGreaterThanOrEqual(123);
  });

  it("gives every card at least one role and a valid target", () => {
    for (const [name, attributes] of Object.entries(CARD_ATTRIBUTES)) {
      expect(attributes.roles.length, `${name} has no roles`).toBeGreaterThan(
        0,
      );
      expect(["ground", "air", "both", "none"]).toContain(attributes.targets);
    }
  });

  it("marks a realistic number of cards as win conditions", () => {
    const winConditions = Object.values(CARD_ATTRIBUTES).filter((card) =>
      card.roles.includes("winCondition"),
    );
    expect(winConditions.length).toBeGreaterThan(15);
    expect(winConditions.length).toBeLessThan(35);
  });
});

describe("hasRole", () => {
  it("reports whether any card in a deck fills a role", () => {
    const deck = [
      buildCardProfile(card({ name: "Hog Rider" })),
      buildCardProfile(card({ name: "Musketeer" })),
    ];

    expect(hasRole(deck, "winCondition")).toBe(true);
    expect(hasRole(deck, "building")).toBe(false);
  });
});
