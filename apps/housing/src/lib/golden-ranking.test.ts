import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  GOLDEN_NOW,
  GOLDEN_WEIGHT_SETS,
  computeGoldenRows,
  type GoldenInput,
  type GoldenRow,
} from "@/lib/__fixtures__/golden";

const FIXTURE_DIR = join(__dirname, "__fixtures__");
const readFixture = <T,>(name: string): T =>
  JSON.parse(readFileSync(join(FIXTURE_DIR, name), "utf8")) as T;

const input = readFixture<GoldenInput>("golden-listings.json");
const expected = readFixture<Record<string, GoldenRow[]>>("golden-expected.json");

// Intentional ranking changes: `corepack pnpm exec tsx scripts/update-golden.ts`, then review the diff.
describe("golden ranking fixture", () => {
  let actual: Record<string, GoldenRow[]>;

  beforeAll(() => {
    vi.useFakeTimers({ now: new Date(GOLDEN_NOW), toFake: ["Date"] });
    actual = computeGoldenRows(input);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it.each(GOLDEN_WEIGHT_SETS.map((s) => s.id))("matches the expected ranking for %s", (id) => {
    expect(actual[id]).toEqual(expected[id]);
  });

  it("covers every weight set in the expected file", () => {
    expect(Object.keys(expected).sort()).toEqual(GOLDEN_WEIGHT_SETS.map((s) => s.id).sort());
  });

  it("carries no contact data", () => {
    const raw = readFileSync(join(FIXTURE_DIR, "golden-listings.json"), "utf8");
    expect(raw).not.toMatch(/[\w.+-]+@[\w-]+\.[a-z]{2,}/i);
    expect(raw).not.toMatch(/@[\w.]{3,}/);
    expect(raw).not.toMatch(/\bCRECI\b[^\\,;)]*?\d/i);
    expect(raw).not.toMatch(/\(?\b\d{2}\)?[\s.-]*9?\d{4}[\s.-]\d{4}\b/);
    expect(raw).not.toMatch(/"(?:advertiser|phone|whatsapp|email)"\s*:/i);
  });
});
