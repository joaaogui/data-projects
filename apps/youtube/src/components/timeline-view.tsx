"use client";

import { formatCompact, getScoreColorClass } from "@/lib/format";
import { formatDuration } from "@/lib/scoring";
import { useVideoDescription } from "@/hooks/use-video-detail";
import type { VideoData } from "@/types/youtube";
import { Input } from "@data-projects/ui";
import dayjs from "dayjs";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  ExternalLink,
  MessageSquare,
  Search,
  ThumbsUp,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WEIGHTS } from "./metric-icon";
import { ScoreRing } from "./score-ring";

interface TimelineViewProps {
  videos: VideoData[];
  initialVideoId?: string | null;
}

interface YearGroup {
  year: string;
  videos: VideoData[];
  avgScore: number;
}

const YEAR_BATCH_SIZE = 2;
const VIDEO_BATCH_SIZE = 100;
const MAX_SCORE_BARS = 120;

/**
 * One bar per video in publication order: at a glance it shows whether a year
 * was consistent or erratic, which a single average can't convey.
 */
function YearScoreStrip({ videos }: Readonly<{ videos: VideoData[] }>) {
  const chronological = useMemo(
    () =>
      [...videos].sort(
        (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
      ),
    [videos]
  );
  const sampleStep = Math.max(
    1,
    Math.ceil(chronological.length / MAX_SCORE_BARS)
  );
  const sampled = chronological.filter(
    (_, index) =>
      index % sampleStep === 0 || index === chronological.length - 1
  );

  return (
    <div
      className="flex h-8 flex-1 items-end gap-px overflow-hidden"
      aria-hidden
      title={`Scores in publication order${
        sampleStep > 1 ? `, sampled every ${sampleStep} videos` : ""
      }`}
    >
      {sampled.map((v) => (
        <div
          key={v.videoId}
          className={`w-1 shrink-0 rounded-[1px] ${v.score >= 70 ? "bg-data" : "bg-foreground/30"}`}
          style={{ height: `${Math.max(v.score, 6)}%` }}
        />
      ))}
    </div>
  );
}

function ExpandedDetail({ video }: Readonly<{ video: VideoData }>) {
  const {
    description,
    isLoading: descriptionLoading,
  } = useVideoDescription(video.videoId, video.description);

  return (
    <div className="flex flex-col gap-5 border-t border-border bg-muted/20 p-4 sm:flex-row sm:p-5">
      <div className="relative aspect-video w-full shrink-0 sm:w-72">
        <Image
          src={video.thumbnail.replace("default", "hqdefault")}
          alt={video.title}
          fill
          sizes="(min-width: 640px) 288px, 100vw"
          className="rounded-md object-cover"
        />
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium tabular-nums text-white">
          {formatDuration(video.duration)}
        </span>
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center gap-4">
          <ScoreRing
            score={video.score}
            scoreComponents={video.scoreComponents}
            weights={DEFAULT_WEIGHTS}
            size={52}
          />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <ThumbsUp className="h-3.5 w-3.5" />
              <span className="font-medium tabular-nums text-foreground">
                {formatCompact(video.likes)}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="font-medium tabular-nums text-foreground">
                {formatCompact(video.comments)}
              </span>
            </span>
          </div>
        </div>

        {descriptionLoading && (
          <p role="status" className="text-xs text-muted-foreground">
            Loading description…
          </p>
        )}

        {description && (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}

        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Watch on YouTube
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

function TimelineRow({
  video,
  isExpanded,
  isHighlighted,
  onToggle,
  registerRef,
}: Readonly<{
  video: VideoData;
  isExpanded: boolean;
  isHighlighted: boolean;
  onToggle: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
}>) {
  return (
    <div
      ref={registerRef}
      className={`overflow-hidden border-b border-border last:border-b-0 ${isHighlighted ? "bg-data/5" : ""}`}
    >
      <button
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors hover:bg-muted/50 sm:gap-4"
      >
        <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
          {dayjs(video.publishedAt).format("MMM D")}
        </span>

        <div className="relative aspect-video w-16 shrink-0 overflow-hidden rounded bg-muted sm:w-20">
          <Image
            src={video.thumbnail}
            alt=""
            fill
            sizes="80px"
            className="object-cover"
          />
        </div>

        <span className="min-w-0 flex-1 truncate text-sm">{video.title}</span>

        <span className="hidden w-20 shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">
          {formatCompact(video.views)}
        </span>

        <span
          className={`w-9 shrink-0 rounded px-1.5 py-0.5 text-center text-xs font-medium tabular-nums ${getScoreColorClass(video.score)}`}
        >
          {video.score.toFixed(0)}
        </span>
      </button>

      {isExpanded && <ExpandedDetail video={video} />}
    </div>
  );
}

export function TimelineView({ videos, initialVideoId }: Readonly<TimelineViewProps>) {
  const [query, setQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(initialVideoId ?? null);
  const [visibleYearCount, setVisibleYearCount] = useState(YEAR_BATCH_SIZE);
  const [visibleVideosByYear, setVisibleVideosByYear] = useState<
    Record<string, number>
  >({});

  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return videos;
    return videos.filter((v) => v.title.toLowerCase().includes(q));
  }, [videos, query]);

  const groups = useMemo<YearGroup[]>(() => {
    const map = new Map<string, VideoData[]>();
    for (const v of filtered) {
      const year = dayjs(v.publishedAt).format("YYYY");
      const arr = map.get(year) ?? [];
      arr.push(v);
      map.set(year, arr);
    }

    const direction = newestFirst ? 1 : -1;
    return [...map.entries()]
      .sort(([a], [b]) => direction * b.localeCompare(a))
      .map(([year, vids]) => ({
        year,
        videos: [...vids].sort(
          (a, b) =>
            direction *
            (new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        ),
        avgScore: vids.reduce((s, v) => s + v.score, 0) / vids.length,
      }));
  }, [filtered, newestFirst]);

  const visibleGroups = query.trim()
    ? groups
    : groups.slice(0, visibleYearCount);
  const hiddenGroups = Math.max(0, groups.length - visibleGroups.length);
  const hiddenVideoCount = groups
    .slice(visibleGroups.length)
    .reduce((sum, group) => sum + group.videos.length, 0);

  useEffect(() => {
    setVisibleYearCount(YEAR_BATCH_SIZE);
    setVisibleVideosByYear({});
  }, [newestFirst]);

  // Deep link from the videos table: reveal and scroll to the requested video.
  useEffect(() => {
    if (!initialVideoId) return;
    setExpandedId(initialVideoId);
    const targetVideo = videos.find((video) => video.videoId === initialVideoId);
    if (!targetVideo) return;
    const targetYear = dayjs(targetVideo.publishedAt).format("YYYY");
    const groupIndex = groups.findIndex((group) => group.year === targetYear);
    if (groupIndex >= 0) {
      setVisibleYearCount((current) => Math.max(current, groupIndex + 1));
      const videoIndex = groups[groupIndex].videos.findIndex(
        (video) => video.videoId === initialVideoId
      );
      setVisibleVideosByYear((current) => ({
        ...current,
        [targetYear]: Math.max(
          current[targetYear] ?? VIDEO_BATCH_SIZE,
          videoIndex + 1
        ),
      }));
      globalThis.setTimeout(() => {
        rowRefs.current
          .get(initialVideoId)
          ?.scrollIntoView({ block: "center" });
      }, 0);
    }
  }, [initialVideoId, videos, groups]);

  const toggle = useCallback((videoId: string) => {
    setExpandedId((current) => (current === videoId ? null : videoId));
  }, []);

  const jumpToYear = useCallback(
    (year: string) => {
      const groupIndex = groups.findIndex((group) => group.year === year);
      if (groupIndex < 0) return;
      setVisibleYearCount((current) => Math.max(current, groupIndex + 1));
      globalThis.setTimeout(() => {
        document
          .getElementById(`timeline-year-${year}`)
          ?.scrollIntoView({ block: "start", behavior: "smooth" });
      }, 0);
    },
    [groups]
  );

  if (videos.length === 0) return null;

  const span = (() => {
    const times = videos.map((v) => new Date(v.publishedAt).getTime());
    return `${dayjs(Math.min(...times)).format("MMM YYYY")} – ${dayjs(Math.max(...times)).format("MMM YYYY")}`;
  })();

  const allYears = [...new Set(videos.map((v) => dayjs(v.publishedAt).format("YYYY")))].sort(
    (a, b) => (newestFirst ? b.localeCompare(a) : a.localeCompare(b))
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
        <p className="w-full text-xs text-muted-foreground sm:w-auto sm:text-sm">
          <span className="font-medium text-foreground tabular-nums">
            {filtered.length}
          </span>
          {filtered.length !== videos.length && ` of ${videos.length}`} videos ·{" "}
          {span}
        </p>

        <div className="relative w-full sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title..."
            className="h-8 pl-8 text-sm"
          />
        </div>

        <button
          onClick={() => setNewestFirst((v) => !v)}
          className="ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground sm:ml-0"
        >
          {newestFirst ? (
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpWideNarrow className="h-3.5 w-3.5" />
          )}
          {newestFirst ? "Newest" : "Oldest"}
        </button>
      </div>

      <div className="flex shrink-0 gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {allYears.map((year) => (
          <button
            key={year}
            onClick={() => jumpToYear(year)}
            className="rounded px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {year}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No videos match &ldquo;{query}&rdquo;
          </p>
        )}

        {visibleGroups.map((group) => {
          const visibleVideoCount =
            visibleVideosByYear[group.year] ?? VIDEO_BATCH_SIZE;
          const visibleVideos = group.videos.slice(0, visibleVideoCount);
          const hiddenVideos = Math.max(
            0,
            group.videos.length - visibleVideos.length
          );

          return (
          <section key={group.year} id={`timeline-year-${group.year}`} className="mb-6">
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 py-2 backdrop-blur sm:gap-4">
              <h3 className="w-12 shrink-0 font-mono text-sm font-medium">
                {group.year}
              </h3>
              <YearScoreStrip videos={group.videos} />
              <p className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
                {group.videos.length} videos · avg {group.avgScore.toFixed(0)}
              </p>
            </div>

            <div>
              {visibleVideos.map((video) => (
                <TimelineRow
                  key={video.videoId}
                  video={video}
                  isExpanded={expandedId === video.videoId}
                  isHighlighted={initialVideoId === video.videoId}
                  onToggle={() => toggle(video.videoId)}
                  registerRef={(el) => {
                    if (el) rowRefs.current.set(video.videoId, el);
                    else rowRefs.current.delete(video.videoId);
                  }}
                />
              ))}
            </div>

            {hiddenVideos > 0 && (
              <div className="flex justify-center border-b border-border py-3">
                <button
                  onClick={() =>
                    setVisibleVideosByYear((current) => ({
                      ...current,
                      [group.year]: Math.min(
                        group.videos.length,
                        visibleVideoCount + VIDEO_BATCH_SIZE
                      ),
                    }))
                  }
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Show {Math.min(VIDEO_BATCH_SIZE, hiddenVideos)} more from{" "}
                  {group.year}
                  <span className="ml-1 font-normal">
                    · {hiddenVideos.toLocaleString()} remaining
                  </span>
                </button>
              </div>
            )}
          </section>
          );
        })}

        {!query.trim() && hiddenGroups > 0 && (
          <div className="flex justify-center pb-4">
            <button
              onClick={() =>
                setVisibleYearCount((count) =>
                  Math.min(groups.length, count + YEAR_BATCH_SIZE)
                )
              }
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
    </div>
  );
}
