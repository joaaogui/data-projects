import type { Series, SeriesIndex, SeriesPosition } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import { createScale, packLanes, stackRows, timeToX, ZOOM_SPECS, type TimeScale, type Zoom, type ZoomSpec } from "./map-layout";
import { dotRadius } from "./map-shapes";
import { seriesColor } from "./series-colors";

export const AXIS_HEIGHT = 40;
export const LANE_LABEL_HEIGHT = 18;
const LANE_PAD = 6;
const LANE_GAP_PX = 16;
const BAND_GAP = 14;

export interface MapNode {
  video: VideoData;
  /** Position in chronological order (index into `MapLayout.nodes`). */
  order: number;
  time: number;
  x: number;
  /** Vertical center inside the map body. */
  y: number;
  r: number;
  seriesId: string | null;
}

export interface MapThread {
  series: Series;
  color: string;
  lane: number;
  /** Top of the lane in the map body. */
  top: number;
  /** Occupied span including half a node and the label reserve. */
  startX: number;
  endX: number;
  nodes: MapNode[];
  xs: number[];
}

export interface MapLayout {
  zoom: Zoom;
  spec: ZoomSpec;
  scale: TimeScale;
  height: number;
  /** Chronological; `xs[i] === nodes[i].x`. */
  nodes: MapNode[];
  xs: number[];
  byId: Map<string, MapNode>;
  /** Sorted by startX. */
  threads: MapThread[];
  laneCount: number;
  band: { top: number; height: number };
}

const laneHeight = (spec: ZoomSpec, rows: number) => LANE_LABEL_HEIGHT + Math.max(1, rows) * spec.rowHeight + LANE_PAD;
const rowCenter = (spec: ZoomSpec, top: number, row: number) => top + LANE_LABEL_HEIGHT + row * spec.rowHeight + spec.rowHeight / 2;

export function buildMapLayout(videos: readonly VideoData[], index: SeriesIndex, zoom: Zoom): MapLayout | null {
  const spec = ZOOM_SPECS[zoom];
  const timed = videos
    .map((video) => ({ video, time: Date.parse(video.publishedAt) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time || (a.video.videoId < b.video.videoId ? -1 : 1));
  if (timed.length === 0) return null;

  const scale = createScale(timed[0].time, timed[timed.length - 1].time, spec.pxPerDay);
  let minViews = Infinity;
  let maxViews = 0;
  for (const { video } of timed) {
    minViews = Math.min(minViews, video.views);
    maxViews = Math.max(maxViews, video.views);
  }
  const nodes: MapNode[] = timed.map(({ video, time }, order) => ({
    video,
    order,
    time,
    x: timeToX(scale, time),
    y: 0,
    r: dotRadius(video.views, minViews, maxViews, 2, spec.nodeWidth / 2),
    seriesId: null,
  }));
  const byId = new Map(nodes.map((node) => [node.video.videoId, node]));

  const half = spec.nodeWidth / 2;
  const spacing = spec.nodeWidth + (spec.node === "card" ? 6 : 2);
  const drafts = index.series.flatMap((series) => {
    const members = series.videoIds.flatMap((id) => {
      const node = byId.get(id);
      return node && node.seriesId === null ? [node] : [];
    });
    if (members.length === 0) return [];
    members.sort((a, b) => a.order - b.order);
    for (const node of members) node.seriesId = series.id;
    const xs = members.map((node) => node.x);
    const startX = xs[0] - half;
    const endX = Math.max(xs[xs.length - 1] + half, startX + spec.labelReserve);
    return [{ series, members, xs, startX, endX, stack: stackRows(xs, spacing, spec.threadRows) }];
  });

  const { lanes, count: laneCount } = packLanes(
    drafts.map((d) => ({ id: d.series.id, start: d.startX, end: d.endX })),
    LANE_GAP_PX
  );
  const laneRows = Array.from({ length: laneCount }, () => 1);
  for (const d of drafts) {
    const lane = lanes.get(d.series.id)!;
    laneRows[lane] = Math.max(laneRows[lane], d.stack.count);
  }
  const laneTops: number[] = [];
  let y = 0;
  for (const rows of laneRows) {
    laneTops.push(y);
    y += laneHeight(spec, rows);
  }

  const threads: MapThread[] = drafts.map((d) => {
    const lane = lanes.get(d.series.id)!;
    const top = laneTops[lane];
    d.members.forEach((node, i) => (node.y = rowCenter(spec, top, d.stack.rows[i])));
    return { series: d.series, color: seriesColor(d.series.id), lane, top, startX: d.startX, endX: d.endX, nodes: d.members, xs: d.xs };
  });
  threads.sort((a, b) => a.startX - b.startX);

  const bandTop = y + (laneCount > 0 ? BAND_GAP : 0);
  const standalone = nodes.filter((node) => node.seriesId === null);
  const bandStack = stackRows(standalone.map((node) => node.x), spacing, spec.bandRows);
  standalone.forEach((node, i) => (node.y = rowCenter(spec, bandTop, bandStack.rows[i])));
  const band = { top: bandTop, height: laneHeight(spec, bandStack.count) };

  return {
    zoom,
    spec,
    scale,
    height: band.top + band.height,
    nodes,
    xs: nodes.map((node) => node.x),
    byId,
    threads,
    laneCount,
    band,
  };
}

/** Prev/next episode for thread members, chronological neighbor otherwise. */
export function neighborId(
  layout: MapLayout,
  byVideo: ReadonlyMap<string, SeriesPosition>,
  videoId: string,
  direction: -1 | 1
): string | null {
  const position = byVideo.get(videoId);
  if (position && layout.byId.get(videoId)?.seriesId === position.series.id) {
    return direction < 0 ? position.prevVideoId : position.nextVideoId;
  }
  const node = layout.byId.get(videoId);
  if (!node) return null;
  return layout.nodes[node.order + direction]?.video.videoId ?? null;
}

/** Ids whose title or thread name contains the query; null when the query is blank. */
export function matchVideoIds(
  videos: readonly VideoData[],
  query: string,
  byVideo: ReadonlyMap<string, SeriesPosition>
): Set<string> | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const ids = new Set<string>();
  for (const video of videos) {
    const name = byVideo.get(video.videoId)?.series.name.toLowerCase() ?? "";
    if (video.title.toLowerCase().includes(q) || name.includes(q)) ids.add(video.videoId);
  }
  return ids;
}

export interface Viewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Scroll offsets that center `node` horizontally and bring its row into view vertically. */
export function scrollTargetFor(layout: MapLayout, node: MapNode, viewport: Viewport): { left: number; top: number } {
  const maxLeft = Math.max(0, layout.scale.width - viewport.width);
  const left = Math.min(maxLeft, Math.max(0, node.x - viewport.width / 2));
  const margin = layout.spec.rowHeight;
  const nodeTop = AXIS_HEIGHT + node.y;
  const visible =
    nodeTop - margin >= viewport.top + AXIS_HEIGHT && nodeTop + margin <= viewport.top + viewport.height;
  const maxTop = Math.max(0, AXIS_HEIGHT + layout.height - viewport.height);
  const top = visible ? viewport.top : Math.min(maxTop, Math.max(0, nodeTop - (viewport.height + AXIS_HEIGHT) / 2));
  return { left, top };
}
