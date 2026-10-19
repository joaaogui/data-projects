import { describe, expect, it } from "vitest";

import { commuteUpperBound, nextSort, sortItems, type SortValue } from "./neighborhood-sort";

describe("commuteUpperBound", () => {
  it("reads the upper bound of a range and a single value", () => {
    expect(commuteUpperBound("9-25 min")).toBe(25);
    expect(commuteUpperBound("10–15 min")).toBe(15);
    expect(commuteUpperBound("15 min")).toBe(15);
  });

  it("is null without minutes", () => {
    expect(commuteUpperBound("neutro")).toBeNull();
    expect(commuteUpperBound("")).toBeNull();
  });
});

describe("nextSort", () => {
  it("toggles the same column and starts a new one at its default", () => {
    expect(nextSort({ key: "score", dir: "desc" }, "score", "desc")).toEqual({ key: "score", dir: "asc" });
    expect(nextSort({ key: "score", dir: "asc" }, "score", "desc")).toEqual({ key: "score", dir: "desc" });
    expect(nextSort({ key: "score", dir: "desc" }, "name", "asc")).toEqual({ key: "name", dir: "asc" });
  });
});

describe("sortItems", () => {
  const rows = [
    { rank: 1, v: 3 as SortValue },
    { rank: 2, v: null as SortValue },
    { rank: 3, v: 5 as SortValue },
    { rank: 4, v: 3 as SortValue },
  ];
  const sorted = (dir: "asc" | "desc") =>
    sortItems(rows, { key: "v", dir }, (r) => r.v, (r) => r.rank).map((r) => r.rank);

  it("keeps missing values last in both directions and breaks ties by rank", () => {
    expect(sorted("asc")).toEqual([1, 4, 3, 2]);
    expect(sorted("desc")).toEqual([3, 1, 4, 2]);
  });

  it("compares text in pt-BR order, ignoring accents and case", () => {
    const names = [
      { rank: 1, v: "Savassi" },
      { rank: 2, v: "Águas Claras" },
      { rank: 3, v: "belvedere" },
    ];
    expect(sortItems(names, { key: "v", dir: "asc" }, (r) => r.v, (r) => r.rank).map((r) => r.v)).toEqual([
      "Águas Claras",
      "belvedere",
      "Savassi",
    ]);
  });
});
