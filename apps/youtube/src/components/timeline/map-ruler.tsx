import { indexToX, visibleRange } from "./map-layout";
import { RULER_HEIGHT, type MapLayout } from "./map-model";

export interface WindowProps {
  layout: MapLayout;
  from: number;
  to: number;
}

/** Left edge of the slot of the video at `index`. */
const slotLeft = (layout: MapLayout, index: number) => indexToX(index, layout.spec.pitch) - layout.spec.pitch / 2;

/** Sticky date ruler: each month labelled at its first video, pinned left while the month is on screen. */
export function MapRuler({ layout, from, to }: Readonly<WindowProps>) {
  const [lo, hi] = visibleRange(layout.nodes.length, layout.spec.pitch, from, to);
  return (
    <div
      aria-hidden
      className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm"
      style={{ height: RULER_HEIGHT, width: layout.width }}
    >
      {layout.months
        .filter((month) => month.endIndex > lo && month.index < hi)
        .map((month) => {
          const left = slotLeft(layout, month.index);
          return (
            <div
              key={month.index}
              className="absolute top-0 h-full border-l border-border"
              style={{ left, width: slotLeft(layout, month.endIndex) - left }}
            >
              <span className="sticky left-0 inline-block max-w-full truncate px-1.5 text-[11px] font-medium leading-[22px] text-foreground">
                {month.label}
              </span>
            </div>
          );
        })}
    </div>
  );
}

/** SVG under the nodes: month gridlines, the track rule, and break markers for long gaps. */
export function MapTrackDecor({ layout, from, to }: Readonly<WindowProps>) {
  const { spec, lineY, trackTop, height } = layout;
  const [lo, hi] = visibleRange(layout.nodes.length, spec.pitch, from, to);
  const left = Math.max(0, from);
  const width = Math.max(0, Math.min(layout.width, to) - left);
  const showGapLabels = spec.pitch >= 40;

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute top-0"
      style={{ left, width, height }}
      viewBox={`${left} 0 ${width} ${height}`}
    >
      {layout.months
        .filter((month) => month.index >= lo && month.index <= hi)
        .map((month) => {
          const x = slotLeft(layout, month.index);
          return <line key={month.index} x1={x} x2={x} y1={0} y2={height} className="stroke-border" opacity={0.6} />;
        })}
      <line x1={left} x2={left + width} y1={lineY} y2={lineY} className="stroke-foreground/25" strokeWidth={1} />
      {layout.gaps
        .filter((gap) => gap.index >= lo && gap.index <= hi)
        .map((gap) => {
          const x = slotLeft(layout, gap.index);
          return (
            <g key={gap.index}>
              <title>{`${gap.days} days without uploads`}</title>
              <rect x={x - 3} y={lineY - 2} width={6} height={4} className="fill-background" />
              <line x1={x - 3} x2={x - 1} y1={lineY + 3} y2={lineY - 3} className="stroke-muted-foreground" />
              <line x1={x + 1} x2={x + 3} y1={lineY + 3} y2={lineY - 3} className="stroke-muted-foreground" />
              {showGapLabels && (
                <text x={x} y={trackTop - 3} textAnchor="middle" className="fill-muted-foreground text-[9px] tabular-nums">
                  +{gap.days}d
                </text>
              )}
            </g>
          );
        })}
    </svg>
  );
}
