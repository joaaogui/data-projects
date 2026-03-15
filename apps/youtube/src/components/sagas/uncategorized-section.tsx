"use client";

import { useSagaStorage } from "@/hooks/use-saga-storage";
import { useSagaSuggestions } from "@/hooks/use-saga-suggestions";
import { formatDuration } from "@/lib/scoring";
import type { Saga, SagaSuggestion, VideoData } from "@/types/youtube";
import { Button, Input } from "@data-projects/ui";
import dayjs from "dayjs";
import {
  Check,
  ChevronDown,
  FolderInput,
  Loader2,
  Plus,
  Wand2,
  X,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const CONFIDENCE_CLASSES: Record<string, string> = {
  high: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  low: "bg-muted text-muted-foreground",
};

function confidenceBadgeClass(confidence: string): string {
  return CONFIDENCE_CLASSES[confidence] ?? CONFIDENCE_CLASSES.low;
}

function UncategorizedVideoRow({
  video,
  isSelected,
  onToggle,
  suggestion,
  onAcceptSuggestion,
  onDismissSuggestion,
}: Readonly<{
  video: VideoData;
  isSelected: boolean;
  onToggle: () => void;
  suggestion?: SagaSuggestion;
  onAcceptSuggestion?: () => void;
  onDismissSuggestion?: () => void;
}>) {
  return (
    <div className="flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-muted/40">
      <button
        onClick={onToggle}
        className={`shrink-0 h-4 w-4 rounded border transition-colors flex items-center justify-center ${isSelected
          ? "bg-primary border-primary text-primary-foreground"
          : "border-muted-foreground/30 hover:border-muted-foreground/60"
          }`}
      >
        {isSelected && <Check className="h-3 w-3" />}
      </button>
      <div className="relative shrink-0 w-[120px] aspect-video">
        <Image
          src={video.thumbnail}
          alt=""
          fill
          sizes="120px"
          className="rounded-md object-cover"
        />
        <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-[9px] px-1 py-0.5 rounded tabular-nums font-medium">
          {formatDuration(video.duration)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium leading-snug line-clamp-1">{video.title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {dayjs(video.publishedAt).format("MMM D, YYYY")}
        </p>
        {suggestion && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${confidenceBadgeClass(suggestion.confidence)
              }`}>
              {suggestion.sagaName}
            </span>
            <button
              onClick={onAcceptSuggestion}
              className="h-5 w-5 rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 flex items-center justify-center transition-colors"
              title="Accept suggestion"
              aria-label="Accept suggestion"
            >
              <Check className="h-3 w-3" />
            </button>
            <button
              onClick={onDismissSuggestion}
              className="h-5 w-5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80 flex items-center justify-center transition-colors"
              title="Dismiss"
              aria-label="Dismiss suggestion"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function UncategorizedSection({
  channelId,
  videos,
  uncategorizedVideoIds,
  sagas,
}: Readonly<{
  channelId: string;
  videos: VideoData[];
  uncategorizedVideoIds: string[];
  sagas: Saga[];
}>) {
  const { assignVideos, createManualSaga } = useSagaStorage(channelId);
  const { suggestions, isLoading: suggestionsLoading, getSuggestions, dismissSuggestion } =
    useSagaSuggestions(channelId, uncategorizedVideoIds, sagas);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSagaName, setNewSagaName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const assignMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAssignMenu) return;
    const handler = (e: MouseEvent) => {
      if (assignMenuRef.current && !assignMenuRef.current.contains(e.target as Node)) {
        setShowAssignMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAssignMenu]);

  const uncatVideos = useMemo(() => {
    const idSet = new Set(uncategorizedVideoIds);
    return videos
      .filter((v) => idSet.has(v.videoId))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  }, [uncategorizedVideoIds, videos]);

  const assignableSagas = useMemo(
    () => sagas.filter((s) => s.id !== "standalone"),
    [sagas]
  );

  const toggleSelect = useCallback((videoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === uncatVideos.length) return new Set();
      return new Set(uncatVideos.map((v) => v.videoId));
    });
  }, [uncatVideos]);

  const handleAssignTo = useCallback(async (sagaId: string) => {
    if (selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      await assignVideos(sagaId, [...selectedIds]);
      setSelectedIds(new Set());
      setShowAssignMenu(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedIds, assignVideos]);

  const handleCreateSaga = useCallback(async () => {
    if (!newSagaName.trim() || selectedIds.size === 0) return;
    setIsSubmitting(true);
    try {
      await createManualSaga(newSagaName.trim(), [...selectedIds]);
      setSelectedIds(new Set());
      setNewSagaName("");
      setShowCreateForm(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [newSagaName, selectedIds, createManualSaga]);

  const handleAcceptSuggestion = useCallback(async (suggestion: SagaSuggestion) => {
    setIsSubmitting(true);
    try {
      await assignVideos(suggestion.sagaId, [suggestion.videoId]);
      dismissSuggestion(suggestion.videoId);
    } finally {
      setIsSubmitting(false);
    }
  }, [assignVideos, dismissSuggestion]);

  if (uncatVideos.length === 0) return null;

  const suggestionMap = new Map(suggestions.map((s) => [s.videoId, s]));

  return (
    <div className="rounded-2xl border border-dashed border-muted-foreground/30 bg-muted/20 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FolderInput className="h-4 w-4 text-muted-foreground" />
          Uncategorized Videos
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            ({uncatVideos.length})
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {suggestions.length === 0 && !suggestionsLoading && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={getSuggestions}
              disabled={suggestionsLoading}
            >
              <Wand2 className="h-3 w-3 mr-1.5" />
              Get AI Suggestions
            </Button>
          )}
          {suggestionsLoading && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Getting suggestions...
            </span>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-card border border-border/50 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{selectedIds.size}</span> selected
          </span>
          <div className="h-4 w-px bg-border" />

          <div className="relative" ref={assignMenuRef}>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setShowAssignMenu(!showAssignMenu); setShowCreateForm(false); }}
              disabled={isSubmitting}
            >
              <FolderInput className="h-3 w-3 mr-1.5" />
              Assign to...
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
            {showAssignMenu && (
              <div className="absolute top-full left-0 mt-1 z-20 w-64 max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-lg py-1">
                {assignableSagas.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 transition-colors truncate"
                    onClick={() => handleAssignTo(s.id)}
                  >
                    {s.name}
                    <span className="ml-1.5 text-muted-foreground">({s.videoCount})</span>
                  </button>
                ))}
                {assignableSagas.length === 0 && (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No sagas available</p>
                )}
              </div>
            )}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => { setShowCreateForm(!showCreateForm); setShowAssignMenu(false); }}
            disabled={isSubmitting}
          >
            <Plus className="h-3 w-3 mr-1.5" />
            Create saga
          </Button>

          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {showCreateForm && selectedIds.size > 0 && (
        <div className="flex items-center gap-2">
          <Input
            value={newSagaName}
            onChange={(e) => setNewSagaName(e.target.value)}
            placeholder="New saga name..."
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => e.key === "Enter" && handleCreateSaga()}
            autoFocus
          />
          <Button
            size="sm"
            className="h-8"
            onClick={handleCreateSaga}
            disabled={!newSagaName.trim() || isSubmitting}
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => { setShowCreateForm(false); setNewSagaName(""); }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
        <button
          onClick={toggleAll}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-1 px-2"
        >
          {selectedIds.size === uncatVideos.length ? "Deselect all" : "Select all"}
        </button>
        {uncatVideos.map((video) => (
          <UncategorizedVideoRow
            key={video.videoId}
            video={video}
            isSelected={selectedIds.has(video.videoId)}
            onToggle={() => toggleSelect(video.videoId)}
            suggestion={suggestionMap.get(video.videoId)}
            onAcceptSuggestion={
              suggestionMap.has(video.videoId)
                ? () => handleAcceptSuggestion(suggestionMap.get(video.videoId)!)
                : undefined
            }
            onDismissSuggestion={
              suggestionMap.has(video.videoId)
                ? () => dismissSuggestion(video.videoId)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
