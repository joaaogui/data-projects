"use client";

import { BarList } from "@/components/charts/bar-list";
import { LoadingGrid, NoData, QueryError } from "@/components/query-state";
import { PageHeader, Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { useOverview } from "@/hooks/use-stats";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { Flame } from "lucide-react";

export default function OverviewPage() {
  const { data, isLoading, error } = useOverview();

  if (isLoading) return <LoadingGrid />;
  if (error) return <QueryError message={error.message} />;
  if (!data || data.summary.scrobbleCount === 0) return <NoData />;

  const { summary, streaks, topArtists, topTracks, recent, milestones, repeatRecords } =
    data;

  const years =
    summary.firstPlayedAt && summary.lastPlayedAt
      ? (new Date(summary.lastPlayedAt).getTime() -
          new Date(summary.firstPlayedAt).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
      : 0;

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Overview"
        description={`${formatNumber(summary.scrobbleCount)} plays spanning ${years.toFixed(1)} years, from ${formatDate(summary.firstPlayedAt)} to ${formatDate(summary.lastPlayedAt)}.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Scrobbles"
          value={formatNumber(summary.scrobbleCount)}
          hint={`${formatNumber(Math.round(data.playsPerActiveDay))} per active day`}
          accent
        />
        <StatCard
          label="Artists"
          value={formatNumber(summary.artistCount)}
          hint={`${formatNumber(summary.trackCount)} distinct tracks`}
        />
        <StatCard
          label="Days with music"
          value={formatNumber(data.activeDays)}
          hint={`of ${formatNumber(Math.round(years * 365.25))} elapsed`}
        />
        <StatCard
          label="Current streak"
          value={streaks.current ? `${streaks.current.days} days` : "None"}
          hint={
            streaks.longest[0]
              ? `Longest: ${streaks.longest[0].days} days in ${streaks.longest[0].start.slice(0, 4)}`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Most played artists"
          description="All time, by number of scrobbles."
        >
          <BarList
            items={topArtists.map((artist) => ({
              label: artist.artist,
              sublabel: `${(artist.share * 100).toFixed(1)}%`,
              value: artist.plays,
              href: `/artists/${encodeURIComponent(artist.artist)}`,
            }))}
          />
        </Section>

        <Section title="Most played tracks" description="All time, by number of plays.">
          <BarList
            items={topTracks.map((track) => ({
              label: track.track,
              sublabel: track.artist,
              value: track.plays,
              href: `/artists/${encodeURIComponent(track.artist)}`,
            }))}
          />
        </Section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Milestones"
          description="The track playing at each 25,000-scrobble mark."
          bodyClassName="p-0"
        >
          <ol className="divide-y divide-border/60">
            {milestones.map((milestone) => (
              <li
                key={milestone.n}
                className="flex items-baseline gap-3 px-5 py-2.5 text-sm"
              >
                <span className="w-14 shrink-0 font-mono text-xs text-data">
                  #{formatNumber(milestone.n)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {milestone.track}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {milestone.artist}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDate(milestone.playedAt)}
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          title="Heaviest repeats"
          description="The most times a single track was played in one day."
          bodyClassName="p-0"
        >
          <ol className="divide-y divide-border/60">
            {repeatRecords.slice(0, 8).map((record) => (
              <li
                key={`${record.artist}-${record.track}-${record.day}`}
                className="flex items-baseline gap-3 px-5 py-2.5 text-sm"
              >
                <span className="flex w-14 shrink-0 items-center gap-1 font-medium tabular-nums text-data">
                  <Flame className="size-3.5" aria-hidden />
                  {record.plays}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {record.track}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {record.artist}
                  </span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatDate(`${record.day}T00:00:00Z`)}
                </span>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <Section
        title="Recently played"
        description="The newest scrobbles in the database."
        bodyClassName="p-0"
      >
        <ol className="divide-y divide-border/60">
          {recent.map((play) => (
            <li
              key={`${play.playedAt}-${play.track}`}
              className="flex items-baseline gap-3 px-5 py-2.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">
                {play.track}
                <span className="ml-2 text-xs text-muted-foreground">
                  {play.artist}
                </span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatRelative(play.playedAt)}
              </span>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
