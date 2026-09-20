import { buildCardProfiles, type CardProfile } from "./card-knowledge";
import {
  airQuality,
  BIG_DAMAGE_SPELLS,
  DEFENSIVE_BUILDINGS,
  isPrimaryWinCondition,
  PUMPS,
  SMALL_DAMAGE_SPELLS,
  SPELL_MAGNETS,
} from "./card-mechanics";
import { ARCHETYPE_TEMPLATES, type ArchetypeTemplate } from "./archetypes.data";
import { checkDeckLegality } from "./deck-rules";
import type { AnalysisMode } from "./engine-context";
import type {
  DeckAnalysis,
  DeckEvidence,
  Matchup,
  ReplayAdvice,
} from "./schemas";
import type { MetaDeckReference, RecentLoss } from "./types";

/** New cards below this level are not competitive at the player's trophy range. */
export const MIN_RECOMMENDED_LEVEL = 10;

const MAX_IMPROVE_SWAPS = 3;
const MAX_VARIANTS = 24;

export interface RankedDeck {
  template: ArchetypeTemplate;
  deck: CardProfile[];
  support: number;
  coherence: number;
  minLevel: number;
  averageLevel: number;
  weaknesses: string[];
  strengths: string[];
  swapsFromCurrent: number;
}

export interface Recommendation {
  analysis: DeckAnalysis;
  keptCurrentDeck: boolean;
  support: number;
}

function namesOf(deck: CardProfile[]): string[] {
  return deck.map((card) => card.name);
}

function averageLevel(deck: CardProfile[]): number {
  return deck.reduce((sum, card) => sum + card.level, 0) / deck.length;
}

function hasDamageSpell(names: string[]): boolean {
  return names.some(
    (name) => SMALL_DAMAGE_SPELLS.has(name) || BIG_DAMAGE_SPELLS.has(name),
  );
}

export function gateFailures(deck: CardProfile[]): string[] {
  const names = namesOf(deck);
  const failures: string[] = [];
  const legality = checkDeckLegality(deck);
  if (!legality.legal) failures.push(...legality.violations);

  if (!names.some(isPrimaryWinCondition)) {
    failures.push("No credible tower-damage card");
  }

  if (airQuality(names) === "none") {
    failures.push("No dependable air defense");
  }

  if (!hasDamageSpell(names)) {
    failures.push("No damage spell");
  }

  const magnets = names.filter((name) => SPELL_MAGNETS.has(name));
  if (magnets.length >= 2) {
    failures.push(`${magnets.join(" and ")} give the opponent too much spell value`);
  }

  if (
    names.some((name) => PUMPS.has(name)) &&
    !names.some((name) =>
      ["Golem", "Lava Hound", "Electro Giant"].includes(name),
    )
  ) {
    failures.push("Elixir Collector is not a defensive building");
  }

  const underleveled = deck.filter((card) => card.level < MIN_RECOMMENDED_LEVEL);
  if (underleveled.length > 0) {
    failures.push(
      `Below level ${MIN_RECOMMENDED_LEVEL}: ${underleveled.map((card) => card.name).join(", ")}`,
    );
  }

  return failures;
}

function listWeaknesses(deck: CardProfile[]): string[] {
  const names = namesOf(deck);
  const notes: string[] = [];
  if (!names.some((name) => SMALL_DAMAGE_SPELLS.has(name))) {
    notes.push("No small spell, so swarms have to be answered with troops");
  }
  if (!names.some((name) => BIG_DAMAGE_SPELLS.has(name))) {
    notes.push("No big spell, so support troops are hard to clear");
  }
  if (airQuality(names) === "thin") {
    notes.push("Air defense is real but fragile against a dedicated air deck");
  }
  if (!names.some((name) => DEFENSIVE_BUILDINGS.has(name))) {
    notes.push("No building, so Hog Rider and Battle Ram are not pulled");
  }
  const low = deck.filter((card) => card.level < 11);
  if (low.length > 0) {
    notes.push(
      `${low.map((card) => `${card.name} is level ${card.level}`).join(", ")}`,
    );
  }
  return notes.slice(0, 4);
}

function listStrengths(template: ArchetypeTemplate, deck: CardProfile[]): string[] {
  const names = new Set(namesOf(deck));
  const strengths = [template.summary];
  const primary = template.primaryWinConditions.find((name) => names.has(name));
  if (primary) strengths.push(`${primary} is the tower-damage plan`);
  return strengths.slice(0, 3);
}

