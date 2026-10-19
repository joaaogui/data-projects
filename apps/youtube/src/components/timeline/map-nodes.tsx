import type { SeriesPosition } from "@/lib/series";
import dayjs from "dayjs";
import Image from "next/image";
import { useMemo } from "react";
import { visibleSlice, type ZoomSpec } from "./map-layout";
import type { MapLayout, MapNode } from "./map-model";
import { seriesColor } from "./series-colors";
import { FOCUS_RING } from "./timeline-model";

interface MapNodesProps {
  layout: MapLayout;
  from: number;
  to: number;
  /** Render-window anchor; the first node after it is the tab stop when nothing selected is rendered. */
  anchor: number;
  selectedId: string | null;
  selectedSeriesId: string | null;
  matches: ReadonlySet<string> | null;
  byVideo: ReadonlyMap<string, SeriesPosition>;
}

export function nodeLabel(node: MapNode, byVideo: ReadonlyMap<string, SeriesPosition>): string {
  const date = dayjs(node.video.publishedAt).format("MMM D, YYYY");
  const position = node.seriesId ? byVideo.get(node.video.videoId) : undefined;
  const part = position ? `, Part ${position.index + 1} of ${position.total} (${position.series.name})` : "";
  return `${node.video.title}, ${date}${part}`;
}

function scoreFill(score: number): string {
  if (score >= 70) return "fill-data";
  if (score >= 55) return "fill-foreground/70";
  if (score >= 40) return "fill-foreground/45";
  return "fill-foreground/25";
}

interface NodeProps {
  node: MapNode;
  spec: ZoomSpec;
  label: string;
  selected: boolean;
  dimmed: boolean;
  tabbable: boolean;
}

export const cardHeight = (spec: ZoomSpec) => spec.rowHeight - 6;

function NodeCard({ node, spec, label, selected, dimmed, tabbable }: Readonly<NodeProps>) {
  const width = spec.nodeWidth;
  const height = cardHeight(spec);
  const withTitle = spec.rowHeight > 80;
  return (
    <button
      type="button"
      data-video-id={node.video.videoId}
      tabIndex={tabbable ? 0 : -1}
      aria-label={label}
      aria-current={selected ? "true" : undefined}
      className={`absolute z-10 flex flex-col overflow-hidden rounded-md border-2 bg-background text-left transition-opacity motion-reduce:transition-none ${FOCUS_RING} ${
        node.seriesId ? "" : "border-border"
      } ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""} ${dimmed ? "opacity-25" : ""}`}
      style={{
        left: node.x - width / 2,
        top: node.y - height / 2,
        width,
        height,
        borderColor: node.seriesId ? seriesColor(node.seriesId) : undefined,
      }}
    >
      <span className="relative block aspect-video w-full shrink-0 bg-muted">
        <Image src={node.video.thumbnail} alt="" fill unoptimized sizes={`${width}px`} className="object-cover" />
      </span>
      {withTitle && (
        <span className="line-clamp-2 px-1 pt-0.5 text-[10px] leading-3 text-foreground">{node.video.title}</span>
      )}
    </button>
  );
}

function NodeDot({ node, label, selected, dimmed, tabbable }: Readonly<NodeProps>) {
  return (
    <g opacity={dimmed ? 0.2 : 1}>
      {selected && <circle cx={node.x} cy={node.y} r={node.r + 3} fill="none" className="stroke-primary" strokeWidth={2} />}
      <circle
        data-video-id={node.video.videoId}
        role="button"
        tabIndex={tabbable ? 0 : -1}
        aria-label={label}
        aria-current={selected ? "true" : undefined}
        cx={node.x}
        cy={node.y}
        r={node.r}
        stroke={node.seriesId ? seriesColor(node.seriesId) : "none"}
        strokeWidth={1.5}
        className={`${scoreFill(node.video.score)} cursor-pointer outline-none focus-visible:stroke-foreground focus-visible:[stroke-width:3px]`}
      />
    </g>
  );
}

/** Only the nodes inside the render window: thumbnail cards at Week/Month, dots at Quarter/Year. */
export function MapNodes({ layout, from, to, anchor, selectedId, selectedSeriesId, matches, byVideo }: Readonly<MapNodesProps>) {
  // Labels for the whole layout once, so crossing a chunk boundary does no date formatting.
  const labels = useMemo(
    () => new Map(layout.nodes.map((node) => [node.video.videoId, nodeLabel(node, byVideo)])),
    [layout, byVideo]
  );
  const [lo, hi] = visibleSlice(layout.xs, from, to);
  const nodes = layout.nodes.slice(lo, hi);
  const selectedRendered = selectedId !== null && nodes.some((node) => node.video.videoId === selectedId);
  const tabStopId = selectedRendered
    ? selectedId
    : (nodes.find((node) => node.x >= anchor) ?? nodes[0])?.video.videoId;
  const { spec } = layout;

  const items = nodes.map((node) => {
    const id = node.video.videoId;
    const props: NodeProps = {
      node,
      spec,
      label: labels.get(id) ?? node.video.title,
      selected: id === selectedId,
      dimmed: (selectedSeriesId !== null && node.seriesId !== selectedSeriesId) || (matches !== null && !matches.has(id)),
      tabbable: id === tabStopId,
    };
    return spec.node === "card" ? <NodeCard key={id} {...props} /> : <NodeDot key={id} {...props} />;
  });

  if (spec.node === "card") return <>{items}</>;
  const left = Math.max(0, from);
  const width = Math.max(0, Math.min(layout.scale.width, to) - left);
  return (
    <svg
      className="absolute top-0 z-10 overflow-visible"
      style={{ left, width, height: layout.height }}
      viewBox={`${left} 0 ${width} ${layout.height}`}
    >
      {items}
    </svg>
  );
}
