"use client";

import { TrendChart } from "@/components/charts/trend-chart";
import { LoadingGrid, NoData, QueryError } from "@/components/query-state";
import { PageHeader, Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { useEvolution } from "@/hooks/use-stats";
import type { YearRankEntry } from "@/lib/analytics/evolution";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@data-projects/shared";
import { ArrowDown, ArrowUp, Minus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

function RankMovement({ entry }: Readonly<{ entry: YearRankEntry }>) {
  if (entry.previousRank === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-data">
        <Sparkles className="size-3" aria-hidden />
        new
      </span>
    );
  }

  const delta = entry.previousRank - entry.rank;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="size-3" aria-hidden />
        held
      </span>
    );
  }

  const Icon = delta > 0 ? ArrowUp : ArrowDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs tabular-nums",
        delta > 0 ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <Icon className="size-3" aria-hidden />
      {Math.abs(delta)}
    </span>
  );
}

export default function EvolutionPage() {
  const { data, isLoading, error } = useEvolution();

  const byYear = useMemo(() => {
    if (!data) return [];
    const grouped = new Map<number, YearRankEntry[]>();
    for (const entry of data.ranks) {
      const list = grouped.get(entry.year) ?? [];
      list.push(entry);
      grouped.set(entry.year, list);
    }
    return [...grouped.entries()].sort((a, b) => b[0] - a[0]);
  }, [data]);

  if (isLoading) return <LoadingGrid />;
  if (error) return <QueryError message={error.message} />;
  if (!data || data.diversity.length === 0) return <NoData />;

  const { diversity, oneHitWonders } = data;
  const latest = diversity[diversity.length - 1];
  const first = diversity[0];

  const retentionYears = diversity.filter(
    (year) => year.retainedFromPreviousYear !== null
  );
  const avgRetention =
    retentionYears.reduce(
      (sum, year) => sum + (year.retainedFromPreviousYear ?? 0),
      0
    ) / Math.max(1, retentionYears.length);

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Evolution"
        description="How the shape of the listening changed year over year: who held the top spots, how concentrated the plays were, and how much carried over between years."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Artists this year"
          value={formatNumber(latest.artists)}
          hint={`${formatNumber(first.artists)} in ${first.year}`}
          accent
        />
        <StatCard
          label="Top-10 share"
          value={formatPercent(latest.top10Share, 0)}
          hint={`${formatPercent(first.top10Share, 0)} in ${first.year}`}
        />
        <StatCard
          label="Evenness"
          value={latest.evenness.toFixed(3)}
          hint="Entropy over its maximum, 0 to 1"
        />
        <StatCard
          label="Year-to-year loyalty"
          value={`${avgRetention.toFixed(1)} / 20`}
          hint="Average top-20 artists carried over"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Concentration"
          description="Top-10 share is how much of a year went to its ten biggest artists. Evenness normalises entropy so years with different artist counts compare fairly. Both rise when listening narrows."
        >
          <TrendChart
            data={diversity as unknown as Record<string, unknown>[]}
            xKey="year"
            xTickInterval={0}
            height={260}
            series={[
              {
                key: "top10Share",
                label: "Top-10 share",
                kind: "line",
                format: (value) => formatPercent(value, 1),
              },
              {
                key: "evenness",
                label: "Evenness",
                kind: "line",
                colorClassName: "text-foreground/50",
                format: (value) => value.toFixed(3),
              },
            ]}
          />
        </Section>

        <Section
          title="Breadth"
          description="Distinct artists heard each year against total plays. Rising volume with flat artist count means more repetition, not more exploration."
        >
          <TrendChart
            data={diversity as unknown as Record<string, unknown>[]}
            xKey="year"
            xTickInterval={0}
            height={260}
            series={[
              {
                key: "plays",
                label: "Plays",
                kind: "area",
                colorClassName: "text-foreground/30",
              },
              { key: "artists", label: "Distinct artists", kind: "line", axis: "right" },
            ]}
            rightAxisFormat={(value) => formatNumber(value)}
          />
        </Section>
      </div>

      <Section
        title="Top 10 by year"
        description="Movement compares each artist's rank against their rank in the previous year across all artists, not just the top 10."
        bodyClassName="p-0"
      >
        <div className="divide-y divide-border/60">
          {byYear.map(([year, entries]) => {
            const yearStats = diversity.find((d) => d.year === year);
            return (
              <div key={year} className="px-5 py-4">
                <div className="mb-2 flex items-baseline gap-3">
                  <h3 className="text-sm font-semibold tabular-nums">{year}</h3>
                  {yearStats && (
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(yearStats.plays)} plays across{" "}
                      {formatNumber(yearStats.artists)} artists
                      {yearStats.retainedFromPreviousYear !== null &&
                        ` - ${yearStats.retainedFromPreviousYear}/20 held over`}
                    </p>
                  )}
                </div>
                <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  {entries.map((entry) => (
                    <li
                      key={entry.artist}
                      className="flex items-baseline gap-2.5 text-sm"
                    >
                      <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {entry.rank}
                      </span>
                      <Link
                        href={`/artists/${encodeURIComponent(entry.artist)}`}
                        className="min-w-0 flex-1 truncate hover:text-data"
                      >
                        {entry.artist}
                      </Link>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {formatNumber(entry.plays)}
                      </span>
                      <span className="w-12 shrink-0 text-right">
                        <RankMovement entry={entry} />
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
        </div>
      </Section>

      <Section
        title="One-hit wonders"
        description="Artists where a single track carries at least 60% of their plays, with 40 plays or more overall."
        bodyClassName="p-0"
      >
        <ol className="divide-y divide-border/60">
          {oneHitWonders.map((item) => (
            <li
              key={`${item.artist}-${item.track}`}
              className="flex items-baseline gap-3 px-5 py-2.5 text-sm"
            >
              <span className="w-12 shrink-0 font-medium tabular-nums text-data">
                {formatPercent(item.share, 0)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {item.track}
                <Link
                  href={`/artists/${encodeURIComponent(item.artist)}`}
                  className="ml-2 text-xs text-muted-foreground hover:text-data"
                >
                  {item.artist}
                </Link>
              </span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {formatNumber(item.trackPlays)} of {formatNumber(item.totalPlays)}
              </span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
