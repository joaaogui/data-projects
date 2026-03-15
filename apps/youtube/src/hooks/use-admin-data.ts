"use client";

import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminStats,
  fetchAdminJobs,
  runCleanup,
  runBulkAction,
  triggerSync,
  cancelSyncJob,
} from "@/services/admin-client";
import type { CleanupAction, BulkRequest } from "@/types/admin";

export function useAdminData(autoRefresh: boolean) {
  const queryClient = useQueryClient();

  const statsQuery = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
    refetchInterval: autoRefresh ? 10_000 : false,
    retry: 2,
    retryDelay: 1000,
  });

  const jobsQuery = useQuery({
    queryKey: ["admin-jobs"],
    queryFn: fetchAdminJobs,
    refetchInterval: autoRefresh ? 10_000 : false,
  });

  const hasRunningJobs = useMemo(
    () => jobsQuery.data?.some((j) => j.status === "running" || j.status === "pending") ?? false,
    [jobsQuery.data]
  );

  const activeJobsQuery = useQuery({
    queryKey: ["admin-jobs-active"],
    queryFn: fetchAdminJobs,
    refetchInterval: hasRunningJobs ? 3_000 : false,
    enabled: hasRunningJobs,
  });

  const jobs = activeJobsQuery.data ?? jobsQuery.data ?? [];

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
    queryClient.invalidateQueries({ queryKey: ["admin-jobs-active"] });
  };

  const cleanupMutation = useMutation({
    mutationFn: ({ action, channelId }: { action: CleanupAction; channelId?: string }) =>
      runCleanup(action, channelId),
    onSuccess: invalidateAll,
  });

  const bulkMutation = useMutation({
    mutationFn: (request: BulkRequest) => runBulkAction(request),
    onSuccess: invalidateAll,
  });

  const syncMutation = useMutation({
    mutationFn: ({ channelId, type }: { channelId: string; type: "videos" | "transcripts" }) =>
      triggerSync(channelId, type),
    onSuccess: () => {
      setTimeout(invalidateAll, 1500);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => cancelSyncJob(jobId),
    onSuccess: () => {
      setTimeout(invalidateAll, 1000);
    },
  });

  return {
    stats: statsQuery.data ?? null,
    jobs,
    loadingStats: statsQuery.isLoading,
    loadingJobs: jobsQuery.isLoading,
    statsError: statsQuery.error,
    hasRunningJobs,
    lastRefreshed: statsQuery.dataUpdatedAt ? new Date(statsQuery.dataUpdatedAt) : null,
    refetch: invalidateAll,

    cleanup: cleanupMutation,
    bulk: bulkMutation,
    sync: syncMutation,
    cancel: cancelMutation,
  };
}
