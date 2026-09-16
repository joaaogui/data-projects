import {
  CARD_ATTRIBUTES,
  type Archetype,
  type CardAttributes,
  type CardRole,
} from "./card-roles.data";
import type { ClashCard } from "./types";

export interface CardProfile {
  id: number;
  name: string;
  /** Level on the unified 1-16 scale, comparable across rarities. */
  level: number;
  elixirCost: number;
  rarity: string;
  roles: CardRole[];
  targets: CardAttributes["targets"];
  isAirUnit: boolean;
  archetypes: Archetype[];
  isChampion: boolean;
  isEvolutionUnlocked: boolean;
  canEvolve: boolean;
  hasHeroForm: boolean;
}

const UNKNOWN_CARD: CardAttributes = {
  roles: ["support"],
  targets: "ground",
};

/**
 * The API reports levels relative to each rarity's own maximum. Adding the
 * distance from 16 puts every card on the scale players actually see in game.
 */
export function normalizeLevel(card: ClashCard): number {
  return card.level + Math.max(0, 16 - card.maxLevel);
}

export function buildCardProfile(card: ClashCard): CardProfile {
  const attributes = CARD_ATTRIBUTES[card.name] ?? UNKNOWN_CARD;

  return {
    id: card.id,
    name: card.name,
    level: normalizeLevel(card),
    elixirCost: card.elixirCost ?? 0,
    rarity: card.rarity,
    roles: attributes.roles,
    targets: attributes.targets,
    isAirUnit: attributes.isAirUnit ?? false,
    archetypes: attributes.archetypes ?? [],
    isChampion: card.rarity.toLowerCase() === "champion",
    isEvolutionUnlocked: (card.evolutionLevel ?? 0) > 0,
    canEvolve: (card.maxEvolutionLevel ?? 0) > 0,
    hasHeroForm: Boolean(card.iconUrls.heroMedium),
  };
}

export function buildCardProfiles(cards: ClashCard[]): CardProfile[] {
  return cards.map(buildCardProfile);
}

export function hasRole(deck: CardProfile[], role: CardRole): boolean {
  return deck.some((card) => card.roles.includes(role));
}

export function countRole(deck: CardProfile[], role: CardRole): number {
  return deck.filter((card) => card.roles.includes(role)).length;
}

function canHitAir(card: CardProfile): boolean {
  return (
    (card.targets === "both" || card.targets === "air") &&
    !card.roles.includes("spellSmall") &&
    !card.roles.includes("spellBig")
  );
}

/** Cards that can shoot air units at all, including incidental ones. */
export function countAirAnswers(deck: CardProfile[]): number {
  return deck.filter(canHitAir).length;
}

/**
 * Not every card that technically hits air is real air defense. A 1-elixir
 * spirit clips a Balloon once; a Musketeer actually kills it. Cards carrying
 * the explicit airDefense role count fully, incidental ones count half.
 */
export function airDefenseStrength(deck: CardProfile[]): number {
  return deck.reduce((strength, card) => {
    if (!canHitAir(card)) return strength;
    return strength + (card.roles.includes("airDefense") ? 1 : 0.5);
  }, 0);
}

export function averageElixir(deck: CardProfile[]): number {
  if (deck.length === 0) {
    return 0;
  }
  const total = deck.reduce((sum, card) => sum + card.elixirCost, 0);
  return Math.round((total / deck.length) * 10) / 10;
}

/** Cheap cards keep a deck from being out-rotated. */
export function countCycleCards(deck: CardProfile[]): number {
  return deck.filter((card) => card.elixirCost > 0 && card.elixirCost <= 3)
    .length;
}
