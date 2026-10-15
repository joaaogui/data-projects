import { describe, expect, it } from "vitest";

import {
  battleIdentity,
  fromStoredBattle,
  mergeBattleHistory,
  toStoredBattle,
} from "./battle-history";
import {
  buildDeckVersions,
  deckKeyOf,
  evaluateDeckChangeImpacts,
} from "./learning-engine";
import type { StoredBattle } from "./schemas";

const DECK_OLD = [
  "Skeleton Barrel",
  "Goblin Gang",
  "Skeleton Army",
  "Minion Horde",
  "Wizard",
  "Golden Knight",
  "Fireball",
  "P.E.K.K.A",
];

const DECK_NEW = DECK_OLD.map((card) =>
  card === "Minion Horde" ? "Minions" : card,
);

const OPPONENT_DECK = [
  "Hog Rider",
  "Musketeer",
  "Ice Golem",
  "Cannon",
  "Skeletons",
  "Ice Spirit",
  "The Log",
  "Fireball",
];

function battleTimeAt(day: number, minute: number): string {
  const dd = String(day).padStart(2, "0");
  const hh = String(Math.floor(minute / 60)).padStart(2, "0");
  const mm = String(minute % 60).padStart(2, "0");
  return `202609${dd}T${hh}${mm}00.000Z`;
}

function storedBattle(
  overrides: Partial<StoredBattle> & { battleTime: string },
): StoredBattle {
  return {
    type: "PvP",
    gameModeName: "Ladder",
    playerCrowns: 1,
    opponentCrowns: 0,
    trophyChange: 30,
    playerDeck: DECK_OLD,
    opponentName: "Rival",
    opponentTag: "#OPP1",
    opponentDeck: OPPONENT_DECK,
    ...overrides,
  };
}

describe("battle-history", () => {
  it("identifies a battle by time and opponent tag regardless of tag formatting", () => {
    const time = battleTimeAt(19, 600);
    expect(battleIdentity({ battleTime: time, opponentTag: "#abc123" })).toBe(
      battleIdentity({ battleTime: time, opponentTag: "ABC123" }),
    );
  });

  it("dedupes merged lists, keeps the first copy, and sorts newest first", () => {
    const fresh = [
      storedBattle({ battleTime: battleTimeAt(19, 600), trophyChange: 31 }),
      storedBattle({ battleTime: battleTimeAt(19, 590) }),
    ];
    const saved = [
      storedBattle({
        battleTime: battleTimeAt(19, 600),
        opponentTag: "OPP1",
        trophyChange: -5,
      }),
      storedBattle({ battleTime: battleTimeAt(18, 100) }),
      storedBattle({ battleTime: battleTimeAt(19, 600), opponentTag: "#OPP2" }),
    ];

    const merged = mergeBattleHistory([fresh, saved]);

    expect(merged).toHaveLength(4);
    expect(merged.map((battle) => battle.battleTime)).toEqual([
      battleTimeAt(19, 600),
      battleTimeAt(19, 600),
      battleTimeAt(19, 590),
      battleTimeAt(18, 100),
    ]);
    const duplicate = merged.find(
      (battle) =>
        battle.battleTime === battleTimeAt(19, 600) &&
        battle.opponentTag.endsWith("OPP1"),
    );
    expect(duplicate?.trophyChange).toBe(31);
  });

  it("drops battles with unreadable timestamps and caps the history", () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      storedBattle({ battleTime: battleTimeAt(10, index), opponentTag: `#T${index}` }),
    );
    const merged = mergeBattleHistory(
      [[storedBattle({ battleTime: "not-a-time" })], many],
      5,
    );

    expect(merged).toHaveLength(5);
    expect(merged[0]?.battleTime).toBe(battleTimeAt(10, 11));
    expect(merged.some((battle) => battle.battleTime === "not-a-time")).toBe(
      false,
    );
  });

  it("recomputes derived fields from a stored battle instead of trusting the client", () => {
    const stored = storedBattle({
      battleTime: battleTimeAt(19, 600),
      playerCrowns: 0,
      opponentCrowns: 2,
      trophyChange: -29,
    });

    const normalized = fromStoredBattle(stored);

    expect(normalized.outcome).toBe("loss");
    expect(normalized.crownDiff).toBe(-2);
    expect(normalized.deckKey).toBe(deckKeyOf(DECK_OLD));
    expect(normalized.opponentArchetype).toBe("Hog Cycle");
    expect(normalized.timestampMs).toBeGreaterThan(0);
    expect(normalized.isLadderOrRanked).toBe(true);
    expect(toStoredBattle(normalized)).toEqual(stored);
  });

  it("lets before/after impacts see battles older than the live 25-battle window", () => {
    // 30 saved battles with the old deck (10W-20L) followed by 25 live battles with the new deck (15W-10L).
    const saved = Array.from({ length: 30 }, (_, index) =>
      storedBattle({
        battleTime: battleTimeAt(10, index),
        opponentTag: `#OLD${index}`,
        playerDeck: DECK_OLD,
        playerCrowns: index % 3 === 0 ? 1 : 0,
        opponentCrowns: index % 3 === 0 ? 0 : 1,
      }),
    );
    const live = Array.from({ length: 25 }, (_, index) =>
      storedBattle({
        battleTime: battleTimeAt(11, index),
        opponentTag: `#NEW${index}`,
        playerDeck: DECK_NEW,
        playerCrowns: index < 15 ? 1 : 0,
        opponentCrowns: index < 15 ? 0 : 1,
      }),
    );

    const liveOnly = buildDeckVersions(live.map(fromStoredBattle), DECK_NEW);
    expect(evaluateDeckChangeImpacts(liveOnly, [], DECK_NEW)).toHaveLength(0);

    const history = mergeBattleHistory([live, saved]).map(fromStoredBattle);
    const versions = buildDeckVersions(history, DECK_NEW);
    const impacts = evaluateDeckChangeImpacts(versions, [], DECK_NEW);

    expect(impacts).toHaveLength(1);
    expect(impacts[0]?.swaps).toEqual([{ out: "Minion Horde", in: "Minions" }]);
    expect(impacts[0]?.beforeBattles).toBe(30);
    expect(impacts[0]?.beforeWinRate).toBeCloseTo(33.3, 1);
    expect(impacts[0]?.afterBattles).toBe(25);
    expect(impacts[0]?.afterWinRate).toBe(60);
    expect(impacts[0]?.verdict).toBe("helped");
  });
});
