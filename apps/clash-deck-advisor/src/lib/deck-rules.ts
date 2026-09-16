import type { CardProfile } from "./card-knowledge";

/**
 * Deck legality under the March 2026 slot system.
 *
 * A deck has three special slots:
 *   - Evolution slot: Evolutions only
 *   - Hero slot:      Heroes or Champions
 *   - Wild slot:      an Evolution, Hero, or Champion
 *
 * So a legal deck holds at most 2 Evolutions, at most 2 Hero/Champion cards,
 * and at most 3 special cards in total.
 *
 * The API exposes Evolution unlock state but never Hero unlock state, so a
 * Hero cannot be verified from player data. Champions are therefore the only
 * Hero-slot occupants this engine will assert.
 */
export const MAX_EVOLUTIONS = 2;
export const MAX_HERO_CHAMPION = 2;
export const MAX_SPECIAL_SLOTS = 3;
export const DECK_SIZE = 8;

export interface SlotAssignment {
  evolutionSlot: CardProfile | null;
  heroSlot: CardProfile | null;
  wildSlot: CardProfile | null;
  evolutionCount: number;
  heroChampionCount: number;
  totalSpecial: number;
}

export interface LegalityResult {
  legal: boolean;
  violations: string[];
  slots: SlotAssignment;
}

function byLevelDescending(left: CardProfile, right: CardProfile): number {
  return right.level - left.level || left.name.localeCompare(right.name);
}

/**
 * Works out which cards occupy the three special slots. Evolutions claim the
 * Evolution slot first and a Hero/Champion claims the Hero slot, so whatever
 * is left over competes for the single Wild slot.
 */
export function assignSlots(deck: CardProfile[]): SlotAssignment {
  const evolutions = deck
    .filter((card) => card.isEvolutionUnlocked)
    .sort(byLevelDescending);
  const heroChampions = deck.filter((card) => card.isChampion).sort(
    byLevelDescending,
  );

  const evolutionSlot = evolutions[0] ?? null;
  const heroSlot = heroChampions[0] ?? null;
  const wildSlot = evolutions[1] ?? heroChampions[1] ?? null;

  return {
    evolutionSlot,
    heroSlot,
    wildSlot,
    evolutionCount: evolutions.length,
    heroChampionCount: heroChampions.length,
    totalSpecial: evolutions.length + heroChampions.length,
  };
}

export function checkDeckLegality(deck: CardProfile[]): LegalityResult {
  const violations: string[] = [];
  const uniqueNames = new Set(deck.map((card) => card.name));

  if (deck.length !== DECK_SIZE || uniqueNames.size !== DECK_SIZE) {
    violations.push(
      `A deck must contain exactly ${DECK_SIZE} unique cards (found ${deck.length}, ${uniqueNames.size} unique)`,
    );
  }

  const slots = assignSlots(deck);

  if (slots.evolutionCount > MAX_EVOLUTIONS) {
    violations.push(
      `A deck may hold at most ${MAX_EVOLUTIONS} Evolutions (found ${slots.evolutionCount})`,
    );
  }

  if (slots.heroChampionCount > MAX_HERO_CHAMPION) {
    violations.push(
      `A deck may hold at most ${MAX_HERO_CHAMPION} Hero or Champion cards (found ${slots.heroChampionCount})`,
    );
  }

  if (slots.totalSpecial > MAX_SPECIAL_SLOTS) {
    violations.push(
      `A deck may hold at most ${MAX_SPECIAL_SLOTS} special cards across the Evolution, Hero, and Wild slots (found ${slots.totalSpecial})`,
    );
  }

  return { legal: violations.length === 0, violations, slots };
}

/**
 * Evolution slots activate only the cards that actually occupy them, which is
 * what the in-game deck link encodes.
 */
export function activeEvolutionNames(deck: CardProfile[]): string[] {
  const slots = assignSlots(deck);
  return [slots.evolutionSlot, slots.wildSlot]
    .filter(
      (card): card is CardProfile =>
        card !== null && card.isEvolutionUnlocked,
    )
    .map((card) => card.name);
}
