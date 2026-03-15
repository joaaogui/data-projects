"use client";

import { capture } from "@/lib/analytics";
import type { FetchProgress, SyncLogEntry } from "@/types/youtube";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

export type SyncJobType = "videos" | "transcripts" | "sagas";

function handleJobCompletion(
  data: { status: string; progress?: FetchProgress | null },
  type: SyncJobType,
  channelId: string | null,
  queryClient: QueryClient
): boolean {
  if (data.status !== "completed" && data.status !== "failed") return false;
  if (data.status === "completed") {
    if (type === "videos") {
      capture("channel_sync_completed", { channelId, videoCount: data.progress?.total });
    }
    if (type === "videos" || type === "transcripts") {
      queryClient.invalidateQueries({ queryKey: ["channel-videos", channelId] });
      queryClient.invalidateQueries({ queryKey: ["channel-info", channelId] });
    }
    if (type === "sagas") {
      queryClient.invalidateQueries({ queryKey: ["sagas", channelId] });
    }
  }
  return true;
}

export interface SyncJobState {
  jobId: string;
  type: SyncJobType;
  status: "pending" | "running" | "completed" | "failed";
  progress: FetchProgress | null;
  error: string | null;
  retryAfterSeconds?: number;
}

const POLL_INTERVAL_MS = 2000;

