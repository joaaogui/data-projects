import { describe, it, expect } from "vitest";
import { buildSeriesIndex } from "@/lib/series";
import { findStoryThreads, titleWords } from "@/lib/story-threads";
import type { Saga, VideoData } from "@/types/youtube";

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
    scoreComponents: { engagementScore: 0, reachScore: 0, momentumScore: 0, efficiencyScore: 0, communityScore: 0 },
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

const HOUR = 3_600_000;
const BASE = Date.UTC(2023, 0, 1);
const at = (hours: number) => new Date(BASE + hours * HOUR).toISOString();

/** A made-up word unique to `i` (consonants only, so no stemming rule touches it). */
const CONSONANTS = "bcdfghjklmnpqrtvwxz";
const token = (i: number, prefix = "q") =>
  `${prefix}${CONSONANTS[i % 19]}${CONSONANTS[Math.floor(i / 19) % 19]}${CONSONANTS[Math.floor(i / 361) % 19]}`;
const BOILERPLATE = (words: string) => `LUIZ DO SOM E MANETIKIN ${words} | LUIZ DO SOM`;
/** Unrelated uploads: boilerplate plus two words no other title has. */
const noise = (n: number, startHour: number, prefix = "n") =>
  Array.from({ length: n }, (_, i) =>
    makeVideo(`${prefix}${i}`, BOILERPLATE(`${token(2 * i)} ${token(2 * i + 1)}`), at(startHour + 12 * i))
  );

const stories = (videos: VideoData[], sagas: Saga[] = []) =>
  buildSeriesIndex(videos, sagas).series.filter((s) => s.kind === "story");

// Public titles from the LUIZ DO SOM channel, 2023-05-20..24; ids are fake.
const STORY: [string, string][] = [
  ["s1", "PESCOÇO DE GALO LIGOU E SAÍMOS A PROCURA  | LUIZ DO SOM"],
  ["s2", "PESCOÇO DE GALO DEIXOU UM RASTRO NO CAMINHO PRA ACHAR ELE | LUIZ DO SOM"],
  ["s3", "PEGARAM PESCOÇO E A CASA CAIU PRA LUIZ DO SOM E MANETIKIN | LUIZ DO SOM"],
  ["s4", "LUIZ DO SOM DISSE A MANETIKIN PRA DAR DINHEIRO A POLÍCIA | LUIZ DO SOM"],
  ["s5", "A POLÍCIA FOI NO SÍTIO E A CASA CAIU PRA LUIZ DO SOM E MANETIKIN | LUIZ DO SOM"],
  ["s6", "LUIZ DO SOM DISSE PRA MANETIKIN DAR DINHEIRO AOS POLICIAIS | LUIZ DO SOM"],
  ["s7", "MANETIKIN FOI PRESO E LUIZ DO SOM TÁ NEM AÍ | LUIZ DO SOM"],
  ["s8", "MANETIKIN DEU A DICA QUE ENTERROU ALGUM DINHEIRO 😱😱😱 | LUIZ DO SOM"],
];
const EXAMPLE = ["s3", "s4", "s5", "s6", "s7"];

/** 200 earlier noise uploads, then the storyline twice a day with same-day noise around it. */
function storyline() {
  const start = 200 * 12;
  const story = STORY.map(([id, title], i) => makeVideo(id, title, at(start + 24 + 12 * i)));
  const sameDay = [
    makeVideo("d1", BOILERPLATE("CHEGOU UMA CARTA DA PREFEITURA"), at(start + 20)),
    makeVideo("d2", BOILERPLATE("DONA ZAZA FEZ CUSCUZ"), at(start + 24 + 12 + 3)),
    makeVideo("d3", BOILERPLATE("O CACHORRO LATIU CEDO NO TERRAÇO"), at(start + 24 + 12 + 5)),
    makeVideo("d4", BOILERPLATE("VOVÔ ASSISTIU O JOGO DO SPORT"), at(start + 24 + 12 * 8 + 2)),
  ];
  return [...noise(200, 0), ...story, ...sameDay];
}

