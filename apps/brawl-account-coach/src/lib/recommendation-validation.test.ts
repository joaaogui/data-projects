import { describe, expect, it } from "vitest";

import { validateRecommendations } from "./recommendation-validation";
import type {
  BrawlerCatalogItem,
  NamedItem,
  PlayerProfile,
} from "./types";

const item = (id: number, name: string): NamedItem => ({ id, name });

const shellyCatalog: BrawlerCatalogItem = {
  id: 16_000_000,
  name: "SHELLY",
  gadgets: [item(1, "FAST FORWARD"), item(2, "CLAY PIGEONS")],
  starPowers: [item(3, "SHELL SHOCK"), item(4, "BAND-AID")],
  gears: [item(5, "SPEED"), item(6, "DAMAGE"), item(7, "GADGET CHARGE")],
  hyperCharges: [item(8, "DOUBLE BARREL")],
};

const coltCatalog: BrawlerCatalogItem = {
  id: 16_000_001,
  name: "COLT",
  gadgets: [item(9, "SPEEDLOADER")],
  starPowers: [item(10, "SLICK BOOTS")],
  gears: [item(11, "SHIELD")],
  hyperCharges: [item(12, "DUAL WIELDING")],
};

const player: PlayerProfile = {
  tag: "#Y0GLCU0GL",
  name: "Account Coach",
  trophies: 1_200,
  highestTrophies: 1_300,
  expLevel: 100,
  "3vs3Victories": 600,
  soloVictories: 90,
  duoVictories: 70,
  brawlers: [
    {
      id: shellyCatalog.id,
      name: shellyCatalog.name,
      power: 11,
      rank: 25,
      trophies: 500,
      highestTrophies: 800,
      gadgets: [item(1, "FAST FORWARD")],
      starPowers: [item(3, "SHELL SHOCK")],
      gears: [item(5, "SPEED"), item(7, "GADGET CHARGE")],
      hyperCharges: [item(8, "DOUBLE BARREL")],
    },
    {
      id: coltCatalog.id,
      name: coltCatalog.name,
      power: 9,
      rank: 20,
      trophies: 700,
      highestTrophies: 700,
      gadgets: [],
      starPowers: [],
      gears: [],
      hyperCharges: [],
    },
  ],
};

function validAnalysis() {
  return {
    health: {
      score: 78,
      verdict: "Strong core roster with clear push value.",
    },
    upgradePriorities: [
      {
        brawlerName: "SHELLY",
        currentPower: 11,
        currentTrophies: 500,
        accountImpact: "high" as const,
        reason: "Her owned build is complete and trophies lag her peak.",
      },
    ],
    pushTargets: [
      {
        brawlerName: "SHELLY",
        currentTrophies: 500,
        targetTrophies: 650,
        reason: "Power 11 and an owned Hypercharge support the push.",
      },
    ],
    buildAdvice: [
      {
        brawlerName: "SHELLY",
        gadget: "FAST FORWARD",
        starPower: "SHELL SHOCK",
        gears: ["SPEED", "GADGET CHARGE"],
        hypercharge: "DOUBLE BARREL",
        reason: "Use the mobility setup for close-range control.",
      },
    ],
    battleDiagnosis: [
      {
        brawlerName: "SHELLY",
        mode: "gemGrab",
        map: "Hard Rock Mine",
        outcome: "mixed" as const,
        summary: "Recent results are even.",
        adjustment: "Use side lanes and protect the gem carrier.",
      },
    ],
    avoidForNow: [
      {
        brawlerName: "COLT",
        reason: "The account has no owned build pieces for him yet.",
      },
    ],
    actionPlan: [
      {
        title: "Push Shelly",
        detail: "Play a short Gem Grab set toward 650 trophies.",
      },
      {
        title: "Bank resources",
        detail: "Do not spread coins across low-power brawlers.",
      },
      {
        title: "Review the next snapshot",
        detail: "Use the refreshed battle trend before the next upgrade.",
      },
    ],
  };
}

describe("validateRecommendations", () => {
  it("accepts grounded brawlers and owned build items", () => {
    const result = validateRecommendations(validAnalysis(), player, [
      shellyCatalog,
      coltCatalog,
    ]);

    expect(result.buildAdvice[0]).toMatchObject({
      brawlerName: "SHELLY",
      gadget: "FAST FORWARD",
      starPower: "SHELL SHOCK",
      gears: ["SPEED", "GADGET CHARGE"],
      hypercharge: "DOUBLE BARREL",
    });
  });

  it("rejects a brawler that is not in the owned catalog-backed roster", () => {
    const analysis = validAnalysis();
    analysis.upgradePriorities[0].brawlerName = "SPIKE";

    expect(() =>
      validateRecommendations(analysis, player, [
        shellyCatalog,
        coltCatalog,
      ]),
    ).toThrow("Unknown or unowned brawler: SPIKE");
  });

  it.each([
    ["gadget", "CLAY PIGEONS"],
    ["starPower", "BAND-AID"],
    ["gears", ["DAMAGE"]],
    ["hypercharge", "DUAL WIELDING"],
  ] as const)(
    "rejects a catalog item that the player does not own for %s",
    (field, value) => {
      const analysis = validAnalysis();
      analysis.buildAdvice[0] = {
        ...analysis.buildAdvice[0],
        [field]: value,
      };

      expect(() =>
        validateRecommendations(analysis, player, [
          shellyCatalog,
          coltCatalog,
        ]),
      ).toThrow(/Player does not own/);
    },
  );
});
