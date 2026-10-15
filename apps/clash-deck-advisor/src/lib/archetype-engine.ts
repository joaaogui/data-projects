import type { CardProfile } from "./card-knowledge";
import {
  airQuality,
  BIG_DAMAGE_SPELLS,
  DEFENSIVE_BUILDINGS,
  isPrimaryWinCondition,
  PUMPS,
  RELIABLE_AIR,
  SMALL_DAMAGE_SPELLS,
  SPELL_MAGNETS,
} from "./card-mechanics";
import { ARCHETYPE_TEMPLATES, type ArchetypeTemplate } from "./archetypes.data";
import { refineDeck } from "./deck-refine";
import { checkDeckLegality } from "./deck-rules";
import type { AnalysisMode } from "./engine-context";
import {
  buildLossAutopsy,
  cardCountersThreatCategory,
  deckKeyOf,
  MIN_BATTLES_FOR_SWAP,
  normalizeBattles,
} from "./learning-engine";
import type {
  DeckAnalysis,
  DeckEvidence,
  Matchup,
  ReplayAdvice,
} from "./schemas";
import type {
  Battle,
  DeckChangeImpact,
  DeckVersionSummary,
  LossAutopsy,
  MetaDeckReference,
  PlayerFeedbackInput,
  RecentLoss,
  ThreatCardStat,
} from "./types";

export { MIN_BATTLES_FOR_SWAP };

/** New cards below this level are not competitive at the player's trophy range. */
export const MIN_RECOMMENDED_LEVEL = 10;

const MAX_IMPROVE_SWAPS = 3;
const MAX_VARIANTS = 64;

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
  counteredThreats?: string[];
  counterTargetsByCard?: Map<string, string[]>;
  avoidedFailedSwaps?: string[];
  penalizedDeckKeys?: string[];
}

