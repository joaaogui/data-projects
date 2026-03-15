"use client";

import { SyncLogPanel } from "@/components/sync-log-panel";
import { useJobLogs } from "@/hooks/use-job-logs";
import { Skeleton } from "@data-projects/ui";

export function JobLogRow({
  jobId,
  isActive,
}: Readonly<{
  jobId: string;
  isActive: boolean;
}>) {
  const { logs, loading } = useJobLogs(jobId, isActive);

  if (loading && logs.length === 0) {
    return (
      <div className="bg-zinc-950 px-4 py-3 space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-3 w-14 bg-zinc-800" />
            <Skeleton className="h-3 w-8 bg-zinc-800" />
            <Skeleton className="h-3 bg-zinc-800" style={{ width: `${60 - i * 12}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0 && !isActive) {
    return (
      <div className="bg-zinc-950 px-4 py-3">
        <span className="text-xs text-zinc-500 font-mono">No logs recorded for this job.</span>
      </div>
    );
  }

  return (
    <SyncLogPanel
      logs={logs}
      isActive={isActive}
      className="rounded-none border-x-0 border-b-0"
    />
  );
}
