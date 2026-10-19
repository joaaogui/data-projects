"use client";

import type { SeriesPosition } from "@/lib/series";
import type { KeyboardEvent, SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapAxis } from "./map-axis";
import type { MapLayout } from "./map-model";
import { MapNodes } from "./map-nodes";
import { MapLabels, MapThreads } from "./map-threads";
import { MapTooltip } from "./map-tooltip";
import { FOCUS_RING } from "./timeline-model";

interface StoryMapProps {
  layout: MapLayout;
  /** Quantized render window (see `renderWindow`): unchanged while scrolling inside one chunk. */
  from: number;
  to: number;
  anchor: number;
  mapRef: (element: HTMLDivElement | null) => void;
  element: HTMLDivElement | null;
  label: string;
  selectedId: string | null;
  selectedSeriesId: string | null;
  matches: ReadonlySet<string> | null;
  byVideo: ReadonlyMap<string, SeriesPosition>;
  bandNote: string | null;
  focusRequest: { videoId: string; nonce: number } | null;
  onSelect: (videoId: string) => void;
  onStep: (direction: -1 | 1, fromId: string) => void;
  onClear: () => void;
}

function nodeIdOf(event: SyntheticEvent): string | null {
  const target = event.target as Element | null;
  return target?.closest?.("[data-video-id]")?.getAttribute("data-video-id") ?? null;
}

/** The scrollable map: sticky axis, thread curves and labels, nodes, tooltip. Events are delegated. */
export function StoryMap({
  layout,
  from,
  to,
  anchor,
  mapRef,
  element,
  label,
  selectedId,
  selectedSeriesId,
  matches,
  byVideo,
  bandNote,
  focusRequest,
  onSelect,
  onStep,
  onClear,
}: Readonly<StoryMapProps>) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const matchedSeries = useMemo(() => {
    if (!matches) return null;
    const ids = new Set<string>();
    for (const id of matches) {
      const seriesId = layout.byId.get(id)?.seriesId;
      if (seriesId) ids.add(seriesId);
    }
    return ids;
  }, [matches, layout]);

  // Keyboard stepping focuses the new node once it is rendered (it may need the scroll to arrive first).
  const handledFocus = useRef(0);
  useEffect(() => {
    if (!focusRequest || !element || handledFocus.current === focusRequest.nonce) return;
    const target = element.querySelector<HTMLElement | SVGElement>(
      `[data-video-id="${CSS.escape(focusRequest.videoId)}"]`
    );
    if (!target) return;
    handledFocus.current = focusRequest.nonce;
    target.focus({ preventScroll: true });
  }, [focusRequest, element, from, layout]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const targetId = nodeIdOf(event);
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const base = selectedId ?? targetId;
      if (!base) return;
      event.preventDefault();
      onStep(event.key === "ArrowLeft" ? -1 : 1, base);
    } else if (event.key === "Escape" && selectedId) {
      event.preventDefault();
      onClear();
    } else if ((event.key === "Enter" || event.key === " ") && targetId && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      onSelect(targetId);
    }
  };

  const hovered = hoveredId ? layout.byId.get(hoveredId) : undefined;
  const layer = { layout, from, to, selectedSeriesId, matchedSeries };

  return (
    <div
      ref={mapRef}
      role="region"
      aria-label={label}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        const id = nodeIdOf(event);
        if (id) onSelect(id);
      }}
      onPointerOver={(event) => setHoveredId(nodeIdOf(event))}
      onPointerLeave={() => setHoveredId(null)}
      onFocus={(event) => setHoveredId(nodeIdOf(event))}
      onBlur={() => setHoveredId(null)}
      className={`relative min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain rounded-md border border-border bg-background ${FOCUS_RING}`}
    >
      <div className="relative" style={{ width: layout.scale.width }}>
        <MapAxis layout={layout} from={from} to={to} />
        <div className="relative" style={{ height: layout.height }}>
          <MapThreads {...layer} />
          <MapLabels {...layer} note={bandNote} />
          <MapNodes {...layer} anchor={anchor} selectedId={selectedId} matches={matches} byVideo={byVideo} />
          {hovered && <MapTooltip layout={layout} node={hovered} />}
        </div>
      </div>
    </div>
  );
}
