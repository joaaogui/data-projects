import type { SeriesPosition } from "@/lib/series";
import dayjs from "dayjs";
import Image from "next/image";
import { useMemo } from "react";
import { visibleRange } from "./map-layout";
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
  layout: MapLayout;
  label: string;
  selected: boolean;
  dimmed: boolean;
  tabbable: boolean;
}

/** Thumbnail card (with title and day number at Cards density) whose top bar carries the story color. */
function NodeCard({ node, layout, label, selected, dimmed, tabbable }: Readonly<NodeProps>) {
  const { spec, trackTop } = layout;
  const width = spec.nodeWidth;
  return (
    <>
      <button
        type="button"
        data-video-id={node.video.videoId}
        tabIndex={tabbable ? 0 : -1}
        aria-label={label}
        aria-current={selected ? "true" : undefined}
        className={`absolute z-10 flex flex-col overflow-hidden rounded-md border border-border bg-background text-left transition-opacity motion-reduce:transition-none ${FOCUS_RING} ${
          selected ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
        } ${dimmed ? "opacity-25" : ""}`}
        style={{ left: node.x - width / 2, top: trackTop, width, height: spec.nodeHeight }}
      >
        <span
          aria-hidden
          className="block h-[3px] w-full shrink-0"
          style={{ backgroundColor: node.seriesId ? seriesColor(node.seriesId) : "transparent" }}
        />
        <span className="relative block w-full shrink-0 bg-muted" style={{ height: spec.thumbHeight }}>
          <Image src={node.video.thumbnail} alt="" fill unoptimized sizes={`${width}px`} className="object-cover" />
        </span>
        {spec.title && (
          <span className="line-clamp-2 px-1 pt-0.5 text-[10px] leading-3 text-foreground">{node.video.title}</span>
        )}
      </button>
      {spec.dayLabels && (
        <span
          aria-hidden
          className={`absolute -translate-x-1/2 text-[10px] tabular-nums leading-3 text-muted-foreground ${dimmed ? "opacity-40" : ""}`}
          style={{ left: node.x, top: trackTop + spec.nodeHeight + 2 }}
        >
          {new Date(node.time).getUTCDate()}
        </span>
      )}
    </>
  );
}

/** Dot on the rule: size by views, fill by score, story color as a small bar above it. */
function NodeDot({ node, layout, label, selected, dimmed, tabbable }: Readonly<NodeProps>) {
  const y = layout.lineY;
  const barY = y - layout.spec.nodeWidth / 2 - 3;
  return (
    <g opacity={dimmed ? 0.2 : 1}>
      {node.seriesId && (
        <rect x={node.x - 3} y={barY} width={6} height={2} rx={1} fill={seriesColor(node.seriesId)} />
      )}
      {selected && <circle cx={node.x} cy={y} r={node.r + 2.5} fill="none" className="stroke-primary" strokeWidth={2} />}
      <circle
        data-video-id={node.video.videoId}
        role="button"
        tabIndex={tabbable ? 0 : -1}
        aria-label={label}
        aria-current={selected ? "true" : undefined}
        cx={node.x}
        cy={y}
        r={node.r}
        className={`${scoreFill(node.video.score)} cursor-pointer outline-none focus-visible:stroke-foreground focus-visible:[stroke-width:2px]`}
      />
    </g>
  );
}

/** Only the videos inside the render window, as cards/thumbnails or dots on the line. */
export function MapNodes({ layout, from, to, anchor, selectedId, selectedSeriesId, matches, byVideo }: Readonly<MapNodesProps>) {
  // Labels for the whole layout once, so crossing a chunk boundary does no date formatting.
  const labels = useMemo(
    () => new Map(layout.nodes.map((node) => [node.video.videoId, nodeLabel(node, byVideo)])),
    [layout, byVideo]
  );
  const [lo, hi] = visibleRange(layout.nodes.length, layout.spec.pitch, from, to);
  const nodes = layout.nodes.slice(lo, hi);
  const selectedRendered = selectedId !== null && nodes.some((node) => node.video.videoId === selectedId);
  const tabStopId = selectedRendered
    ? selectedId
    : (nodes.find((node) => node.x >= anchor) ?? nodes[0])?.video.videoId;
  const dots = layout.spec.thumbHeight === 0;

  const items = nodes.map((node) => {
    const id = node.video.videoId;
    const props: NodeProps = {
      node,
      layout,
      label: labels.get(id) ?? node.video.title,
      selected: id === selectedId,
      dimmed: (selectedSeriesId !== null && node.seriesId !== selectedSeriesId) || (matches !== null && !matches.has(id)),
      tabbable: id === tabStopId,
    };
    return dots ? <NodeDot key={id} {...props} /> : <NodeCard key={id} {...props} />;
  });

  if (!dots) return <>{items}</>;
  const left = Math.max(0, from);
  const width = Math.max(0, Math.min(layout.width, to) - left);
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