describe("titleWords", () => {
  it("folds accents, drops stopwords/short words/numbers/emoji and stems plurals and gender", () => {
    expect(titleWords("A POLÍCIA E OS POLICIAIS 2023 😱 PRESO PRESA kkkk").map(([, s]) => s)).toEqual([
      "polic",
      "polic",
      "pres",
      "pres",
    ]);
  });

  it("keeps the original spelling next to the stem and reads @ as a", () => {
    expect(titleWords("Pescoço MERD@")).toEqual([
      ["Pescoço", "pesco"],
      ["MERDa", "merd"],
    ]);
  });
});

describe("story threads - linking", () => {
  it("links the example storyline into one story amid unrelated same-day uploads", () => {
    const found = stories(storyline());
    const thread = found.find((s) => s.videoIds.includes("s3"));
    expect(thread).toBeDefined();
    expect(thread!.kind).toBe("story");
    expect(thread!.videoIds).toEqual(expect.arrayContaining(EXAMPLE));
    for (const d of ["d1", "d2", "d3", "d4"]) expect(thread!.videoIds).not.toContain(d);
    expect(thread!.id).toBe(`story:${thread!.videoIds[0]}`);
    expect(found).toHaveLength(1);
  });

  it("names a story from its shared words, never from boilerplate", () => {
    const [thread] = stories(storyline());
    const words = thread.name.split(" · ");
    expect(words.length).toBeGreaterThanOrEqual(2);
    expect(words.length).toBeLessThanOrEqual(3);
    expect(words).toContain("Polícia");
    for (const w of words) expect(["Luiz", "Som", "Manetikin"]).not.toContain(w);
  });

  it("never links videos that only share channel boilerplate", () => {
    const vids = noise(120, 0);
    expect(stories(vids)).toEqual([]);
  });

  it("does not link titles further apart than the window", () => {
    const pair = (gapHours: number) => [
      ...noise(100, 0),
      makeVideo("a", BOILERPLATE("O BODE BERNARDINHO FUGIU"), at(1300)),
      makeVideo("b", BOILERPLATE("ACHARAM O BODE BERNARDINHO"), at(1300 + gapHours)),
    ];
    expect(stories(pair(24)).map((s) => s.videoIds)).toEqual([["a", "b"]]);
    expect(stories(pair(5 * 24))).toEqual([]);
  });

  it("does not link more than maxBack uploads back even inside the window", () => {
    const vids = [
      ...noise(100, 0),
      makeVideo("a", BOILERPLATE("O BODE BERNARDINHO FUGIU"), at(1300)),
      ...Array.from({ length: 13 }, (_, i) => makeVideo(`m${i}`, BOILERPLATE(`${token(900 + i)} ${token(950 + i)}`), at(1301 + i))),
      makeVideo("b", BOILERPLATE("ACHARAM O BODE BERNARDINHO"), at(1320)),
    ];
    expect(stories(vids)).toEqual([]);
  });

  it("needs a strong link: one moderately common shared word alone makes no story", () => {
    // "ficou" is in 3 of 303 titles: above the rare cutoff (2), within the attach cutoff (6).
    const weakOnly = [
      ...noise(300, 0),
      makeVideo("x", BOILERPLATE("FICOU QBBBZ"), at(100)),
      makeVideo("a", BOILERPLATE("FICOU QCCCZ"), at(3700)),
      makeVideo("b", BOILERPLATE("FICOU QDDDZ"), at(3710)),
    ];
    expect(stories(weakOnly)).toEqual([]);
    // The same weak word does extend a thread that already has a strong link.
    const extended = [
      ...weakOnly,
      makeVideo("c", BOILERPLATE("FICOU O BODE BERNARDINHO"), at(3720)),
      makeVideo("d", BOILERPLATE("ACHARAM O BODE BERNARDINHO"), at(3730)),
    ];
    expect(stories(extended).map((s) => s.videoIds)).toEqual([["a", "b", "c", "d"]]);
  });

  it("returns nothing for tiny catalogs where word frequencies are meaningless", () => {
    const vids = ["O BODE FUGIU", "ACHARAM O BODE QUE FUGIU", "O BODE FUGIU DE NOVO"].map((t, i) =>
      makeVideo(`v${i}`, t, at(i))
    );
    expect(stories(vids)).toEqual([]);
  });
});

