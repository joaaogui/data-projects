"use client";

import type { SeriesPosition } from "@/lib/series";
import type { KeyboardEvent, SyntheticEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapBracketLabels, MapBrackets } from "./map-brackets";
import type { MapLayout } from "./map-model";
import { MapNodes } from "./map-nodes";
import { MapRuler, MapTrackDecor } from "./map-ruler";
import { MapTooltip, type TooltipAnchor } from "./map-tooltip";
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
  focusRequest: { videoId: string; nonce: number } | null;
  onSelect: (videoId: string) => void;
  /** byEpisode: move inside the selected story instead of along the line. */
  onStep: (direction: -1 | 1, fromId: string, byEpisode: boolean) => void;
  onClear: () => void;
}

function nodeOf(event: SyntheticEvent): Element | null {
  const target = event.target as Element | null;
  return target?.closest?.("[data-video-id]") ?? null;
}

function anchorOf(event: SyntheticEvent): TooltipAnchor | null {
  const node = nodeOf(event);
  const videoId = node?.getAttribute("data-video-id");
  if (!node || !videoId) return null;
  const rect = node.getBoundingClientRect();
  return { videoId, left: rect.left, top: rect.top, bottom: rect.bottom, width: rect.width, viewportWidth: window.innerWidth };
}

/** The scrollable map: sticky date ruler, story brackets, the track and its nodes. Events are delegated. */
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
  focusRequest,
  onSelect,
  onStep,
  onClear,
}: Readonly<StoryMapProps>) {
  const [tooltip, setTooltip] = useState<TooltipAnchor | null>(null);

  const matchedSeries = useMemo(() => {
    if (!matches) return null;
    const ids = new Set<string>();
    for (const id of matches) {
      const seriesId = layout.byId.get(id)?.seriesId;
      if (seriesId) ids.add(seriesId);
    }
    return ids;
  }, [matches, layout]);

  // Keyboard stepping focuses the new node once it is rendered (the scroll may need to arrive first).
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
    const targetId = nodeOf(event)?.getAttribute("data-video-id") ?? null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const base = selectedId ?? targetId;
      if (!base) return;
      event.preventDefault();
      onStep(event.key === "ArrowLeft" ? -1 : 1, base, event.shiftKey);
    } else if (event.key === "Escape" && selectedId) {
      event.preventDefault();
      onClear();
    } else if ((event.key === "Enter" || event.key === " ") && targetId && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      onSelect(targetId);
    }
  };

  const hovered = tooltip ? layout.byId.get(tooltip.videoId) : undefined;
  const layer = { layout, from, to, selectedSeriesId, matchedSeries };

  return (
    <div
      ref={mapRef}
      role="region"
      aria-label={label}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        const id = nodeOf(event)?.getAttribute("data-video-id");
        if (id) onSelect(id);
      }}
      onPointerOver={(event) => setTooltip(anchorOf(event))}
      onPointerLeave={() => setTooltip(null)}
      onFocus={(event) => setTooltip(anchorOf(event))}
      onBlur={() => setTooltip(null)}
      onScroll={() => setTooltip(null)}
      className={`relative max-h-[60%] min-w-0 shrink-0 overflow-auto overscroll-contain rounded-md border border-border bg-background ${FOCUS_RING}`}
    >
      <div className="relative" style={{ width: layout.width }}>
        <MapRuler layout={layout} from={from} to={to} />
        <div className="relative" style={{ height: layout.height }}>
          <MapTrackDecor layout={layout} from={from} to={to} />
          <MapBrackets {...layer} />
          <MapBracketLabels {...layer} />
          <MapNodes {...layer} anchor={anchor} selectedId={selectedId} matches={matches} byVideo={byVideo} />
        </div>
      </div>
      {tooltip && hovered && <MapTooltip video={hovered.video} anchor={tooltip} />}
    </div>
  );
}