export interface Recommendation {
  analysis: DeckAnalysis;
  keptCurrentDeck: boolean;
  support: number;
  penalizedDecks: string[];
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

function listStrengths(
  template: ArchetypeTemplate,
  deck: CardProfile[],
  counteredThreats: string[] = [],
): string[] {
  const names = new Set(namesOf(deck));
  const strengths = [template.summary];
  const primary = template.primaryWinConditions.find((name) => names.has(name));
  if (primary) strengths.push(`${primary} is the tower-damage plan`);
  if (counteredThreats.length > 0) {
    strengths.push(
      `Targeted answers for recent losses against ${counteredThreats.slice(0, 3).join(", ")}`,
    );
  }
  return strengths.slice(0, 4);
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
  excludedCards?: Set<string>,
  lockedCards?: Set<string>,
): CardProfile[][] {
  const slotChoices = template.slots.map((slot) => {
    const valid = slot.options
      .map((name) => owned.get(name))
      .filter((card): card is CardProfile => card !== undefined)
      .filter((card) => card.level >= MIN_RECOMMENDED_LEVEL)
      .filter((card) => !excludedCards?.has(card.name));

    if (lockedCards && lockedCards.size > 0) {
      valid.sort((left, right) => {
        const leftLocked = lockedCards.has(left.name) ? 1 : 0;
        const rightLocked = lockedCards.has(right.name) ? 1 : 0;
        return rightLocked - leftLocked;
      });
    }

    return valid.slice(0, 4);
  });
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

function cardDirectlyCountersThreat(
  card: CardProfile,
  threat: ThreatCardStat,
): boolean {
  if (card.name === threat.cardName) return false;
  if (threat.recommendedCounters.includes(card.name)) return true;
  return cardCountersThreatCategory(
    card,
    threat.threatCategory,
    threat.cardName,
  );
}

/**
 * Scores how well a candidate deck answers the specific opponent cards and
 * blind spots that beat the player in recent battles.
 */
export function scoreLossCounters(
  deck: CardProfile[],
  current: CardProfile[],
  lossAutopsy?: LossAutopsy,
): {
  bonus: number;
  counteredThreats: string[];
  counterTargetsByCard: Map<string, string[]>;
} {
  const counterTargetsByCard = new Map<string, string[]>();
  const activeLosses =
    lossAutopsy?.currentDeckLosses ?? lossAutopsy?.recentLosses ?? 0;
  if (!lossAutopsy || activeLosses === 0) {
    return { bonus: 0, counteredThreats: [], counterTargetsByCard };
  }

  const currentNames = new Set(namesOf(current));
  const addedCards = deck.filter((card) => !currentNames.has(card.name));
  const counteredSet = new Set<string>();
  let bonus = 0;

  for (const threat of lossAutopsy.topThreatCards) {
    let answeredByNewSwap = false;
    for (const added of addedCards) {
      if (cardDirectlyCountersThreat(added, threat)) {
        answeredByNewSwap = true;
        counteredSet.add(threat.cardName);
        const list = counterTargetsByCard.get(added.name) ?? [];
        if (!list.includes(threat.cardName)) {
          list.push(threat.cardName);
          counterTargetsByCard.set(added.name, list);
        }
      }
    }

    if (answeredByNewSwap) {
      bonus += 5 + threat.lossesAgainst * 4;
    } else {
      const deckHasCounter = deck.some((card) =>
        cardDirectlyCountersThreat(card, threat),
      );
      const currentHadCounter = current.some((card) =>
        cardDirectlyCountersThreat(card, threat),
      );
      if (deckHasCounter && !currentHadCounter) {
        counteredSet.add(threat.cardName);
        bonus += 4 + threat.lossesAgainst * 2;
      }
    }
  }

  for (const spot of lossAutopsy.dominantBlindSpots) {
    const deckCounters = deck.filter((card) =>
      cardCountersThreatCategory(card, spot.category),
    ).length;
    const currentCounters = current.filter((card) =>
      cardCountersThreatCategory(card, spot.category),
    ).length;

    if (deckCounters > currentCounters) {
      const weight =
        spot.severity === "high" ? 12 : spot.severity === "medium" ? 8 : 4;
      bonus += (deckCounters - currentCounters) * weight;
    }

    for (const added of addedCards) {
      if (spot.counterCards.includes(added.name)) {
        bonus += 5;
      }
    }
  }

  return {
    bonus: Math.min(48, bonus),
    counteredThreats: [...counteredSet],
    counterTargetsByCard,
  };
}

/**
 * Evaluates closed-loop battle history feedback:
 * - Penalizes keeping a losing current deck (<45% WR over >=3 battles or >=3 loss streak)
 * - Penalizes any deck variant that already went <45% WR over >=3 battles
 * - Penalizes incoming swap cards that produced a "hurt" verdict in changeImpacts
 * - Rewards deck versions proven to win (>=60% WR over >=3 battles)
 */
export function scoreHistoryFeedback(
  deck: CardProfile[],
  current: CardProfile[],
  deckVersions: DeckVersionSummary[] = [],
  changeImpacts: DeckChangeImpact[] = [],
  lossAutopsy?: LossAutopsy,
): {
  delta: number;
  avoidedFailedSwaps: string[];
  penalizedDeckKeys: string[];
} {
  const deckNames = namesOf(deck);
  const currentNames = namesOf(current);
  const candidateKey = deckKeyOf(deckNames);
  const currentKey = deckKeyOf(currentNames);
  const isKeepingCurrent = candidateKey === currentKey;

  let delta = 0;
  const avoidedFailedSwaps: string[] = [];
  const penalizedDeckKeys: string[] = [];

  const currentVersion = deckVersions.find(
    (v) => v.deckKey === currentKey || v.isCurrentActiveDeck,
  );
  const currentIsLosingInVersions =
    currentVersion !== undefined &&
    currentVersion.battles >= MIN_BATTLES_FOR_SWAP &&
    currentVersion.winRate < 45;
  const autopsyDeckBattles =
    lossAutopsy?.currentDeckBattles ?? lossAutopsy?.totalBattlesAnalyzed ?? 0;
  const autopsyDeckWinRate =
    lossAutopsy?.currentDeckWinRate ?? lossAutopsy?.recentWinRate ?? 0;
  const currentIsLosingInAutopsy =
    lossAutopsy !== undefined &&
    autopsyDeckBattles >= MIN_BATTLES_FOR_SWAP &&
    ((autopsyDeckWinRate < 45 &&
      deckVersions.filter((v) => v.battles > 0).length <= 1) ||
      (lossAutopsy.currentStreak.type === "loss" &&
        lossAutopsy.currentStreak.count >= 3));

  if (
    isKeepingCurrent &&
    (currentIsLosingInVersions || currentIsLosingInAutopsy)
  ) {
    delta -= 30;
    penalizedDeckKeys.push(currentVersion?.versionLabel ?? "current");
  }

  const matchingVersion = deckVersions.find((v) => v.deckKey === candidateKey);
  if (matchingVersion && matchingVersion.battles >= 3) {
    if (matchingVersion.winRate < 45) {
      if (!isKeepingCurrent) {
        delta -= 35;
        penalizedDeckKeys.push(matchingVersion.versionLabel);
      } else if (!penalizedDeckKeys.includes(matchingVersion.versionLabel)) {
        delta -= 30;
        penalizedDeckKeys.push(matchingVersion.versionLabel);
      }
    } else if (matchingVersion.winRate >= 60) {
      delta += 18;
    }
  }

  const addedNames = new Set(
    deckNames.filter((name) => !currentNames.includes(name)),
  );
  const failedIncomingCards = new Set<string>();
  const helpedIncomingCards = new Set<string>();

  for (const impact of changeImpacts) {
    if (impact.verdict === "hurt") {
      for (const swap of impact.swaps) {
        failedIncomingCards.add(swap.in);
      }
    } else if (impact.verdict === "helped") {
      for (const swap of impact.swaps) {
        helpedIncomingCards.add(swap.in);
      }
    }
  }

  for (const failedCard of failedIncomingCards) {
    if (addedNames.has(failedCard)) {
      delta -= 15;
    } else if (!deckNames.includes(failedCard)) {
      avoidedFailedSwaps.push(failedCard);
    }
  }

  for (const helpedCard of helpedIncomingCards) {
    if (deckNames.includes(helpedCard)) {
      delta += 8;
    }
  }

  return {
    delta,
    avoidedFailedSwaps,
    penalizedDeckKeys,
  };
}

function toRanked(
  template: ArchetypeTemplate,
  deck: CardProfile[],
  baseSupport: number,
  current: CardProfile[],
  lossAutopsy?: LossAutopsy,
  deckVersions?: DeckVersionSummary[],
  changeImpacts?: DeckChangeImpact[],
): RankedDeck | null {
  if (gateFailures(deck).length > 0) return null;
  const names = namesOf(deck);
  const currentNames = namesOf(current);
  const preferred = template.slots.filter((slot, index) => {
    return names[index] === slot.options[0];
  }).length;

  const counterEval = scoreLossCounters(deck, current, lossAutopsy);
  const historyEval = scoreHistoryFeedback(
    deck,
    current,
    deckVersions,
    changeImpacts,
    lossAutopsy,
  );

  const support = baseSupport + counterEval.bonus + historyEval.delta;

  return {
    template,
    deck,
    support,
    coherence: preferred,
    minLevel: Math.min(...deck.map((card) => card.level)),
    averageLevel: averageLevel(deck),
    weaknesses: listWeaknesses(deck),
    strengths: listStrengths(template, deck, counterEval.counteredThreats),
    swapsFromCurrent: currentNames.filter((name) => !names.includes(name))
      .length,
    counteredThreats: counterEval.counteredThreats,
    counterTargetsByCard: counterEval.counterTargetsByCard,
    avoidedFailedSwaps: historyEval.avoidedFailedSwaps,
    penalizedDeckKeys: historyEval.penalizedDeckKeys,
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

/**
 * In "improve" mode, only lock the archetype's defining core and primary win
 * conditions (plus any explicitly user-locked cards), and never lock excluded
 * cards or flexible slot options.
 */
export function lockedNames(
  template: ArchetypeTemplate,
  current: CardProfile[],
  feedback?: PlayerFeedbackInput,
): Set<string> {
  const excluded = new Set(feedback?.excludedCards ?? []);
  const explicitLocked = new Set(feedback?.lockedCards ?? []);

  return new Set(
    current
      .map((card) => card.name)
      .filter(
        (name) =>
          !excluded.has(name) &&
          (explicitLocked.has(name) ||
            template.core.includes(name) ||
            template.primaryWinConditions.includes(name)),
      ),
  );
}

function synthesizeAutopsyFromLosses(
  losses: RecentLoss[],
  current: CardProfile[],
  owned: CardProfile[],
): LossAutopsy | undefined {
  if (losses.length === 0) return undefined;
  const syntheticBattles: Battle[] = losses.map((loss) => ({
    type: "PvP",
    battleTime: loss.battleTime,
    team: [
      {
        tag: "#PLAYER",
        name: "Player",
        crowns: loss.playerCrowns,
        cards: current.map((card) => ({
          id: card.id,
          name: card.name,
          level: card.level,
          maxLevel: 16,
          rarity: card.rarity,
          elixirCost: card.elixirCost,
          iconUrls: { medium: "" },
        })),
      },
    ],
    opponent: [
      {
        tag: "#OPPONENT",
        name: loss.opponentName,
        crowns: loss.opponentCrowns,
        cards: loss.opponentDeck.map((name, idx) => ({
          id: idx + 1,
          name,
          level: 14,
          maxLevel: 16,
          rarity: "common",
          elixirCost: 4,
          iconUrls: { medium: "" },
        })),
      },
    ],
  }));

  const normalized = normalizeBattles(syntheticBattles, "#PLAYER");
  if (normalized.length === 0) {
    // Handle partial opponent decks in synthetic test fixtures (<8 cards)
    const fallbackNormalized = losses.map((loss, index) => ({
      battleTime: loss.battleTime,
      timestampMs: Date.now() - index * 60_000,
      type: "PvP",
      gameModeName: "Ladder",
      isLadderOrRanked: true,
      outcome: "loss" as const,
      playerCrowns: loss.playerCrowns,
      opponentCrowns: loss.opponentCrowns,
      crownDiff: loss.playerCrowns - loss.opponentCrowns,
      trophyChange: -30,
      playerDeck: namesOf(current),
      deckKey: deckKeyOf(namesOf(current)),
      opponentName: loss.opponentName,
      opponentTag: "#OPP",
      opponentDeck: loss.opponentDeck,
      opponentArchetype: "Mid-Ladder Control",
    }));
    return buildLossAutopsy(
      fallbackNormalized,
      current,
      owned.filter((c) => c.level >= MIN_RECOMMENDED_LEVEL),
    );
  }

  return buildLossAutopsy(
    normalized,
    current,
    owned.filter((c) => c.level >= MIN_RECOMMENDED_LEVEL),
  );
}

function generateRefinedAndCounterVariants(input: {
  current: CardProfile[];
  ownedMap: Map<string, CardProfile>;
  locked: Set<string>;
  excluded: Set<string>;
  lossAutopsy?: LossAutopsy;
  deckVersions?: DeckVersionSummary[];
}): CardProfile[][] {
  const pool = [...input.ownedMap.values()].filter(
    (card) =>
      card.level >= MIN_RECOMMENDED_LEVEL && !input.excluded.has(card.name),
  );
  const results: CardProfile[][] = [];

  // 1. Hill-climbed refinement from current deck
  const refined = refineDeck(input.current, pool, {
    maxSwaps: MAX_IMPROVE_SWAPS,
    lockedCards: input.locked,
    excludedCards: input.excluded,
    lossAutopsy: input.lossAutopsy,
    deckVersions: input.deckVersions,
  });
  if (refined.swapsApplied > 0 && gateFailures(refined.deck).length === 0) {
    results.push(refined.deck);
  }

  // 2. Single-card and two-card targeted counter substitutions on current deck
  const priorityPool = pool
    .filter((card) => {
      if (input.lossAutopsy && input.lossAutopsy.recentLosses > 0) {
        return (
          input.lossAutopsy.topThreatCards.some((t) =>
            cardDirectlyCountersThreat(card, t),
          ) ||
          input.lossAutopsy.dominantBlindSpots.some((s) =>
            cardCountersThreatCategory(card, s.category),
          )
        );
      }
      return (
        SMALL_DAMAGE_SPELLS.has(card.name) ||
        DEFENSIVE_BUILDINGS.has(card.name) ||
        RELIABLE_AIR.has(card.name)
      );
    })
    .sort((a, b) => b.level - a.level)
    .slice(0, 10);

  const currentNames = new Set(namesOf(input.current));
  for (let i = 0; i < input.current.length; i += 1) {
    const outgoing = input.current[i]!;
    if (input.locked.has(outgoing.name) && !input.excluded.has(outgoing.name)) {
      continue;
    }
    for (const replacement of priorityPool) {
      if (currentNames.has(replacement.name)) continue;
      const singleSwap = [...input.current];
      singleSwap[i] = replacement;
      if (gateFailures(singleSwap).length === 0) {
        results.push(singleSwap);
      }
    }
  }

  return results;
}

export function rankArchetypes(input: {
  owned: CardProfile[];
  current: CardProfile[];
  metaDecks: MetaDeckReference[];
  mode: AnalysisMode;
  losses?: RecentLoss[];
  lossAutopsy?: LossAutopsy;
  deckVersions?: DeckVersionSummary[];
  changeImpacts?: DeckChangeImpact[];
  feedback?: PlayerFeedbackInput;
}): RankedDeck[] {
  const owned = new Map(input.owned.map((card) => [card.name, card]));
  for (const card of input.current) owned.set(card.name, card);

  const currentNames = namesOf(input.current);
  const classified = classifyArchetype(currentNames);
  const excluded = new Set(input.feedback?.excludedCards ?? []);
  const explicitLocked = new Set(
    (input.feedback?.lockedCards ?? []).filter((name) => !excluded.has(name)),
  );
  const locked =
    input.mode === "improve"
      ? lockedNames(classified, input.current, input.feedback)
      : explicitLocked;

  const effectiveAutopsy =
    input.lossAutopsy ??
    synthesizeAutopsyFromLosses(
      input.losses ?? [],
      input.current,
      [...owned.values()],
    );

  const seenKeys = new Set<string>();
  const ranked: RankedDeck[] = [];

  for (const template of ARCHETYPE_TEMPLATES) {
    if (input.mode === "improve" && template.id !== classified.id) continue;
    const baseSupport =
      template.support + metaBoost(template, input.metaDecks);

    for (const deck of variantsFor(template, owned, excluded, explicitLocked)) {
      const deckNames = namesOf(deck);
      if (deckNames.some((name) => excluded.has(name))) continue;

      if (input.mode === "improve") {
        const removed = currentNames.filter(
          (name) => !deckNames.includes(name),
        );
        if (removed.length > MAX_IMPROVE_SWAPS) continue;
        if (removed.some((name) => locked.has(name))) continue;
      } else if (explicitLocked.size > 0) {
        const missingLocked = [...explicitLocked].some(
          (name) => !deckNames.includes(name),
        );
        if (missingLocked) continue;
      }

      const candidate = toRanked(
        template,
        deck,
        baseSupport,
        input.current,
        effectiveAutopsy,
        input.deckVersions,
        input.changeImpacts,
      );
      if (!candidate) continue;

      const key = `${template.id}:${deckKeyOf(deckNames)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      ranked.push(candidate);
    }
  }

  // In improve mode, also evaluate direct counter-swaps and hill-climbed variants
  // from the player's current deck so custom decks or counter-tech options compete.
  if (input.mode === "improve") {
    const directDecks = generateRefinedAndCounterVariants({
      current: input.current,
      ownedMap: owned,
      locked,
      excluded,
      lossAutopsy: effectiveAutopsy,
      deckVersions: input.deckVersions,
    });

    const baseSupport =
      classified.support + metaBoost(classified, input.metaDecks) - 6;

    for (const deck of directDecks) {
      const deckNames = namesOf(deck);
      if (deckNames.some((name) => excluded.has(name))) continue;
      const removed = currentNames.filter((name) => !deckNames.includes(name));
      if (removed.length > MAX_IMPROVE_SWAPS) continue;
      if (removed.some((name) => locked.has(name))) continue;

      const key = `${classified.id}:${deckKeyOf(deckNames)}`;
      if (seenKeys.has(key)) continue;

      const candidate = toRanked(
        classified,
        deck,
        baseSupport,
        input.current,
        effectiveAutopsy,
        input.deckVersions,
        input.changeImpacts,
      );
      if (!candidate) continue;
      seenKeys.add(key);
      ranked.push(candidate);
    }
  }

  // If explicitLocked in "best" mode filtered out all templates, fall back to
  // ranking templates without the hard filter but boosting locked card matches.
  if (ranked.length === 0 && input.mode === "best" && explicitLocked.size > 0) {
    for (const template of ARCHETYPE_TEMPLATES) {
      const baseSupport =
        template.support + metaBoost(template, input.metaDecks);
      for (const deck of variantsFor(template, owned, excluded)) {
        const deckNames = namesOf(deck);
        if (deckNames.some((name) => excluded.has(name))) continue;
        const lockedMatches = [...explicitLocked].filter((name) =>
          deckNames.includes(name),
        ).length;
        const candidate = toRanked(
          template,
          deck,
          baseSupport + lockedMatches * 25,
          input.current,
          effectiveAutopsy,
          input.deckVersions,
          input.changeImpacts,
        );
        if (candidate) ranked.push(candidate);
      }
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

function matchupsFor(
  deck: CardProfile[],
  lossAutopsy?: LossAutopsy,
): Matchup[] {
  const names = namesOf(deck);
  const hasBuilding = names.some((name) => DEFENSIVE_BUILDINGS.has(name));
  const buildingName = names.find((name) => DEFENSIVE_BUILDINGS.has(name));
  const air = airQuality(names);
  const airDefender = names.find((name) => RELIABLE_AIR.has(name));
  const smallSpell = names.find((name) => SMALL_DAMAGE_SPELLS.has(name));
  const tankKiller = deck.find((card) => card.roles.includes("tankKiller"))?.name;
  const results: Matchup[] = [];

  results.push({
    archetype: "Hog Cycle",
    rating: hasBuilding ? "even" : "unfavored",
    advice: hasBuilding
      ? `Pull Hog Rider with ${buildingName ?? "the building"} instead of spending a heavy troop.`
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
        ? `Keep ${airDefender ?? "the ranged air defender"} in hand once Balloon or Lava Hound is cycled.`
        : "Air defense is too fragile to call this matchup safe.",
  });

  if (lossAutopsy && lossAutopsy.topThreatArchetypes.length > 0) {
    for (const threatArch of lossAutopsy.topThreatArchetypes.slice(0, 2)) {
      const alreadyListed = results.some(
        (m) => m.archetype.toLowerCase() === threatArch.archetype.toLowerCase(),
      );
      if (alreadyListed) continue;
      const answerCard = tankKiller ?? smallSpell ?? airDefender ?? names[0]!;
      results.push({
        archetype: threatArch.archetype,
        rating: answerCard ? "even" : "unfavored",
        advice: `Recent log shows ${threatArch.losses} loss${threatArch.losses === 1 ? "" : "es"} here; anchor defense around ${answerCard} before counterpushing.`,
      });
    }
  }

  return results.slice(0, 5);
}

function replayNotes(
  losses: RecentLoss[],
  deck: CardProfile[],
  counterTargetsByCard?: Map<string, string[]>,
): ReplayAdvice[] {
  return losses.slice(0, 3).map((loss) => {
    const shown = loss.opponentDeck.slice(0, 4).join(", ");
    const names = new Set(namesOf(deck));
    const overlap = loss.opponentDeck.filter((name) => names.has(name));
    const overlapText =
      overlap.length > 0
        ? ` Both decks share ${overlap.join(", ")}.`
        : "";

    let counterNote = "";
    if (counterTargetsByCard && counterTargetsByCard.size > 0) {
      for (const [addedCard, targets] of counterTargetsByCard.entries()) {
        const matched = targets.filter((t) => loss.opponentDeck.includes(t));
        if (matched.length > 0) {
          counterNote = ` ${addedCard} is brought in to answer ${matched.join(", ")}.`;
          break;
        }
      }
    }

    return {
      title: `Loss to ${loss.opponentName}`,
      detail: `The battle log only records crowns and the opposing cards (${shown}). It does not show placements or timing.${overlapText}${counterNote}`,
    };
  });
}

function slotLabel(template: ArchetypeTemplate, cardName: string): string {
  return (
    template.slots.find((slot) => slot.options.includes(cardName))?.label ??
    "counter slot"
  );
}

function buildAnalysis(
  candidate: RankedDeck,
  current: CardProfile[],
  metaDecks: MetaDeckReference[],
  losses: RecentLoss[],
  keptCurrentDeck: boolean,
  lossAutopsy?: LossAutopsy,
  deckVersions?: DeckVersionSummary[],
  verdictReasonOverride?: string,
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
    counteredThreats:
      candidate.counteredThreats && candidate.counteredThreats.length > 0
        ? candidate.counteredThreats.slice(0, 5)
        : undefined,
    avoidedFailedSwaps:
      candidate.avoidedFailedSwaps && candidate.avoidedFailedSwaps.length > 0
        ? candidate.avoidedFailedSwaps.slice(0, 4)
        : undefined,
  };

  const currentKey = deckKeyOf(original);
  const activeVersion = deckVersions?.find((v) => v.deckKey === currentKey);

  let verdictReason: string;
  if (verdictReasonOverride) {
    verdictReason = verdictReasonOverride;
  } else if (keptCurrentDeck) {
    if (
      activeVersion &&
      activeVersion.battles >= MIN_BATTLES_FOR_SWAP &&
      activeVersion.winRate >= 52
    ) {
      verdictReason = `Current ${candidate.template.name} build is winning ${activeVersion.winRate.toFixed(1)}% across ${activeVersion.battles} recent battles. No swap beat its live performance.`;
    } else {
      verdictReason = `No legal ${candidate.template.name} variant beat this deck without breaking its core, so it stays.`;
    }
  } else if (
    candidate.counteredThreats &&
    candidate.counteredThreats.length > 0
  ) {
    verdictReason = `${candidate.template.name} keeps the tower-damage plan and replaces ${removed.length} card${removed.length === 1 ? "" : "s"} to counter recent losses against ${candidate.counteredThreats.slice(0, 3).join(", ")}.`;
  } else {
    verdictReason = `${candidate.template.name} keeps the tower-damage plan and replaces ${removed.length} card${removed.length === 1 ? "" : "s"} that did not belong in it.`;
  }

  const blindSpotProblems =
    lossAutopsy?.dominantBlindSpots.slice(0, 2).map((spot) => ({
      title: spot.label,
      description: spot.evidence,
      severity: spot.severity,
    })) ?? [];

  const structuralProblems = candidate.weaknesses
    .slice(0, Math.max(0, 4 - blindSpotProblems.length))
    .map((description) => ({
      title: description.split(",")[0] ?? description,
      description,
      severity: (description.includes("level") ? "high" : "medium") as
        | "high"
        | "medium"
        | "low",
    }));

  const problems = [...blindSpotProblems, ...structuralProblems].slice(0, 4);

  return {
    originalDeck: original,
    improvedDeck: improved,
    verdict: removed.length > 0 ? "improve" : "keep",
    verdictReason,
    problems,
    changes: removed.map((out, index) => {
      const incoming = added[index] ?? "";
      const counterTargets =
        candidate.counterTargetsByCard?.get(incoming)?.slice(0, 4) ?? [];
      return {
        out,
        in: incoming,
        reason: `${incoming} fills the ${slotLabel(candidate.template, incoming)} in ${candidate.template.name}. ${out} does not.`,
        ...(counterTargets.length > 0 ? { counterTargets } : {}),
      };
    }),
    metaTier: {
      archetype: candidate.template.name,
      tier: candidate.template.tier,
      summary: candidate.template.summary,
    },
    matchups: matchupsFor(candidate.deck, lossAutopsy),
    replayAdvice: replayNotes(
      losses,
      candidate.deck,
      candidate.counterTargetsByCard,
    ),
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

function getCurrentDeckSample(input: {
  current: CardProfile[];
  deckVersions?: DeckVersionSummary[];
  lossAutopsy?: LossAutopsy;
  losses: RecentLoss[];
}): { battles: number; wins: number; losses: number } {
  const currentKey = deckKeyOf(namesOf(input.current));
  const activeVersion =
    input.deckVersions?.find((v) => v.deckKey === currentKey) ??
    input.deckVersions?.find((v) => v.isCurrentActiveDeck);

  if (activeVersion) {
    return {
      battles: activeVersion.battles,
      wins: activeVersion.wins,
      losses: activeVersion.losses,
    };
  }

  if (input.lossAutopsy !== undefined) {
    return {
      battles:
        input.lossAutopsy.currentDeckBattles ??
        input.lossAutopsy.totalBattlesAnalyzed,
      wins:
        input.lossAutopsy.currentDeckWins ?? input.lossAutopsy.recentWins,
      losses:
        input.lossAutopsy.currentDeckLosses ?? input.lossAutopsy.recentLosses,
    };
  }

  if (input.losses.length > 0) {
    return {
      battles: input.losses.length,
      wins: 0,
      losses: input.losses.length,
    };
  }

  return { battles: 0, wins: 0, losses: 0 };
}

function sampleGateReason(sample: {
  battles: number;
  wins: number;
  losses: number;
}): string {
  if (sample.battles === 0) {
    return `We have 0 recorded battles with this exact 8-card deck. Play ${MIN_BATTLES_FOR_SWAP} matches with it first so recommendations are based on real results with this deck, not guesses.`;
  }
  const remaining = MIN_BATTLES_FOR_SWAP - sample.battles;
  return `Only ${sample.battles} recorded battle${sample.battles === 1 ? "" : "s"} with this exact deck (${sample.wins}W–${sample.losses}L). Play ${remaining} more so we have enough games with this deck before suggesting swaps.`;
}

export function recommendArchetype(input: {
  owned: CardProfile[];
  current: CardProfile[];
  metaDecks: MetaDeckReference[];
  losses: RecentLoss[];
  mode: AnalysisMode;
  lossAutopsy?: LossAutopsy;
  deckVersions?: DeckVersionSummary[];
  changeImpacts?: DeckChangeImpact[];
  feedback?: PlayerFeedbackInput;
}): Recommendation {
  const effectiveAutopsy =
    input.lossAutopsy ??
    synthesizeAutopsyFromLosses(input.losses, input.current, input.owned);

  const hasExplicitRules =
    (input.feedback?.lockedCards?.length ?? 0) > 0 ||
    (input.feedback?.excludedCards?.length ?? 0) > 0;

  if (input.mode === "improve" && !hasExplicitRules) {
    const sample = getCurrentDeckSample({
      current: input.current,
      deckVersions: input.deckVersions,
      lossAutopsy: effectiveAutopsy,
      losses: input.losses,
    });

    if (sample.battles < MIN_BATTLES_FOR_SWAP) {
      const currentNames = namesOf(input.current);
      const template = classifyArchetype(currentNames);
      const preferred = template.slots.filter(
        (slot, index) => currentNames[index] === slot.options[0],
      ).length;
      const gatedDeck: RankedDeck = {
        template,
        deck: input.current,
        support: template.support + metaBoost(template, input.metaDecks),
        coherence: preferred,
        minLevel: Math.min(...input.current.map((card) => card.level)),
        averageLevel: averageLevel(input.current),
        weaknesses: listWeaknesses(input.current),
        strengths: listStrengths(template, input.current),
        swapsFromCurrent: 0,
      };
      return {
        analysis: buildAnalysis(
          gatedDeck,
          input.current,
          input.metaDecks,
          input.losses,
          true,
          effectiveAutopsy,
          input.deckVersions,
          sampleGateReason(sample),
        ),
        keptCurrentDeck: true,
        support: gatedDeck.support,
        penalizedDecks: [],
      };
    }
  }

  const ranked = rankArchetypes({
    ...input,
    lossAutopsy: effectiveAutopsy,
  });

  const allPenalized = new Set<string>();
  for (const r of ranked) {
    for (const p of r.penalizedDeckKeys ?? []) {
      allPenalized.add(p);
    }
  }

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
        effectiveAutopsy,
        input.deckVersions,
      ),
      keptCurrentDeck: true,
      support: 0,
      penalizedDecks: [...allPenalized],
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
      effectiveAutopsy,
      input.deckVersions,
    ),
    keptCurrentDeck: kept,
    support: winner.support,
    penalizedDecks: [...allPenalized],
  };
}
