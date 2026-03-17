"use client";

import { useTranscriptSearch, type TranscriptSearchResult } from "@/hooks/use-transcript-search";
import { formatCompact, getScoreColorClass } from "@/lib/format";
import dayjs from "dayjs";
import { ArrowLeft, Clock, ExternalLink, Eye, FileSearch, FileText, Loader2, Search, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function estimateTimestamp(result: TranscriptSearchResult): number | null {
  if (result.matchOffset < 0 || result.textLength <= 0 || result.duration <= 0) return null;
  const ratio = result.matchOffset / result.textLength;
  return Math.round(ratio * result.duration);
}

function youtubeTimestampUrl(videoId: string, seconds: number): string {
  return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
}

interface TranscriptSearchOverlayProps {
  channelId: string;
  open: boolean;
  onClose: () => void;
  onSelectVideo: (videoId: string) => void;
}

const STAGGER_CLASSES = [
  "",
  "stagger-1",
  "stagger-2",
  "stagger-3",
  "stagger-4",
  "stagger-5",
  "stagger-6",
  "stagger-7",
  "stagger-8",
  "stagger-9",
];

function TimestampTooltip({
  videoId,
  seconds,
  children,
  onClick,
}: Readonly<{ videoId: string; seconds: number; children: React.ReactNode; onClick?: () => void }>) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setCoords({ top: rect.top - 6, left: rect.left + rect.width / 2 });
    }
    setVisible(true);
  };
  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), 150);
  };
  const keepOpen = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      show();
    }
  };

  return (
    <button
      type="button"
      ref={anchorRef}
      tabIndex={0}
      className={`inline border-0 bg-transparent p-0 font-inherit ${onClick ? "cursor-pointer" : "cursor-default"}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {children}
      {visible && coords && createPortal(
        <div
          role="tooltip"
          className="fixed z-100 animate-fade-up pointer-events-auto"
          style={{
            top: coords.top,
            left: coords.left,
            transform: "translate(-50%, -100%)",
            animationDuration: "150ms",
          }}
          onMouseEnter={keepOpen}
          onMouseLeave={hide}
        >
          <a
            href={youtubeTimestampUrl(videoId, seconds)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="
              flex items-center gap-1.5 whitespace-nowrap
              rounded-lg border border-border/50 bg-popover px-2.5 py-1.5
              text-[11px] font-medium text-popover-foreground
              shadow-lg shadow-black/10
              hover:bg-primary hover:text-primary-foreground hover:border-primary
              transition-colors duration-150
            "
          >
            <Clock className="h-3 w-3" />
            <span className="tabular-nums">{formatTimestamp(seconds)}</span>
            <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </a>
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-border/50" />
        </div>,
        document.body
      )}
    </button>
  );
}

function HighlightedSnippet({
  text,
  pattern,
  videoId,
  estimatedSeconds,
  onClickHighlight,
}: Readonly<{
  text: string;
  pattern: string | null;
  videoId: string;
  estimatedSeconds: number | null;
  onClickHighlight?: () => void;
}>) {
  if (!text || !pattern) return <span>{text}</span>;

  let regex: RegExp;
  try {
    regex = new RegExp(`(${pattern})`, "gi");
  } catch {
    return <span>{text}</span>;
  }
  const parts = text.split(regex);

  let firstMatchRendered = false;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClickHighlight?.();
  };

  return (
    <span>
      {parts.map((part, i) => {
        if (regex.test(part)) {
          const isFirst = !firstMatchRendered;
          firstMatchRendered = true;

          const highlightClassName =
            "inline bg-primary/20 text-primary font-medium rounded-sm px-0.5 animate-highlight-pulse cursor-pointer hover:bg-primary/30 transition-colors";

          if (isFirst && estimatedSeconds !== null) {
            return (
              <TimestampTooltip
                key={`${i}-${part}`}
                videoId={videoId}
                seconds={estimatedSeconds}
                onClick={onClickHighlight}
              >
                <span className={highlightClassName}>{part}</span>
              </TimestampTooltip>
            );
          }
          return (
            <button
              type="button"
              key={`${i}-${part}`}
              className={`inline ${highlightClassName} border-0 font-inherit`}
              onClick={handleClick}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClickHighlight?.();
                }
              }}
            >
              {part}
            </button>
          );
        }
        return <span key={`${i}-${part}`}>{part}</span>;
      })}
    </span>
  );
}

function ResultCard({
  result,
  highlightPattern,
  index,
  isActive,
  onClick,
  onMouseEnter,
  onViewTranscript,
}: Readonly<{
  result: TranscriptSearchResult;
  highlightPattern: string | null;
  index: number;
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onViewTranscript: () => void;
}>) {
  const stagger = STAGGER_CLASSES[Math.min(index, STAGGER_CLASSES.length - 1)];
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isActive) ref.current?.scrollIntoView({ block: "nearest" });
  }, [isActive]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      data-active={isActive}
      className={`
        w-full text-left rounded-xl p-3 transition-all duration-150
        animate-fade-up ${stagger} opacity-0
        border border-transparent
        ${isActive
          ? "bg-primary/8 border-primary/20 shadow-sm shadow-primary/5"
          : "hover:bg-muted/60"
        }
      `}
      style={{ animationFillMode: "forwards" }}
    >
      <div className="flex gap-3">
        {result.thumbnail && (
          <div className="relative h-16 w-28 shrink-0 rounded-lg overflow-hidden bg-muted">
            <Image
              src={result.thumbnail}
              alt={result.title}
              fill
              sizes="112px"
              className="object-cover"
            />
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium leading-snug line-clamp-1">{result.title}</h4>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${getScoreColorClass(result.score)}`}
            >
              {result.score.toFixed(0)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>{dayjs(result.publishedAt).format("MMM D, YYYY")}</span>
            <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/40" />
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {formatCompact(result.views)}
            </span>
            {result.language && (
              <>
                <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/40" />
                <span className="uppercase">{result.language}</span>
              </>
            )}
          </div>

          {result.contextSnippet && (
            <p className="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
              <HighlightedSnippet
                text={result.contextSnippet}
                pattern={highlightPattern}
                videoId={result.videoId}
                estimatedSeconds={estimateTimestamp(result)}
                onClickHighlight={onViewTranscript}
              />
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function FullTextHighlight({ text, pattern }: Readonly<{ text: string; pattern: string | null }>) {
  const firstMatchRef = useRef<HTMLElement>(null);
  const scrolledRef = useRef(false);

  useEffect(() => {
    if (firstMatchRef.current && !scrolledRef.current) {
      scrolledRef.current = true;
      setTimeout(() => {
        firstMatchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, []);

  if (!pattern) return <span>{text}</span>;

  let regex: RegExp;
  try {
    regex = new RegExp(`(${pattern})`, "gi");
  } catch {
    return <span>{text}</span>;
  }
  const parts = text.split(regex);
  let firstMatchDone = false;

  return (
    <span>
      {parts.map((part, i) => {
        if (regex.test(part)) {
          const isFirst = !firstMatchDone;
          firstMatchDone = true;
          return (
            <mark
              key={`${i}-${part}`}
              ref={isFirst ? firstMatchRef : undefined}
              className="bg-primary/25 text-primary font-medium rounded-sm px-0.5"
            >
              {part}
            </mark>
          );
        }
        return <span key={`${i}-${part}`}>{part}</span>;
      })}
    </span>
  );
}

interface TranscriptReaderState {
  videoId: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
  duration: number;
  matchOffset: number;
  textLength: number;
}

function TranscriptReader({
  video,
  highlightPattern,
  onBack,
}: Readonly<{
  video: TranscriptReaderState;
  highlightPattern: string | null;
  onBack: () => void;
}>) {
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetch(`/api/transcripts/${video.videoId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setTranscript(data.transcript?.fullText ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(err instanceof Error ? err.message : "Failed to load transcript");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [video.videoId]);

  const estimatedSeconds = video.matchOffset >= 0 && video.textLength > 0 && video.duration > 0
    ? Math.round((video.matchOffset / video.textLength) * video.duration)
    : null;

  return (
    <div className="animate-slide-right">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border/40 px-5 py-3">
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label="Back to results"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          {video.thumbnail && (
            <div className="relative h-8 w-14 shrink-0 rounded-md overflow-hidden bg-muted">
              <Image src={video.thumbnail} alt={video.title} fill sizes="56px" className="object-cover" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-medium truncate">{video.title}</h3>
            <p className="text-[11px] text-muted-foreground">
              {dayjs(video.publishedAt).format("MMM D, YYYY")}
              {estimatedSeconds !== null && (
                <>
                  <span className="mx-1.5">&middot;</span>
                  <a
                    href={youtubeTimestampUrl(video.videoId, estimatedSeconds)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Clock className="h-2.5 w-2.5" />
                    ~{formatTimestamp(estimatedSeconds)}
                  </a>
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Transcript body */}
      <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
        {loading && (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground animate-fade-up">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading transcript...</span>
          </div>
        )}

        {fetchError && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 animate-fade-up">
            <p className="text-sm text-destructive">{fetchError}</p>
          </div>
        )}

        {!loading && !fetchError && !transcript && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 animate-fade-up">
            <div className="rounded-full bg-muted p-3">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No transcript available</p>
          </div>
        )}

        {!loading && transcript && (
          <p className="text-sm leading-relaxed text-foreground/85 whitespace-pre-wrap">
            <FullTextHighlight text={transcript} pattern={highlightPattern} />
          </p>
        )}
      </div>
    </div>
  );
}

function ShimmerCard({ index }: Readonly<{ index: number }>) {
  const stagger = STAGGER_CLASSES[Math.min(index, STAGGER_CLASSES.length - 1)];
  return (
    <div className={`flex gap-3 rounded-xl p-3 animate-fade-up ${stagger}`} style={{ animationFillMode: "forwards" }}>
      <div className="h-16 w-28 shrink-0 rounded-lg bg-muted animate-pulse" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
        <div className="h-3 w-full rounded bg-muted/60 animate-pulse" />
      </div>
    </div>
  );
}

export function TranscriptSearchOverlay({
  channelId,
  open,
  onClose,
  onSelectVideo,
}: Readonly<TranscriptSearchOverlayProps>) {
  const {
    query, search, aiSearch, reset, highlightPattern, generatedRegex, isGenerating,
    results, isSearching, error, hasSearched,
  } = useTranscriptSearch(channelId);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewingVideo, setViewingVideo] = useState<TranscriptReaderState | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const isBusy = isGenerating || isSearching;

  const handleAiSearch = useCallback(() => {
    if (!query.trim() || isGenerating) return;
    setAiError(null);
    aiSearch(query).catch((err: unknown) => {
      setAiError(err instanceof Error ? err.message : "AI search failed");
    });
  }, [query, isGenerating, aiSearch]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      reset();
      setActiveIndex(0);
      setViewingVideo(null);
      setAiError(null);
    }
  }, [open, reset]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  const handleSelect = useCallback(
    (videoId: string) => {
      onSelectVideo(videoId);
      onClose();
    },
    [onSelectVideo, onClose],
  );


  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (viewingVideo) {
          setViewingVideo(null);
        } else {
          onClose();
        }
        return;
      }
      if (viewingVideo) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (results[activeIndex]) handleSelect(results[activeIndex].videoId);
      }
    },
    [results, activeIndex, handleSelect, onClose, viewingVideo],
  );

  if (open) {
    const showResults = hasSearched && results.length > 0 && !isGenerating;
    const showEmpty = hasSearched && results.length === 0 && !isBusy && query.trim().length >= 2;
    const showInitial = !hasSearched && !isBusy && query.trim().length < 2;

    return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 w-full h-full bg-black/50 backdrop-blur-sm border-0 p-0 cursor-default transition-opacity duration-300"
        onClick={onClose}
        aria-label="Close transcript search"
        tabIndex={-1}
      />

      <dialog
        open
        aria-modal="true"
        aria-label="Search transcripts"
        className="relative mx-4 sm:mx-auto mt-[10vh] sm:mt-[15vh] w-auto sm:w-full max-w-2xl rounded-2xl border border-border/40 bg-card shadow-2xl p-0 animate-spotlight-in glass-strong"
      >
        {viewingVideo ? (
          <TranscriptReader
            video={viewingVideo}
            highlightPattern={highlightPattern}
            onBack={() => setViewingVideo(null)}
          />
        ) : (
          <>
            {/* Search header */}
            <div className="flex items-center gap-3 border-b border-border/40 px-5 py-4">
              <FileSearch className="h-5 w-5 shrink-0 text-primary" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => { setAiError(null); search(e.target.value); }}
                onKeyDown={handleKeyDown}
                placeholder="Search transcripts..."
                disabled={isGenerating}
                className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground/50 font-medium disabled:cursor-not-allowed min-w-0"
                spellCheck={false}
              />
              {query && !isBusy && (
                <button
                  onClick={() => { setAiError(null); reset(); inputRef.current?.focus(); }}
                  className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={handleAiSearch}
                disabled={!query.trim() || isGenerating}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="AI search"
                title="AI-powered search"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </button>
              <kbd className="hidden sm:inline-flex shrink-0 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                ESC
              </kbd>
            </div>
            {isGenerating && (
              <div className="px-5 py-1.5 border-b border-border/40">
                <p className="text-[11px] text-muted-foreground/60 animate-pulse">Understanding your query...</p>
              </div>
            )}
            {aiError && !isGenerating && (
              <div className="px-5 py-2 border-b border-border/40 bg-destructive/5">
                <p className="text-xs text-destructive">{aiError}</p>
              </div>
            )}
            {error && !isGenerating && (
              <div className="px-5 py-2 border-b border-border/40 bg-destructive/5">
                <p className="text-xs text-destructive">{error}</p>
              </div>
            )}

            {/* Results area */}
            <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
              {(isSearching || isGenerating) && (
                <div className="space-y-1 p-1">
                  <ShimmerCard index={0} />
                  <ShimmerCard index={1} />
                  <ShimmerCard index={2} />
                </div>
              )}

              {showResults && !isSearching && (
                <>
                  <div className="px-3 py-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{results.length}</span>
                      {" "}video{results.length === 1 ? "" : "s"} matched
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      <kbd className="font-mono">↑↓</kbd> navigate &middot; <kbd className="font-mono">↵</kbd> open
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    {results.map((result, i) => (
                      <ResultCard
                        key={result.videoId}
                        result={result}
                        highlightPattern={highlightPattern}
                        index={i}
                        isActive={i === activeIndex}
                        onClick={() => handleSelect(result.videoId)}
                        onMouseEnter={() => setActiveIndex(i)}
                        onViewTranscript={() => setViewingVideo({
                          videoId: result.videoId,
                          title: result.title,
                          thumbnail: result.thumbnail,
                          publishedAt: result.publishedAt,
                          duration: result.duration,
                          matchOffset: result.matchOffset,
                          textLength: result.textLength,
                        })}
                      />
                    ))}
                  </div>
                </>
              )}

              {showEmpty && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 animate-fade-up">
                  <div className="rounded-full bg-muted p-3">
                    <Search className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">No matches found</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Try different keywords or check if transcripts have been synced
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex flex-col items-center justify-center py-12 gap-2 animate-fade-up">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              {showInitial && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 animate-scale-in">
                  <div className="rounded-full bg-primary/10 p-3">
                    <FileSearch className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">Search video transcripts</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Type to search, or describe what you&apos;re looking for and press
                      <Sparkles className="inline h-3 w-3 mx-1 text-primary" />
                      for AI-powered search
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {showResults && !isSearching && !isGenerating && (
              <div className="border-t border-border/40 px-5 py-2.5">
                {generatedRegex ? (
                  <p className="text-[10px] text-muted-foreground/50 text-center truncate" title={generatedRegex}>
                    Matched with: <code className="font-mono text-muted-foreground/70">{generatedRegex}</code>
                  </p>
                ) : (
                  <p className="text-[10px] text-muted-foreground/50 text-center">
                    Results ordered by publish date
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </dialog>
    </div>
    );
  }
  return null;
}
