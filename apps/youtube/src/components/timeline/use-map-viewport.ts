"use client";

import { useCallback, useEffect, useState } from "react";
import type { Viewport } from "./map-model";

const EMPTY: Viewport = { left: 0, top: 0, width: 0, height: 0 };

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Tracks the map scroller's scroll offsets and size in state, throttled to one
 * update per animation frame. The element is held in state (callback ref) so
 * listeners attach whenever it mounts.
 */
export function useMapViewport() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState<Viewport>(EMPTY);

  useEffect(() => {
    if (!element) return;
    let frame = 0;
    const read = () => {
      frame = 0;
      const next: Viewport = {
        left: element.scrollLeft,
        top: element.scrollTop,
        width: element.clientWidth,
        height: element.clientHeight,
      };
      setViewport((prev) =>
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next
      );
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    element.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    schedule();
    return () => {
      element.removeEventListener("scroll", schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [element]);

  const scrollTo = useCallback(
    (left: number, top: number | null, smooth: boolean) => {
      element?.scrollTo({
        left,
        top: top ?? element.scrollTop,
        behavior: smooth && !prefersReducedMotion() ? "smooth" : "auto",
      });
    },
    [element]
  );

  return { element, ref: setElement, viewport, scrollTo };
}

export type MapViewportApi = ReturnType<typeof useMapViewport>;
