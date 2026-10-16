import { describe, expect, it } from "vitest";
import {
  formatCompact,
  formatNumber,
  formatSigned,
  getAgeLabel,
} from "./format";

describe("formatCompact", () => {
  it("returns '-' for null, undefined, or NaN", () => {
    expect(formatCompact(null)).toBe("-");
    expect(formatCompact(undefined)).toBe("-");
    expect(formatCompact(Number.NaN)).toBe("-");
  });

  it("returns '0' for 0", () => {
    expect(formatCompact(0)).toBe("0");
  });

  it("returns locale string for values under 1000", () => {
    expect(formatCompact(999)).toBe("999");
  });

  it("formats 1000 as 1.0K", () => {
    expect(formatCompact(1000)).toBe("1.0K");
  });

  it("formats 1500 as 1.5K", () => {
    expect(formatCompact(1500)).toBe("1.5K");
  });

  it("formats 999_999 as 1000.0K", () => {
    expect(formatCompact(999_999)).toBe("1000.0K");
  });

  it("formats 1_000_000 as 1.0M", () => {
    expect(formatCompact(1_000_000)).toBe("1.0M");
  });

  it("formats 2_500_000 as 2.5M", () => {
    expect(formatCompact(2_500_000)).toBe("2.5M");
  });
});

describe("formatNumber", () => {
  it("returns '-' for null, undefined, or NaN", () => {
    expect(formatNumber(null)).toBe("-");
    expect(formatNumber(undefined)).toBe("-");
    expect(formatNumber(Number.NaN)).toBe("-");
  });

  it("formats 0", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats small numbers without separators", () => {
    expect(formatNumber(42)).toBe("42");
  });

  it("formats thousands with comma separator", () => {
    expect(formatNumber(1234)).toBe("1,234");
  });

  it("formats millions", () => {
    expect(formatNumber(1_234_567)).toBe("1,234,567");
  });
});

describe("formatSigned", () => {
  it("formats positive, negative, and zero values", () => {
    expect(formatSigned(1450)).toBe("+1,450");
    expect(formatSigned(-120)).toBe("−120");
    expect(formatSigned(0)).toBe("0");
  });
});

describe("getAgeLabel", () => {
  it("returns 'Today' for 0 days", () => {
    expect(getAgeLabel(0)).toBe("Today");
  });

  it("returns 'Yesterday' for 1 day", () => {
    expect(getAgeLabel(1)).toBe("Yesterday");
  });

  it("returns days format for values between 2 and 364", () => {
    expect(getAgeLabel(30)).toBe("30d");
    expect(getAgeLabel(364)).toBe("364d");
  });

  it("returns year format for >= 365 days", () => {
    expect(getAgeLabel(365)).toBe("1.0y");
    expect(getAgeLabel(548)).toBe("1.5y");
    expect(getAgeLabel(730)).toBe("2.0y");
  });
});
