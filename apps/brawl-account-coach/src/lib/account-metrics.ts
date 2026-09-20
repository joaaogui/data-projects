import type {
  AccountMetrics,
  BattleEntry,
  BattleLog,
  BattleOutcome,
  BattlePlayer,
  BrawlerCatalogItem,
  ModeTrend,
  PlayerProfile,
  RecentBattleSummary,
} from "./types";

const PORTRAIT_BASE =
  "https://cdn.brawlify.com/brawlers/borderless";

function round(value: number, places = 1): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function percentage(numerator: number, denominator: number): number {
  return denominator > 0 ? round((numerator / denominator) * 100) : 0;
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function normalizedTag(tag: string): string {
  return tag.replace(/^#/, "").trim().toUpperCase();
}

function findPlayer(entry: BattleEntry, playerTag: string): BattlePlayer | null {
  const participants = [
    ...(entry.battle.teams?.flat() ?? []),
    ...(entry.battle.players ?? []),
  ];
  const tag = normalizedTag(playerTag);
  return (
    participants.find(
      (participant) => normalizedTag(participant.tag) === tag,
    ) ?? null
  );
}

function battleOutcome(entry: BattleEntry): BattleOutcome {
  const result = entry.battle.result?.trim().toLowerCase();
  if (result === "victory" || result === "defeat" || result === "draw") {
    return result;
  }

  const trophyChange = entry.battle.trophyChange ?? 0;
  if (trophyChange > 0) {
    return "victory";
  }
  if (trophyChange < 0) {
    return "defeat";
  }
  return "draw";
}

function summarizeBattles(
  battleLog: BattleLog,
  playerTag: string,
): RecentBattleSummary[] {
  return battleLog.items.flatMap((entry) => {
    const player = findPlayer(entry, playerTag);
    if (!player) {
      return [];
    }

    return [
      {
        battleTime: entry.battleTime,
        mode: entry.battle.mode || entry.event.mode || "unknown",
        map: entry.event.map || "Unknown map",
        brawlerName: player.brawler.name,
        result: battleOutcome(entry),
        trophyChange: entry.battle.trophyChange ?? 0,
      },
    ];
  });
}

function emptyTrend(mode?: string): ModeTrend {
  return {
    ...(mode ? { mode } : { mode: "" }),
    battles: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    netTrophies: 0,
  };
}

function addBattle(
  trend: Omit<ModeTrend, "mode">,
  battle: RecentBattleSummary,
) {
  trend.battles += 1;
  trend.netTrophies += battle.trophyChange;
  if (battle.result === "victory") {
    trend.wins += 1;
  } else if (battle.result === "defeat") {
    trend.losses += 1;
  } else {
    trend.draws += 1;
  }
  trend.winRate = percentage(trend.wins, trend.battles);
}

export function deriveAccountMetrics(
  player: PlayerProfile,
  battleLog: BattleLog,
  catalog: BrawlerCatalogItem[],
): AccountMetrics {
  const ownedCount = player.brawlers.length;
  const catalogIds = new Set(catalog.map((brawler) => brawler.id));
  const totalCount = Math.max(
    catalogIds.size,
    new Set(player.brawlers.map((brawler) => brawler.id)).size,
  );

  const powerCounts = new Map<number, number>();
  for (const brawler of player.brawlers) {
    powerCounts.set(brawler.power, (powerCounts.get(brawler.power) ?? 0) + 1);
  }

  const currentTotal = player.brawlers.reduce(
    (total, brawler) => total + brawler.trophies,
    0,
  );
  const peakTotal = player.brawlers.reduce(
    (total, brawler) => total + brawler.highestTrophies,
    0,
  );
  const recentBattles = summarizeBattles(battleLog, player.tag);
  const overallTrend = {
    battles: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    netTrophies: 0,
  };
  const modeTrends = new Map<string, ModeTrend>();

  for (const battle of recentBattles) {
    addBattle(overallTrend, battle);
    const trend = modeTrends.get(battle.mode) ?? emptyTrend(battle.mode);
    addBattle(trend, battle);
    modeTrends.set(battle.mode, trend);
  }

  return {
    rosterCompletion: {
      owned: ownedCount,
      total: totalCount,
      percentage: percentage(ownedCount, totalCount),
    },
    powerDistribution: [...powerCounts.entries()]
      .sort(([left], [right]) => left - right)
      .map(([power, count]) => ({
        power,
        count,
        percentage: percentage(count, ownedCount),
      })),
    trophyEfficiency: {
      currentTotal,
      peakTotal,
      peakRetentionPercentage: percentage(currentTotal, peakTotal),
      averageTrophies:
        ownedCount > 0 ? round(currentTotal / ownedCount) : 0,
      medianTrophies: median(
        player.brawlers.map((brawler) => brawler.trophies),
      ),
    },
    underPushedBrawlers: player.brawlers
      .map((brawler) => ({
        id: brawler.id,
        name: brawler.name,
        power: brawler.power,
        trophies: brawler.trophies,
        highestTrophies: brawler.highestTrophies,
        gapToPeak: Math.max(0, brawler.highestTrophies - brawler.trophies),
        portraitUrl: `${PORTRAIT_BASE}/${brawler.id}.png`,
      }))
      .filter((brawler) => brawler.power >= 9 && brawler.gapToPeak >= 150)
      .sort(
        (left, right) =>
          right.gapToPeak - left.gapToPeak ||
          right.power - left.power ||
          left.name.localeCompare(right.name),
      )
      .slice(0, 5),
    recentBattles,
    recentTrend: {
      ...overallTrend,
      byMode: [...modeTrends.values()],
    },
  };
}
