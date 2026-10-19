import { formatCompact } from "@/lib/format";
import type { VideoData } from "@/types/youtube";
import dayjs from "dayjs";
import { ScoreBadge } from "./score-badge";

const WIDTH = 240;
const ROOM_ABOVE = 90;

export interface TooltipAnchor {
  videoId: string;
  /** Viewport rect of the hovered/focused node (measured in the event handler). */
  left: number;
  top: number;
  bottom: number;
  width: number;
  viewportWidth: number;
}

/**
 * Floating summary for the hovered or focused node. Fixed-positioned from the
 * node's viewport rect, so the short map scroller never clips it.
 */
export function MapTooltip({ video, anchor }: Readonly<{ video: VideoData; anchor: TooltipAnchor }>) {
  const above = anchor.top > ROOM_ABOVE;
  const center = anchor.left + anchor.width / 2;
  const left = Math.min(anchor.viewportWidth - WIDTH / 2 - 8, Math.max(WIDTH / 2 + 8, center));

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed z-50 -translate-x-1/2 rounded-md border border-border bg-background px-2.5 py-2 text-xs shadow-md ${
        above ? "-translate-y-full" : ""
      }`}
      style={{ left, top: above ? anchor.top - 8 : anchor.bottom + 8, width: WIDTH }}
    >
      <p className="line-clamp-2 font-medium leading-snug text-foreground">{video.title}</p>
      <p className="mt-1.5 flex items-center gap-2 tabular-nums text-muted-foreground">
        <span>{dayjs(video.publishedAt).format("MMM D, YYYY")}</span>
        <span>{formatCompact(video.views)} views</span>
        <span className="ml-auto">
          <ScoreBadge score={video.score} />
        </span>
      </p>
    </div>
  );
}
