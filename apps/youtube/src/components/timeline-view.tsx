"use client";

import { formatCompact, getScoreColorClass } from "@/lib/format";
import { formatDuration, getScoreLabel } from "@/lib/scoring";
import type { VideoData } from "@/types/youtube";
import { Button, Input } from "@data-projects/ui";
import dayjs from "dayjs";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Eye,
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

function AdjacentVideoCard({
  video,
  direction,
  onClick,
}: Readonly<{
  video: VideoData;
  direction: "before" | "after";
  onClick: () => void;
}>) {
  const date = dayjs(video.publishedAt).format("MMM D, YYYY");
  const { color: scoreColor } = getScoreLabel(video.score);

  return (
    <button
      onClick={onClick}
      className="group w-full text-left rounded-2xl border border-border/50 bg-card/60 p-4 hover:-translate-y-0.5 transition-all duration-200 hover:bg-muted/50 hover:border-primary/30 hover:shadow-md"
    >
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 mb-2">
        {direction === "before" ? "Published before" : "Published after"}
      </p>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="relative flex-shrink-0 w-[100px] sm:w-[160px] aspect-video">
          <Image
            src={video.thumbnail}
            alt={video.title}
            fill
            sizes="(min-width: 640px) 160px, 100px"
            className="rounded-lg object-cover"
          />
          <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1 py-0.5 rounded tabular-nums font-medium">
            {formatDuration(video.duration)}
          </span>
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <h4 className="text-sm font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
            {video.title}
          </h4>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {date}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatCompact(video.views)}
            </span>
            <span className={`font-medium tabular-nums ${scoreColor}`}>
              Score {video.score.toFixed(0)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function CenterVideoCard({ video }: Readonly<{ video: VideoData }>) {
  const date = dayjs(video.publishedAt).format("MMMM D, YYYY");

  return (
    <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60 mb-3">
        Current video
      </p>
      <div className="flex flex-col sm:flex-row gap-5">
        <div className="relative flex-shrink-0 sm:w-[320px] aspect-video">
          <Image
            src={video.thumbnail.replace("default", "hqdefault")}
            alt={video.title}
            fill
            sizes="(min-width: 640px) 320px, 100vw"
            className="rounded-lg object-cover"
          />
          <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded tabular-nums font-medium">
            {formatDuration(video.duration)}
          </span>
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h3 className="text-lg font-bold leading-snug">{video.title}</h3>
            <div className="flex items-center gap-2 mt-1.5 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{date}</span>
              <span className="text-border">|</span>
              <span>{video.days === 0 ? "Today" : `${video.days}d ago`}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <ScoreRing
              score={video.score}
              scoreComponents={video.scoreComponents}
              weights={DEFAULT_WEIGHTS}
              size={56}
            />
            <div className="flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Eye className="h-4 w-4" />
                <span className="font-medium text-foreground tabular-nums">{formatCompact(video.views)}</span>
                <span>views</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ThumbsUp className="h-4 w-4" />
                <span className="font-medium text-foreground tabular-nums">{formatCompact(video.likes)}</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                <span className="font-medium text-foreground tabular-nums">{formatCompact(video.comments)}</span>
              </span>
            </div>
          </div>

          {video.description && (
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
              {video.description}
            </p>
          )}

          <a
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-all"
          >
            Watch on YouTube
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

export function TimelineView({ videos, initialVideoId }: Readonly<TimelineViewProps>) {
  const sorted = useMemo(
    () => [...videos].sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()),
    [videos]
  );

  const initialIdx = useMemo(() => {
    if (!initialVideoId) return Math.max(0, sorted.length - 1);
    const idx = sorted.findIndex((v) => v.videoId === initialVideoId);
    return idx >= 0 ? idx : Math.max(0, sorted.length - 1);
  }, [sorted, initialVideoId]);

  const [currentIndex, setCurrentIndex] = useState(initialIdx);
  const [jumpQuery, setJumpQuery] = useState("");
  const [jumpOpen, setJumpOpen] = useState(false);
  const jumpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentIndex(initialIdx);
  }, [initialIdx]);

  const current = sorted[currentIndex] ?? null;
  const prev = currentIndex > 0 ? sorted[currentIndex - 1] : null;
  const next = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null;

  const goTo = useCallback(
    (idx: number) => {
      setCurrentIndex(Math.max(0, Math.min(sorted.length - 1, idx)));
      setJumpOpen(false);
      setJumpQuery("");
    },
    [sorted.length]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goTo(currentIndex - 1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        goTo(currentIndex + 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(sorted.length - 1);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [currentIndex, goTo, sorted.length]);

  const jumpResults = useMemo(() => {
    if (jumpQuery.trim().length < 2) return [];
    const q = jumpQuery.toLowerCase();
    return sorted
      .map((v, i) => ({ video: v, index: i }))
      .filter(({ video }) => video.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [sorted, jumpQuery]);

  useEffect(() => {
    if (jumpOpen) {
      globalThis.setTimeout(() => jumpInputRef.current?.focus(), 50);
    }
  }, [jumpOpen]);

  if (!current) return null;

  const progressPct = sorted.length > 1 ? (currentIndex / (sorted.length - 1)) * 100 : 50;

  return (
    <div className="flex flex-col h-full gap-4">
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            <span className="font-medium text-foreground tabular-nums">{currentIndex + 1}</span>
            <span className="text-muted-foreground/60"> / </span>
            <span className="tabular-nums">{sorted.length}</span>
          </span>
        </div>

        <div className="flex-1 min-w-[80px] max-w-xs">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary/60 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs hidden sm:inline-flex"
            disabled={currentIndex === 0}
            onClick={() => goTo(0)}
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
            Oldest
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={!prev}
            onClick={() => goTo(currentIndex - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Older</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            disabled={!next}
            onClick={() => goTo(currentIndex + 1)}
          >
            <span className="hidden sm:inline">Newer</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs hidden sm:inline-flex"
            disabled={currentIndex === sorted.length - 1}
            onClick={() => goTo(sorted.length - 1)}
          >
            Newest
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>

          <div className="relative">
            <Button
              variant={jumpOpen ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2"
              onClick={() => setJumpOpen((o) => !o)}
            >
              <Search className="h-3.5 w-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Jump to</span>
            </Button>
            {jumpOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/50 bg-card shadow-xl z-50 overflow-hidden animate-scale-in">
                <div className="p-2">
                  <Input
                    ref={jumpInputRef}
                    placeholder="Search by title..."
                    value={jumpQuery}
                    onChange={(e) => setJumpQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setJumpOpen(false);
                        setJumpQuery("");
                      }
                      if (e.key === "Enter" && jumpResults.length > 0) {
                        goTo(jumpResults[0].index);
                      }
                    }}
                    className="h-8 text-sm"
                  />
                </div>
                {jumpResults.length > 0 && (
                  <ul className="max-h-64 overflow-y-auto border-t border-border/50">
                    {jumpResults.map(({ video, index }) => (
                      <li key={video.videoId}>
                        <button
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition-colors flex items-center gap-2"
                          onClick={() => goTo(index)}
                        >
                          <div className="relative w-12 aspect-video flex-shrink-0">
                            <Image
                              src={video.thumbnail}
                              alt=""
                              fill
                              sizes="48px"
                              className="rounded object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{video.title}</p>
                            <p className="text-muted-foreground">
                              {dayjs(video.publishedAt).format("MMM D, YYYY")} &middot; #{index + 1}
                            </p>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {jumpQuery.trim().length >= 2 && jumpResults.length === 0 && (
                  <p className="px-3 py-3 text-xs text-muted-foreground text-center border-t border-border/50">
                    No videos match
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline bar */}
      <div className="flex-shrink-0 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-3">
        <div className="relative h-8">
          <div className="absolute top-1/2 left-0 right-0 h-px bg-border/50 -translate-y-1/2" />

          <div className="relative h-full flex items-center">
            {(() => {
              const maxDots = 200;
              const skipEvery = sorted.length > maxDots ? Math.ceil(sorted.length / maxDots) : 1;

              const visibleDots: { video: VideoData; idx: number }[] = [];
              for (let idx = 0; idx < sorted.length; idx++) {
                if (idx === currentIndex || idx % skipEvery === 0) {
                  visibleDots.push({ video: sorted[idx], idx });
                }
              }

              return visibleDots.map(({ video, idx }) => {
                const position = sorted.length > 1 ? (idx / (sorted.length - 1)) * 100 : 50;
                const isCurrent = idx === currentIndex;
                const score = video.score;
                const dotColor = getScoreColorClass(score).split(" ")[0].replace("/15", "");

                return (
                  <button
                    key={video.videoId}
                    onClick={() => goTo(idx)}
                    className={`absolute -translate-x-1/2 transition-all duration-200 rounded-full ${isCurrent
                      ? `w-3.5 h-3.5 ${dotColor} ring-2 ring-primary ring-offset-2 ring-offset-card z-10 animate-pulse-glow`
                      : `w-1.5 h-1.5 ${dotColor} hover:w-2.5 hover:h-2.5 opacity-60 hover:opacity-100`
                      }`}
                    style={{ left: `${position}%` }}
                    title={`${video.title} (${dayjs(video.publishedAt).format("MMM YYYY")})`}
                    aria-label={video.title}
                  />
                );
              });
            })()}
          </div>

          <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/60">
            <span>{dayjs(sorted[0]?.publishedAt).format("MMM YYYY")}</span>
            <span>{dayjs(sorted.at(-1)?.publishedAt).format("MMM YYYY")}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-3">
          {prev ? (
            <AdjacentVideoCard video={prev} direction="before" onClick={() => goTo(currentIndex - 1)} />
          ) : (
            <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground">
              This is the oldest video on the channel
            </div>
          )}

          <div className="flex items-center justify-center py-1">
            <div className="h-6 w-px bg-border/50" />
          </div>

          <CenterVideoCard video={current} />

          <div className="flex items-center justify-center py-1">
            <div className="h-6 w-px bg-border/50" />
          </div>

          {next ? (
            <AdjacentVideoCard video={next} direction="after" onClick={() => goTo(currentIndex + 1)} />
          ) : (
            <div className="rounded-xl border border-dashed border-border/40 p-6 text-center text-sm text-muted-foreground">
              This is the newest video on the channel
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center justify-center text-[10px] text-muted-foreground/50 pb-1">
        Use arrow keys to navigate &middot; Home/End to jump to oldest/newest
      </div>
    </div>
  );
}