function metaBoost(
  template: ArchetypeTemplate,
  metaDecks: MetaDeckReference[],
): number {
  const signature = new Set(template.slots.map((slot) => slot.options[0]!));
  const hits = metaDecks.filter((deck) => {
    const shared = deck.deck.filter((name) => signature.has(name)).length;
    return shared >= 4;
  }).length;
  return Math.min(hits, 3) * 8;
}

function variantsFor(
  template: ArchetypeTemplate,
  owned: Map<string, CardProfile>,
): CardProfile[][] {
  const slotChoices = template.slots.map((slot) =>
    slot.options
      .map((name) => owned.get(name))
      .filter((card): card is CardProfile => card !== undefined)
      .filter((card) => card.level >= MIN_RECOMMENDED_LEVEL)
      .slice(0, 3),
  );
  if (slotChoices.some((choices) => choices.length === 0)) return [];

  const found: CardProfile[][] = [];
  const walk = (index: number, draft: CardProfile[]) => {
    if (found.length >= MAX_VARIANTS) return;
    if (index === slotChoices.length) {
      found.push([...draft]);
      return;
    }
    for (const card of slotChoices[index] ?? []) {
      if (draft.some((chosen) => chosen.name === card.name)) continue;
      draft.push(card);
      walk(index + 1, draft);
      draft.pop();
    }
  };
  walk(0, []);
  return found;
}

function toRanked(
  template: ArchetypeTemplate,
  deck: CardProfile[],
  support: number,
  currentNames: string[],
): RankedDeck | null {
  if (gateFailures(deck).length > 0) return null;
  const names = namesOf(deck);
  const preferred = template.slots.filter((slot, index) => {
    return names[index] === slot.options[0];
  }).length;

  return {
    template,
    deck,
    support,
    coherence: preferred,
    minLevel: Math.min(...deck.map((card) => card.level)),
    averageLevel: averageLevel(deck),
    weaknesses: listWeaknesses(deck),
    strengths: listStrengths(template, deck),
    swapsFromCurrent: currentNames.filter((name) => !names.includes(name)).length,
  };
}

function better(left: RankedDeck, right: RankedDeck): number {
  return (
    right.support - left.support ||
    right.coherence - left.coherence ||
    right.minLevel - left.minLevel ||
    right.averageLevel - left.averageLevel ||
    left.weaknesses.length - right.weaknesses.length ||
    left.template.name.localeCompare(right.template.name)
  );
}

export function classifyArchetype(
  currentNames: string[],
): ArchetypeTemplate {
  const ranked = [...ARCHETYPE_TEMPLATES].sort((left, right) => {
    const score = (template: ArchetypeTemplate) => {
      const coreHits = template.core.filter((name) =>
        currentNames.includes(name),
      ).length;
      const optionHits = template.slots.filter((slot) =>
        slot.options.some((name) => currentNames.includes(name)),
      ).length;
      return coreHits * 10 + optionHits;
    };
    return score(right) - score(left) || right.support - left.support;
  });
  return ranked[0] ?? ARCHETYPE_TEMPLATES[0]!;
}

function lockedNames(
  template: ArchetypeTemplate,
  current: CardProfile[],
): Set<string> {
  const optionNames = new Set(template.slots.flatMap((slot) => slot.options));
  return new Set(
    current
      .map((card) => card.name)
      .filter(
        (name) =>
          template.core.includes(name) ||
          template.primaryWinConditions.includes(name) ||
          optionNames.has(name),
      ),
  );
}

export function rankArchetypes(input: {
  owned: CardProfile[];
  current: CardProfile[];
  metaDecks: MetaDeckReference[];
  mode: AnalysisMode;
}): RankedDeck[] {
  const owned = new Map(input.owned.map((card) => [card.name, card]));
  for (const card of input.current) owned.set(card.name, card);
  const currentNames = namesOf(input.current);
  const classified = classifyArchetype(currentNames);
  const locked = lockedNames(classified, input.current);

  const ranked: RankedDeck[] = [];
  for (const template of ARCHETYPE_TEMPLATES) {
    if (input.mode === "improve" && template.id !== classified.id) continue;
    const support = template.support + metaBoost(template, input.metaDecks);
    for (const deck of variantsFor(template, owned)) {
      const candidate = toRanked(template, deck, support, currentNames);
      if (!candidate) continue;
      if (input.mode === "improve") {
        const removed = currentNames.filter(
          (name) => !namesOf(deck).includes(name),
        );
        if (removed.length > MAX_IMPROVE_SWAPS) continue;
        if (removed.some((name) => locked.has(name))) continue;
      }
      ranked.push(candidate);
    }
  }

  ranked.sort(better);
  return ranked;
}

