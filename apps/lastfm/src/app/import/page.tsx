"use client";

import { PageHeader, Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { useImport } from "@/hooks/use-import";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { Button, Skeleton } from "@data-projects/ui";
import { Download, RefreshCw, Square } from "lucide-react";

function ProgressBar({ done, total }: Readonly<{ done: number; total: number | null }>) {
  const pct = total && total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-data transition-[width] duration-300 animate-progress-stripe"
        style={{ width: `${pct}%` }}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Import progress"
      />
    </div>
  );
}

export default function ImportPage() {
  const {
    job,
    summary,
    isLoadingStatus,
    isRunning,
    error,
    startFull,
    startIncremental,
    resume,
    stop,
  } = useImport();

  const hasData = (summary?.scrobbleCount ?? 0) > 0;

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="Import"
        description="Pulls the full scrobble history from Last.fm into Postgres. The import runs in bounded chunks and saves its cursor after each one, so it can be stopped and resumed without losing progress."
      />

      {isLoadingStatus ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Scrobbles stored"
            value={formatNumber(summary?.scrobbleCount ?? 0)}
            accent
          />
          <StatCard label="Artists" value={formatNumber(summary?.artistCount ?? 0)} />
          <StatCard label="Tracks" value={formatNumber(summary?.trackCount ?? 0)} />
          <StatCard
            label="Range"
            value={
              summary?.firstPlayedAt
                ? `${formatDate(summary.firstPlayedAt)}`
                : "Empty"
            }
            hint={
              summary?.lastPlayedAt
                ? `through ${formatDate(summary.lastPlayedAt)}`
                : "No scrobbles imported yet"
            }
          />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Section
          title="Run an import"
          description={
            hasData
              ? "Sync fetches only plays newer than the most recent stored scrobble. A full rebuild re-walks the entire history; existing rows are left untouched."
              : "Start with a full import. Roughly 1,125 requests at about four per second, so expect a few minutes."
          }
        >
          <div className="flex flex-wrap gap-2">
            <Button onClick={startIncremental} disabled={isRunning} className="gap-2">
              <RefreshCw className="size-4" aria-hidden />
              Sync new plays
            </Button>
            <Button
              onClick={startFull}
              disabled={isRunning}
              variant="outline"
              className="gap-2"
            >
              <Download className="size-4" aria-hidden />
              Full import
            </Button>
            {isRunning && (
              <Button onClick={stop} variant="ghost" className="gap-2">
                <Square className="size-4" aria-hidden />
                Stop
              </Button>
            )}
            {!isRunning && job?.status === "error" && (
              <Button onClick={resume} variant="outline">
                Resume from page {job.pagesDone + 1}
              </Button>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          {job && (
            <div className="mt-5 space-y-3">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium capitalize">{job.mode} import</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(job.pagesDone)} / {formatNumber(job.totalPages ?? 0)} pages
                </span>
              </div>
              <ProgressBar done={job.pagesDone} total={job.totalPages} />
              <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                <span>
                  {formatNumber(job.scrobblesImported)} new scrobbles
                  {job.status === "done" && " - complete"}
                </span>
                <span>
                  {job.finishedAt
                    ? formatRelative(job.finishedAt)
                    : formatRelative(job.startedAt)}
                </span>
              </div>
            </div>
          )}
        </Section>

        <Section title="Activity log" bodyClassName="p-0">
          {job?.logs.length ? (
            <ol className="max-h-80 divide-y divide-border/60 overflow-y-auto text-sm">
              {[...job.logs].reverse().map((entry) => (
                <li
                  key={`${entry.at}-${entry.message}`}
                  className="flex gap-3 px-5 py-2.5"
                >
                  <time
                    dateTime={entry.at}
                    className="shrink-0 font-mono text-xs text-muted-foreground"
                  >
                    {new Date(entry.at).toLocaleTimeString("en-GB")}
                  </time>
                  <span className="text-foreground/90">{entry.message}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No import has run yet.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
