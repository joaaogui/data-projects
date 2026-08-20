"use client";

import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { HourWeekdayHeatmap } from "@/components/charts/hour-weekday-heatmap";
import { TrendChart } from "@/components/charts/trend-chart";
import { LoadingGrid, NoData, QueryError } from "@/components/query-state";
import { PageHeader, Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { useTemporal } from "@/hooks/use-stats";
import {
  formatDate,
  formatDuration,
  formatHour,
  formatMonth,
  formatNumber,
  WEEKDAY_LABELS,
} from "@/lib/format";
import { useMemo } from "react";

export default function TimePage() {
  const { data, isLoading, error } = useTemporal();

  const peaks = useMemo(() => {
    if (!data) return null;
    const byHour = new Array<number>(24).fill(0);
    const byWeekday = new Array<number>(7).fill(0);
    for (const cell of data.heatmap) {
      byHour[cell.hour] += cell.plays;
      byWeekday[cell.weekday - 1] += cell.plays;
    }
    const peakHour = byHour.indexOf(Math.max(...byHour));
    const peakWeekday = byWeekday.indexOf(Math.max(...byWeekday));
    const quietHour = byHour.indexOf(Math.min(...byHour));
    return { byHour, byWeekday, peakHour, peakWeekday, quietHour };
  }, [data]);

  if (isLoading) return <LoadingGrid />;
  if (error) return <QueryError message={error.message} />;
  if (!data || data.daily.length === 0) return <NoData />;

  const { sessions, streaks, busiestDay } = data;

  return (
    <div className="animate-fade-up space-y-6">
      <PageHeader
        title="Time"
        description="When the listening actually happens. Every play is rebased from UTC into local time before being bucketed, so the hours below are wall-clock hours."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Peak hour"
          value={peaks ? formatHour(peaks.peakHour) : "-"}
          hint={peaks ? `${formatNumber(peaks.byHour[peaks.peakHour])} plays` : undefined}
          accent
        />
        <StatCard
          label="Peak weekday"
          value={peaks ? WEEKDAY_LABELS[peaks.peakWeekday] : "-"}
          hint={
            peaks
              ? `${formatNumber(peaks.byWeekday[peaks.peakWeekday])} plays`
              : undefined
          }
        />
        <StatCard
          label="Listening sessions"
          value={formatNumber(sessions.totalSessions)}
          hint={`avg ${sessions.avgTracks.toFixed(1)} tracks, ${formatDuration(sessions.avgMinutes)}`}
        />
        <StatCard
          label="Busiest day"
          value={busiestDay ? formatNumber(busiestDay.plays) : "-"}
          hint={busiestDay ? formatDate(`${busiestDay.day}T00:00:00Z`) : undefined}
        />
      </div>

      <Section
        title="Hour of day by weekday"
        description="Darker means more plays. Intensity uses a square-root ramp because the distribution is heavily skewed."
      >
        <HourWeekdayHeatmap cells={data.heatmap} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Plays by hour" description="Totals across the whole history.">
          <TrendChart
            data={(peaks?.byHour ?? []).map((plays, hour) => ({
              hour: String(hour),
              plays,
            }))}
            xKey="hour"
            xTickFormat={(value) => formatHour(Number(value))}
            xTickInterval={2}
            series={[{ key: "plays", label: "Plays", kind: "bar" }]}
            height={220}
          />
        </Section>

        <Section title="Plays by weekday" description="Totals across the whole history.">
          <TrendChart
            data={(peaks?.byWeekday ?? []).map((plays, index) => ({
              weekday: WEEKDAY_LABELS[index],
              plays,
            }))}
            xKey="weekday"
            xTickInterval={0}
            series={[{ key: "plays", label: "Plays", kind: "bar" }]}
            height={220}
          />
        </Section>
      </div>

      <Section
        title="Monthly volume"
        description="Scrobbles per month, with the number of distinct artists heard in that month."
      >
        <TrendChart
          data={data.monthly as unknown as Record<string, unknown>[]}
          xKey="month"
          xTickFormat={formatMonth}
          xTickInterval={11}
          height={280}
          series={[
            { key: "plays", label: "Plays", kind: "area" },
            {
              key: "artists",
              label: "Distinct artists",
              kind: "line",
              axis: "right",
              colorClassName: "text-foreground/50",
            },
          ]}
          rightAxisFormat={(value) => formatNumber(value)}
        />
      </Section>

      <Section
        title="Every day since the first scrobble"
        description="One square per day, arranged by ISO week."
      >
        <CalendarHeatmap daily={data.daily} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section
          title="Longest streaks"
          description="Consecutive days with at least one scrobble."
          bodyClassName="p-0"
        >
          <ol className="divide-y divide-border/60">
            {streaks.longest.map((streak) => (
              <li
                key={streak.start}
                className="flex items-baseline gap-3 px-5 py-2.5 text-sm"
              >
                <span className="w-20 shrink-0 font-medium tabular-nums text-data">
                  {streak.days} days
                </span>
                <span className="text-muted-foreground">
                  {formatDate(`${streak.start}T00:00:00Z`)} to{" "}
                  {formatDate(`${streak.end}T00:00:00Z`)}
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          title="Longest sessions"
          description="Runs of plays with no gap longer than 30 minutes. Duration spans the first to the last scrobble, so it understates each session by the length of its final track."
          bodyClassName="p-0"
        >
          <ol className="divide-y divide-border/60">
            {sessions.longest.map((session) => (
              <li key={session.started} className="px-5 py-2.5 text-sm">
                <div className="flex items-baseline gap-3">
                  <span className="w-20 shrink-0 font-medium tabular-nums text-data">
                    {session.tracks} tracks
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    mostly {session.topArtist}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatDuration(session.minutes)}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDate(session.started)}
                </p>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </div>
  );
}
