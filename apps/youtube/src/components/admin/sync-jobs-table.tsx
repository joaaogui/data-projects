"use client";

import type { SyncJob } from "@/types/admin";
import {
  Button,
  Card,
  CardContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@data-projects/ui";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { ChevronDown, ChevronUp, Terminal, Trash2, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useCallback, useState } from "react";
import { JobLogRow } from "./job-log-row";
import { StatusBadge } from "./shared";

dayjs.extend(relativeTime);

function formatDuration(start: string, end: string): string {
  const ms = dayjs(end).diff(dayjs(start));
  if (ms < 1000) return "<1s";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function jobDuration(job: SyncJob): string {
  if (job.status === "completed" || job.status === "failed") {
    return formatDuration(job.createdAt, job.updatedAt);
  }
  if (job.status === "running") {
    return formatDuration(job.createdAt, new Date().toISOString());
  }
  return "\u2014";
}

function JobProgress({ progress }: Readonly<{ progress: SyncJob["progress"] }>) {
  if (progress?.total) {
    const pctDone = Math.min(100, (progress.fetched / progress.total) * 100);
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pctDone}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {progress.fetched}/{progress.total}
        </span>
      </div>
    );
  }
  if (progress?.fetched) {
    return (
      <span className="text-xs tabular-nums text-muted-foreground">
        {progress.fetched} fetched
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">&mdash;</span>;
}

export interface SyncJobsTableProps {
  jobs: SyncJob[];
  loading: boolean;
  runningJobCount: number;
  onClearFinished: () => void;
  onCancelJob: (jobId: string) => void;
}

export function SyncJobsTable({
  jobs,
  loading,
  runningJobCount,
  onClearFinished,
  onCancelJob,
}: Readonly<SyncJobsTableProps>) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const toggleLogs = useCallback((jobId: string) => {
    setExpandedJobId((prev) => (prev === jobId ? null : jobId));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {jobs.length} job{jobs.length !== 1 && "s"} total
          {runningJobCount > 0 && ` \u00B7 ${runningJobCount} running`}
        </p>
        <Button variant="outline" size="sm" onClick={onClearFinished}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Clear finished
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const isActive = job.status === "running" || job.status === "pending";
                  const isExpanded = expandedJobId === job.id;
                  return (
                    <Fragment key={job.id}>
                      <TableRow className={isExpanded ? "border-b-0" : ""}>
                        <TableCell>
                          <Link href={`/channel/${job.channelId}`} className="font-medium hover:text-primary transition-colors">
                            {job.channelTitle ?? job.channelId}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${job.type === "videos"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-purple-500/20"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20"
                              }`}
                          >
                            {job.type}
                          </span>
                        </TableCell>
                        <TableCell><StatusBadge status={job.status} /></TableCell>
                        <TableCell><JobProgress progress={job.progress} /></TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {dayjs(job.createdAt).fromNow()}
                        </TableCell>
                        <TableCell className="text-sm tabular-nums text-muted-foreground">
                          {jobDuration(job)}
                        </TableCell>
                        <TableCell>
                          {job.error ? (
                            <span className="text-xs text-destructive max-w-[200px] truncate block" title={job.error}>
                              {job.error}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">&mdash;</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-7 px-2 ${isExpanded ? "text-foreground" : "text-muted-foreground"} hover:text-foreground`}
                              onClick={() => toggleLogs(job.id)}
                            >
                              <Terminal className="h-3.5 w-3.5 mr-1" />
                              {isExpanded
                                ? <ChevronUp className="h-3 w-3" />
                                : <ChevronDown className="h-3 w-3" />}
                            </Button>
                            {isActive && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-muted-foreground hover:text-destructive"
                                onClick={() => onCancelJob(job.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={8} className="p-0 border-t-0">
                            <JobLogRow jobId={job.id} isActive={isActive} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
                {jobs.length === 0 && loading && (
                  <>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16 rounded-md" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-1.5 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                        <TableCell><Skeleton className="h-7 w-7 rounded" /></TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                {jobs.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      No sync jobs found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
