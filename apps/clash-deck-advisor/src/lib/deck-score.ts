import {
  airDefenseStrength,
  averageElixir,
  countAirAnswers,
  countCycleCards,
  countRole,
  hasRole,
  type CardProfile,
} from "./card-knowledge";
import { assignSlots } from "./deck-rules";

/**
 * Deterministic deck quality model.
 *
 * Scoring locally means two candidate decks can be compared without asking a
 * model to grade its own work, and means quality is testable.
 */

export interface ScoreComponents {
  winCondition: number;
  airDefense: number;
  spellCoverage: number;
  tankAnswer: number;
  splashAnswer: number;
  elixirCurve: number;
  cycleSpeed: number;
  cardLevels: number;
  specialSlots: number;
}

export interface DeckScore {
  total: number;
  components: ScoreComponents;
  weaknesses: string[];
  averageElixir: number;
}

const WEIGHTS: Record<keyof ScoreComponents, number> = {
  winCondition: 20,
  airDefense: 16,
  spellCoverage: 14,
  tankAnswer: 12,
  splashAnswer: 10,
  elixirCurve: 10,
  cycleSpeed: 6,
  cardLevels: 7,
  specialSlots: 5,
};

const IDEAL_ELIXIR_MIN = 2.8;
const IDEAL_ELIXIR_MAX = 4.2;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Two solid air answers is the accepted standard, so that earns full marks. */
function scoreAirDefense(deck: CardProfile[]): number {
  return clamp01(airDefenseStrength(deck) / 2);
}

function scoreSpellCoverage(deck: CardProfile[]): number {
  const small = countRole(deck, "spellSmall");
  const big = countRole(deck, "spellBig");

  if (small >= 1 && big >= 1) {
    // Three or more spells starts costing board presence.
    return small + big > 3 ? 0.8 : 1;
  }
  if (small >= 1 || big >= 1) return 0.5;
  return 0;
}

function scoreElixirCurve(deck: CardProfile[]): number {
  const average = averageElixir(deck);
  if (average >= IDEAL_ELIXIR_MIN && average <= IDEAL_ELIXIR_MAX) {
    return 1;
  }
  const distance =
    average < IDEAL_ELIXIR_MIN
      ? IDEAL_ELIXIR_MIN - average
      : average - IDEAL_ELIXIR_MAX;
  return clamp01(1 - distance / 2);
}

function scoreCycleSpeed(deck: CardProfile[]): number {
  const cheap = countCycleCards(deck);
  if (cheap >= 3) return 1;
  if (cheap === 2) return 0.7;
  if (cheap === 1) return 0.35;
  return 0;
}

function scoreCardLevels(deck: CardProfile[]): number {
  if (deck.length === 0) return 0;
  const average =
    deck.reduce((sum, card) => sum + card.level, 0) / deck.length;
  // Level 11 is roughly the floor for competitive ladder, 15 is strong.
  return clamp01((average - 9) / 6);
}

/**
 * Special slots are only worth points when they are actually occupied, since
 * an unused Evolution or Hero slot is wasted deck value.
 */
function scoreSpecialSlots(deck: CardProfile[]): number {
  const slots = assignSlots(deck);
  const used = [slots.evolutionSlot, slots.heroSlot, slots.wildSlot].filter(
    Boolean,
  ).length;
  return clamp01(used / 3);
}

export function scoreDeck(deck: CardProfile[]): DeckScore {
  const components: ScoreComponents = {
    winCondition: hasRole(deck, "winCondition") ? 1 : 0,
    airDefense: scoreAirDefense(deck),
    spellCoverage: scoreSpellCoverage(deck),
    tankAnswer:
      hasRole(deck, "tankKiller") || hasRole(deck, "building") ? 1 : 0,
    splashAnswer: hasRole(deck, "splash") ? 1 : 0,
    elixirCurve: scoreElixirCurve(deck),
    cycleSpeed: scoreCycleSpeed(deck),
    cardLevels: scoreCardLevels(deck),
    specialSlots: scoreSpecialSlots(deck),
  };

  const total = (
    Object.keys(WEIGHTS) as (keyof ScoreComponents)[]
  ).reduce((sum, key) => sum + components[key] * WEIGHTS[key], 0);

  const weaknesses: string[] = [];
  if (components.winCondition === 0) {
    weaknesses.push("No win condition, so the deck has no reliable way to take a tower");
  }
  if (components.airDefense < 1) {
    weaknesses.push(
      countAirAnswers(deck) === 0
        ? "No air defense, so Balloon and Lava Hound get free damage"
        : "Only one air answer, which is thin against air-heavy decks",
    );
  }
  if (components.spellCoverage < 1) {
    weaknesses.push(
      "Incomplete spell coverage, ideally one small spell and one big spell",
    );
  }
  if (components.tankAnswer === 0) {
    weaknesses.push("No tank answer, so heavy pushes are hard to stop");
  }
  if (components.splashAnswer === 0) {
    weaknesses.push("No splash damage, so swarms are hard to clear");
  }
  if (components.elixirCurve < 1) {
    weaknesses.push(
      `Average elixir ${averageElixir(deck).toFixed(1)} sits outside the ${IDEAL_ELIXIR_MIN}-${IDEAL_ELIXIR_MAX} band`,
    );
  }
  if (components.cycleSpeed < 0.7) {
    weaknesses.push("Too few cheap cards, so the deck is easy to out-cycle");
  }

  return {
    total: Math.round(total),
    components,
    weaknesses,
    averageElixir: averageElixir(deck),
  };
}
