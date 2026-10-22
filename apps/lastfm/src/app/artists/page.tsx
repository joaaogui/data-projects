"use client";

import { TrendChart } from "@/components/charts/trend-chart";
import { LoadingGrid, NoData, QueryError } from "@/components/query-state";
import { PageHeader, Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { useArtistStats } from "@/hooks/use-stats";
import type { ArtistLifecycle } from "@/lib/analytics/artists";
import {
  LIFECYCLE_LABELS,
  LIFECYCLE_ORDER,
  LIFECYCLE_RULES,
  type Lifecycle,
} from "@/lib/lifecycle";
import { formatDate, formatMonth, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@data-projects/shared";
import {
  DataTable,
  sortableHeader,
  type ColumnDef,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@data-projects/ui";
import { Info } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

function computeElapsedCalendarMonths(firstPlayed: string, lastPlayed: string): number {
  const start = new Date(firstPlayed);
  const end = new Date(lastPlayed);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth()) +
    1;
  return Math.max(1, months);
}

function LifecycleBadge({
  value,
  row,
}: Readonly<{ value: Lifecycle; row?: ArtistLifecycle }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex rounded-full border px-2 py-0.5 text-xs font-medium cursor-default",
            value === "companion" && "border-data/40 bg-data/10 text-data",
            value === "phase" && "border-foreground/20 bg-foreground/5",
            value === "recent" && "border-foreground/20 bg-foreground/5",
            value === "abandoned" && "border-border text-muted-foreground",
            value === "casual" && "border-border text-muted-foreground"
          )}
        >
          {LIFECYCLE_LABELS[value]}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs space-y-1">
        {row && (
          <p className="font-mono text-[11px] text-foreground">
            {formatNumber(row.plays)} plays across {row.months} active months · Span:{" "}
            {formatDate(row.firstPlayed)} to {formatDate(row.lastPlayed)} · Peak:{" "}
            {formatNumber(row.peakPlays)} plays ({formatPercent(row.peakShare, 1)}) in{" "}
            {formatMonth(row.peakMonth)}
          </p>
        )}
        <p className="text-muted-foreground">{LIFECYCLE_RULES[value]}</p>
      </TooltipContent>
    </Tooltip>
  );
}

