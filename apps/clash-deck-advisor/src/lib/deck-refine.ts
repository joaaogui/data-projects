import type { CardProfile } from "./card-knowledge";
import { checkDeckLegality, DECK_SIZE } from "./deck-rules";
import { scoreDeck, type DeckScore } from "./deck-score";

/**
 * Deterministic local search over a deck.
 *
 * Models reliably produce a sensible archetype but routinely miss a strictly
 * better card sitting in the collection. Hill climbing from their proposal
 * closes that gap for free: every single-card substitution is tried, the best
 * legal one is kept, and the process repeats until nothing improves.
 *
 * Because the score caps each dimension, this cannot spiral into stacking one
 * attribute, and legality is rechecked on every step.
 */

export interface RefineOptions {
  /** Caps how far the result can drift from the starting deck. */
  maxSwaps?: number;
  /** Cards that must stay, such as the archetype's win condition. */
  lockedCards?: Set<string>;
}

export interface RefineResult {
  deck: CardProfile[];
  score: DeckScore;
  swapsApplied: number;
}

/** A swap must be worth at least this much to be worth confusing the player. */
const MIN_GAIN = 1;

/**
 * The dimensions a swap is allowed to chase.
 *
 * Restricting the search to structural gaps is what keeps hill climbing
 * honest. Left to maximise the total, it will happily trade a deck's tank for
 * a higher-levelled utility spell, because average card level is worth points
 * and "has a tank" is not a dimension. A swap must therefore fix a real hole
 * in the deck, with the total score only breaking ties between such fixes.
 */
const STRUCTURAL_COMPONENTS = [
  "winCondition",
  "airDefense",
  "spellCoverage",
  "tankAnswer",
  "splashAnswer",
] as const;

function structuralTotal(score: DeckScore): number {
  return STRUCTURAL_COMPONENTS.reduce(
    (total, key) => total + score.components[key],
    0,
  );
}

/**
 * Cards that can actually pressure a tower: declared win conditions, plus
 * heavy units that lead a push.
 *
 * Counting these stops the search from defending its way to a high score. It
 * can otherwise strip a deck down to cheap answers, which grades well on
 * every defensive dimension while having no way to win.
 */
function countThreats(deck: CardProfile[]): number {
  return deck.filter(
    (card) =>
      card.roles.includes("winCondition") ||
      (card.roles.includes("tank") && card.elixirCost >= 5),
  ).length;
}

export function refineDeck(
  startingDeck: CardProfile[],
  pool: CardProfile[],
  options: RefineOptions = {},
): RefineResult {
  const maxSwaps = options.maxSwaps ?? DECK_SIZE;
  const locked = options.lockedCards ?? new Set<string>();

  let deck = [...startingDeck];
  let score = scoreDeck(deck);
  let structural = structuralTotal(score);
  const threats = countThreats(startingDeck);
  let swapsApplied = 0;

  while (swapsApplied < maxSwaps) {
    const inDeck = new Set(deck.map((card) => card.name));
    let best: {
      deck: CardProfile[];
      score: DeckScore;
      structural: number;
    } | null = null;

    for (let position = 0; position < deck.length; position += 1) {
      if (locked.has(deck[position].name)) {
        continue;
      }

      for (const replacement of pool) {
        if (inDeck.has(replacement.name)) {
          continue;
        }

        const candidate = [...deck];
        candidate[position] = replacement;

        if (!checkDeckLegality(candidate).legal) {
          continue;
        }

        if (countThreats(candidate) < threats) {
          continue;
        }

        const candidateScore = scoreDeck(candidate);
        const candidateStructural = structuralTotal(candidateScore);

        // Must close a structural gap, and must not be an overall downgrade.
        if (candidateStructural <= structural) {
          continue;
        }
        if (candidateScore.total < score.total + MIN_GAIN) {
          continue;
        }
        if (
          best !== null &&
          (candidateStructural < best.structural ||
            (candidateStructural === best.structural &&
              candidateScore.total <= best.score.total))
        ) {
          continue;
        }

        best = {
          deck: candidate,
          score: candidateScore,
          structural: candidateStructural,
        };
      }
    }

    if (best === null) {
      break;
    }

    deck = best.deck;
    score = best.score;
    structural = best.structural;
    swapsApplied += 1;
  }

  return { deck, score, swapsApplied };
}
