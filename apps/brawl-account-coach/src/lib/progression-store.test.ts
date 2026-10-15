import { describe, expect, it } from "vitest";

import {
  clearBrawlerRules,
  computeProgressionSummary,
  emptyProgressionLedger,
  MAX_SNAPSHOTS,
  parseProgressionLedger,
  recordSnapshot,
  toggleExcludedBrawler,
  togglePinnedBrawler,
  type AccountSnapshot,
} from "./progression-store";

function makeSnapshot(
  overrides: Partial<AccountSnapshot> = {},
): AccountSnapshot {
  return {
    recordedAt: "2026-10-12T12:00:00.000Z",
    trophies: 24_000,
    highestTrophies: 24_500,
    brawlers: [
      {
        id: 16_000_000,
        name: "SHELLY",
        power: 11,
        trophies: 700,
        highestTrophies: 800,
        gadgetCount: 1,
        starPowerCount: 1,
        gearCount: 2,
        hyperchargeCount: 1,
      },
      {
        id: 16_000_001,
        name: "GUS",
        power: 9,
        trophies: 520,
        highestTrophies: 600,
        gadgetCount: 1,
        starPowerCount: 1,
        gearCount: 0,
        hyperchargeCount: 0,
      },
      {
        id: 16_000_002,
        name: "COLT",
        power: 10,
        trophies: 650,
        highestTrophies: 700,
        gadgetCount: 1,
        starPowerCount: 1,
        gearCount: 1,
        hyperchargeCount: 0,
      },
    ],
    recommendedUpgrades: ["GUS"],
    recommendedPushes: ["SHELLY"],
    ...overrides,
  };
}

