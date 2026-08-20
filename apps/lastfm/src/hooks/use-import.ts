"use client";

import { getJson, postJson } from "@/services/api-client";
import type { ImportJobView, ImportMode } from "@/types/lastfm";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

export interface LibrarySummary {
  scrobbleCount: number;
  artistCount: number;
  trackCount: number;
  firstPlayedAt: string | null;
  lastPlayedAt: string | null;
}

interface ImportStatusResponse {
  job: ImportJobView | null;
  summary: LibrarySummary;
}

interface ImportRunResponse {
  job: ImportJobView;
  done: boolean;
  summary: LibrarySummary | null;
}

/**
 * Drives the chunked import. Each POST advances the server-side cursor by one
 * bounded slice, so progress is a loop of short requests rather than one long
 * one; the loop stops as soon as a chunk reports it is done or errored.
 */
export function useImport() {
  const queryClient = useQueryClient();
  const [job, setJob] = useState<ImportJobView | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const status = useQuery<ImportStatusResponse>({
    queryKey: ["import-status"],
    queryFn: () => getJson<ImportStatusResponse>("/api/import"),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (status.data?.job && !isRunning) setJob(status.data.job);
  }, [status.data?.job, isRunning]);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
    };
  }, []);

  const drive = useCallback(
    async (payload: { mode?: ImportMode; resume?: boolean }) => {
      if (isRunning) return;
      cancelRef.current = false;
      setIsRunning(true);
      setError(null);

      try {
        let first = true;
        for (;;) {
          if (cancelRef.current) break;
          const result = await postJson<ImportRunResponse>(
            "/api/import",
            first ? payload : {}
          );
          first = false;
          setJob(result.job);

          if (result.job.status === "error") {
            setError(result.job.error ?? "Import failed");
            break;
          }
          if (result.done) break;
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      } finally {
        setIsRunning(false);
        queryClient.invalidateQueries({ queryKey: ["import-status"] });
        // Every analytics query reads the table this just wrote to.
        queryClient.invalidateQueries({ queryKey: ["stats"] });
      }
    },
    [isRunning, queryClient]
  );

  const startFull = useCallback(() => drive({ mode: "full" }), [drive]);
  const startIncremental = useCallback(() => drive({ mode: "incremental" }), [drive]);
  const resume = useCallback(() => drive({ resume: true }), [drive]);
  const stop = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return {
    job,
    summary: status.data?.summary ?? null,
    isLoadingStatus: status.isLoading,
    isRunning,
    error,
    startFull,
    startIncremental,
    resume,
    stop,
  };
}
