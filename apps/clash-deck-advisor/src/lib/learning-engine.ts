import type { CardProfile } from "./card-knowledge";
import {
  BIG_DAMAGE_SPELLS,
  DEFENSIVE_BUILDINGS,
  RELIABLE_AIR,
  SMALL_DAMAGE_SPELLS,
  airQuality,
} from "./card-mechanics";
import type {
  Battle,
  BattleOutcome,
  BattleParticipant,
  BlindSpotDiagnostic,
  DeckChangeImpact,
  DeckVersionSummary,
  LossAutopsy,
  NormalizedBattle,
  RecentLoss,
  StoredSuggestionEntry,
  ThreatCardStat,
  ThreatCategory,
} from "./types";

const HEAVY_TANK_CARDS = new Set([
  "Mega Knight",
  "P.E.K.K.A",
  "Golem",
  "Giant",
  "Goblin Giant",
  "Electro Giant",
  "Royal Giant",
  "Giant Skeleton",
  "Elixir Golem",
  "Rune Giant",
  "Royal Recruits",
  "Elite Barbarians",
  "Prince",
  "Boss Bandit",
  "Goblin Machine",
]);

const AIR_BEATDOWN_CARDS = new Set([
  "Balloon",
  "Lava Hound",
  "Minion Horde",
  "Baby Dragon",
  "Inferno Dragon",
  "Electro Dragon",
  "Phoenix",
  "Flying Machine",
  "Skeleton Dragons",
  "Minion Giant",
]);

const FAST_CYCLE_WIN_CONS = new Set([
  "Hog Rider",
  "Ram Rider",
  "Battle Ram",
  "Royal Hogs",
  "Miner",
  "Goblin Drill",
  "Bandit",
  "Golden Knight",
]);

const SPELL_BAIT_CARDS = new Set([
  "Goblin Barrel",
  "Skeleton Barrel",
  "Wall Breakers",
  "Princess",
  "Dart Goblin",
  "Goblin Gang",
  "Skeleton Army",
  "Bats",
  "Minions",
  "Guards",
  "Rascals",
  "Suspicious Bush",
  "Goblins",
  "Spear Goblins",
]);

const BUILDING_SIEGE_CARDS = new Set([
  "X-Bow",
  "Mortar",
  "Inferno Tower",
  "Tesla",
  "Cannon",
  "Bomb Tower",
  "Goblin Hut",
  "Furnace",
  "Barbarian Hut",
  "Elixir Collector",
  "Goblin Cage",
  "Tombstone",
]);

const SPLASH_SUPPORT_CARDS = new Set([
  "Wizard",
  "Witch",
  "Executioner",
  "Magic Archer",
  "Firecracker",
  "Bowler",
  "Valkyrie",
  "Dark Prince",
  "Mother Witch",
  "Sparky",
  "Bomber",
  "Ice Wizard",
  "Night Witch",
  "Electro Wizard",
  "Little Prince",
  "Archer Queen",
  "Goblin Demolisher",
  "Spirit Empress",
]);

const NON_THREAT_UTILITY_CARDS = new Set([
  "The Log",
  "Zap",
  "Arrows",
  "Giant Snowball",
  "Barbarian Barrel",
  "Royal Delivery",
  "Earthquake",
  "Fireball",
  "Poison",
  "Rocket",
  "Lightning",
  "Void",
  "Tornado",
  "Rage",
  "Freeze",
  "Clone",
  "Mirror",
  "Vines",
  "Goblin Curse",
  "Ice Spirit",
  "Electro Spirit",
  "Fire Spirit",
  "Heal Spirit",
  "Skeletons",
  "Ice Golem",
]);

/** Battles a deck version needs before its win rate earns a verdict. */
export const MIN_BATTLES_FOR_VERDICT = 3;

export function battleOutcome(
  playerCrowns: number,
  opponentCrowns: number,
): BattleOutcome {
  if (playerCrowns > opponentCrowns) return "win";
  if (playerCrowns < opponentCrowns) return "loss";
  return "draw";
}

export function isLadderOrRankedMode(
  type: string,
  gameModeName: string,
): boolean {
  return (
    /pvp|ladder|pathoflegend|ranked|trophy/i.test(type) ||
    /ladder|ranked|league|trophy|path/i.test(gameModeName)
  );
}

export function deckKeyOf(cards: string[]): string {
  return [...cards].sort((left, right) => left.localeCompare(right)).join("|");
}

export function diffDeckCards(
  fromDeck: string[],
  toDeck: string[],
): { out: string; in: string }[] {
  const toSet = new Set(toDeck);
  const fromSet = new Set(fromDeck);
  const removed = fromDeck.filter((name) => !toSet.has(name));
  const added = toDeck.filter((name) => !fromSet.has(name));
  const count = Math.min(removed.length, added.length);
  const swaps: { out: string; in: string }[] = [];
  for (let index = 0; index < count; index += 1) {
    swaps.push({
      out: removed[index]!,
      in: added[index]!,
    });
  }
  return swaps;
}

/**
 * Parses Clash Royale compact UTC timestamps ("20260919T143210.000Z") or ISO strings.
 */
