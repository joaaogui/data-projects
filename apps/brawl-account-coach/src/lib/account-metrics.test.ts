import { describe, expect, it } from "vitest";

import { deriveAccountMetrics } from "./account-metrics";
import type {
  BattleLog,
  BrawlerCatalogItem,
  PlayerProfile,
} from "./types";

const brawler = (
  id: number,
  name: string,
  power: number,
  trophies: number,
  highestTrophies: number,
) => ({
  id,
  name,
  power,
  rank: 20,
  trophies,
  highestTrophies,
  gadgets: [],
  starPowers: [],
  gears: [],
  hyperCharges: [],
});

const player: PlayerProfile = {
  tag: "#Y0GLCU0GL",
  name: "Account Coach",
  trophies: 2_000,
  highestTrophies: 2_300,
  expLevel: 100,
  "3vs3Victories": 600,
  soloVictories: 90,
  duoVictories: 70,
  club: { tag: "#CLUB", name: "Training Room" },
  brawlers: [
    brawler(16_000_000, "SHELLY", 11, 400, 800),
    brawler(16_000_001, "COLT", 10, 800, 900),
    brawler(16_000_002, "JESSIE", 8, 500, 550),
    brawler(16_000_003, "POCO", 1, 300, 300),
  ],
};

const catalog: BrawlerCatalogItem[] = [
  ...player.brawlers.map((entry) => ({
    id: entry.id,
    name: entry.name,
    gadgets: [],
    starPowers: [],
    gears: [],
    hyperCharges: [],
  })),
  {
    id: 16_000_004,
    name: "NITA",
    gadgets: [],
    starPowers: [],
    gears: [],
    hyperCharges: [],
  },
];

const participant = (name: string, tag = "#Y0GLCU0GL") => ({
  tag,
  name: tag === "#Y0GLCU0GL" ? "Account Coach" : "Opponent",
  brawler: {
    id: name === "SHELLY" ? 16_000_000 : 16_000_001,
    name,
    power: 11,
    trophies: 400,
  },
});

const battleLog: BattleLog = {
  items: [
    {
      battleTime: "20260913T220000.000Z",
      event: { id: 1, mode: "gemGrab", map: "Hard Rock Mine" },
      battle: {
        mode: "gemGrab",
        type: "ranked",
        result: "victory",
        trophyChange: 8,
        teams: [
          [participant("SHELLY")],
          [participant("COLT", "#OPPONENT1")],
        ],
      },
    },
    {
      battleTime: "20260913T210000.000Z",
      event: { id: 1, mode: "gemGrab", map: "Hard Rock Mine" },
      battle: {
        mode: "gemGrab",
        type: "ranked",
        result: "defeat",
        trophyChange: -7,
        teams: [
          [participant("SHELLY")],
          [participant("COLT", "#OPPONENT2")],
        ],
      },
    },
    {
      battleTime: "20260913T200000.000Z",
      event: { id: 2, mode: "brawlBall", map: "Super Beach" },
      battle: {
        mode: "brawlBall",
        type: "ranked",
        result: "victory",
        trophyChange: 8,
        teams: [
          [participant("COLT")],
          [participant("SHELLY", "#OPPONENT3")],
        ],
      },
    },
  ],
};

describe("deriveAccountMetrics", () => {
  it("calculates roster completion and power distribution", () => {
    const metrics = deriveAccountMetrics(player, battleLog, catalog);

    expect(metrics.rosterCompletion).toEqual({
      owned: 4,
      total: 5,
      percentage: 80,
    });
    expect(metrics.powerDistribution).toEqual([
      { power: 1, count: 1, percentage: 25 },
      { power: 8, count: 1, percentage: 25 },
      { power: 10, count: 1, percentage: 25 },
      { power: 11, count: 1, percentage: 25 },
    ]);
  });

  it("calculates trophy efficiency against each brawler's peak", () => {
    const metrics = deriveAccountMetrics(player, battleLog, catalog);

    expect(metrics.trophyEfficiency).toEqual({
      currentTotal: 2_000,
      peakTotal: 2_550,
      peakRetentionPercentage: 78.4,
      averageTrophies: 500,
      medianTrophies: 450,
    });
  });

  it("finds high-power brawlers with meaningful push headroom", () => {
    const metrics = deriveAccountMetrics(player, battleLog, catalog);

    expect(metrics.underPushedBrawlers).toEqual([
      expect.objectContaining({
        name: "SHELLY",
        power: 11,
        trophies: 400,
        gapToPeak: 400,
      }),
    ]);
  });

  it("groups recent results into deterministic mode trends", () => {
    const metrics = deriveAccountMetrics(player, battleLog, catalog);

    expect(metrics.recentTrend).toMatchObject({
      battles: 3,
      wins: 2,
      losses: 1,
      draws: 0,
      winRate: 66.7,
      netTrophies: 9,
    });
    expect(metrics.recentTrend.byMode).toEqual([
      {
        mode: "gemGrab",
        battles: 2,
        wins: 1,
        losses: 1,
        draws: 0,
        winRate: 50,
        netTrophies: 1,
      },
      {
        mode: "brawlBall",
        battles: 1,
        wins: 1,
        losses: 0,
        draws: 0,
        winRate: 100,
        netTrophies: 8,
      },
    ]);
  });

  it("keeps percentage-style metrics within 0–100", () => {
    const metrics = deriveAccountMetrics(player, battleLog, catalog);

    expect(metrics.rosterCompletion.percentage).toBeGreaterThanOrEqual(0);
    expect(metrics.rosterCompletion.percentage).toBeLessThanOrEqual(100);
    expect(metrics.trophyEfficiency.peakRetentionPercentage).toBeGreaterThanOrEqual(0);
    expect(metrics.trophyEfficiency.peakRetentionPercentage).toBeLessThanOrEqual(100);
    expect(metrics.recentTrend.winRate).toBeGreaterThanOrEqual(0);
    expect(metrics.recentTrend.winRate).toBeLessThanOrEqual(100);

    for (const bucket of metrics.powerDistribution) {
      expect(bucket.percentage).toBeGreaterThanOrEqual(0);
      expect(bucket.percentage).toBeLessThanOrEqual(100);
    }
    for (const modeTrend of metrics.recentTrend.byMode) {
      expect(modeTrend.winRate).toBeGreaterThanOrEqual(0);
      expect(modeTrend.winRate).toBeLessThanOrEqual(100);
    }
  });
});
