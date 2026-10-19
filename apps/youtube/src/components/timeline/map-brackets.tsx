import type { MapBracket, MapLayout } from "./map-model";
import { BRACKET_ROW_HEIGHT } from "./map-model";
import type { WindowProps } from "./map-ruler";

export interface BracketLayerProps extends WindowProps {
  selectedSeriesId: string | null;
  /** Stories with at least one search match; null when no search is active. */
  matchedSeries: ReadonlySet<string> | null;
}

function visibleBrackets(layout: MapLayout, from: number, to: number): MapBracket[] {
  return layout.brackets.filter((bracket) => bracket.endX >= from && bracket.startX <= to);
}

function isDimmed(id: string, selectedSeriesId: string | null, matched: ReadonlySet<string> | null) {
  return (selectedSeriesId !== null && id !== selectedSeriesId) || (matched !== null && !matched.has(id));
}

/** y of the bracket rule inside its row; end and member ticks hang below it toward the track. */
const ruleY = (bracket: MapBracket) => bracket.top + BRACKET_ROW_HEIGHT - 5;

/**
 * One colored bracket per story spanning its first to last member, with a
 * tick at each member (interleaved non-members inside the span stay unmarked).
 */
export function MapBrackets({ layout, from, to, selectedSeriesId, matchedSeries }: Readonly<BracketLayerProps>) {
  const left = Math.max(0, from);
  const width = Math.max(0, Math.min(layout.width, to) - left);
  const brackets = visibleBrackets(layout, from, to).sort(
    (a, b) => Number(a.series.id === selectedSeriesId) - Number(b.series.id === selectedSeriesId)
  );

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute top-0"
      style={{ left, width, height: layout.trackTop }}
      viewBox={`${left} 0 ${width} ${layout.trackTop}`}
    >
      {brackets.map((bracket) => {
        const y = ruleY(bracket);
        const selected = bracket.series.id === selectedSeriesId;
        return (
          <g
            key={bracket.series.id}
            stroke={bracket.color}
            strokeWidth={selected ? 3 : 1.75}
            strokeLinecap="round"
            fill="none"
            opacity={isDimmed(bracket.series.id, selectedSeriesId, matchedSeries) ? 0.2 : 0.9}
          >
            <path d={`M${bracket.lineStart} ${y + 4} V${y} H${bracket.lineEnd} V${y + 4}`} />
            {bracket.members
              .filter((member) => member.x >= from && member.x <= to)
              .map((member) => (
                <line key={member.order} x1={member.x} x2={member.x} y1={y} y2={y + 5} />
              ))}
          </g>
        );
      })}
    </svg>
  );
}

/** Story name and episode count at each bracket's start, sticky while the bracket is on screen. */
export function MapBracketLabels({ layout, from, to, selectedSeriesId, matchedSeries }: Readonly<BracketLayerProps>) {
  return (
    <div aria-hidden className="pointer-events-none">
      {visibleBrackets(layout, from, to).map((bracket) => {
        const width = bracket.endX - bracket.startX;
        if (width < 32) return null;
        const dimmed = isDimmed(bracket.series.id, selectedSeriesId, matchedSeries);
        return (
          <div
            key={bracket.series.id}
            className={`absolute z-10 transition-opacity motion-reduce:transition-none ${dimmed ? "opacity-30" : ""}`}
            style={{ left: bracket.startX, top: bracket.top, width, height: BRACKET_ROW_HEIGHT - 6 }}
          >
            <span className="sticky left-1 inline-flex max-w-full items-center gap-1 rounded bg-background/85 px-1 text-[11px] leading-[14px] text-foreground">
              <span className="truncate font-medium">{bracket.series.name}</span>
              <span className="shrink-0 tabular-nums" style={{ color: bracket.color }}>
                {bracket.members.length}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
