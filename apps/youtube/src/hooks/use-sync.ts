"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { FetchProgress, SyncLogEntry } from "@/types/youtube";

export interface SyncJobState {
  jobId: string;
  type: "videos" | "transcripts";
  status: "pending" | "running" | "completed" | "failed";
  progress: FetchProgress | null;
  error: string | null;
}

const POLL_INTERVAL_MS = 2000;

export function useSync(channelId: string | null) {
  const [videoSync, setVideoSync] = useState<SyncJobState | null>(null);
  const [transcriptSync, setTranscriptSync] = useState<SyncJobState | null>(null);
  const [videoLogs, setVideoLogs] = useState<SyncLogEntry[]>([]);
  const [transcriptLogs, setTranscriptLogs] = useState<SyncLogEntry[]>([]);
  const videoPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoLogCountRef = useRef(0);
  const transcriptLogCountRef = useRef(0);
  const detectedRef = useRef(false);
  const queryClient = useQueryClient();

  const pollJob = useCallback(
    async (jobId: string, type: "videos" | "transcripts") => {
      try {
        const logCountRef = type === "videos" ? videoLogCountRef : transcriptLogCountRef;
        const res = await fetch(`/api/sync/status/${jobId}?logsSince=${logCountRef.current}`);
        if (!res.ok) return false;
        const data = await res.json();
        const state: SyncJobState = {
          jobId,
          type,
          status: data.status,
          progress: data.progress,
          error: data.error,
        };

        if (type === "videos") setVideoSync(state);
        else setTranscriptSync(state);

        if (data.logs && data.logs.length > 0) {
          const setter = type === "videos" ? setVideoLogs : setTranscriptLogs;
          setter((prev) => [...prev, ...data.logs]);
          logCountRef.current = data.totalLogs;
        }

        if (data.status === "completed" || data.status === "failed") {
          if (data.status === "completed") {
            queryClient.invalidateQueries({ queryKey: ["channel-videos", channelId] });
            queryClient.invalidateQueries({ queryKey: ["channel-info", channelId] });
          }
          return true;
        }
      } catch (err) {
        console.warn(`[useSync] Poll error for ${type}:`, err);
      }
      return false;
    },
    [channelId, queryClient]
  );

  const startPolling = useCallback(
    (jobId: string, type: "videos" | "transcripts") => {
      const ref = type === "videos" ? videoPollRef : transcriptPollRef;
      if (ref.current) clearTimeout(ref.current);

      let delay = POLL_INTERVAL_MS;
      const MAX_POLL_INTERVAL_MS = 10_000;

      const poll = async () => {
        const done = await pollJob(jobId, type);
        if (done) {
          ref.current = null;
          return;
        }
        delay = Math.min(delay * 1.5, MAX_POLL_INTERVAL_MS);
        ref.current = setTimeout(poll, delay);
      };

      ref.current = setTimeout(poll, delay);
    },
    [pollJob]
  );

  useEffect(() => {
    detectedRef.current = false;
    setVideoSync(null);
    setTranscriptSync(null);
    setVideoLogs([]);
    setTranscriptLogs([]);
    videoLogCountRef.current = 0;
    transcriptLogCountRef.current = 0;
  }, [channelId]);

  useEffect(() => {
    if (!channelId || detectedRef.current) return;
    detectedRef.current = true;

    fetch(`/api/sync/active/${channelId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((jobs: Array<{ jobId: string; type: string; status: string; progress: FetchProgress | null; error: string | null }>) => {
        for (const job of jobs) {
          const state: SyncJobState = {
            jobId: job.jobId,
            type: job.type as "videos" | "transcripts",
            status: job.status as SyncJobState["status"],
            progress: job.progress,
            error: job.error,
          };
          if (job.type === "videos") {
            setVideoSync(state);
            startPolling(job.jobId, "videos");
          } else if (job.type === "transcripts") {
            setTranscriptSync(state);
            startPolling(job.jobId, "transcripts");
          }
        }
      })
      .catch((err) => console.warn("[useSync] Failed to detect active jobs:", err));
  }, [channelId, startPolling]);

  useEffect(() => {
    const videoRef = videoPollRef;
    const transcriptRef = transcriptPollRef;
    return () => {
      if (videoRef.current) clearTimeout(videoRef.current);
      if (transcriptRef.current) clearTimeout(transcriptRef.current);
    };
  }, [channelId]);

  const syncVideos = useCallback(async () => {
    if (!channelId) return;
    setVideoLogs([]);
    videoLogCountRef.current = 0;
    try {
      const res = await fetch(`/api/sync/channel/${channelId}`, { method: "POST" });
      const data = await res.json();
      const state: SyncJobState = {
        jobId: data.jobId,
        type: "videos",
        status: "running",
        progress: { fetched: 0 },
        error: null,
      };
      setVideoSync(state);
      startPolling(data.jobId, "videos");
    } catch (err) {
      setVideoSync({
        jobId: "",
        type: "videos",
        status: "failed",
        progress: null,
        error: err instanceof Error ? err.message : "Failed to start sync",
      });
    }
  }, [channelId, startPolling]);

  const syncTranscripts = useCallback(async (options?: { retry?: boolean }) => {
    if (!channelId) return;
    setTranscriptLogs([]);
    transcriptLogCountRef.current = 0;
    try {
      const query = options?.retry ? "?retry=true" : "";
      const res = await fetch(`/api/sync/transcripts/${channelId}${query}`, { method: "POST" });
      const data = await res.json();
      const state: SyncJobState = {
        jobId: data.jobId,
        type: "transcripts",
        status: "running",
        progress: { fetched: 0 },
        error: null,
      };
      setTranscriptSync(state);
      startPolling(data.jobId, "transcripts");
    } catch (err) {
      setTranscriptSync({
        jobId: "",
        type: "transcripts",
        status: "failed",
        progress: null,
        error: err instanceof Error ? err.message : "Failed to start sync",
      });
    }
  }, [channelId, startPolling]);

  const cancelSync = useCallback(async (type: "videos" | "transcripts") => {
    const state = type === "videos" ? videoSync : transcriptSync;
    if (!state?.jobId) return;

    const ref = type === "videos" ? videoPollRef : transcriptPollRef;
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }

    try {
      await fetch(`/api/sync/cancel/${state.jobId}`, { method: "POST" });
    } catch { /* fire-and-forget */ }

    const cancelled: SyncJobState = {
      ...state,
      status: "failed",
      error: "Cancelled by user",
    };
    if (type === "videos") setVideoSync(cancelled);
    else setTranscriptSync(cancelled);
  }, [videoSync, transcriptSync]);

  const isVideoSyncing = videoSync?.status === "running" || videoSync?.status === "pending";
  const isTranscriptSyncing = transcriptSync?.status === "running" || transcriptSync?.status === "pending";

  return {
    videoSync,
    transcriptSync,
    videoLogs,
    transcriptLogs,
    syncVideos,
    syncTranscripts,
    cancelSync,
    isVideoSyncing,
    isTranscriptSyncing,
    isSyncing: isVideoSyncing || isTranscriptSyncing,
  };
}
