import {
  NEGATIVE_SIGNAL_KEYS,
  POSITIVE_SIGNAL_KEYS,
  legacySignalKey,
  signalLabel,
} from "@data-projects/housing-contract";
import { describe, expect, it } from "vitest";
import { ensureSignalKeysAndLabels, hasNegativeSignal, hasPositiveSignal } from "./listing-signals";

describe("listing signals", () => {
  it("maps every contract label back to its key", () => {
    for (const key of [...POSITIVE_SIGNAL_KEYS, ...NEGATIVE_SIGNAL_KEYS]) {
      expect(legacySignalKey(signalLabel(key, 2016))).toBe(key);
    }
  });

  it("reads keys when present and falls back to legacy labels", () => {
    expect(hasPositiveSignal({ positiveSignalKeys: ["SPLIT_AC"], positiveSignals: [] }, "SPLIT_AC")).toBe(true);
    expect(hasPositiveSignal({ positiveSignals: ["Construção 2012"] }, "CONSTRUCTION_2010S")).toBe(true);
    expect(hasPositiveSignal({ positiveSignals: ["Construção anos 2000 (2004)"] }, "CONSTRUCTION_2010S")).toBe(false);
    expect(hasNegativeSignal({ negativeSignals: ["Sem elevador", "texto livre"] }, "NO_ELEVATOR")).toBe(true);
  });

  it("derives display labels for key-only records", () => {
    const rec = ensureSignalKeysAndLabels({
      constructionYear: 2019,
      positiveSignalKeys: ["CONSTRUCTION_RECENT", "MODERN_FLOORING"],
      negativeSignalKeys: [],
    } as Parameters<typeof ensureSignalKeysAndLabels>[0]);
    expect(rec.positiveSignals).toEqual(["Construção recente (2019)", "Porcelanato / Vinílico"]);
    expect(rec.negativeSignals).toEqual([]);
  });
});
