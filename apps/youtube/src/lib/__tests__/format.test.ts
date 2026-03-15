import { describe, it, expect } from "vitest";
import {
  formatCompact,
  formatNumber,
  getAgeLabel,
  getScoreColorClass,
  getScoreBorderClass,
  getEngagementColor,
  getEfficiencyColor,
} from "@/lib/format";

describe("formatCompact", () => {
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

describe("getAgeLabel", () => {
  it("returns 'Today' for 0 days", () => {
    expect(getAgeLabel(0)).toBe("Today");
  });

  it("returns 'Yesterday' for 1 day", () => {
    expect(getAgeLabel(1)).toBe("Yesterday");
  });

  it("returns days format for values between 2 and 364", () => {
    expect(getAgeLabel(30)).toBe("30d");
  });

  it("formats large day counts with locale separators", () => {
    expect(getAgeLabel(364)).toBe("364d");
  });

  it("returns year format for exactly 365 days", () => {
    expect(getAgeLabel(365)).toBe("1.0y");
  });

  it("returns year format for 730 days", () => {
    expect(getAgeLabel(730)).toBe("2.0y");
  });

  it("returns fractional years", () => {
    expect(getAgeLabel(548)).toBe("1.5y");
  });
});

describe("getScoreColorClass", () => {
  it("returns emerald class for score >= 70", () => {
    expect(getScoreColorClass(70)).toContain("emerald");
    expect(getScoreColorClass(100)).toContain("emerald");
  });

  it("returns teal class for score >= 55 and < 70", () => {
    expect(getScoreColorClass(55)).toContain("teal");
    expect(getScoreColorClass(69)).toContain("teal");
  });

  it("returns amber class for score >= 40 and < 55", () => {
    expect(getScoreColorClass(40)).toContain("amber");
    expect(getScoreColorClass(54)).toContain("amber");
  });

  it("returns orange class for score >= 25 and < 40", () => {
    expect(getScoreColorClass(25)).toContain("orange");
    expect(getScoreColorClass(39)).toContain("orange");
  });

  it("returns red class for score < 25", () => {
    expect(getScoreColorClass(24)).toContain("red");
    expect(getScoreColorClass(0)).toContain("red");
  });
});

describe("getScoreBorderClass", () => {
  it("returns emerald border for score >= 70", () => {
    expect(getScoreBorderClass(70)).toContain("emerald");
  });

  it("returns teal border for score >= 55 and < 70", () => {
    expect(getScoreBorderClass(55)).toContain("teal");
  });

  it("returns amber border for score >= 40 and < 55", () => {
    expect(getScoreBorderClass(40)).toContain("amber");
  });

  it("returns orange border for score >= 25 and < 40", () => {
    expect(getScoreBorderClass(25)).toContain("orange");
  });

  it("returns red border for score < 25", () => {
    expect(getScoreBorderClass(0)).toContain("red");
  });
});

describe("getEngagementColor", () => {
  it("returns emerald for rate >= 60", () => {
    expect(getEngagementColor(60)).toContain("emerald");
  });

  it("returns teal for rate >= 40 and < 60", () => {
    expect(getEngagementColor(40)).toContain("teal");
  });

  it("returns amber for rate >= 20 and < 40", () => {
    expect(getEngagementColor(20)).toContain("amber");
  });

  it("returns muted for rate < 20", () => {
    expect(getEngagementColor(19)).toContain("muted");
  });
});

describe("getEfficiencyColor", () => {
  it("returns emerald for rate >= 100000", () => {
    expect(getEfficiencyColor(100000)).toContain("emerald");
  });

  it("returns teal for rate >= 50000 and < 100000", () => {
    expect(getEfficiencyColor(50000)).toContain("teal");
  });

  it("returns amber for rate >= 10000 and < 50000", () => {
    expect(getEfficiencyColor(10000)).toContain("amber");
  });

  it("returns muted for rate < 10000", () => {
    expect(getEfficiencyColor(9999)).toContain("muted");
  });
});