describe("story threads - precedence", () => {
  it("lets sagas claim videos first: a saga video is never in a story", () => {
    const vids = storyline();
    const saga: Saga = {
      id: "saga-1",
      name: "Pescoço",
      source: "playlist",
      videoIds: ["s1", "s2", "s3"],
      videoCount: 3,
      dateRange: { first: vids[0].publishedAt, last: vids[0].publishedAt },
    };
    const idx = buildSeriesIndex(vids, [saga]);
    for (const id of saga.videoIds) expect(idx.byVideo.get(id)?.series.id).toBe("saga-1");
    const story = idx.series.filter((s) => s.kind === "story");
    for (const s of story) for (const id of saga.videoIds) expect(s.videoIds).not.toContain(id);
    expect(idx.byVideo.get("s6")?.series.kind).toBe("story");
  });

  it("lets numbered titles claim videos before stories", () => {
    const vids = [
      ...noise(100, 0),
      makeVideo("p1", BOILERPLATE("O BODE BERNARDINHO PARTE 1"), at(1300)),
      makeVideo("p2", BOILERPLATE("O BODE BERNARDINHO PARTE 2"), at(1310)),
      makeVideo("p3", BOILERPLATE("O BODE BERNARDINHO FUGIU"), at(1320)),
    ];
    const idx = buildSeriesIndex(vids, []);
    expect(idx.byVideo.get("p1")?.series.kind).toBe("title");
    expect(idx.byVideo.get("p2")?.series.kind).toBe("title");
    expect(idx.byVideo.has("p3")).toBe(false);
  });
});

describe("story threads - determinism and edges", () => {
  it("returns the same series in the same order regardless of input order", () => {
    const vids = storyline();
    const reversed = [...vids].reverse();
    const shuffled = [...vids].sort((a, b) => (a.videoId.split("").reverse().join("") < b.videoId.split("").reverse().join("") ? -1 : 1));
    const shape = (v: VideoData[]) => buildSeriesIndex(v, []).series.map((s) => [s.id, s.name, s.videoIds]);
    expect(shape(reversed)).toEqual(shape(vids));
    expect(shape(shuffled)).toEqual(shape(vids));
    expect(shape(vids)).toEqual(shape(vids));
  });

  it("handles empty input", () => {
    expect(findStoryThreads([], new Set())).toEqual([]);
    expect(buildSeriesIndex([], []).series).toEqual([]);
  });

  it("ignores videos with unparseable dates", () => {
    const vids = storyline().map((v) => (v.videoId === "s6" ? { ...v, publishedAt: "not a date" } : v));
    const thread = stories(vids).find((s) => s.videoIds.includes("s3"));
    expect(thread?.videoIds).not.toContain("s6");
  });

  it("reports prev/next/gapDays inside a story", () => {
    const vids = [
      ...noise(100, 0),
      makeVideo("a", BOILERPLATE("O BODE BERNARDINHO FUGIU"), "2023-03-01T00:00:00Z"),
      makeVideo("b", BOILERPLATE("PROCURANDO O BODE BERNARDINHO"), "2023-03-03T12:00:00Z"),
      makeVideo("c", BOILERPLATE("ACHARAM O BODE BERNARDINHO"), "2023-03-04T00:00:00Z"),
    ];
    const { byVideo } = buildSeriesIndex(vids, []);
    expect(byVideo.get("a")).toMatchObject({ index: 0, total: 3, prevVideoId: null, nextVideoId: "b", gapDays: null });
    expect(byVideo.get("b")).toMatchObject({ index: 1, total: 3, prevVideoId: "a", nextVideoId: "c", gapDays: 3 });
    expect(byVideo.get("c")).toMatchObject({ index: 2, total: 3, prevVideoId: "b", nextVideoId: null, gapDays: 1 });
    expect(byVideo.get("a")?.series.kind).toBe("story");
  });

  it("indexes 5,000 story-heavy videos in under 300 ms", () => {
    const vids = Array.from({ length: 5000 }, (_, i) => {
      const arc = Math.floor(i / 8);
      return makeVideo(`id${i}`, BOILERPLATE(`${token(arc)} ${token(arc, "w")} ${token(i, "x")}`), at(i * 6));
    });
    buildSeriesIndex(vids, []);
    const start = performance.now();
    const idx = buildSeriesIndex(vids, []);
    expect(performance.now() - start).toBeLessThan(300);
    expect(idx.series.filter((s) => s.kind === "story").length).toBeGreaterThan(500);
  });
});