/**
 * Share of cards at or above the deck's median level — the same benchmark
 * getLevelWarnings uses — so readiness never reads 100% while warnings fire.
 */
function levelReadiness(deck: CardProfile[]): number {
  if (deck.length === 0) return 0;
  const levels = deck.map((card) => card.level).sort((left, right) => left - right);
  const benchmark = levels[Math.floor(levels.length / 2)]!;
  const ready = deck.filter((card) => card.level >= benchmark).length;
  return Math.round((ready / deck.length) * 100);
}

function confidenceFor(
  candidate: RankedDeck,
  liveMetaOverlap: number,
): DeckEvidence["confidence"] {
  // Live sample size gates how sure we can be about ladder fit.
  if (liveMetaOverlap === 0) {
    if (candidate.minLevel >= 11 && candidate.coherence >= 5) return "medium";
    return "low";
  }
  if (candidate.minLevel >= 11 && candidate.coherence >= 5) return "high";
  if (candidate.minLevel >= MIN_RECOMMENDED_LEVEL) return "medium";
  return "low";
}

function matchupsFor(deck: CardProfile[]): Matchup[] {
  const names = namesOf(deck);
  const hasBuilding = names.some((name) => DEFENSIVE_BUILDINGS.has(name));
  const air = airQuality(names);
  const smallSpell = names.find((name) => SMALL_DAMAGE_SPELLS.has(name));
  const results: Matchup[] = [];

  results.push({
    archetype: "Hog Cycle",
    rating: hasBuilding ? "even" : "unfavored",
    advice: hasBuilding
      ? "Pull Hog Rider with the building instead of spending a heavy troop."
      : "There is no building. Do not answer Hog Rider with a 7-elixir tank.",
  });

  if (names.includes("Goblin Gang") || names.includes("Skeleton Barrel")) {
    results.push({
      archetype: "Spell bait",
      rating: smallSpell ? "even" : "unfavored",
      advice: smallSpell
        ? `Save ${smallSpell} for the barrel or gang that threatens the tower, not the first bait card.`
        : "Without a small spell, both bait cards can connect.",
    });
  }

  results.push({
    archetype: "Air beatdown",
    rating: air === "reliable" ? "even" : "unfavored",
    advice:
      air === "reliable"
        ? "Keep the ranged air defender in hand once Balloon or Lava Hound is cycled."
        : "Air defense is too fragile to call this matchup safe.",
  });

  return results.slice(0, 3);
}

function replayNotes(
  losses: RecentLoss[],
  deck: CardProfile[],
): ReplayAdvice[] {
  return losses.slice(0, 2).map((loss) => {
    const shown = loss.opponentDeck.slice(0, 4).join(", ");
    const names = new Set(namesOf(deck));
    const overlap = loss.opponentDeck.filter((name) => names.has(name));
    const overlapText =
      overlap.length > 0
        ? ` Both decks share ${overlap.join(", ")}.`
        : "";
    return {
      title: `Loss to ${loss.opponentName}`,
      detail: `The battle log only records crowns and the opposing cards (${shown}). It does not show placements or timing.${overlapText}`,
    };
  });
}

function slotLabel(template: ArchetypeTemplate, cardName: string): string {
  return (
    template.slots.find((slot) => slot.options.includes(cardName))?.label ??
    "flex slot"
  );
}

