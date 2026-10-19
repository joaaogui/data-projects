import type { Series, SeriesIndex, SeriesPosition } from "@/lib/series";
import type { VideoData } from "@/types/youtube";
import {
  DENSITY_SPECS,
  gapMarks,
  indexToX,
  packRows,
  periodMarks,
  trackWidth,
  type Density,
  type DensitySpec,
  type GapMark,
  type PeriodMark,
} from "./map-layout";
import { dotRadius } from "./map-shapes";
import { seriesColor } from "./series-colors";

export const RULER_HEIGHT = 22;
export const BRACKET_ROW_HEIGHT = 20;
export const MAX_BRACKET_ROWS = 4;
const BRACKET_GAP_PX = 10;
const BODY_TOP = 4;
/** Strip between the brackets and the nodes, for gap labels. */
const GAP_STRIP = 14;
const DAY_LABEL_HEIGHT = 14;
const BOTTOM_PAD = 8;

export interface MapNode {
  video: VideoData;
  /** Index on the ordinal track (into `MapLayout.nodes`). */
  order: number;
  time: number;
  x: number;
  r: number;
  seriesId: string | null;
}

export interface MapBracket {
  series: Series;
  color: string;
  row: number;
  /** Row top inside the map body. */
  top: number;
  /** Packed span: the members' extent plus the label reserve. */
  startX: number;
  endX: number;
  /** Drawn line: left edge of the first member to right edge of the last. */
  lineStart: number;
  lineEnd: number;
  members: MapNode[];
}

export interface MapLayout {
  density: Density;
  spec: DensitySpec;
  width: number;
  height: number;
  /** Chronological; `nodes[i].order === i`. */
  nodes: MapNode[];
  byId: Map<string, MapNode>;
  /** Sorted by startX. */
  brackets: MapBracket[];
  bracketRows: number;
  months: PeriodMark[];
  years: PeriodMark[];
  gaps: GapMark[];
  /** Top of the nodes inside the body. */
  trackTop: number;
  /** y of the track rule inside the body. */
  lineY: number;
}

export function buildMapLayout(videos: readonly VideoData[], index: SeriesIndex, density: Density): MapLayout | null {
  const spec = DENSITY_SPECS[density];
  const timed = videos
    .map((video) => ({ video, time: Date.parse(video.publishedAt) }))
    .filter((item) => Number.isFinite(item.time))
    .sort((a, b) => a.time - b.time || (a.video.videoId < b.video.videoId ? -1 : 1));
  if (timed.length === 0) return null;

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
    x: indexToX(order, spec.pitch),
    r: dotRadius(video.views, minViews, maxViews, 1.5, spec.nodeWidth / 2),
    seriesId: null,
  }));
  const byId = new Map(nodes.map((node) => [node.video.videoId, node]));

  const half = spec.nodeWidth / 2;
  const drafts = index.series.flatMap((series) => {
    const members = series.videoIds.flatMap((id) => {
      const node = byId.get(id);
      return node && node.seriesId === null ? [node] : [];
    });
    if (members.length === 0) return [];
    members.sort((a, b) => a.order - b.order);
    for (const node of members) node.seriesId = series.id;
    const lineStart = members[0].x - half;
    const lineEnd = members[members.length - 1].x + half;
    return [{ series, members, lineStart, lineEnd, startX: lineStart, endX: Math.max(lineEnd, lineStart + spec.labelReserve) }];
  });
  const packed = packRows(
    drafts.map((d) => ({ id: d.series.id, start: d.startX, end: d.endX })),
    BRACKET_GAP_PX,
    MAX_BRACKET_ROWS
  );
  const brackets: MapBracket[] = drafts
    .map((d) => {
      const row = packed.rows.get(d.series.id)!;
      return { ...d, color: seriesColor(d.series.id), row, top: BODY_TOP + row * BRACKET_ROW_HEIGHT };
    })
    .sort((a, b) => a.startX - b.startX);

  const times = nodes.map((node) => node.time);
  const trackTop = BODY_TOP + packed.count * BRACKET_ROW_HEIGHT + GAP_STRIP;
  const lineY = trackTop + 3 + (spec.thumbHeight > 0 ? spec.thumbHeight / 2 : (spec.nodeHeight - 3) / 2);
  return {
    density,
    spec,
    width: trackWidth(nodes.length, spec.pitch),
    height: trackTop + spec.nodeHeight + (spec.dayLabels ? DAY_LABEL_HEIGHT : 0) + BOTTOM_PAD,
    nodes,
    byId,
    brackets,
    bracketRows: packed.count,
    months: periodMarks(times, "month"),
    years: periodMarks(times, "year"),
    gaps: gapMarks(times),
    trackTop,
    lineY,
  };
}

/** Next/previous video on the line, or (byEpisode) next/previous episode of its story. */
export function neighborId(
  layout: MapLayout,
  byVideo: ReadonlyMap<string, SeriesPosition>,
  videoId: string,
  direction: -1 | 1,
  byEpisode: boolean
): string | null {
  const node = layout.byId.get(videoId);
  if (!node) return null;
  if (byEpisode) {
    const position = byVideo.get(videoId);
    if (!position || node.seriesId !== position.series.id) return null;
    return direction < 0 ? position.prevVideoId : position.nextVideoId;
  }
  return layout.nodes[node.order + direction]?.video.videoId ?? null;
}

/** Ids whose title or story name contains the query; null when the query is blank. */
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

/** Scroll offsets that center `node` horizontally and bring the track into view vertically. */
export function scrollTargetFor(layout: MapLayout, node: MapNode, viewport: Viewport): { left: number; top: number } {
  const left = Math.min(Math.max(0, layout.width - viewport.width), Math.max(0, node.x - viewport.width / 2));
  const nodeTop = RULER_HEIGHT + layout.trackTop;
  const nodeBottom = nodeTop + layout.spec.nodeHeight;
  let top = viewport.top;
  if (nodeBottom > viewport.top + viewport.height) top = nodeBottom - viewport.height + BOTTOM_PAD;
  if (nodeTop - RULER_HEIGHT < top) top = Math.max(0, nodeTop - RULER_HEIGHT - GAP_STRIP);
  return { left, top };
}
