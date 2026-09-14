import { normalizeCardLevel } from "./level-warnings";
import type { ClashCard } from "./types";

export function buildDeckLink(cards: ClashCard[]): string {
  if (cards.length !== 8) {
    return "";
  }

  const activeEvolutionIds = new Set(
    cards
      .filter((card) => (card.evolutionLevel ?? 0) > 0)
      .sort(
        (left, right) =>
          normalizeCardLevel(right) - normalizeCardLevel(left),
      )
      .slice(0, 2)
      .map((card) => card.id),
  );

  const deck = cards.map((card) => card.id).join(";");
  const slots = cards
    .map((card) => (activeEvolutionIds.has(card.id) ? "1" : "0"))
    .join(";");

  return `https://link.clashroyale.com/deck/en?deck=${deck}&slots=${slots}`;
}
