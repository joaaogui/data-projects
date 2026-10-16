import { describe, expect, it } from "vitest";
import {
  median,
  normalizeKey,
  toggleExclusiveListItem,
} from "./utils";

describe("median", () => {
  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });

  it("returns the single element for array of length 1", () => {
    expect(median([42])).toBe(42);
  });

  it("returns the middle element for odd-length array", () => {
    expect(median([3, 1, 2])).toBe(2);
  });

  it("returns the average of two middle elements for even-length array", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("handles already sorted and unsorted inputs", () => {
    expect(median([10, 20, 30, 40, 50])).toBe(30);
    expect(median([50, 10, 40, 20, 30])).toBe(30);
  });

  it("handles duplicate values and does not mutate input", () => {
    expect(median([5, 5, 5])).toBe(5);
    const arr = [3, 1, 2];
    median(arr);
    expect(arr).toEqual([3, 1, 2]);
  });
});

describe("normalizeKey", () => {
  it("uppercases and strips punctuation and whitespace", () => {
    expect(normalizeKey("  El Primo! ")).toBe("ELPRIMO");
    expect(normalizeKey("8-Bit")).toBe("8BIT");
  });
});

describe("toggleExclusiveListItem", () => {
  it("adds to primary, removes from secondary, and enforces maxItems", () => {
    const [primary, secondary] = toggleExclusiveListItem(
      ["A"],
      ["b"],
      "B",
      2,
    );
    expect(primary).toEqual(["A", "B"]);
    expect(secondary).toEqual([]);

    const [toggledOff] = toggleExclusiveListItem(primary, secondary, "a", 2);
    expect(toggledOff).toEqual(["B"]);
  });
});