export function useSync(channelId: string | null) {
  const [videoSync, setVideoSync] = useState<SyncJobState | null>(null);
  const [transcriptSync, setTranscriptSync] = useState<SyncJobState | null>(null);
  const [sagaSync, setSagaSync] = useState<SyncJobState | null>(null);
  const [videoLogs, setVideoLogs] = useState<SyncLogEntry[]>([]);
  const [transcriptLogs, setTranscriptLogs] = useState<SyncLogEntry[]>([]);
  const [sagaLogs, setSagaLogs] = useState<SyncLogEntry[]>([]);
  const videoPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transcriptPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sagaPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoLogCountRef = useRef(0);
  const transcriptLogCountRef = useRef(0);
  const sagaLogCountRef = useRef(0);
  const detectedRef = useRef(false);
  const queryClient = useQueryClient();

  function getRefsForType(type: SyncJobType) {
    switch (type) {
      case "videos":
        return { setState: setVideoSync, setLogs: setVideoLogs, pollRef: videoPollRef, logCountRef: videoLogCountRef };
      case "transcripts":
        return { setState: setTranscriptSync, setLogs: setTranscriptLogs, pollRef: transcriptPollRef, logCountRef: transcriptLogCountRef };
      case "sagas":
        return { setState: setSagaSync, setLogs: setSagaLogs, pollRef: sagaPollRef, logCountRef: sagaLogCountRef };
    }
  }

  const pollJob = useCallback(
    async (jobId: string, type: SyncJobType) => {
      try {
        const { setState, setLogs, logCountRef } = getRefsForType(type);
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

        setState(state);

        if (data.logs && data.logs.length > 0) {
          setLogs((prev) => [...prev, ...data.logs]);
          logCountRef.current = data.totalLogs;
        }

        if (handleJobCompletion(data, type, channelId, queryClient)) {
          return true;
        }

        if (type === "sagas" && data.status === "running") {
          queryClient.invalidateQueries({ queryKey: ["sagas", channelId] });
        }
      } catch (err) {
        console.warn(`[useSync] Poll error for ${type}:`, err);
      }
      return false;
    },
    [channelId, queryClient]
  );

  const startPolling = useCallback(
    (jobId: string, type: SyncJobType) => {
      const { pollRef } = getRefsForType(type);
      if (pollRef.current) clearTimeout(pollRef.current);

      let delay = POLL_INTERVAL_MS;
      const MAX_POLL_INTERVAL_MS = 10_000;

      const poll = async () => {
        const done = await pollJob(jobId, type);
        if (done) {
          pollRef.current = null;
          return;
        }
        delay = Math.min(delay * 1.5, MAX_POLL_INTERVAL_MS);
        pollRef.current = setTimeout(poll, delay);
      };

      pollRef.current = setTimeout(poll, delay);
    },
    [pollJob]
  );

  useEffect(() => {
    detectedRef.current = false;
    setVideoSync(null);
    setTranscriptSync(null);
    setSagaSync(null);
    setVideoLogs([]);
    setTranscriptLogs([]);
    setSagaLogs([]);
    videoLogCountRef.current = 0;
    transcriptLogCountRef.current = 0;
    sagaLogCountRef.current = 0;
  }, [channelId]);

  useEffect(() => {
    if (!channelId || detectedRef.current) return;
    detectedRef.current = true;

    fetch(`/api/sync/active/${channelId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((jobs: Array<{ jobId: string; type: string; status: string; progress: FetchProgress | null; error: string | null }>) => {
        for (const job of jobs) {
          const type = job.type as SyncJobType;
          const state: SyncJobState = {
            jobId: job.jobId,
            type,
            status: job.status as SyncJobState["status"],
            progress: job.progress,
            error: job.error,
          };
          const { setState } = getRefsForType(type);
          setState(state);
          startPolling(job.jobId, type);
        }
      })
      .catch((err) => console.warn("[useSync] Failed to detect active jobs:", err));
  }, [channelId, startPolling]);

  useEffect(() => {
    const vRef = videoPollRef;
    const tRef = transcriptPollRef;
    const sRef = sagaPollRef;
    return () => {
      if (vRef.current) clearTimeout(vRef.current);
      if (tRef.current) clearTimeout(tRef.current);
      if (sRef.current) clearTimeout(sRef.current);
    };
  }, [channelId]);

  const syncVideos = useCallback(async () => {
    if (!channelId) return;
    setVideoLogs([]);
    videoLogCountRef.current = 0;
    try {
      const res = await fetch(`/api/sync/channel/${channelId}`, { method: "POST" });
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = Number.parseInt(res.headers.get("Retry-After") ?? "60", 10);
          setVideoSync({
            jobId: "",
            type: "videos",
            status: "failed",
            progress: null,
            error: "Too many requests. Please wait a moment and try again.",
            retryAfterSeconds: retryAfter,
          });
          return;
        }
        const errorData = await res.json().catch(() => ({ error: "Failed to start sync" }));
        setVideoSync({
          jobId: "",
          type: "videos",
          status: "failed",
          progress: null,
          error: errorData.error ?? `Sync failed (${res.status})`,
        });
        return;
      }
      const data = await res.json();
      const state: SyncJobState = {
        jobId: data.jobId,
        type: "videos",
        status: "running",
        progress: { fetched: 0 },
        error: null,
      };
      setVideoSync(state);
      capture('channel_sync_started', { channelId, source: 'manual' });
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
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = Number.parseInt(res.headers.get("Retry-After") ?? "60", 10);
          setTranscriptSync({
            jobId: "",
            type: "transcripts",
            status: "failed",
            progress: null,
            error: "Too many requests. Please wait a moment and try again.",
            retryAfterSeconds: retryAfter,
          });
          return;
        }
        const errorData = await res.json().catch(() => ({ error: "Failed to start transcript sync" }));
        setTranscriptSync({
          jobId: "",
          type: "transcripts",
          status: "failed",
          progress: null,
          error: errorData.error ?? `Transcript sync failed (${res.status})`,
        });
        return;
      }
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

  const syncSagas = useCallback(async (options?: { mode?: "full" | "incremental" | "reset" }) => {
    if (!channelId) return;
    setSagaLogs([]);
    sagaLogCountRef.current = 0;
    try {
      const res = await fetch(`/api/sync/sagas/${channelId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: options?.mode ?? "full" }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = Number.parseInt(res.headers.get("Retry-After") ?? "60", 10);
          setSagaSync({
            jobId: "",
            type: "sagas",
            status: "failed",
            progress: null,
            error: "Too many requests. Please wait a moment and try again.",
            retryAfterSeconds: retryAfter,
          });
          return;
        }
        const errorData = await res.json().catch(() => ({ error: "Failed to start saga analysis" }));
        setSagaSync({
          jobId: "",
          type: "sagas",
          status: "failed",
          progress: null,
          error: errorData.error ?? `Saga analysis failed (${res.status})`,
        });
        return;
      }
      const data = await res.json();
      const state: SyncJobState = {
        jobId: data.jobId,
        type: "sagas",
        status: "running",
        progress: { fetched: 0 },
        error: null,
      };
      setSagaSync(state);
      startPolling(data.jobId, "sagas");
    } catch (err) {
      setSagaSync({
        jobId: "",
        type: "sagas",
        status: "failed",
        progress: null,
        error: err instanceof Error ? err.message : "Failed to start saga analysis",
      });
    }
  }, [channelId, startPolling]);

  const pushSagaLog = useCallback((msg: string, level: SyncLogEntry["level"] = "info") => {
    setSagaLogs((prev) => [...prev, { ts: Date.now(), level, msg }]);
  }, []);

  const cancelSync = useCallback(async (type: SyncJobType) => {
    const stateMap: Record<SyncJobType, SyncJobState | null> = {
      videos: videoSync,
      transcripts: transcriptSync,
      sagas: sagaSync,
    };
    const state = stateMap[type];
    if (!state?.jobId) return;

    const { pollRef, setState } = getRefsForType(type);
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }

    try {
      await fetch(`/api/sync/cancel/${state.jobId}`, { method: "POST" });
    } catch { /* fire-and-forget */ }

    setState({
      ...state,
      status: "failed",
      error: "Cancelled by user",
    });
  }, [videoSync, transcriptSync, sagaSync]);

  const isVideoSyncing = videoSync?.status === "running" || videoSync?.status === "pending";
  const isTranscriptSyncing = transcriptSync?.status === "running" || transcriptSync?.status === "pending";
  const isSagaSyncing = sagaSync?.status === "running" || sagaSync?.status === "pending";

  return {
    videoSync,
    transcriptSync,
    sagaSync,
    videoLogs,
    transcriptLogs,
    sagaLogs,
    pushSagaLog,
    syncVideos,
    syncTranscripts,
    syncSagas,
    cancelSync,
    isVideoSyncing,
    isTranscriptSyncing,
    isSagaSyncing,
    isSyncing: isVideoSyncing || isTranscriptSyncing,
  };
}