describe("progression-store", () => {
  it("deduplicates snapshots within 15 minutes or with identical roster state", () => {
    const first = makeSnapshot({
      recordedAt: "2026-10-12T12:00:00.000Z",
    });
    const fiveMinutesLater = makeSnapshot({
      recordedAt: "2026-10-12T12:05:00.000Z",
      recommendedPushes: ["COLT"],
    });
    const nextDayIdenticalState = makeSnapshot({
      recordedAt: "2026-10-13T18:00:00.000Z",
      recommendedUpgrades: ["COLT"],
    });

    let ledger = recordSnapshot(emptyProgressionLedger(), first);
    expect(ledger.snapshots).toHaveLength(1);

    ledger = recordSnapshot(ledger, fiveMinutesLater);
    expect(ledger.snapshots).toHaveLength(1);
    expect(ledger.snapshots[0].recommendedPushes).toEqual(["COLT", "SHELLY"]);

    ledger = recordSnapshot(ledger, nextDayIdenticalState);
    expect(ledger.snapshots).toHaveLength(1);
    expect(ledger.snapshots[0].recordedAt).toBe("2026-10-12T12:00:00.000Z");
  });

  it("caps stored snapshots at 30 entries when trophies advance across sessions", () => {
    let ledger = emptyProgressionLedger();
    for (let index = 0; index < 35; index += 1) {
      const hour = String(index).padStart(2, "0");
      ledger = recordSnapshot(
        ledger,
        makeSnapshot({
          recordedAt: new Date(
            Date.UTC(2026, 9, 1 + index, 12, 0, 0),
          ).toISOString(),
          trophies: 24_000 + index * 25,
          brawlers: [
            {
              id: 16_000_000,
              name: "SHELLY",
              power: 11,
              trophies: 700 + index * 5,
              highestTrophies: 800 + index * 5,
              gadgetCount: 1,
              starPowerCount: 1,
              gearCount: 2,
              hyperchargeCount: 1,
            },
          ],
          recommendedPushes: [`PUSH_${hour}`],
        }),
      );
    }

    expect(ledger.snapshots).toHaveLength(MAX_SNAPSHOTS);
    expect(ledger.snapshots[0].trophies).toBe(24_000 + 5 * 25);
    expect(ledger.snapshots.at(-1)?.trophies).toBe(24_000 + 34 * 25);
  });

  it("computes trophy delta, power upgrades, and recommended push gains", () => {
    const baseline = makeSnapshot();
    const current: AccountSnapshot = {
      recordedAt: "2026-10-15T15:00:00.000Z",
      trophies: 24_145,
      highestTrophies: 24_645,
      brawlers: [
        {
          id: 16_000_000,
          name: "SHELLY",
          power: 11,
          trophies: 790,
          highestTrophies: 800,
          gadgetCount: 1,
          starPowerCount: 1,
          gearCount: 2,
          hyperchargeCount: 1,
        },
        {
          id: 16_000_001,
          name: "GUS",
          power: 11,
          trophies: 590,
          highestTrophies: 600,
          gadgetCount: 1,
          starPowerCount: 1,
          gearCount: 2,
          hyperchargeCount: 1,
        },
        {
          id: 16_000_002,
          name: "COLT",
          power: 10,
          trophies: 635,
          highestTrophies: 700,
          gadgetCount: 1,
          starPowerCount: 1,
          gearCount: 1,
          hyperchargeCount: 0,
        },
      ],
      recommendedUpgrades: ["COLT"],
      recommendedPushes: ["GUS"],
    };

    const summary = computeProgressionSummary([baseline, current], current);

    expect(summary.hasBaseline).toBe(true);
    expect(summary.baselineRecordedAt).toBe("2026-10-12T12:00:00.000Z");
    expect(summary.trophyDelta).toBe(145);
    expect(summary.verdict).toBe("gaining");
    expect(summary.followedRecommendationsCount).toBe(2);

    expect(summary.upgradedBrawlers).toEqual([
      expect.objectContaining({
        name: "GUS",
        previousPower: 9,
        currentPower: 11,
        trophyDelta: 70,
        newGears: 2,
        newHypercharges: 1,
        wasRecommendedUpgrade: true,
        label: "GUS P9 → P11",
      }),
    ]);

    expect(summary.brawlerTrophyGains).toEqual([
      expect.objectContaining({
        name: "SHELLY",
        trophyDelta: 90,
        wasRecommendedPush: true,
      }),
      expect.objectContaining({
        name: "GUS",
        trophyDelta: 70,
        wasRecommendedUpgrade: true,
      }),
      expect.objectContaining({
        name: "COLT",
        trophyDelta: -15,
        wasRecommendedPush: false,
      }),
    ]);
  });

  it("returns a clean baseline state on the very first visit", () => {
    const first = makeSnapshot();
    const summary = computeProgressionSummary([first], first);

    expect(summary.hasBaseline).toBe(false);
    expect(summary.verdict).toBe("baseline");
    expect(summary.trophyDelta).toBe(0);
    expect(summary.upgradedBrawlers).toEqual([]);
    expect(summary.brawlerTrophyGains).toEqual([]);
  });

  it("toggles pinned and excluded brawlers mutually exclusively and parses corrupted storage safely", () => {
    let state = emptyProgressionLedger();
    state = togglePinnedBrawler(state, "SHELLY");
    expect(state.pinnedBrawlers).toEqual(["SHELLY"]);

    state = toggleExcludedBrawler(state, "shelly");
    expect(state.pinnedBrawlers).toEqual([]);
    expect(state.excludedBrawlers).toEqual(["shelly"]);

    state = clearBrawlerRules(state);
    expect(state.pinnedBrawlers).toEqual([]);
    expect(state.excludedBrawlers).toEqual([]);

    const recovered = parseProgressionLedger({
      snapshots: [{ invalid: true }, makeSnapshot()],
      pinnedBrawlers: ["GUS"],
      excludedBrawlers: ["COLT"],
    });
    expect(recovered.snapshots).toHaveLength(1);
    expect(recovered.pinnedBrawlers).toEqual(["GUS"]);
    expect(recovered.excludedBrawlers).toEqual(["COLT"]);
  });
});
