"use client";

import { BarList } from "@/components/charts/bar-list";
import { TrendChart } from "@/components/charts/trend-chart";
import { LoadingGrid, QueryError } from "@/components/query-state";
import { PageHeader, Section } from "@/components/section";
import { StatCard } from "@/components/stat-card";
import { useArtistDetail } from "@/hooks/use-stats";
import { formatDate, formatMonth, formatNumber, formatPercent } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

export default function ArtistDetailPage({
  params,
}: Readonly<{ params: Promise<{ name: string }> }>) {
  const { name } = use(params);
  const artist = decodeURIComponent(name);
  const { data, isLoading, error } = useArtistDetail(artist);

  if (isLoading) return <LoadingGrid rows={2} />;
  if (error) return <QueryError message={error.message} />;
  if (!data) return <QueryError message={`No plays stored for "${artist}".`} />;

  const span =
    (new Date(data.lastPlayed).getTime() - new Date(data.firstPlayed).getTime()) /
    (365.25 * 24 * 60 * 60 * 1000);

  return (
    <div className="animate-fade-up space-y-6">
      <Link
        href="/artists"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All artists
      </Link>

      <PageHeader
        title={data.artist}
        description={`Ranked #${formatNumber(data.rank)} of all artists, accounting for ${formatPercent(data.share, 2)} of every scrobble.`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Plays" value={formatNumber(data.plays)} accent />
        <StatCard
          label="Distinct tracks"
          value={formatNumber(data.distinctTracks)}
          hint={`${(data.plays / Math.max(1, data.distinctTracks)).toFixed(1)} plays per track`}
        />
        <StatCard
          label="Active months"
          value={formatNumber(data.months)}
          hint={`over a ${span.toFixed(1)} year span`}
        />
        <StatCard
          label="First heard"
          value={formatDate(data.firstPlayed)}
          hint={`last on ${formatDate(data.lastPlayed)}`}
        />
      </div>

      <Section
        title="Play history"
        description="Scrobbles per month. Gaps are months with no plays at all."
      >
        <TrendChart
          data={data.monthly as unknown as Record<string, unknown>[]}
          xKey="month"
          xTickFormat={formatMonth}
          xTickInterval={Math.max(1, Math.floor(data.monthly.length / 10))}
          height={260}
          series={[{ key: "plays", label: "Plays", kind: "bar" }]}
        />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Top tracks">
          <BarList
            items={data.topTracks.map((track) => ({
              label: track.track,
              value: track.plays,
            }))}
          />
        </Section>

        <Section title="Top albums">
          {data.topAlbums.length > 0 ? (
            <BarList
              items={data.topAlbums.map((album) => ({
                label: album.album,
                value: album.plays,
              }))}
            />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No album data on these scrobbles.
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
