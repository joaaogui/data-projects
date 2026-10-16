import { describe, it, expect } from "vitest";
import {
  getScoreColorClass,
  getScoreBorderClass,
  getEngagementColor,
  getEfficiencyColor,
} from "@/lib/format";

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
