import type { StatsData, SyncJob, CleanupAction, BulkRequest } from "@/types/admin";

export async function fetchAdminStats(): Promise<StatsData> {
  const res = await fetch("/api/admin/stats");
  if (!res.ok) throw new Error("Failed to load stats");
  return res.json();
}

export async function fetchAdminJobs(): Promise<SyncJob[]> {
  const res = await fetch("/api/admin/sync-jobs");
  if (!res.ok) throw new Error("Failed to load sync jobs");
  const data = await res.json();
  return data.jobs;
}

export async function runCleanup(
  action: CleanupAction,
  channelId?: string
): Promise<{ deleted: number }> {
  const res = await fetch("/api/admin/cleanup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, channelId }),
  });
  if (!res.ok) throw new Error("Cleanup failed");
  return res.json();
}

export async function runBulkAction(
  request: BulkRequest
): Promise<{ deleted?: number; started?: number; total: number }> {
  const res = await fetch("/api/admin/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error("Bulk operation failed");
  return res.json();
}

export async function triggerSync(
  channelId: string,
  type: "videos" | "transcripts"
): Promise<{ jobId?: string; error?: string }> {
  const url =
    type === "videos"
      ? `/api/sync/channel/${channelId}`
      : `/api/sync/transcripts/${channelId}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function cancelSyncJob(
  jobId: string
): Promise<{ cancelled: boolean }> {
  const res = await fetch(`/api/sync/cancel/${jobId}`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}
