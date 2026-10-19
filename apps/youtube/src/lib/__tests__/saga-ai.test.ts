import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock("@/db/schema", () => ({
  transcripts: { videoId: "videoId", excerpt: "excerpt", fullText: "fullText" },
}));

vi.mock("@/lib/ai-providers", () => ({
  extractJsonObject: vi.fn(),
  getModel: vi.fn(),
}));

vi.mock("@/lib/transcript", () => ({
  fetchTranscriptBatch: vi.fn(),
}));

vi.mock("@data-projects/shared/logger", () => ({
  createTaggedLogger: () => ({
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("drizzle-orm", () => ({
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

import { hasMoneyAmount } from "../saga-ai";

describe("hasMoneyAmount", () => {
  it.each([
    ["10 mil", true],
    ["100 reais", true],
    ["1.500 reais", true],
    ["2.5 mil", true],
    ["custou 250 mil reais", true],
    ["10mil", true],
    [".5 mil", true],
    ["10. mil", true],
  ])("returns true for digit token before money word: %s", (input, expected) => {
    expect(hasMoneyAmount(input)).toBe(expected);
  });

  it("returns false for a dot-only token (token needs a digit)", () => {
    expect(hasMoneyAmount(". mil")).toBe(false);
    expect(hasMoneyAmount("... reais")).toBe(false);
    expect(hasMoneyAmount("..  mil")).toBe(false);
  });

  it.each([
    "1.. mil",
    "1..2 mil",
    "1..2 reais",
    "..1.. mil",
  ])("returns true when the digit/dot token contains a digit: %s", (input) => {
    expect(hasMoneyAmount(input)).toBe(true);
  });

  it.each([
    "10 MIL",
    "10 Mil",
    "10 Reais",
    "10 REAIS",
    "10 MiL",
    "7 rEaIs",
  ])("is case-insensitive for the money word: %s", (input) => {
    expect(hasMoneyAmount(input)).toBe(true);
  });

  it("requires a whole-word boundary after the money word", () => {
    expect(hasMoneyAmount("10 milhoes")).toBe(false);
    expect(hasMoneyAmount("10 milhões")).toBe(false);
    expect(hasMoneyAmount("milreais")).toBe(false);
    expect(hasMoneyAmount("10 milreais")).toBe(false);
    expect(hasMoneyAmount("10 reaisx")).toBe(false);
  });

  it("returns false for a bare money word with no preceding token", () => {
    expect(hasMoneyAmount("mil")).toBe(false);
    expect(hasMoneyAmount("reais")).toBe(false);
    expect(hasMoneyAmount("  mil")).toBe(false);
    expect(hasMoneyAmount("dez mil")).toBe(false);
    expect(hasMoneyAmount("abc reais")).toBe(false);
  });

  it("accepts tab and newline separators between token and money word", () => {
    expect(hasMoneyAmount("10\tmil")).toBe(true);
    expect(hasMoneyAmount("10\nreais")).toBe(true);
    expect(hasMoneyAmount("10 \t\n mil")).toBe(true);
    expect(hasMoneyAmount("10\r\nreais")).toBe(true);
  });

  it("returns false when the separator run is not preceded by a digit token", () => {
    expect(hasMoneyAmount("\t\n mil")).toBe(false);
    expect(hasMoneyAmount("palavra\tmil")).toBe(false);
  });

  it("checks later occurrences when an earlier one has no digit token", () => {
    expect(hasMoneyAmount("mil e depois 20 reais")).toBe(true);
    expect(hasMoneyAmount("... mil, abc reais")).toBe(false);
  });

  it("returns false for empty and unrelated input", () => {
    expect(hasMoneyAmount("")).toBe(false);
    expect(hasMoneyAmount("nenhum valor aqui")).toBe(false);
    expect(hasMoneyAmount("12345")).toBe(false);
  });

  it("completes on a long digit-run input", () => {
    const input = `${"9".repeat(100_000)} mil`;
    expect(hasMoneyAmount(input)).toBe(true);
  });

  it("completes on a long dot-only run without a digit", () => {
    const input = `${".".repeat(100_000)} mil`;
    expect(hasMoneyAmount(input)).toBe(false);
  });
});