function buildAnalysis(
  candidate: RankedDeck,
  current: CardProfile[],
  metaDecks: MetaDeckReference[],
  losses: RecentLoss[],
  keptCurrentDeck: boolean,
): DeckAnalysis {
  const original = namesOf(current);
  const improved = namesOf(candidate.deck);
  const removed = original.filter((name) => !improved.includes(name));
  const added = improved.filter((name) => !original.includes(name));
  const liveMetaOverlap = metaDecks.filter((deck) => {
    const signature = new Set(
      candidate.template.slots.map((slot) => slot.options[0]!),
    );
    return deck.deck.filter((name) => signature.has(name)).length >= 4;
  }).length;
  const evidence: DeckEvidence = {
    archetypeId: candidate.template.id,
    archetypeName: candidate.template.name,
    source:
      liveMetaOverlap > 0
        ? `${candidate.template.tier}-tier ladder shell. ${liveMetaOverlap} of ${metaDecks.length} checked top-ladder decks share this core.`
        : `${candidate.template.tier}-tier structural shell. ${metaDecks.length} top-ladder decks were checked; none share this core, so live-meta confidence stays limited.`,
    confidence: confidenceFor(candidate, liveMetaOverlap),
    levelReadiness: levelReadiness(candidate.deck),
    strengths: candidate.strengths,
    weaknesses: candidate.weaknesses,
    liveMetaOverlap,
  };

  const verdictReason = keptCurrentDeck
    ? `No legal ${candidate.template.name} variant beat this deck without breaking its core, so it stays.`
    : `${candidate.template.name} keeps the tower-damage plan and replaces ${removed.length} card${removed.length === 1 ? "" : "s"} that did not belong in it.`;

  return {
    originalDeck: original,
    improvedDeck: improved,
    verdict: removed.length > 0 ? "improve" : "keep",
    verdictReason,
    problems: candidate.weaknesses.slice(0, 3).map((description) => ({
      title: description.split(",")[0] ?? description,
      description,
      severity: description.includes("level") ? "high" : "medium",
    })),
    changes: removed.map((out, index) => {
      const incoming = added[index] ?? "";
      return {
        out,
        in: incoming,
        reason: `${incoming} fills the ${slotLabel(candidate.template, incoming)} in ${candidate.template.name}. ${out} does not.`,
      };
    }),
    metaTier: {
      archetype: candidate.template.name,
      tier: candidate.template.tier,
      summary: candidate.template.summary,
    },
    matchups: matchupsFor(candidate.deck),
    replayAdvice: replayNotes(losses, candidate.deck),
    weaknessScores: {
      airDefense: airQuality(improved) === "reliable" ? 70 : 40,
      tankStopping: improved.some((name) => DEFENSIVE_BUILDINGS.has(name))
        ? 75
        : 45,
      swarmControl: improved.some((name) => SMALL_DAMAGE_SPELLS.has(name))
        ? 70
        : 35,
      spellCoverage:
        improved.some((name) => SMALL_DAMAGE_SPELLS.has(name)) &&
        improved.some((name) => BIG_DAMAGE_SPELLS.has(name))
          ? 80
          : 40,
      cycle:
        elixirAverage(candidate.deck) <= 3.4
          ? 75
          : elixirAverage(candidate.deck) <= 4
            ? 60
            : 40,
      synergy: Math.round((candidate.coherence / 8) * 100),
    },
    strategy: candidate.template.summary,
    averageElixir: elixirAverage(candidate.deck),
    evidence,
  };
}

function elixirAverage(deck: CardProfile[]): number {
  const total = deck.reduce((sum, card) => sum + card.elixirCost, 0);
  return Math.round((total / deck.length) * 10) / 10;
}

export function recommendArchetype(input: {
  owned: CardProfile[];
  current: CardProfile[];
  metaDecks: MetaDeckReference[];
  losses: RecentLoss[];
  mode: AnalysisMode;
}): Recommendation {
  const ranked = rankArchetypes(input);
  const winner = ranked[0];
  if (!winner) {
    const fallbackTemplate = classifyArchetype(namesOf(input.current));
    const fallback: RankedDeck = {
      template: fallbackTemplate,
      deck: input.current,
      support: 0,
      coherence: 0,
      minLevel: Math.min(...input.current.map((card) => card.level)),
      averageLevel: averageLevel(input.current),
      weaknesses: gateFailures(input.current),
      strengths: ["No complete archetype in this collection passed the gates"],
      swapsFromCurrent: 0,
    };
    return {
      analysis: buildAnalysis(
        fallback,
        input.current,
        input.metaDecks,
        input.losses,
        true,
      ),
      keptCurrentDeck: true,
      support: 0,
    };
  }

  const kept = winner.swapsFromCurrent === 0;
  return {
    analysis: buildAnalysis(
      winner,
      input.current,
      input.metaDecks,
      input.losses,
      kept,
    ),
    keptCurrentDeck: kept,
    support: winner.support,
  };
}

export function profilesFromCards(
  cards: Parameters<typeof buildCardProfiles>[0],
): CardProfile[] {
  return buildCardProfiles(cards);
}
