import type { Series, SeriesIndex, SeriesPosition } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import { describe, expect, it } from "vitest";
import { DAY_MS, ZOOM_SPECS } from "../map-layout";
import { AXIS_HEIGHT, buildMapLayout, matchVideoIds, neighborId, scrollTargetFor } from "../map-model";

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
  it("returns null without videos", () => {
    expect(buildMapLayout([], EMPTY, "month")).toBeNull();
  });

  it("puts everything in the Other uploads band when there are no threads", () => {
    const videos = [video("a", 0), video("b", 10), video("c", 20)];
    const layout = buildMapLayout(videos, EMPTY, "month")!;
    expect(layout.laneCount).toBe(0);
    expect(layout.threads).toEqual([]);
    expect(layout.band.top).toBe(0);
    expect(layout.nodes.map((n) => n.video.videoId)).toEqual(["a", "b", "c"]);
    expect(new Set(layout.nodes.map((n) => n.y)).size).toBe(1);
  });

  it("stacks concurrent threads on separate lanes above the band", () => {
    const videos = [video("a1", 0), video("b1", 1), video("a2", 3), video("b2", 4), video("s", 2)];
    const index = makeIndex(videos, [
      { id: "A", name: "Alpha", ids: ["a1", "a2"] },
      { id: "B", name: "Beta", ids: ["b1", "b2"] },
    ]);
    const layout = buildMapLayout(videos, index, "month")!;
    expect(layout.laneCount).toBe(2);
    const [a, b] = ["A", "B"].map((id) => layout.threads.find((t) => t.series.id === id)!);
    expect(a.lane).not.toBe(b.lane);
    expect(layout.byId.get("s")!.seriesId).toBeNull();
    expect(layout.byId.get("s")!.y).toBeGreaterThan(Math.max(a.nodes[0].y, b.nodes[0].y));
    expect(a.xs).toEqual(a.nodes.map((n) => n.x));
  });

  it("offsets same-day episodes of one thread onto different rows", () => {
    const videos = [video("a1", 0), video("a2", 0.1)];
    const layout = buildMapLayout(videos, makeIndex(videos, [{ id: "A", name: "A", ids: ["a1", "a2"] }]), "week")!;
    const [n1, n2] = layout.threads[0].nodes;
    expect(n2.y - n1.y).toBe(ZOOM_SPECS.week.rowHeight);
  });

  it("lays out a 3,700-video channel with hundreds of threads quickly", () => {
    const videos = Array.from({ length: 3700 }, (_, i) => video(`v${i}`, i * 0.55));
    const groups = Array.from({ length: 400 }, (_, g) => ({
      id: `t${g}`,
      name: `Thread ${g}`,
      ids: Array.from({ length: 5 }, (_, k) => `v${g * 9 + k * 2}`),
    }));
    const started = performance.now();
    const layout = buildMapLayout(videos, makeIndex(videos, groups), "year")!;
    expect(performance.now() - started).toBeLessThan(1000);
    expect(layout.nodes).toHaveLength(3700);
    expect(layout.threads).toHaveLength(400);
    expect(layout.laneCount).toBeLessThan(20);
  });
});

describe("navigation helpers", () => {
  const videos = [video("a1", 0), video("s1", 1), video("a2", 2), video("s2", 3)];
  const index = makeIndex(videos, [{ id: "A", name: "Alpha saga", ids: ["a1", "a2"] }]);
  const layout = buildMapLayout(videos, index, "month")!;

  it("moves by episode inside a thread and chronologically otherwise", () => {
    expect(neighborId(layout, index.byVideo, "a1", 1)).toBe("a2");
    expect(neighborId(layout, index.byVideo, "a1", -1)).toBeNull();
    expect(neighborId(layout, index.byVideo, "s1", 1)).toBe("a2");
    expect(neighborId(layout, index.byVideo, "s2", 1)).toBeNull();
  });

  it("matches titles and thread names", () => {
    expect(matchVideoIds(videos, "  ", index.byVideo)).toBeNull();
    expect([...matchVideoIds(videos, "ALPHA", index.byVideo)!]).toEqual(["a1", "a2"]);
    expect([...matchVideoIds(videos, "video s2", index.byVideo)!]).toEqual(["s2"]);
  });

  it("centers a node horizontally and scrolls its lane into view", () => {
    const node = layout.byId.get("a2")!;
    const target = scrollTargetFor(layout, node, { left: 0, top: 0, width: 200, height: 2000 });
    expect(target.left).toBeCloseTo(Math.max(0, Math.min(layout.scale.width - 200, node.x - 100)));
    expect(target.top).toBe(0);
    const far = scrollTargetFor(layout, node, { left: 0, top: 5000, width: 200, height: 100 });
    expect(far.top).toBeLessThanOrEqual(AXIS_HEIGHT + node.y);
    expect(far.top + 100).toBeGreaterThanOrEqual(AXIS_HEIGHT + node.y);
  });
});
