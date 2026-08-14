"use client";

import { formatCompact, getScoreColorClass } from "@/lib/format";
import { formatDuration } from "@/lib/scoring";
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

  return (
    <div
      className="flex h-8 flex-1 items-end gap-px overflow-hidden"
      aria-hidden
      title="Scores in publication order"
    >
      {chronological.map((v) => (
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

        {video.description && (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
            {video.description}
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

  // Deep link from the videos table: reveal and scroll to the requested video.
  useEffect(() => {
    if (!initialVideoId) return;
    setExpandedId(initialVideoId);
    const el = rowRefs.current.get(initialVideoId);
    el?.scrollIntoView({ block: "center" });
  }, [initialVideoId]);

  const toggle = useCallback((videoId: string) => {
    setExpandedId((current) => (current === videoId ? null : videoId));
  }, []);

  const jumpToYear = useCallback((year: string) => {
    document
      .getElementById(`timeline-year-${year}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, []);

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
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {filtered.length}
          </span>
          {filtered.length !== videos.length && ` of ${videos.length}`} videos ·{" "}
          {span}
        </p>

        <div className="relative ml-auto w-full sm:w-64">
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
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {newestFirst ? (
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpWideNarrow className="h-3.5 w-3.5" />
          )}
          {newestFirst ? "Newest" : "Oldest"}
        </button>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1">
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

        {groups.map((group) => (
          <section key={group.year} id={`timeline-year-${group.year}`} className="mb-6">
            <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-border bg-background/95 py-2 backdrop-blur">
              <h3 className="w-12 shrink-0 font-mono text-sm font-medium">
                {group.year}
              </h3>
              <YearScoreStrip videos={group.videos} />
              <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {group.videos.length} videos · avg {group.avgScore.toFixed(0)}
              </p>
            </div>

            <div>
              {group.videos.map((video) => (
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
          </section>
        ))}
      </div>
    </div>
  );
}