export function parseClashBattleTime(raw: string): number {
  if (!raw) return 0;
  const compactMatch =
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.(\d{3}))?Z$/.exec(
      raw.trim(),
    );
  if (compactMatch) {
    const [, year, month, day, hour, minute, second, ms = "000"] = compactMatch;
    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}Z`;
    const parsed = Date.parse(iso);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  const direct = Date.parse(raw);
  return Number.isNaN(direct) ? 0 : direct;
}

export function classifyThreatCategory(cardName: string): ThreatCategory {
  if (HEAVY_TANK_CARDS.has(cardName)) return "heavyTank";
  if (AIR_BEATDOWN_CARDS.has(cardName)) return "airBeatdown";
  if (FAST_CYCLE_WIN_CONS.has(cardName)) return "fastCycleWinCon";
  if (SPELL_BAIT_CARDS.has(cardName)) return "spellBait";
  if (BUILDING_SIEGE_CARDS.has(cardName)) return "buildingSiege";
  if (SPLASH_SUPPORT_CARDS.has(cardName)) return "splashSupport";
  return "other";
}

export function classifyOpponentArchetype(cards: string[]): string {
  const set = new Set(cards);

  if (set.has("Lava Hound") && set.has("Balloon")) {
    return "LavaLoon / Air";
  }
  if (set.has("Lava Hound") || set.has("Balloon")) {
    return "LavaLoon / Air";
  }
  if (
    set.has("Royal Recruits") &&
    (set.has("Wall Breakers") ||
      set.has("Skeleton Barrel") ||
      set.has("Goblin Barrel") ||
      set.has("Royal Hogs"))
  ) {
    return "Recruits Bait";
  }
  if (
    set.has("Goblin Barrel") &&
    (set.has("Princess") ||
      set.has("Goblin Gang") ||
      set.has("Dart Goblin") ||
      set.has("Skeleton Barrel") ||
      set.has("Inferno Tower") ||
      set.has("Rocket"))
  ) {
    return "Log Bait";
  }
  if (set.has("Mega Knight")) {
    return "Mega Knight Beatdown";
  }
  if (set.has("Hog Rider")) {
    return "Hog Cycle";
  }
  if (set.has("X-Bow") || set.has("Mortar")) {
    return "Siege (X-Bow/Mortar)";
  }
  if (set.has("Graveyard")) {
    return "Graveyard Control";
  }
  if (set.has("Royal Giant")) {
    return "Royal Giant";
  }
  if (set.has("Golem") || set.has("Electro Giant") || set.has("Elixir Golem")) {
    return "Golem Beatdown";
  }
  if (set.has("P.E.K.K.A")) {
    return "P.E.K.K.A Bridge Spam";
  }
  if (set.has("Giant") || set.has("Goblin Giant") || set.has("Rune Giant")) {
    return "Giant Beatdown";
  }
  if (set.has("Royal Hogs") || set.has("Three Musketeers")) {
    return "Royal Hogs / Split";
  }
  if (
    set.has("Goblin Barrel") ||
    set.has("Skeleton Barrel") ||
    set.has("Wall Breakers")
  ) {
    return "Log Bait";
  }
  if (set.has("Miner") || set.has("Goblin Drill")) {
    return "Miner Control";
  }
  return "Mid-Ladder Control";
}

function participantForTag(
  participants: BattleParticipant[],
  tag?: string,
): BattleParticipant | undefined {
  if (!tag) return participants[0];
  const normalizedTag = tag.replace(/^#/, "").toUpperCase();
  return participants.find(
    (participant) =>
      participant.tag.replace(/^#/, "").toUpperCase() === normalizedTag,
  );
}

/**
 * Normalizes the raw Clash Royale battle log into chronological newest-first
 * 1v1 records, preserving wins, losses, draws, player deck versions, and trophy deltas.
 */
export function normalizeBattles(
  battles: Battle[],
  playerTag?: string,
): NormalizedBattle[] {
  const normalized = battles.flatMap(
    (battle, index): (NormalizedBattle & { _order: number })[] => {
      if (battle.team.length !== 1 || battle.opponent.length !== 1) {
        return [];
      }

      const player =
        participantForTag(battle.team, playerTag) ??
        participantForTag(battle.opponent, playerTag);
      if (!player) {
        return [];
      }

      const playerIsOnTeam = battle.team.includes(player);
      const opponents = playerIsOnTeam ? battle.opponent : battle.team;
      const opponent = opponents[0];
      if (!opponent) {
        return [];
      }

      const playerDeck = player.cards.map((card) => card.name);
      const opponentDeck = opponent.cards.map((card) => card.name);
      if (playerDeck.length !== 8 || opponentDeck.length !== 8) {
        return [];
      }

      const outcome = battleOutcome(player.crowns, opponent.crowns);

      let trophyChange = 0;
      if (typeof player.trophyChange === "number") {
        trophyChange = player.trophyChange;
      } else if (
        outcome === "loss" &&
        typeof opponent.trophyChange === "number" &&
        opponent.trophyChange > 0
      ) {
        trophyChange = -opponent.trophyChange;
      }

      const gameModeName = battle.gameMode?.name ?? battle.type ?? "Ladder";
      const isLadderOrRanked = isLadderOrRankedMode(battle.type, gameModeName);

      return [
        {
          battleTime: battle.battleTime,
          timestampMs: parseClashBattleTime(battle.battleTime),
          type: battle.type,
          gameModeName,
          isLadderOrRanked,
          outcome,
          playerCrowns: player.crowns,
          opponentCrowns: opponent.crowns,
          crownDiff: player.crowns - opponent.crowns,
          trophyChange,
          playerDeck,
          deckKey: deckKeyOf(playerDeck),
          opponentName: opponent.name,
          opponentTag: opponent.tag,
          opponentDeck,
          opponentArchetype: classifyOpponentArchetype(opponentDeck),
          _order: index,
        },
      ];
    },
  );

  normalized.sort((left, right) => {
    if (right.timestampMs !== left.timestampMs) {
      return right.timestampMs - left.timestampMs;
    }
    return left._order - right._order;
  });

  return normalized.map(({ _order: _unused, ...battle }) => battle);
}

export function lossesFromNormalized(
  normalizedBattles: NormalizedBattle[],
  limit = 6,
): RecentLoss[] {
  return normalizedBattles
    .filter((battle) => battle.outcome === "loss")
    .slice(0, limit)
    .map((battle) => ({
      battleTime: battle.battleTime,
      opponentName: battle.opponentName,
      opponentCrowns: battle.opponentCrowns,
      playerCrowns: battle.playerCrowns,
      opponentDeck: battle.opponentDeck,
    }));
}

/**
 * Checks whether a candidate card counters a given threat category or specific threat card.
 */
export function cardCountersThreatCategory(
  card: CardProfile,
  category: ThreatCategory,
  specificCard?: string,
): boolean {
  if (specificCard && card.name === specificCard) {
    return false;
  }

  switch (category) {
    case "heavyTank":
      return (
        card.roles.includes("tankKiller") ||
        DEFENSIVE_BUILDINGS.has(card.name) ||
        card.name === "Royal Recruits" ||
        card.name === "Knight" ||
        card.name === "Valkyrie"
      );
    case "airBeatdown":
      return (
        RELIABLE_AIR.has(card.name) ||
        card.name === "Tesla" ||
        card.name === "Inferno Tower" ||
        (card.roles.includes("airDefense") && !card.weakAirDefense)
      );
    case "fastCycleWinCon":
      return (
        DEFENSIVE_BUILDINGS.has(card.name) ||
        card.name === "Tornado" ||
        card.name === "Fisherman" ||
        card.name === "Mini P.E.K.K.A" ||
        card.name === "Hunter" ||
        card.name === "Royal Delivery" ||
        card.name === "Guards" ||
        card.name === "Skeleton Army"
      );
    case "spellBait":
      return (
        SMALL_DAMAGE_SPELLS.has(card.name) ||
        card.roles.includes("splash")
      );
    case "splashSupport":
      return (
        BIG_DAMAGE_SPELLS.has(card.name) ||
        card.name === "Royal Delivery" ||
        card.name === "Knight" ||
        card.name === "Valkyrie" ||
        card.name === "Golden Knight" ||
        card.name === "Mighty Miner" ||
        card.name === "Bandit" ||
        card.name === "Miner"
      );
    case "buildingSiege":
      return (
        card.name === "Earthquake" ||
        BIG_DAMAGE_SPELLS.has(card.name) ||
        (card.roles.includes("tank") && card.elixirCost >= 5)
      );
    case "other":
      return (
        card.roles.includes("support") ||
        SMALL_DAMAGE_SPELLS.has(card.name)
      );
  }
}

function selectCounterCardsForCategory(
  category: ThreatCategory,
  viableOwnedCards: CardProfile[],
  currentDeckNames: Set<string>,
  specificThreat?: string,
): string[] {
  const candidates = viableOwnedCards.filter((card) =>
    cardCountersThreatCategory(card, category, specificThreat),
  );

  // Prefer cards not already in the failing deck first, then highest level.
  candidates.sort((left, right) => {
    const leftInCurrent = currentDeckNames.has(left.name) ? 1 : 0;
    const rightInCurrent = currentDeckNames.has(right.name) ? 1 : 0;
    if (leftInCurrent !== rightInCurrent) {
      return leftInCurrent - rightInCurrent;
    }
    return right.level - left.level || left.name.localeCompare(right.name);
  });

  return candidates.slice(0, 4).map((card) => card.name);
}

const BLIND_SPOT_METADATA: Record<
  Exclude<ThreatCategory, "other">,
  { label: string; neededRole: string }
> = {
  heavyTank: {
    label: "Heavy Tank Overwhelm",
    neededRole: "High-DPS Tank Killer or Defensive Building",
  },
  airBeatdown: {
    label: "Vulnerable to Air Pushes",
    neededRole: "Reliable Ranged Air Defense",
  },
  fastCycleWinCon: {
    label: "Tower-Targeting Rush Pressure",
    neededRole: "Defensive Building or Fast Pull",
  },
  spellBait: {
    label: "Swarm & Spell-Bait Chip",
    neededRole: "Small Damage Spell & Splash",
  },
  splashSupport: {
    label: "Backline Splash Support Value",
    neededRole: "Big Spell or Mini-Tank Assassin",
  },
  buildingSiege: {
    label: "Defensive Building / Siege Lock",
    neededRole: "Heavy Spell or Ground Tank",
  },
};

function currentDeckCoverageGap(
  category: Exclude<ThreatCategory, "other">,
  currentDeck: CardProfile[],
): string | null {
  const names = currentDeck.map((card) => card.name);
  switch (category) {
    case "heavyTank": {
      const answers = currentDeck.filter(
        (card) =>
          card.roles.includes("tankKiller") ||
          DEFENSIVE_BUILDINGS.has(card.name),
      ).length;
      if (answers === 0) return "current deck has no dedicated tank killer or building";
      if (answers === 1) return "current deck has only one reliable tank answer";
      return null;
    }
    case "airBeatdown": {
      const quality = airQuality(names);
      if (quality === "none") return "current deck has no dependable air defense";
      if (quality === "thin") return "current air defense is fragile against spells";
      const reliableCount = names.filter((name) => RELIABLE_AIR.has(name)).length;
      if (reliableCount < 2) return "current deck has only one sturdy ranged air defender";
      return null;
    }
    case "fastCycleWinCon": {
      const hasBuilding = names.some((name) => DEFENSIVE_BUILDINGS.has(name));
      if (!hasBuilding) return "current deck runs no defensive building to pull tower rushers";
      return null;
    }
    case "spellBait": {
      const hasSmallSpell = names.some((name) => SMALL_DAMAGE_SPELLS.has(name));
      if (!hasSmallSpell) return "current deck lacks a small damage spell for bait swarms";
      return null;
    }
    case "splashSupport": {
      const hasBigSpell = names.some((name) => BIG_DAMAGE_SPELLS.has(name));
      const swarmCount = currentDeck.filter((card) =>
        card.roles.includes("swarm"),
      ).length;
      if (!hasBigSpell) return "current deck lacks a big spell to clear ranged splashers";
      if (swarmCount >= 3) return "current deck stacks multiple swarms that feed splash troops";
      return null;
    }
    case "buildingSiege": {
      const hasBigSpell = names.some(
        (name) => BIG_DAMAGE_SPELLS.has(name) || name === "Earthquake",
      );
      if (!hasBigSpell) return "current deck lacks a heavy spell or Earthquake to break buildings";
      return null;
    }
  }
}

export function buildLossAutopsy(
  normalizedBattles: NormalizedBattle[],
  currentDeck: CardProfile[],
  viableOwnedCards: CardProfile[],
): LossAutopsy {
  const totalBattlesAnalyzed = normalizedBattles.length;
  const recentWins = normalizedBattles.filter((b) => b.outcome === "win").length;
  const recentLosses = normalizedBattles.filter(
    (b) => b.outcome === "loss",
  ).length;
  const recentDraws = normalizedBattles.filter(
    (b) => b.outcome === "draw",
  ).length;
  const recentWinRate =
    totalBattlesAnalyzed > 0
      ? Math.round((recentWins / totalBattlesAnalyzed) * 1000) / 10
      : 0;
  const netTrophies = normalizedBattles.reduce(
    (sum, battle) => sum + battle.trophyChange,
    0,
  );

  let streakType: "win" | "loss" | "none" = "none";
  let streakCount = 0;
  for (const battle of normalizedBattles) {
    if (battle.outcome === "draw") {
      break;
    }
    if (streakType === "none") {
      streakType = battle.outcome;
      streakCount = 1;
    } else if (battle.outcome === streakType) {
      streakCount += 1;
    } else {
      break;
    }
  }

  const lossBattles = normalizedBattles.filter((b) => b.outcome === "loss");
  const threeCrownLosses = lossBattles.filter(
    (b) => b.opponentCrowns >= 3,
  ).length;
  const oneCrownLosses = lossBattles.filter(
    (b) => b.opponentCrowns - b.playerCrowns === 1,
  ).length;

  const currentDeckNames = new Set(currentDeck.map((card) => card.name));
  const cardCounts = new Map<
    string,
    { losses: number; wins: number; total: number }
  >();

  for (const battle of normalizedBattles) {
    for (const cardName of new Set(battle.opponentDeck)) {
      const entry = cardCounts.get(cardName) ?? {
        losses: 0,
        wins: 0,
        total: 0,
      };
      entry.total += 1;
      if (battle.outcome === "loss") entry.losses += 1;
      if (battle.outcome === "win") entry.wins += 1;
      cardCounts.set(cardName, entry);
    }
  }

  const allThreatStats: ThreatCardStat[] = [...cardCounts.entries()]
    .filter(([, stat]) => stat.losses > 0)
    .map(([cardName, stat]) => {
      const threatCategory = classifyThreatCategory(cardName);
      return {
        cardName,
        lossesAgainst: stat.losses,
        winsAgainst: stat.wins,
        totalSeen: stat.total,
        lossRateAgainst: Math.round((stat.losses / stat.total) * 100),
        threatCategory,
        recommendedCounters: selectCounterCardsForCategory(
          threatCategory,
          viableOwnedCards,
          currentDeckNames,
          cardName,
        ),
      };
    });

  const nonUtilityThreats = allThreatStats.filter(
    (item) => !NON_THREAT_UTILITY_CARDS.has(item.cardName),
  );
  const candidateThreats =
    nonUtilityThreats.length > 0 ? nonUtilityThreats : allThreatStats;

  candidateThreats.sort(
    (left, right) =>
      right.lossesAgainst - left.lossesAgainst ||
      right.lossRateAgainst - left.lossRateAgainst ||
      right.totalSeen - left.totalSeen ||
      left.cardName.localeCompare(right.cardName),
  );

  const topThreatCards = candidateThreats.slice(0, 6);

  // Archetype breakdown
  const archetypeCounts = new Map<
    string,
    { losses: number; wins: number; total: number }
  >();
  for (const battle of normalizedBattles) {
    const entry = archetypeCounts.get(battle.opponentArchetype) ?? {
      losses: 0,
      wins: 0,
      total: 0,
    };
    entry.total += 1;
    if (battle.outcome === "loss") entry.losses += 1;
    if (battle.outcome === "win") entry.wins += 1;
    archetypeCounts.set(battle.opponentArchetype, entry);
  }

  const topThreatArchetypes = [...archetypeCounts.entries()]
    .filter(([, stat]) => stat.losses > 0)
    .map(([archetype, stat]) => ({
      archetype,
      losses: stat.losses,
      wins: stat.wins,
      lossRate: Math.round((stat.losses / stat.total) * 100),
    }))
    .sort(
      (left, right) =>
        right.losses - left.losses ||
        right.lossRate - left.lossRate ||
        left.archetype.localeCompare(right.archetype),
    )
    .slice(0, 4);

  // Dominant blind spots by threat category
  const categories: Exclude<ThreatCategory, "other">[] = [
    "heavyTank",
    "airBeatdown",
    "fastCycleWinCon",
    "spellBait",
    "splashSupport",
    "buildingSiege",
  ];

  const blindSpots: (BlindSpotDiagnostic & { _score: number })[] = [];

  for (const category of categories) {
    const lossesWithCategory = lossBattles.filter((battle) =>
      battle.opponentDeck.some(
        (cardName) =>
          !NON_THREAT_UTILITY_CARDS.has(cardName) &&
          classifyThreatCategory(cardName) === category,
      ),
    );
    const lossCount = lossesWithCategory.length;
    const gap = currentDeckCoverageGap(category, currentDeck);

    if (lossCount === 0) continue;
    if (lossCount === 1 && !gap && recentLosses > 2) continue;

    const matchingCards = candidateThreats
      .filter((item) => item.threatCategory === category)
      .slice(0, 3)
      .map((item) => `${item.cardName} (${item.lossesAgainst}L)`);

    const severity: "high" | "medium" | "low" =
      lossCount >= 3 || (lossCount >= 2 && Boolean(gap))
        ? "high"
        : lossCount >= 2 || Boolean(gap)
          ? "medium"
          : "low";

    const meta = BLIND_SPOT_METADATA[category];
    const gapText = gap ? ` — ${gap}` : "";
    const evidence = `Lost ${lossCount} of ${recentLosses} recent defeat${recentLosses === 1 ? "" : "s"} against ${matchingCards.join(", ")}${gapText}.`;

    blindSpots.push({
      category,
      label: meta.label,
      severity,
      evidence,
      neededRole: meta.neededRole,
      counterCards: selectCounterCardsForCategory(
        category,
        viableOwnedCards,
        currentDeckNames,
      ),
      _score: lossCount * 10 + (gap ? 15 : 0),
    });
  }

  blindSpots.sort((left, right) => right._score - left._score);

  return {
    totalBattlesAnalyzed,
    recentWins,
    recentLosses,
    recentDraws,
    recentWinRate,
    netTrophies,
    currentStreak: { type: streakType, count: streakCount },
    threeCrownLosses,
    oneCrownLosses,
    topThreatCards,
    topThreatArchetypes,
    dominantBlindSpots: blindSpots
      .slice(0, 3)
      .map(({ _score: _unused, ...spot }) => spot),
  };
}

function versionVerdict(
  battles: number,
  winRate: number,
): DeckVersionSummary["verdict"] {
  if (battles === 0) return "untested";
  if (battles < MIN_BATTLES_FOR_VERDICT) return "testing";
  if (winRate >= 52) return "working";
  if (winRate < 50) return "underperforming";
  return "testing";
}

/**
 * Groups the player's battle log by actual 8-card deck played, labels each
 * version chronologically (v1, v2, ...), and computes per-version performance.
 */
export function buildDeckVersions(
  normalizedBattles: NormalizedBattle[],
  currentDeckNames: string[],
): DeckVersionSummary[] {
  const currentKey =
    currentDeckNames.length === 8 ? deckKeyOf(currentDeckNames) : "";

  interface RawGroup {
    deckKey: string;
    cards: string[];
    battles: NormalizedBattle[];
    firstSeenMs: number;
    lastSeenMs: number;
    firstSeen: string;
    lastSeen: string;
  }

  const groups = new Map<string, RawGroup>();

  for (const battle of normalizedBattles) {
    const existing = groups.get(battle.deckKey);
    if (!existing) {
      groups.set(battle.deckKey, {
        deckKey: battle.deckKey,
        cards: [...battle.playerDeck],
        battles: [battle],
        firstSeenMs: battle.timestampMs,
        lastSeenMs: battle.timestampMs,
        firstSeen: battle.battleTime,
        lastSeen: battle.battleTime,
      });
    } else {
      existing.battles.push(battle);
      if (
        battle.timestampMs > 0 &&
        (existing.firstSeenMs === 0 || battle.timestampMs < existing.firstSeenMs)
      ) {
        existing.firstSeenMs = battle.timestampMs;
        existing.firstSeen = battle.battleTime;
      }
      if (battle.timestampMs >= existing.lastSeenMs) {
        existing.lastSeenMs = battle.timestampMs;
        existing.lastSeen = battle.battleTime;
      }
    }
  }

  // Sort played groups oldest-first to assign chronological version numbers v1, v2, ...
  const chronological = [...groups.values()].sort(
    (left, right) =>
      left.firstSeenMs - right.firstSeenMs ||
      left.lastSeenMs - right.lastSeenMs ||
      left.deckKey.localeCompare(right.deckKey),
  );

  if (currentKey && !groups.has(currentKey)) {
    const nowIso = new Date().toISOString();
    chronological.push({
      deckKey: currentKey,
      cards: [...currentDeckNames],
      battles: [],
      firstSeenMs: Number.MAX_SAFE_INTEGER,
      lastSeenMs: Number.MAX_SAFE_INTEGER,
      firstSeen: nowIso,
      lastSeen: nowIso,
    });
  }

  const summaries: DeckVersionSummary[] = chronological.map((group, index) => {
    const previous = index > 0 ? chronological[index - 1] : undefined;
    const wins = group.battles.filter((b) => b.outcome === "win").length;
    const losses = group.battles.filter((b) => b.outcome === "loss").length;
    const draws = group.battles.filter((b) => b.outcome === "draw").length;
    const total = group.battles.length;
    const winRate =
      total > 0 ? Math.round((wins / total) * 1000) / 10 : 0;
    const netTrophies = group.battles.reduce(
      (sum, b) => sum + b.trophyChange,
      0,
    );
    const avgCrownDiff =
      total > 0
        ? Math.round(
            (group.battles.reduce((sum, b) => sum + b.crownDiff, 0) / total) *
              10,
          ) / 10
        : 0;

    const lossCardFreq = new Map<string, number>();
    for (const battle of group.battles) {
      if (battle.outcome !== "loss") continue;
      for (const opponentCard of new Set(battle.opponentDeck)) {
        if (NON_THREAT_UTILITY_CARDS.has(opponentCard)) continue;
        lossCardFreq.set(
          opponentCard,
          (lossCardFreq.get(opponentCard) ?? 0) + 1,
        );
      }
    }
    const topLossesAgainst = [...lossCardFreq.entries()]
      .sort(
        (left, right) =>
          right[1] - left[1] || left[0].localeCompare(right[0]),
      )
      .slice(0, 4)
      .map(([name]) => name);

    const isCurrentActiveDeck = group.deckKey === currentKey;

    return {
      deckKey: group.deckKey,
      versionLabel: `v${index + 1}`,
      cards: isCurrentActiveDeck ? [...currentDeckNames] : group.cards,
      isCurrentActiveDeck,
      battles: total,
      wins,
      losses,
      draws,
      winRate,
      netTrophies,
      avgCrownDiff,
      firstSeen: group.firstSeen,
      lastSeen: group.lastSeen,
      swapsFromPrevious: previous
        ? diffDeckCards(previous.cards, group.cards)
        : [],
      swapsToCurrent:
        currentDeckNames.length === 8
          ? diffDeckCards(group.cards, currentDeckNames)
          : [],
      topLossesAgainst,
      verdict: versionVerdict(total, winRate),
    };
  });

  // Return newest version first so the active/latest version leads the list.
  return summaries.reverse();
}

function matchSuggestionForTransition(
  fromDeck: string[],
  toDeck: string[],
  swaps: { out: string; in: string }[],
  suggestionHistory: StoredSuggestionEntry[],
): {
  source: DeckChangeImpact["source"];
  matchedSuggestionId?: string;
} {
  const toKey = deckKeyOf(toDeck);
  const fromKey = deckKeyOf(fromDeck);
  const incomingNames = new Set(swaps.map((swap) => swap.in));

  for (const entry of suggestionHistory) {
    if (entry.recommendedSwaps.length === 0) continue;
    const recKey = deckKeyOf(entry.recommendedDeck);
    const recIn = new Set(entry.recommendedSwaps.map((swap) => swap.in));
    const recOut = new Set(entry.recommendedSwaps.map((swap) => swap.out));

    const exactDeckMatch = recKey === toKey;
    const exactSwapMatch =
      swaps.length === entry.recommendedSwaps.length &&
      swaps.every((swap) => recIn.has(swap.in) && recOut.has(swap.out));

    if (exactDeckMatch || exactSwapMatch) {
      return {
        source: "advisor-full",
        matchedSuggestionId: entry.id,
      };
    }

    const baseOverlap =
      entry.baselineDeck.filter((card) => fromDeck.includes(card)).length >= 5 ||
      deckKeyOf(entry.baselineDeck) === fromKey;
    const sharedIncoming = [...incomingNames].filter((name) =>
      recIn.has(name),
    );
    if (baseOverlap && sharedIncoming.length > 0) {
      return {
        source: "advisor-partial",
        matchedSuggestionId: entry.id,
      };
    }
  }

  return {
    source:
      suggestionHistory.length > 0
        ? "player-custom"
        : "battle-log-transition",
  };
}

function buildImpactVerdictAndSummary(input: {
  fromVersionLabel: string;
  toVersionLabel: string;
  swaps: { out: string; in: string }[];
  beforeBattles: number;
  beforeWinRate: number;
  afterBattles: number;
  afterWinRate: number;
  winRateDelta: number;
  trophyDelta: number;
}): { verdict: DeckChangeImpact["verdict"]; summary: string } {
  const swapDesc = input.swaps
    .map((swap) => `${swap.out} → ${swap.in}`)
    .join(", ");

  if (input.afterBattles === 0) {
    return {
      verdict: "pending",
      summary: `Swapped ${swapDesc} in ${input.toVersionLabel}. Play ${MIN_BATTLES_FOR_VERDICT} battles to measure win-rate impact vs ${input.fromVersionLabel} (${input.beforeWinRate.toFixed(1)}% WR).`,
    };
  }

  if (input.afterBattles < MIN_BATTLES_FOR_VERDICT) {
    const remaining = MIN_BATTLES_FOR_VERDICT - input.afterBattles;
    return {
      verdict: "inconclusive",
      summary: `${input.toVersionLabel} (${swapDesc}) is at ${input.afterWinRate.toFixed(1)}% WR across ${input.afterBattles} battle${input.afterBattles === 1 ? "" : "s"}. Play ${remaining} more battle${remaining === 1 ? "" : "s"} for a reliable verdict.`,
    };
  }

  const helped =
    input.winRateDelta >= 5 ||
    (input.afterWinRate >= 55 && input.winRateDelta >= 0) ||
    (input.beforeWinRate < 45 && input.afterWinRate >= 50);

  const hurt = input.winRateDelta <= -5 || input.afterWinRate < 45;

  if (helped && !hurt) {
    const deltaSign = input.winRateDelta >= 0 ? "+" : "";
    return {
      verdict: "helped",
      summary: `${swapDesc} lifted win rate from ${input.beforeWinRate.toFixed(1)}% (${input.beforeBattles} games) to ${input.afterWinRate.toFixed(1)}% (${input.afterBattles} games, ${deltaSign}${input.winRateDelta.toFixed(1)}%).`,
    };
  }

  if (hurt) {
    const deltaSign = input.winRateDelta >= 0 ? "+" : "";
    return {
      verdict: "hurt",
      summary: `${swapDesc} dropped win rate to ${input.afterWinRate.toFixed(1)}% over ${input.afterBattles} games (${deltaSign}${input.winRateDelta.toFixed(1)}% vs ${input.fromVersionLabel}). Advisor will penalize this configuration.`,
    };
  }

  return {
    verdict: "inconclusive",
    summary: `${swapDesc} performed similarly (${input.beforeWinRate.toFixed(1)}% → ${input.afterWinRate.toFixed(1)}% over ${input.afterBattles} games).`,
  };
}

/**
 * Evaluates before/after win-rate and trophy impacts across deck version transitions
 * and cross-references them against stored advisor recommendations.
 * Returned newest first, so the change behind the most recent deck leads.
 */
export function evaluateDeckChangeImpacts(
  deckVersions: DeckVersionSummary[],
  suggestionHistory: StoredSuggestionEntry[] = [],
  currentDeckNames: string[] = [],
): DeckChangeImpact[] {
  if (deckVersions.length === 0) return [];

  // Order chronologically from oldest version (v1) to newest version (vN)
  const chronological = [...deckVersions].sort(
    (left, right) =>
      versionRank(left.versionLabel) - versionRank(right.versionLabel),
  );

  const impacts: DeckChangeImpact[] = [];
  const coveredTargetKeys = new Set<string>();

  for (let index = 1; index < chronological.length; index += 1) {
    const fromVer = chronological[index - 1]!;
    const toVer = chronological[index]!;
    const swaps = diffDeckCards(fromVer.cards, toVer.cards);

    const matched = matchSuggestionForTransition(
      fromVer.cards,
      toVer.cards,
      swaps,
      suggestionHistory,
    );

    // Track 1..4 card iterations or any explicit advisor recommendation match.
    if (
      swaps.length === 0 ||
      (swaps.length > 4 && matched.source !== "advisor-full")
    ) {
      continue;
    }

    const beforeWinRate = fromVer.winRate;
    const afterWinRate = toVer.winRate;
    const winRateDelta =
      toVer.battles > 0
        ? Math.round((afterWinRate - beforeWinRate) * 10) / 10
        : 0;
    const trophyDelta = toVer.netTrophies;

    const { verdict, summary } = buildImpactVerdictAndSummary({
      fromVersionLabel: fromVer.versionLabel,
      toVersionLabel: toVer.versionLabel,
      swaps,
      beforeBattles: fromVer.battles,
      beforeWinRate,
      afterBattles: toVer.battles,
      afterWinRate,
      winRateDelta,
      trophyDelta,
    });

    coveredTargetKeys.add(toVer.deckKey);

    impacts.push({
      fromVersionLabel: fromVer.versionLabel,
      toVersionLabel: toVer.versionLabel,
      fromDeck: fromVer.cards,
      toDeck: toVer.cards,
      swaps,
      source:
        toVer.isCurrentActiveDeck &&
        toVer.battles === 0 &&
        matched.source === "battle-log-transition"
          ? "player-custom"
          : matched.source,
      matchedSuggestionId: matched.matchedSuggestionId,
      beforeBattles: fromVer.battles,
      beforeWinRate,
      afterBattles: toVer.battles,
      afterWinRate,
      winRateDelta,
      trophyDelta,
      verdict,
      summary,
    });
  }

  // Also check if a single version in deckVersions matches a stored suggestion
  // where the baseline deck aged out of the 25-battle log window.
  for (const version of chronological) {
    if (coveredTargetKeys.has(version.deckKey)) continue;
    for (const suggestion of suggestionHistory) {
      if (suggestion.recommendedSwaps.length === 0) continue;
      if (deckKeyOf(suggestion.recommendedDeck) !== version.deckKey) continue;

      const swaps = diffDeckCards(suggestion.baselineDeck, version.cards);
      if (swaps.length === 0) continue;

      const beforeWinRate = suggestion.baselineWinRate;
      const afterWinRate = version.winRate;
      const winRateDelta =
        version.battles > 0
          ? Math.round((afterWinRate - beforeWinRate) * 10) / 10
          : 0;
      const trophyDelta = version.netTrophies;

      const { verdict, summary } = buildImpactVerdictAndSummary({
        fromVersionLabel: "Baseline",
        toVersionLabel: version.versionLabel,
        swaps,
        beforeBattles: 3,
        beforeWinRate,
        afterBattles: version.battles,
        afterWinRate,
        winRateDelta,
        trophyDelta,
      });

      coveredTargetKeys.add(version.deckKey);
      impacts.push({
        fromVersionLabel: "Baseline",
        toVersionLabel: version.versionLabel,
        fromDeck: suggestion.baselineDeck,
        toDeck: version.cards,
        swaps,
        source: "advisor-full",
        matchedSuggestionId: suggestion.id,
        beforeBattles: 3,
        beforeWinRate,
        afterBattles: version.battles,
        afterWinRate,
        winRateDelta,
        trophyDelta,
        verdict,
        summary,
      });
      break;
    }
  }

  // Check if currentDeckNames differs from the latest played version when not already covered
  if (currentDeckNames.length === 8) {
    const currentKey = deckKeyOf(currentDeckNames);
    const latestPlayed = [...chronological]
      .reverse()
      .find((v) => v.battles > 0);
    if (
      latestPlayed &&
      latestPlayed.deckKey !== currentKey &&
      !coveredTargetKeys.has(currentKey)
    ) {
      const swaps = diffDeckCards(latestPlayed.cards, currentDeckNames);
      if (swaps.length >= 1 && swaps.length <= 4) {
        const matched = matchSuggestionForTransition(
          latestPlayed.cards,
          currentDeckNames,
          swaps,
          suggestionHistory,
        );
        const { verdict, summary } = buildImpactVerdictAndSummary({
          fromVersionLabel: latestPlayed.versionLabel,
          toVersionLabel: "Active",
          swaps,
          beforeBattles: latestPlayed.battles,
          beforeWinRate: latestPlayed.winRate,
          afterBattles: 0,
          afterWinRate: 0,
          winRateDelta: 0,
          trophyDelta: 0,
        });
        impacts.push({
          fromVersionLabel: latestPlayed.versionLabel,
          toVersionLabel: "Active",
          fromDeck: latestPlayed.cards,
          toDeck: currentDeckNames,
          swaps,
          source:
            matched.source === "battle-log-transition"
              ? "player-custom"
              : matched.source,
          matchedSuggestionId: matched.matchedSuggestionId,
          beforeBattles: latestPlayed.battles,
          beforeWinRate: latestPlayed.winRate,
          afterBattles: 0,
          afterWinRate: 0,
          winRateDelta: 0,
          trophyDelta: 0,
          verdict,
          summary,
        });
      }
    }
  }

  return impacts
    .map((impact, index) => ({ impact, index }))
    .sort(
      (left, right) =>
        versionRank(right.impact.toVersionLabel) -
          versionRank(left.impact.toVersionLabel) || right.index - left.index,
    )
    .map(({ impact }) => impact);
}

/** "Active" is the equipped deck, so it outranks every played version. */
function versionRank(label: string): number {
  if (label === "Active") return Number.MAX_SAFE_INTEGER;
  return Number.parseInt(label.replace(/\D/g, ""), 10) || 0;
}
