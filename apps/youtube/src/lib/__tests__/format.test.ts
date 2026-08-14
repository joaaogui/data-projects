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
  it("returns the accent for score >= 70", () => {
    expect(getScoreColorClass(70)).toBe("bg-data/10 text-data");
    expect(getScoreColorClass(100)).toBe("bg-data/10 text-data");
  });

  it("returns full-weight foreground for score >= 55 and < 70", () => {
    expect(getScoreColorClass(55)).toBe("bg-foreground/[0.08] text-foreground");
    expect(getScoreColorClass(69)).toBe("bg-foreground/[0.08] text-foreground");
  });

  it("returns muted for score >= 40 and < 55", () => {
    expect(getScoreColorClass(40)).toBe("bg-muted text-muted-foreground");
    expect(getScoreColorClass(54)).toBe("bg-muted text-muted-foreground");
  });

  it("fades further for score >= 25 and < 40", () => {
    expect(getScoreColorClass(25)).toBe("bg-muted/60 text-muted-foreground/80");
    expect(getScoreColorClass(39)).toBe("bg-muted/60 text-muted-foreground/80");
  });

  it("is faintest for score < 25", () => {
    expect(getScoreColorClass(24)).toBe("bg-muted/40 text-muted-foreground/60");
    expect(getScoreColorClass(0)).toBe("bg-muted/40 text-muted-foreground/60");
  });
});

describe("getScoreBorderClass", () => {
  it("returns the accent border for score >= 70", () => {
    expect(getScoreBorderClass(70)).toBe("border-l-data/70");
  });

  it("fades through the greyscale ramp as the score drops", () => {
    expect(getScoreBorderClass(55)).toBe("border-l-foreground/40");
    expect(getScoreBorderClass(40)).toBe("border-l-foreground/25");
    expect(getScoreBorderClass(25)).toBe("border-l-foreground/15");
    expect(getScoreBorderClass(0)).toBe("border-l-foreground/[0.08]");
  });
});

describe("getEngagementColor", () => {
  it("returns the accent for rate >= 60", () => {
    expect(getEngagementColor(60)).toBe("text-data");
  });

  it("returns foreground for rate >= 40 and < 60", () => {
    expect(getEngagementColor(40)).toBe("text-foreground");
  });

  it("returns muted for rate >= 20 and < 40", () => {
    expect(getEngagementColor(20)).toBe("text-muted-foreground");
  });

  it("returns faded muted for rate < 20", () => {
    expect(getEngagementColor(19)).toBe("text-muted-foreground/70");
  });
});

describe("getEfficiencyColor", () => {
  it("returns the accent for rate >= 100000", () => {
    expect(getEfficiencyColor(100000)).toBe("text-data");
  });

  it("returns foreground for rate >= 50000 and < 100000", () => {
    expect(getEfficiencyColor(50000)).toBe("text-foreground");
  });

  it("returns muted for rate >= 10000 and < 50000", () => {
    expect(getEfficiencyColor(10000)).toBe("text-muted-foreground");
  });

  it("returns faded muted for rate < 10000", () => {
    expect(getEfficiencyColor(9999)).toBe("text-muted-foreground/70");
  });
});
