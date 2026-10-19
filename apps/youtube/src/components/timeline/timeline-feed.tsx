"use client";

import { TimelineRow } from "./timeline-row";
import {
  FOCUS_RING,
  VIDEO_BATCH_SIZE,
  YEAR_BATCH_SIZE,
  yearDomId,
} from "./timeline-model";
import type { TimelineFeedModel } from "./use-timeline-feed";
import { YearScoreStrip } from "./year-score-strip";

/** Chronological feed grouped by year, with year chips, sticky headers and batching. */
export function TimelineFeed({ feed }: Readonly<{ feed: TimelineFeedModel }>) {
  const {
    query,
    newestFirst,
    filterActive,
    groups,
    visibleGroups,
    hiddenGroups,
    hiddenVideoCount,
    visibleVideosByYear,
    expandedId,
    highlightId,
    jumpToYear,
    showMoreYears,
    showMoreVideos,
  } = feed;

  return (
    <>
      <div className="flex shrink-0 gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {groups.map((group) => (
          <button
            type="button"
            key={group.year}
            onClick={() => jumpToYear(group.year)}
            className={`rounded px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${FOCUS_RING}`}
          >
            {group.year}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {query.trim() ? (
              <>No videos match &ldquo;{query}&rdquo;</>
            ) : (
              "No videos in a series"
            )}
          </p>
        )}

        {visibleGroups.map((group) => {
          const visibleCount = visibleVideosByYear[group.year] ?? VIDEO_BATCH_SIZE;
          const hiddenVideos = Math.max(0, group.videos.length - visibleCount);

          return (
            <section key={group.year} id={yearDomId(group.year)} className="mb-6">
              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 py-2 backdrop-blur sm:gap-4">
                <h3 className="w-12 shrink-0 font-mono text-sm font-medium">{group.year}</h3>
                <YearScoreStrip videos={group.videos} />
                <p className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
                  {group.videos.length} videos · avg {group.avgScore.toFixed(0)}
                </p>
              </div>

              <div>
                {group.videos.slice(0, visibleCount).map((video) => (
                  <TimelineRow
                    key={video.videoId}
                    video={video}
                    isExpanded={expandedId === video.videoId}
                    isHighlighted={highlightId === video.videoId}
                  />
                ))}
              </div>

              {hiddenVideos > 0 && (
                <div className="flex justify-center border-b border-border py-3">
                  <button
                    type="button"
                    onClick={() => showMoreVideos(group.year, group.videos.length)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${FOCUS_RING}`}
                  >
                    Show {Math.min(VIDEO_BATCH_SIZE, hiddenVideos)} more from {group.year}
                    <span className="ml-1 font-normal">
                      · {hiddenVideos.toLocaleString()} remaining
                    </span>
                  </button>
                </div>
              )}
            </section>
          );
        })}

        {!filterActive && hiddenGroups > 0 && (
          <div className="flex justify-center pb-4">
            <button
              type="button"
              onClick={showMoreYears}
              className={`rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${FOCUS_RING}`}
            >
              Show {Math.min(YEAR_BATCH_SIZE, hiddenGroups)}{" "}
              {newestFirst ? "older" : "newer"} years
              <span className="ml-1.5 text-xs font-normal">
                · {hiddenVideoCount.toLocaleString()} videos remaining
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