export default function ArtistsPage() {
  const { data, isLoading, error } = useArtistStats();

  const columns = useMemo<ColumnDef<ArtistLifecycle>[]>(
    () => [
      {
        accessorKey: "artist",
        header: sortableHeader("Artist"),
        cell: ({ row }) => (
          <Link
            href={`/artists/${encodeURIComponent(row.original.artist)}`}
            className="font-medium hover:text-data"
          >
            {row.original.artist}
          </Link>
        ),
      },
      {
        accessorKey: "plays",
        header: sortableHeader("Plays"),
        cell: ({ row }) => (
          <span className="tabular-nums">{formatNumber(row.original.plays)}</span>
        ),
      },
      {
        accessorKey: "months",
        header: sortableHeader("Months"),
        cell: ({ row }) => {
          const item = row.original;
          const elapsedMonths = computeElapsedCalendarMonths(
            item.firstPlayed,
            item.lastPlayed
          );
          const consistency = Math.min(1, item.months / elapsedMonths);
          const avgPlaysPerMonth = (item.plays / Math.max(1, item.months)).toFixed(1);

          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="tabular-nums cursor-default">{item.months}</span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs space-y-1">
                <div className="font-medium text-foreground">
                  Rotation Consistency: {formatPercent(consistency, 0)} ({item.months} of{" "}
                  {elapsedMonths} calendar {elapsedMonths === 1 ? "month" : "months"})
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {avgPlaysPerMonth} avg plays per active month
                </div>
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: "peakShare",
        header: sortableHeader("Peak month"),
        cell: ({ row }) => {
          const item = row.original;
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="whitespace-nowrap tabular-nums text-muted-foreground cursor-default">
                  {formatPercent(item.peakShare, 0)} ({formatNumber(item.peakPlays)}) in{" "}
                  {formatMonth(item.peakMonth)}
                </span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {formatNumber(item.peakPlays)} of {formatNumber(item.plays)} lifetime plays occurred in{" "}
                {formatMonth(item.peakMonth)}
              </TooltipContent>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: "firstPlayed",
        header: sortableHeader("First"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.firstPlayed)}
          </span>
        ),
      },
      {
        accessorKey: "lastPlayed",
        header: sortableHeader("Last"),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {formatDate(row.original.lastPlayed)}
          </span>
        ),
      },
      {
        accessorKey: "lifecycle",
        header: "Pattern",
        cell: ({ row }) => (
          <LifecycleBadge value={row.original.lifecycle} row={row.original} />
        ),
      },
    ],
    []
  );

  if (isLoading) return <LoadingGrid />;
  if (error) return <QueryError message={error.message} />;
  if (!data || data.totalArtists === 0) return <NoData />;

  const { discovery, lifecycle, lifecycleCounts, obsessions, comebacks, totalArtists } =
    data;

  const totalNew = discovery.reduce((sum, point) => sum + point.newArtists, 0);
  const recentYear = discovery.slice(-12);
  const recentNew = recentYear.reduce((sum, point) => sum + point.newArtists, 0);
  const avgPerMonth = totalNew / Math.max(1, discovery.length);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Artists"
        description={`${formatNumber(totalArtists)} distinct artists. This page is about how they enter and leave rotation, not just who is on top.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="New artists / month"
          value={avgPerMonth.toFixed(1)}
          hint="Lifetime average"
          accent
        />
        <StatCard
          label="Last 12 months"
          value={formatNumber(recentNew)}
          hint={`vs ${formatNumber(Math.round(avgPerMonth * 12))} at the lifetime rate`}
        />
        <StatCard
          label="Companions"
          value={formatNumber(lifecycleCounts.companion)}
          hint="12+ months across a 3+ year span"
        />
        <StatCard
          label="Phases"
          value={formatNumber(lifecycleCounts.phase)}
          hint="Half their plays in one month"
        />
      </div>

      <Section
        title="Discovery rate"
        description="Artists heard for the first time each month, against total listening volume. A falling line while volume holds means the rotation is tightening."
      >
        <TrendChart
          data={discovery as unknown as Record<string, unknown>[]}
          xKey="month"
          xTickFormat={formatMonth}
          xTickInterval={11}
          height={280}
          series={[
            {
              key: "plays",
              label: "Plays",
              kind: "area",
              colorClassName: "text-foreground/30",
            },
            {
              key: "newArtists",
              label: "New artists",
              kind: "line",
              axis: "right",
            },
          ]}
          rightAxisFormat={(value) => formatNumber(value)}
        />
      </Section>

      <Section
        title="How artists are classified"
        description="Each artist gets exactly one label from the first rule that matches. The thresholds are judgement calls, not measurements."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {LIFECYCLE_ORDER.map((key) => (
            <div key={key} className="rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <LifecycleBadge value={key} />
                <span className="text-sm font-medium tabular-nums">
                  {formatNumber(lifecycleCounts[key])}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {LIFECYCLE_RULES[key]}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Obsessions"
          description="Artists whose plays collapsed into a single month. Minimum 50 plays, ranked by concentration."
          bodyClassName="p-0"
        >
          <ol className="divide-y divide-border/60">
            {obsessions.slice(0, 10).map((item) => (
              <li key={item.artist} className="flex items-baseline gap-3 px-5 py-2.5 text-sm">
                <span className="w-12 shrink-0 font-medium tabular-nums text-data">
                  {formatPercent(item.peakShare, 0)}
                </span>
                <Link
                  href={`/artists/${encodeURIComponent(item.artist)}`}
                  className="min-w-0 flex-1 truncate hover:text-data"
                >
                  {item.artist}
                </Link>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground cursor-default">
                      {formatNumber(item.peakPlays)} of {formatNumber(item.plays)} in{" "}
                      {formatMonth(item.peakMonth)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    {formatNumber(item.peakPlays)} of {formatNumber(item.plays)} lifetime plays ({formatPercent(item.peakShare, 1)}) occurred in{" "}
                    {formatMonth(item.peakMonth)}
                  </TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          title="Comebacks"
          description="The longest silence in each artist's history, where the return stuck. Minimum 2-year gap and 20 plays afterwards."
          bodyClassName="p-0"
        >
          <ol className="divide-y divide-border/60">
            {comebacks.slice(0, 10).map((item) => {
              const postReturnShare =
                item.totalPlays > 0 ? item.playsSince / item.totalPlays : 0;
              return (
                <li key={item.artist} className="flex items-baseline gap-3 px-5 py-2.5 text-sm">
                  <span className="w-16 shrink-0 font-medium tabular-nums text-data">
                    {(item.gapDays / 365).toFixed(1)}y gap
                  </span>
                  <div className="min-w-0 flex-1 truncate">
                    <Link
                      href={`/artists/${encodeURIComponent(item.artist)}`}
                      className="hover:text-data"
                    >
                      {item.artist}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {formatDate(item.lastBefore)} → {formatDate(item.returnedAt)}
                    </span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground cursor-default">
                        {formatNumber(item.playsSince)} of {formatNumber(item.totalPlays)} plays since
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs space-y-1">
                      <div className="font-medium text-foreground">
                        {formatPercent(postReturnShare, 1)} of lifetime plays occurred after returning
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        Silence: {formatDate(item.lastBefore)} → {formatDate(item.returnedAt)} ({formatNumber(item.gapDays)} days)
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
        </Section>
      </div>

      <Section
        title="Top 250 artists"
        description="Sortable. Play counts, active span, and the share of plays that landed in each artist's single biggest month."
        actions={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Info className="size-3.5" aria-hidden />
            Hover a pattern for its rule
          </span>
        }
      >
        <DataTable
          columns={columns}
          data={lifecycle}
          defaultSorting={[{ id: "plays", desc: true }]}
          pagination={{ pageSize: 25, showInfo: true, itemName: "artists" }}
        />
      </Section>
    </div>
  );
}
