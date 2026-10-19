import type { Series, SeriesIndex, SeriesPosition } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import { describe, expect, it } from "vitest";
import { DAY_MS, DENSITY_SPECS, indexToX } from "../map-layout";
import { buildMapLayout, MAX_BRACKET_ROWS, matchVideoIds, neighborId, RULER_HEIGHT, scrollTargetFor } from "../map-model";

const START = Date.UTC(2023, 0, 1, 12);

function video(id: string, day: number, title = `Video ${id}`): VideoData {
  return {
    videoId: id,
    title,
    publishedAt: new Date(START + day * DAY_MS).toISOString(),
    views: 1000 + day,
    score: 50,
  } as unknown as VideoData;
}

function makeIndex(videos: VideoData[], groups: { id: string; name: string; ids: string[] }[]): SeriesIndex {
  const at = new Map(videos.map((v) => [v.videoId, v.publishedAt]));
  const series: Series[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    kind: "story",
    videoIds: g.ids,
    firstPublishedAt: at.get(g.ids[0])!,
    lastPublishedAt: at.get(g.ids[g.ids.length - 1])!,
  }));
  const byVideo = new Map<string, SeriesPosition>();
  for (const s of series) {
    s.videoIds.forEach((id, index) =>
      byVideo.set(id, {
        series: s,
        index,
        total: s.videoIds.length,
        prevVideoId: s.videoIds[index - 1] ?? null,
        nextVideoId: s.videoIds[index + 1] ?? null,
        gapDays: index === 0 ? null : 1,
      })
    );
  }
  return { series, byVideo };
}

const EMPTY: SeriesIndex = { series: [], byVideo: new Map() };

describe("buildMapLayout", () => {
  it("returns null without dated videos", () => {
    expect(buildMapLayout([], EMPTY, "cards")).toBeNull();
  });

  it("puts every video on one ordinal line, same-day uploads side by side", () => {
    const videos = [video("c", 30), video("a", 0), video("b", 0.2)];
    const layout = buildMapLayout(videos, EMPTY, "cards")!;
    expect(layout.nodes.map((n) => n.video.videoId)).toEqual(["a", "b", "c"]);
    expect(layout.nodes.map((n) => n.x)).toEqual([0, 1, 2].map((i) => indexToX(i, DENSITY_SPECS.cards.pitch)));
    expect(layout.brackets).toEqual([]);
    expect(layout.bracketRows).toBe(0);
    expect(layout.gaps).toEqual([{ index: 2, days: 30 }]);
    expect(layout.months.map((m) => m.label)).toEqual(["Jan 2023"]);
  });

  it("stacks interleaved stories into bracket rows above the track", () => {
    const videos = ["a1", "b1", "a2", "s", "b2"].map((id, i) => video(id, i));
    const index = makeIndex(videos, [
      { id: "A", name: "Alpha", ids: ["a1", "a2"] },
      { id: "B", name: "Beta", ids: ["b1", "b2"] },
    ]);
    const layout = buildMapLayout(videos, index, "cards")!;
    const [a, b] = ["A", "B"].map((id) => layout.brackets.find((br) => br.series.id === id)!);
    expect(a.row).not.toBe(b.row);
    expect(layout.bracketRows).toBe(2);
    expect(a.members.map((m) => m.order)).toEqual([0, 2]);
    expect(a.lineStart).toBe(layout.nodes[0].x - DENSITY_SPECS.cards.nodeWidth / 2);
    expect(layout.byId.get("s")!.seriesId).toBeNull();
    expect(layout.trackTop).toBeGreaterThan(b.top);
  });

  it("caps bracket rows", () => {
    const videos = Array.from({ length: 20 }, (_, i) => video(`v${i}`, i));
    const groups = Array.from({ length: 10 }, (_, g) => ({ id: `g${g}`, name: `G${g}`, ids: [`v${g}`, `v${g + 10}`] }));
    const layout = buildMapLayout(videos, makeIndex(videos, groups), "dots")!;
    expect(layout.bracketRows).toBe(MAX_BRACKET_ROWS);
  });

  it("lays out a 3,700-video channel with hundreds of stories quickly", () => {
    const videos = Array.from({ length: 3700 }, (_, i) => video(`v${i}`, i * 0.55));
    const groups = Array.from({ length: 400 }, (_, g) => ({
      id: `t${g}`,
      name: `Thread ${g}`,
      ids: Array.from({ length: 3 }, (_, k) => `v${g * 9 + k * 2}`),
    }));
    const started = performance.now();
    const layout = buildMapLayout(videos, makeIndex(videos, groups), "dots")!;
    expect(performance.now() - started).toBeLessThan(1000);
    expect(layout.nodes).toHaveLength(3700);
    expect(layout.brackets).toHaveLength(400);
  });
});

describe("navigation helpers", () => {
  const videos = [video("a1", 0), video("s1", 1), video("a2", 2), video("s2", 3)];
  const index = makeIndex(videos, [{ id: "A", name: "Alpha saga", ids: ["a1", "a2"] }]);
  const layout = buildMapLayout(videos, index, "cards")!;

  it("moves along the line, or by episode inside a story", () => {
    expect(neighborId(layout, index.byVideo, "a1", 1, false)).toBe("s1");
    expect(neighborId(layout, index.byVideo, "s2", 1, false)).toBeNull();
    expect(neighborId(layout, index.byVideo, "a1", 1, true)).toBe("a2");
    expect(neighborId(layout, index.byVideo, "a1", -1, true)).toBeNull();
    expect(neighborId(layout, index.byVideo, "s1", 1, true)).toBeNull();
  });

  it("matches titles and story names", () => {
    expect(matchVideoIds(videos, "  ", index.byVideo)).toBeNull();
    expect([...matchVideoIds(videos, "ALPHA", index.byVideo)!]).toEqual(["a1", "a2"]);
    expect([...matchVideoIds(videos, "video s2", index.byVideo)!]).toEqual(["s2"]);
  });

  it("centers a node horizontally and brings the track into view", () => {
    const node = layout.byId.get("a2")!;
    const target = scrollTargetFor(layout, node, { left: 0, top: 0, width: 200, height: 2000 });
    expect(target.left).toBeCloseTo(Math.min(layout.width - 200, node.x - 100));
    expect(target.top).toBe(0);
    const short = scrollTargetFor(layout, node, { left: 0, top: 0, width: 200, height: 60 });
    expect(short.top).toBeGreaterThan(0);
    expect(short.top).toBeLessThanOrEqual(layout.trackTop + RULER_HEIGHT);
  });
});
