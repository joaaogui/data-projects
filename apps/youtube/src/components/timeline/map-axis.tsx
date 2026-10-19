import { axisPeriods, axisTicks, timeToX, xToTime } from "./map-layout";
import { AXIS_HEIGHT, type MapLayout } from "./map-model";

interface WindowProps {
  layout: MapLayout;
  from: number;
  to: number;
}

function windowTimes({ layout, from, to }: WindowProps) {
  return {
    start: xToTime(layout.scale, Math.max(0, from)),
    end: xToTime(layout.scale, Math.min(layout.scale.width, to)),
  };
}

/**
 * Sticky top axis: period labels (months or years) that stay pinned to the
 * left edge while their period is on screen, plus minor tick labels.
 */
export function MapAxis(props: Readonly<WindowProps>) {
  const { layout } = props;
  const { scale, zoom } = layout;
  const { start, end } = windowTimes(props);
  const periods = axisPeriods(zoom, start, end);
  const ticks = axisTicks(zoom, start, end);

  return (
    <div
      aria-hidden
      className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm"
      style={{ height: AXIS_HEIGHT, width: scale.width }}
    >
      {periods.map((period) => {
        const left = Math.max(0, timeToX(scale, period.time));
        const right = Math.min(scale.width, timeToX(scale, period.end));
        return (
          <div
            key={period.time}
            className="absolute top-0 h-5 border-l border-border"
            style={{ left, width: Math.max(0, right - left) }}
          >
            <span className="sticky left-0 inline-block whitespace-nowrap px-1.5 text-[11px] font-medium leading-5 text-foreground">
              {period.label}
            </span>
          </div>
        );
      })}
      {ticks.map((tick) => (
        <span
          key={tick.time}
          className="absolute bottom-1 -translate-x-1/2 text-[10px] tabular-nums leading-none text-muted-foreground"
          style={{ left: timeToX(scale, tick.time) }}
        >
          {tick.label}
        </span>
      ))}
    </div>
  );
}

/** Vertical gridlines for the body: faint at ticks, stronger at period starts. */
export function MapGrid(props: Readonly<WindowProps>) {
  const { layout } = props;
  const { scale, zoom, height } = layout;
  const { start, end } = windowTimes(props);
  return (
    <g aria-hidden>
      {axisTicks(zoom, start, end).map((tick) => {
        const x = timeToX(scale, tick.time);
        return <line key={`t${tick.time}`} x1={x} x2={x} y1={0} y2={height} className="stroke-border" opacity={0.45} />;
      })}
      {axisPeriods(zoom, start, end).map((period) => {
        const x = timeToX(scale, period.time);
        return <line key={`p${period.time}`} x1={x} x2={x} y1={0} y2={height} className="stroke-border" />;
      })}
    </g>
  );
}
