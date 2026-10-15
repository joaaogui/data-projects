import { describe, expect, it } from "vitest";

import {
  MAX_ANALYSIS_REQUEST_BYTES,
  parseAnalysisRequestBody,
} from "./analysis-request";
import { MAX_STORED_BATTLES, type StoredBattle } from "./schemas";

const DECK = [
  "Knight",
  "Archers",
  "Fireball",
  "The Log",
  "Hog Rider",
  "Musketeer",
  "Ice Spirit",
  "Cannon",
];

function battle(index: number): StoredBattle {
  return {
    battleTime: `20260919T1${String(index % 100).padStart(2, "0")}000.000Z`,
    type: "PvP",
    gameModeName: "Ladder",
    playerCrowns: 1,
    opponentCrowns: 0,
    trophyChange: 30,
    playerDeck: DECK,
    opponentName: "Rival",
    opponentTag: `#OPP${index}`,
    opponentDeck: DECK,
  };
}

describe("parseAnalysisRequestBody", () => {
  it("falls back to defaults for an empty body", () => {
    const result = parseAnalysisRequestBody("");
    expect(result).toEqual({
      ok: true,
      value: { mode: "improve", refresh: false, battleHistory: [] },
    });
  });

  it("accepts feedback and a saved battle history", () => {
    const result = parseAnalysisRequestBody(
      JSON.stringify({
        mode: "best",
        refresh: true,
        feedback: {
          lockedCards: ["Knight"],
          excludedCards: [],
          suggestionHistory: [],
        },
        battleHistory: [battle(1), battle(2)],
        unexpected: "ignored",
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mode).toBe("best");
    expect(result.value.refresh).toBe(true);
    expect(result.value.feedback?.lockedCards).toEqual(["Knight"]);
    expect(result.value.battleHistory).toHaveLength(2);
    expect(result.value).not.toHaveProperty("unexpected");
  });

  it("rejects malformed JSON", () => {
    const result = parseAnalysisRequestBody("{not json");
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      code: "INVALID_REQUEST",
    });
  });

  it("rejects a battle whose deck is not eight cards and reports where", () => {
    const broken = { ...battle(1), playerDeck: DECK.slice(0, 7) };
    const result = parseAnalysisRequestBody(
      JSON.stringify({ battleHistory: [broken] }),
    );

    expect(result).toMatchObject({ ok: false, status: 400 });
    if (result.ok) return;
    expect(result.issues?.[0]).toMatch(/^battleHistory\.0\.playerDeck/);
  });

  it("rejects an unknown mode", () => {
    const result = parseAnalysisRequestBody(JSON.stringify({ mode: "chaos" }));
    expect(result).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
  });

  it("rejects more battles than the browser is allowed to keep", () => {
    const history = Array.from({ length: MAX_STORED_BATTLES + 1 }, (_, index) =>
      battle(index),
    );
    const result = parseAnalysisRequestBody(
      JSON.stringify({ battleHistory: history }),
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("accepts a full history well inside the byte cap", () => {
    const history = Array.from({ length: MAX_STORED_BATTLES }, (_, index) =>
      battle(index),
    );
    const body = JSON.stringify({ battleHistory: history });

    expect(body.length).toBeLessThan(MAX_ANALYSIS_REQUEST_BYTES / 2);
    expect(parseAnalysisRequestBody(body).ok).toBe(true);
  });

  it("rejects bodies over the byte cap before parsing them", () => {
    const body = JSON.stringify({
      padding: "x".repeat(MAX_ANALYSIS_REQUEST_BYTES),
    });
    expect(parseAnalysisRequestBody(body)).toMatchObject({
      ok: false,
      status: 413,
      code: "PAYLOAD_TOO_LARGE",
    });
  });
});
