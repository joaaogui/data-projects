import type { ClashCard, LevelWarning } from "./types";

const spellBreakpointNotes: Record<string, string> = {
  Arrows:
    "Under-leveled Arrows can miss Firecracker and Archers damage breakpoints.",
  Fireball:
    "Under-leveled Fireball weakens common spell-combination finishes against support troops.",
  "Giant Snowball":
    "Under-leveled Giant Snowball can miss key swarm cleanup breakpoints.",
  Poison:
    "Under-leveled Poison can require an extra damage tick against support troops.",
  "The Log":
    "Under-leveled The Log can miss key Princess and Dart Goblin cleanup breakpoints.",
  Zap: "Under-leveled Zap can miss key swarm cleanup breakpoints.",
};

export function normalizeCardLevel(card: ClashCard): number {
  const rarityOffset = Math.max(0, 16 - card.maxLevel);
  return card.level + rarityOffset;
}

export function getLevelWarnings(cards: ClashCard[]): LevelWarning[] {
  if (cards.length === 0) {
    return [];
  }

  const sortedLevels = cards
    .map(normalizeCardLevel)
    .sort((left, right) => left - right);
  const benchmark = sortedLevels[Math.floor(sortedLevels.length / 2)]!;

  return cards.flatMap((card): LevelWarning[] => {
    const level = normalizeCardLevel(card);
    const difference = benchmark - level;

    if (difference <= 0) {
      return [];
    }

    const plural = difference === 1 ? "level" : "levels";
    const genericMessage = `Level ${level} is ${difference} ${plural} below this deck's level ${benchmark} benchmark.`;
    const breakpointNote = spellBreakpointNotes[card.name];

    return [
      {
        cardName: card.name,
        severity: difference >= 2 ? "high" : "medium",
        message: breakpointNote
          ? `${genericMessage} ${breakpointNote}`
          : `${genericMessage} Upgrade it before relying on ladder interactions.`,
      },
    ];
  });
}
