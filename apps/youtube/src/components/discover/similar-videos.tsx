"use client";

import { formatCompact, getScoreColorClass } from "@/lib/format";
import type { VideoData } from "@/types/youtube";
import { ArrowRight, Heart, Shuffle } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

interface SimilarResult {
  video: VideoData;
  similarity: number;
  reasons: string[];
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

function findSimilar(
  target: VideoData,
  allVideos: VideoData[],
): SimilarResult[] {
  const others = allVideos.filter((v) => v.videoId !== target.videoId);

  return others
    .map((v) => {
      const reasons: string[] = [];
      let score = 0;

      const topicSim = jaccard(target.topics ?? [], v.topics ?? []);
      if (topicSim > 0.3) {
        score += topicSim * 40;
        reasons.push("Same topics");
      }

      const durationRatio =
        Math.min(target.duration, v.duration) /
        Math.max(target.duration, v.duration, 1);
      if (durationRatio > 0.7) {
        score += durationRatio * 20;
        reasons.push("Similar length");
      }

      const daysDiff = Math.abs(target.days - v.days);
      if (daysDiff < 90) {
        score += Math.max(0, (90 - daysDiff) / 90) * 15;
        reasons.push("Same era");
      }

      const targetEng = target.rates?.engagementRate ?? 0;
      const vEng = v.rates?.engagementRate ?? 0;
      if (targetEng > 0 && vEng > 0) {
        const engRatio = Math.min(targetEng, vEng) / Math.max(targetEng, vEng);
        if (engRatio > 0.6) {
          score += engRatio * 15;
          reasons.push("Similar engagement");
        }
      }

      const scoreDiff = Math.abs(target.score - v.score);
      if (scoreDiff < 15) {
        score += Math.max(0, (15 - scoreDiff) / 15) * 10;
      }

      return { video: v, similarity: score, reasons };
    })
    .filter((r) => r.similarity > 10 && r.reasons.length > 0)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5);
}

export function SimilarVideos({
  videos,
  likedVideoIds,
}: Readonly<{ videos: VideoData[]; likedVideoIds?: Set<string> }>) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);

  const likedVideos = useMemo(
    () =>
      likedVideoIds && likedVideoIds.size > 0
        ? videos.filter((v) => likedVideoIds.has(v.videoId))
        : [],
    [videos, likedVideoIds],
  );

  useEffect(() => {
    if (autoSelected || selectedId) return;
    if (likedVideos.length > 0) {
      setSelectedId(likedVideos[0].videoId);
      setAutoSelected(true);
    }
  }, [likedVideos, autoSelected, selectedId]);

  const pickRandom = useCallback(() => {
    const topVideos = [...videos].sort((a, b) => b.score - a.score).slice(0, 20);
    const random = topVideos[Math.floor(Math.random() * topVideos.length)];
    setSelectedId(random.videoId);
  }, [videos]);

  const selected = useMemo(
    () => videos.find((v) => v.videoId === selectedId) ?? null,
    [videos, selectedId],
  );

  const results = useMemo(
    () => (selected ? findSimilar(selected, videos) : []),
    [selected, videos],
  );

  if (videos.length < 5) return null;

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <ArrowRight className="h-4 w-4 text-sky-500" />
        <h3 className="text-sm font-semibold">If You Liked&hellip;</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {likedVideos.length > 0
          ? "Based on the videos you liked on this channel."
          : "Pick a video you enjoyed, and we\u2019ll find similar ones from this channel."}
      </p>

      {likedVideos.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Heart className="h-3 w-3 text-rose-500" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Your liked videos
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {likedVideos.slice(0, 8).map((v) => (
              <button
                key={v.videoId}
                onClick={() => setSelectedId(v.videoId)}
                className={`text-[11px] rounded-full px-2.5 py-1 font-medium transition-colors truncate max-w-[200px] ${selectedId === v.videoId
                    ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/30"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                {v.title.length > 35 ? v.title.slice(0, 32) + "..." : v.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-4">
        <select
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value || null)}
          className="flex-1 rounded-lg border border-border/40 bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 truncate"
        >
          <option value="">Choose a video&hellip;</option>
          {[...videos]
            .sort((a, b) => b.views - a.views)
            .map((v) => (
              <option key={v.videoId} value={v.videoId}>
                {v.title}
              </option>
            ))}
        </select>
        <button
          onClick={pickRandom}
          className="shrink-0 rounded-lg border border-border/40 p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="Pick a random popular video"
        >
          <Shuffle className="h-4 w-4" />
        </button>
      </div>

      {selected && results.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-2">
            Because you liked{" "}
            <span className="font-medium text-foreground">
              &ldquo;{selected.title.length > 50 ? selected.title.slice(0, 47) + "..." : selected.title}&rdquo;
            </span>
          </p>
          {results.map(({ video, reasons }) => (
            <a
              key={video.videoId}
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl p-2 -mx-2 hover:bg-muted/60 transition-colors"
            >
              <div className="relative w-16 shrink-0 aspect-video rounded-md overflow-hidden bg-muted">
                <Image
                  src={video.thumbnail}
                  alt=""
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium line-clamp-2 leading-tight">
                  {video.title}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-muted-foreground">
                    {formatCompact(video.views)} views
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${getScoreColorClass(video.score)}`}
                  >
                    {video.score.toFixed(0)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {reasons.map((r) => (
                    <span
                      key={r}
                      className="text-[9px] rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 px-2 py-0.5 font-medium"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {selected && results.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">
          No similar videos found for this one. Try picking another!
        </p>
      )}
    </div>
  );
}
