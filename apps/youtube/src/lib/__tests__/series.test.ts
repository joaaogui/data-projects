import { describe, it, expect } from "vitest";
import { buildSeriesIndex } from "@/lib/series";
import type { Saga, SagaSource, VideoData } from "@/types/youtube";

function makeVideo(id: string, title: string, isoDate: string): VideoData {
  return {
    videoId: id,
    title,
    publishedAt: isoDate,
    days: 0,
    duration: 0,
    views: 0,
    likes: 0,
    comments: 0,
    favorites: 0,
    score: 0,
    scoreComponents: {
      engagementScore: 0,
      reachScore: 0,
      momentumScore: 0,
      efficiencyScore: 0,
      communityScore: 0,
    },
    rates: {
      likeRate: 0,
      commentRate: 0,
      engagementRate: 0,
      viewsPerDay: 0,
      viewsPerHour: 0,
      viewsPerContentMin: 0,
      engagementPerMinute: 0,
    },
    url: "",
    thumbnail: "",
  };
}

function makeSaga(
  id: string,
  source: SagaSource,
  videoIds: string[],
  range = { first: "2020-01-01T00:00:00Z", last: "2020-01-02T00:00:00Z" }
): Saga {
  return { id, name: `Saga ${id}`, source, videoIds, videoCount: videoIds.length, dateRange: range };
}

/** Day n of Jan 2024, as ISO. */
const day = (n: number) => `2024-01-${String(n).padStart(2, "0")}T12:00:00Z`;

/** Builds videos v1..vN with consecutive days from the given titles. */
const fromTitles = (titles: string[]) => titles.map((t, i) => makeVideo(`v${i + 1}`, t, day(i + 1)));

const titleSeries = (titles: string[]) => buildSeriesIndex(fromTitles(titles), []).series;

describe("buildSeriesIndex - empty inputs", () => {
  it("returns an empty index", () => {
    const idx = buildSeriesIndex([], []);
    expect(idx.series).toEqual([]);
    expect(idx.byVideo.size).toBe(0);
  });

  it("ignores sagas when there are no videos", () => {
    expect(buildSeriesIndex([], [makeSaga("s", "manual", ["a", "b"])]).series).toEqual([]);
  });
});

describe("buildSeriesIndex - saga series", () => {
  const videos = [
    makeVideo("a", "One", day(3)),
    makeVideo("b", "Two", day(1)),
    makeVideo("c", "Three", day(2)),
  ];

  it("keeps known ids, dedupes, orders chronologically", () => {
    const { series } = buildSeriesIndex(videos, [makeSaga("s", "manual", ["a", "ghost", "b", "a", "c"])]);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ id: "s", name: "Saga s", kind: "manual", videoIds: ["b", "c", "a"] });
  });

  it("drops sagas with fewer than 2 existing videos", () => {
    expect(buildSeriesIndex(videos, [makeSaga("s", "playlist", ["a", "ghost"])]).series).toEqual([]);
    expect(buildSeriesIndex(videos, [makeSaga("s", "playlist", ["a", "a"])]).series).toEqual([]);
  });

  it("computes dates from videos, not saga.dateRange", () => {
    const stale = { first: "1999-01-01T00:00:00Z", last: "1999-12-31T00:00:00Z" };
    const { series } = buildSeriesIndex(videos, [makeSaga("s", "ai-detected", ["a", "b"], stale)]);
    expect(series[0].firstPublishedAt).toBe(day(1));
    expect(series[0].lastPublishedAt).toBe(day(3));
  });

  it("prefers manual over ai-detected over playlist for shared videos", () => {
    const vids = ["a", "b", "c", "d", "e"].map((id, i) => makeVideo(id, id, day(i + 1)));
    const sagas = [
      makeSaga("pl", "playlist", ["a", "b", "c", "d", "e"]),
      makeSaga("ai", "ai-detected", ["b", "c", "d", "e"]),
      makeSaga("man", "manual", ["d", "e"]),
    ];
    const { series, byVideo } = buildSeriesIndex(vids, sagas);
    const ids = Object.fromEntries(series.map((s) => [s.id, s.videoIds]));
    // "pl" keeps only "a" (< 2) so it is dropped.
    expect(ids).toEqual({ ai: ["b", "c"], man: ["d", "e"] });
    expect(byVideo.get("d")?.series.kind).toBe("manual");
    expect(byVideo.get("c")?.series.kind).toBe("ai-detected");
    expect(byVideo.has("a")).toBe(false);
  });

  it("lets a bigger lower-priority saga keep its unclaimed videos", () => {
    const vids = ["a", "b", "c", "d"].map((id, i) => makeVideo(id, id, day(i + 1)));
    const sagas = [makeSaga("pl", "playlist", ["a", "b", "c", "d"]), makeSaga("man", "manual", ["c", "d"])];
    const { series, byVideo } = buildSeriesIndex(vids, sagas);
    expect(series.map((s) => [s.id, s.videoIds])).toEqual([
      ["pl", ["a", "b"]],
      ["man", ["c", "d"]],
    ]);
    expect(byVideo.get("a")?.series.id).toBe("pl");
    expect(byVideo.get("d")?.series.id).toBe("man");
  });

  it("breaks priority ties by dateRange.first then id", () => {
    const vids = ["a", "b"].map((id, i) => makeVideo(id, id, day(i + 1)));
    const early = { first: "2020-01-01T00:00:00Z", last: "2020-01-01T00:00:00Z" };
    const late = { first: "2021-01-01T00:00:00Z", last: "2021-01-01T00:00:00Z" };
    const idx = buildSeriesIndex(vids, [
      makeSaga("z-late", "manual", ["a", "b"], late),
      makeSaga("a-late", "manual", ["a", "b"], late),
      makeSaga("m-early", "manual", ["a", "b"], early),
    ]);
    expect(idx.series.map((s) => s.id)).toEqual(["m-early"]);
    const idx2 = buildSeriesIndex(vids, [
      makeSaga("z-late", "manual", ["a", "b"], late),
      makeSaga("a-late", "manual", ["a", "b"], late),
    ]);
    expect(idx2.series.map((s) => s.id)).toEqual(["a-late"]);
  });
});

