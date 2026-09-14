import { describe, expect, it } from "vitest";

import { buildDeckLink } from "./deck-link";
import type { ClashCard } from "./types";

function card(
  id: number,
  name: string,
  level: number,
  maxLevel: number,
  evolutionLevel?: number,
): ClashCard {
  return {
    id,
    name,
    level,
    maxLevel,
    evolutionLevel,
    rarity: "common",
    elixirCost: 3,
    iconUrls: { medium: `https://example.com/${id}.png` },
  };
}

describe("buildDeckLink", () => {
  it("activates only the two highest-level evolutions", () => {
    const cards = [
      card(1, "P.E.K.K.A", 8, 11, 1),
      card(2, "Archers", 10, 16, 1),
      card(3, "Skeleton Army", 6, 11, 1),
      card(4, "Golden Knight", 3, 6),
      card(5, "Fireball", 9, 14),
      card(6, "Wizard", 9, 14),
      card(7, "Wall Breakers", 7, 11),
      card(8, "Skeleton Barrel", 12, 16),
    ];

    const url = new URL(buildDeckLink(cards));

    expect(url.pathname).toBe("/deck/en");
    expect(url.searchParams.get("deck")).toBe("1;2;3;4;5;6;7;8");
    expect(url.searchParams.get("slots")).toBe("1;0;1;0;0;0;0;0");
  });

  it("returns an empty link unless the deck has eight cards", () => {
    expect(buildDeckLink([])).toBe("");
  });
});
