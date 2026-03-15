"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SyncLogEntry } from "@/types/youtube";

const POLL_INTERVAL_MS = 3000;

export function useJobLogs(jobId: string | null, isActive: boolean) {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const logCountRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevJobIdRef = useRef<string | null>(null);

  const fetchLogs = useCallback(async (currentJobId: string) => {
    try {
      const res = await fetch(`/api/sync/status/${currentJobId}?logsSince=${logCountRef.current}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.logs?.length > 0 && currentJobId === prevJobIdRef.current) {
        setLogs((prev) => [...prev, ...data.logs]);
        logCountRef.current = data.totalLogs;
      }
    } catch {
      /* ignore poll errors */
    }
  }, []);

  useEffect(() => {
    if (jobId !== prevJobIdRef.current) {
      setLogs([]);
      logCountRef.current = 0;
      prevJobIdRef.current = jobId;
    }

    if (!jobId) return;

    setLoading(true);
    fetchLogs(jobId).finally(() => setLoading(false));

    if (isActive) {
      pollRef.current = setInterval(() => fetchLogs(jobId), POLL_INTERVAL_MS);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId, isActive, fetchLogs]);

  return { logs, loading };
}