describe("buildSeriesIndex - title detection", () => {
  it.each([
    ["Zork Part 1", "Zork Part 2", "Zork Part 3"],
    ["Zork #1", "Zork #2", "Zork #3"],
    ["Zork - 1", "Zork - 2", "Zork - 3"],
    ["Zork: 1", "Zork: 2", "Zork: 3"],
    ["Zork | 1", "Zork | 2", "Zork | 3"],
    ["Zork (1)", "Zork (2)", "Zork (3)"],
    ["Zork [1]", "Zork [2]", "Zork [3]"],
    ["Zork Ep. 1", "Zork Ep. 2", "Zork Ep. 3"],
    ["Zork ep 1", "Zork EP 2", "Zork Episode 3"],
    ["Zork Pt. 1", "Zork Pt 2", "Zork Pt.3"],
    ["Zork 1/10", "Zork 2/10", "Zork 3/10"],
    ["Zork Vol 1", "Zork Volume 2", "Zork Vol. 3"],
    ["Zork Day 1", "Zork Day 2", "Zork Day 3"],
    ["Zork Chapter 1", "Zork chapter 2", "Zork Chapter 3"],
    ["Zork Parte 1", "Zork Parte 2", "Zork Parte 3"],
    ["Zork Episódio 1", "Zork Episodio 2", "Zork Episódio 3"],
    ["Zork Dia 1", "Zork Dia 2", "Zork Dia 3"],
    ["Zork Cap 1", "Zork Cap. 2", "Zork Capítulo 3"],
    ["Zork Capítulo 1", "Zork CAPITULO 2", "Zork capítulo 3"],
    ["Zork Part I", "Zork Part II", "Zork Part III"],
    ["Zork Part IV", "Zork Part IX", "Zork Part XX"],
  ])("groups %s / %s / %s", (a, b, c) => {
    const series = titleSeries([a, b, c]);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ id: "title:zork", name: "Zork", kind: "title", videoIds: ["v1", "v2", "v3"] });
  });

  it("is accent-insensitive for the stem and keeps original-case accents in the name", () => {
    const series = titleSeries(["Série Épica Parte 1", "Serie Epica - Parte 2"]);
    expect(series).toHaveLength(1);
    expect(series[0].id).toBe("title:serie epica");
    expect(series[0].name).toBe("Série Épica");
  });

  it("strips a marker in the middle of a title", () => {
    const series = titleSeries(["Learning Rust Day 1 of many", "Learning Rust Day 2 of many"]);
    expect(series[0]?.id).toBe("title:learning rust of many");
  });

  it("trims trailing separators from the series name", () => {
    expect(titleSeries(["Foo bar - Part 1", "Foo bar: Part 2"])[0].name).toBe("Foo bar");
    expect(titleSeries(["Foo bar | Ep 1", "Foo bar | Ep 2"])[0].name).toBe("Foo bar");
    expect(titleSeries(["Foo bar (Part 1)", "Foo bar (Part 2)"])[0].name).toBe("Foo bar");
  });

  it("lets ONE unmarked member whose full title equals the stem join as episode 1", () => {
    const vids = [
      makeVideo("v1", "Foo Quest", day(1)),
      makeVideo("v2", "Foo Quest", day(2)),
      makeVideo("v3", "Foo Quest #2", day(3)),
      makeVideo("v4", "Foo Quest #3", day(4)),
    ];
    const { series } = buildSeriesIndex(vids, []);
    expect(series).toHaveLength(1);
    expect(series[0].videoIds).toEqual(["v1", "v3", "v4"]);
    expect(series[0].name).toBe("Foo Quest");
  });

  it("does not group when marked members share only one episode number", () => {
    expect(titleSeries(["Foo Quest Part 1", "Foo Quest Part 1"])).toEqual([]);
  });

  it("orders chronologically even when episode numbers disagree", () => {
    const vids = [
      makeVideo("late", "Foo Quest Part 1", day(9)),
      makeVideo("early", "Foo Quest Part 3", day(1)),
      makeVideo("mid", "Foo Quest Part 2", day(5)),
    ];
    const { series } = buildSeriesIndex(vids, []);
    expect(series[0].videoIds).toEqual(["early", "mid", "late"]);
    expect(series[0].name).toBe("Foo Quest");
  });

  it.each([
    ["Top 10 things", "Top 5 things"],
    ["Top 10 things I love", "Top 5 things I love"],
    ["I tried 5 things", "I tried 7 things"],
    ["#5", "#6"],
    ["Day 1", "Day 2"],
    ["Part 1", "Part 2"],
    ["Foo Quest", "Foo Quest"],
    ["Foo Quest 2024", "Foo Quest 2025"],
    ["Foo Quest (2024)", "Foo Quest (2025)"],
    ["Foo Quest 2023/24", "Foo Quest 2024/25"],
  ])("does not group %s / %s", (a, b) => {
    expect(titleSeries([a, b, `${a} `])).toEqual([]);
  });

  it("ignores a single marked video", () => {
    expect(titleSeries(["Foo Quest Part 2", "Something else"])).toEqual([]);
  });

  it("leaves unrelated stems separate", () => {
    const series = titleSeries(["Alpha Run #1", "Alpha Run #2", "Beta Run #1", "Beta Run #2", "Gamma Run #1"]);
    expect(series.map((s) => s.id)).toEqual(["title:alpha run", "title:beta run"]);
  });

  it("does not include unmarked same-stem videos beyond the first", () => {
    const vids = [
      makeVideo("v1", "Foo Quest", day(1)),
      makeVideo("v2", "Foo Quest", day(2)),
      makeVideo("v3", "Foo Quest 2", day(3)),
    ];
    // Bare trailing number without a separator is not a marker -> nothing groups.
    expect(buildSeriesIndex(vids, []).series).toEqual([]);
  });

  it("does not catastrophically backtrack on pathological titles", () => {
    const evil = `Foo ${"ep ".repeat(2000)}${" ".repeat(2000)}#`;
    const start = performance.now();
    expect(() => titleSeries([evil, evil])).not.toThrow();
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe("buildSeriesIndex - sagas vs titles", () => {
  it("sagas win over title detection for the same videos", () => {
    const vids = fromTitles(["Foo Quest Part 1", "Foo Quest Part 2", "Foo Quest Part 3"]);
    const { series, byVideo } = buildSeriesIndex(vids, [makeSaga("s", "playlist", ["v1", "v2"])]);
    expect(series.map((s) => [s.id, s.kind, s.videoIds])).toEqual([["s", "playlist", ["v1", "v2"]]]);
    expect(byVideo.get("v3")).toBeUndefined();
  });

  it("title-detects from the videos left over after sagas", () => {
    const vids = fromTitles(["Foo Quest Part 1", "Foo Quest Part 2", "Foo Quest Part 3", "Foo Quest Part 4"]);
    const { series } = buildSeriesIndex(vids, [makeSaga("s", "manual", ["v1", "v2"])]);
    expect(series.map((s) => [s.id, s.videoIds])).toEqual([
      ["s", ["v1", "v2"]],
      ["title:foo quest", ["v3", "v4"]],
    ]);
  });
});

describe("buildSeriesIndex - positions", () => {
  const vids = [
    makeVideo("a", "Foo Quest Part 1", "2024-01-01T00:00:00Z"),
    makeVideo("c", "Foo Quest Part 3", "2024-01-11T12:00:00Z"),
    makeVideo("b", "Foo Quest Part 2", "2024-01-04T00:00:00Z"),
    makeVideo("x", "Standalone", "2024-01-05T00:00:00Z"),
  ];

  it("reports index, total, neighbours and rounded gaps", () => {
    const { byVideo } = buildSeriesIndex(vids, []);
    expect(byVideo.get("a")).toMatchObject({ index: 0, total: 3, prevVideoId: null, nextVideoId: "b", gapDays: null });
    expect(byVideo.get("b")).toMatchObject({ index: 1, total: 3, prevVideoId: "a", nextVideoId: "c", gapDays: 3 });
    // 7.5 days rounds to 8
    expect(byVideo.get("c")).toMatchObject({ index: 2, total: 3, prevVideoId: "b", nextVideoId: null, gapDays: 8 });
    expect(byVideo.get("a")?.series).toBe(byVideo.get("c")?.series);
  });

  it("has no entry for standalone videos", () => {
    const { byVideo } = buildSeriesIndex(vids, []);
    expect(byVideo.has("x")).toBe(false);
    expect(byVideo.size).toBe(3);
  });

  it("gives same-instant videos a gap of 0 with deterministic videoId tie-break", () => {
    const same = [
      makeVideo("z", "Foo Quest #2", day(1)),
      makeVideo("y", "Foo Quest #1", day(1)),
    ];
    const { series, byVideo } = buildSeriesIndex(same, []);
    expect(series[0].videoIds).toEqual(["y", "z"]);
    expect(byVideo.get("z")?.gapDays).toBe(0);
  });

  it("sorts series by firstPublishedAt then id", () => {
    const more = [
      makeVideo("p1", "Beta Run #1", day(5)),
      makeVideo("p2", "Beta Run #2", day(6)),
      makeVideo("q1", "Alpha Run #1", day(2)),
      makeVideo("q2", "Alpha Run #2", day(7)),
      makeVideo("r1", "Gamma Run #1", day(2)),
      makeVideo("r2", "Gamma Run #2", day(8)),
    ];
    expect(buildSeriesIndex(more, []).series.map((s) => s.id)).toEqual([
      "title:alpha run",
      "title:gamma run",
      "title:beta run",
    ]);
  });
});

describe("buildSeriesIndex - scale", () => {
  it("handles a 5,000-video input quickly", () => {
    const base = Date.UTC(2020, 0, 1);
    const vids: VideoData[] = [];
    for (let i = 0; i < 5000; i++) {
      const title = i % 2 === 0 ? `Show${i % 100} Part ${Math.floor(i / 100)}` : `Unique upload number ${i}`;
      vids.push(makeVideo(`id${i}`, title, new Date(base + i * 3_600_000).toISOString()));
    }
    const playlist = makeSaga("all", "playlist", vids.map((v) => v.videoId));
    const start = performance.now();
    const withSaga = buildSeriesIndex(vids, [playlist]);
    const titlesOnly = buildSeriesIndex(vids, []);
    expect(performance.now() - start).toBeLessThan(500);
    expect(withSaga.series).toHaveLength(1);
    expect(withSaga.series[0].videoIds).toHaveLength(5000);
    expect(titlesOnly.series.length).toBeGreaterThan(0);
  });
});
