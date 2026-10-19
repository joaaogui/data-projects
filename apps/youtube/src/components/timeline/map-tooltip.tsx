import { formatCompact } from "@/lib/format";
import dayjs from "dayjs";
import type { MapLayout, MapNode } from "./map-model";
import { cardHeight } from "./map-nodes";
import { ScoreBadge } from "./score-badge";

const WIDTH = 240;

/** Floating summary for the hovered or focused node, placed above it (below near the top). */
export function MapTooltip({ layout, node }: Readonly<{ layout: MapLayout; node: MapNode }>) {
  const half = layout.spec.node === "card" ? cardHeight(layout.spec) / 2 : node.r;
  const below = node.y - half < 80;
  const left = Math.min(layout.scale.width - WIDTH / 2 - 4, Math.max(WIDTH / 2 + 4, node.x));
  const { video } = node;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute z-30 -translate-x-1/2 rounded-md border border-border bg-background px-2.5 py-2 text-xs shadow-md ${
        below ? "" : "-translate-y-full"
      }`}
      style={{ left, top: below ? node.y + half + 8 : node.y - half - 8, width: WIDTH }}
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
