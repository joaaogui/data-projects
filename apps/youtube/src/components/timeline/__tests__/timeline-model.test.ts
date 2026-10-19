import { describe, expect, it } from "vitest";
import { formatGap } from "../timeline-model";

describe("formatGap", () => {
  it.each([
    [0, "same day"],
    [1, "+1d"],
    [6, "+6d"],
    [44, "+44d"],
    [45, "+2 mo"],
    [729, "+24 mo"],
    [730, "+2.0 y"],
  ])("formats %i days as %s", (days, expected) => {
    expect(formatGap(days)).toBe(expected);
  });
});
