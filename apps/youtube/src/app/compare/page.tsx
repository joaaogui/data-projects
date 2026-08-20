"use client";

import { AccountSpacer } from "@/components/account-spacer";
import { SearchChannel } from "@/components/search-channel";
import { YouTubeIcon } from "@/components/youtube-icon";
import { formatCompact, getScoreColorClass } from "@/lib/format";
import { Navbar } from "@data-projects/ui";
import { BarChart3, Eye, TrendingUp, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface ChannelComparison {
  channelId: string;
  title: string;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  videoCount: number;
  totalViews: number;
  avgScore: number;
  avgEngagement: number;
  topVideo: {
    id: string;
    title: string;
    score: number;
    thumbnail: string;
  } | null;
}

interface ComparisonInsight {
  label: string;
  channel: string;
  value: string;
  lead: string;
}

function buildInsight(
  label: string,
  channels: ChannelComparison[],
  select: (channel: ChannelComparison) => number,
  format: (value: number) => string,
  difference: "points" | "relative" = "relative"
): ComparisonInsight {
  const ranked = [...channels].sort((a, b) => select(b) - select(a));
  const leader = ranked[0];
  const runnerUp = ranked[1];
  const leaderValue = select(leader);
  const runnerUpValue = runnerUp ? select(runnerUp) : 0;

  let lead = "Only channel";
  if (runnerUp) {
    const delta = leaderValue - runnerUpValue;
    if (Math.abs(delta) < 0.05) {
      lead = "Effectively tied";
    } else if (difference === "points") {
      lead = `+${delta.toFixed(1)} points`;
    } else if (runnerUpValue > 0) {
      const ratio = leaderValue / runnerUpValue;
      lead =
        ratio >= 2
          ? `${ratio.toFixed(1)}× the runner-up`
          : `${((ratio - 1) * 100).toFixed(0)}% ahead`;
    }
  }

  return {
    label,
    channel: leader.title,
    value: format(leaderValue),
    lead,
  };
}

function CompareContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const channelIds = searchParams.get("channels")?.split(",").filter(Boolean) ?? [];
  const [data, setData] = useState<ChannelComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pickerError, setPickerError] = useState<string | null>(null);

  useEffect(() => {
    if (channelIds.length === 0) {
      setData([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (channelIds.length > 5) {
      setError("Compare up to 5 channels at a time.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetch(`/api/compare?channels=${channelIds.join(",")}`)
      .then((res) =>
        res.ok ? res.json() : res.json().then((d) => { throw new Error(d.error); })
      )
      .then((d) => setData(
        (d.channels as ChannelComparison[]).map((ch) => ({
          ...ch,
          totalViews: Number(ch.totalViews),
          avgScore: Number(ch.avgScore),
          avgEngagement: Number(ch.avgEngagement),
        }))
      ))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const updateChannels = (ids: string[]) => {
    const next = ids.length > 0 ? `?channels=${ids.join(",")}` : "";
    router.replace(`/compare${next}`, { scroll: false });
  };

  const addChannel = (channelId: string) => {
    setPickerError(null);
    if (channelIds.includes(channelId)) {
      setPickerError("That channel is already in the comparison.");
      return;
    }
    if (channelIds.length >= 5) {
      setPickerError("Remove a channel before adding another.");
      return;
    }
    updateChannels([...channelIds, channelId]);
  };

  const resolveAndAdd = async (query: string) => {
    setPickerError(null);
    try {
      const response = await fetch(`/api/youtube/search/${encodeURIComponent(query)}`);
      const result = await response.json();
      if (!response.ok || !result.channelId) {
        throw new Error(result.error || "Channel not found");
      }
      addChannel(result.channelId);
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : "Channel not found");
    }
  };

  const picker = (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Compare channels</h1>
          <p className="text-sm text-muted-foreground">
            Add between 2 and 5 analyzed channels. No account required.
          </p>
        </div>
        <div className="w-full lg:w-96">
          <SearchChannel
            compact
            onSelectChannel={(channel) => addChannel(channel.channelId)}
            onSubmitQuery={resolveAndAdd}
          />
        </div>
      </div>

      {data.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" aria-label="Selected channels">
          {data.map((channel) => (
            <span
              key={channel.channelId}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pl-1.5 pr-2 text-xs"
            >
              {channel.thumbnailUrl && (
                <Image
                  src={channel.thumbnailUrl}
                  alt=""
                  width={20}
                  height={20}
                  className="rounded-full"
                />
              )}
              {channel.title}
              <button
                type="button"
                onClick={() =>
                  updateChannels(channelIds.filter((id) => id !== channel.channelId))
                }
                className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${channel.title} from comparison`}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {pickerError && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {pickerError}
        </p>
      )}
    </section>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        {picker}
        <p role="status" className="py-12 text-center text-sm text-muted-foreground">
          Loading comparison…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        {picker}
        <p role="alert" className="py-12 text-center text-sm text-destructive">
          {error}
        </p>
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="space-y-6">
        {picker}
        <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
          <p className="text-sm font-medium">
            {data.length === 0 ? "Choose your first channel" : "Add one more channel"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Search above or select a suggestion to build the comparison.
          </p>
        </div>
      </div>
    );
  }

  const maxViews = Math.max(...data.map((d) => d.totalViews), 1);
  const insights = [
    buildInsight(
      "Scale leader",
      data,
      (channel) => channel.totalViews,
      formatCompact
    ),
    buildInsight(
      "Quality leader",
      data,
      (channel) => channel.avgScore,
      (value) => value.toFixed(1),
      "points"
    ),
    buildInsight(
      "Engagement leader",
      data,
      (channel) => channel.avgEngagement,
      (value) => `${value.toFixed(1)}/1K`
    ),
    buildInsight(
      "Per-video reach",
      data,
      (channel) =>
        channel.videoCount > 0 ? channel.totalViews / channel.videoCount : 0,
      (value) => `${formatCompact(value)} views`
    ),
  ];

  return (
    <div className="space-y-6">
      {picker}
      <div className="flex items-center gap-3">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Comparison</h2>
        <span className="text-sm text-muted-foreground">({data.length} channels)</span>
      </div>

      <section aria-labelledby="comparison-insights-title">
        <h2
          id="comparison-insights-title"
          className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground"
        >
          What separates them
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {insights.map((insight) => (
            <div
              key={insight.label}
              className="rounded-lg border border-border bg-card p-3 sm:p-4"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {insight.label}
              </p>
              <p className="mt-2 truncate text-sm font-semibold" title={insight.channel}>
                {insight.channel}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-data">
                {insight.value}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {insight.lead}
              </p>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:hidden">
        {data.map((channel) => (
          <section
            key={channel.channelId}
            className="rounded-lg border border-border bg-card p-4"
          >
            <Link
              href={`/channel/${channel.channelId}`}
              className="flex items-center gap-3"
            >
              {channel.thumbnailUrl && (
                <Image
                  src={channel.thumbnailUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="rounded-full"
                />
              )}
              <h3 className="min-w-0 truncate text-sm font-semibold">
                {channel.title}
              </h3>
            </Link>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Videos</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {channel.videoCount.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Total views</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {formatCompact(channel.totalViews)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Avg score</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {channel.avgScore.toFixed(0)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Engagement</dt>
                <dd className="mt-0.5 font-medium tabular-nums">
                  {channel.avgEngagement}/1K
                </dd>
              </div>
            </dl>
            {channel.topVideo && (
              <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                Top video:{" "}
                <span className="font-medium text-foreground">
                  {channel.topVideo.title}
                </span>
              </p>
            )}
          </section>
        ))}
      </div>

      {/* KPI Comparison Table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border">
              <th scope="col" className="text-left py-3 px-2 text-muted-foreground font-medium">Channel</th>
              <th scope="col" className="text-right py-3 px-2 text-muted-foreground font-medium">Videos</th>
              <th scope="col" className="text-right py-3 px-2 text-muted-foreground font-medium">Total Views</th>
              <th scope="col" className="text-right py-3 px-2 text-muted-foreground font-medium">Avg Score</th>
              <th scope="col" className="text-right py-3 px-2 text-muted-foreground font-medium">Engagement</th>
              <th scope="col" className="text-left py-3 px-2 text-muted-foreground font-medium">Top Video</th>
            </tr>
          </thead>
          <tbody>
            {data.map((ch) => (
              <tr
                key={ch.channelId}
                className="border-b border-border hover:bg-muted/30 transition-colors"
              >
                <td className="py-3 px-2">
                  <Link
                    href={`/channel/${ch.channelId}`}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    {ch.thumbnailUrl && (
                      <Image
                        src={ch.thumbnailUrl}
                        alt={ch.title}
                        width={28}
                        height={28}
                        className="rounded-full"
                      />
                    )}
                    <span className="font-medium">{ch.title}</span>
                  </Link>
                </td>
                <td className="text-right py-3 px-2 tabular-nums">{ch.videoCount}</td>
                <td className="text-right py-3 px-2 tabular-nums font-medium">
                  {formatCompact(ch.totalViews)}
                </td>
                <td className="text-right py-3 px-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-md text-xs font-bold ${getScoreColorClass(ch.avgScore)}`}
                  >
                    {ch.avgScore.toFixed(0)}
                  </span>
                </td>
                <td className="text-right py-3 px-2 tabular-nums">{ch.avgEngagement}/1K</td>
                <td className="py-3 px-2">
                  {ch.topVideo && (
                    <span className="text-xs text-muted-foreground line-clamp-1">
                      {ch.topVideo.title}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Views Bar Chart */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          Total Views
        </h3>
        <div className="space-y-3">
          {data.map((ch) => (
            <div key={ch.channelId} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="w-full truncate text-xs font-medium sm:w-32">{ch.title}</span>
              <div className="flex w-full items-center gap-3">
                <div className="h-6 flex-1 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full bg-primary/70 transition-all duration-500"
                    style={{ width: `${(ch.totalViews / maxViews) * 100}%` }}
                  />
                </div>
                <span className="w-16 text-right text-xs font-medium tabular-nums">
                  {formatCompact(ch.totalViews)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Score Comparison */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          Average Score
        </h3>
        <div className="flex items-end gap-4 justify-center h-40">
          {data.map((ch) => (
            <div
              key={ch.channelId}
              className="flex flex-col items-center gap-2 flex-1 max-w-[120px]"
            >
              <span
                className={`text-lg font-bold ${getScoreColorClass(ch.avgScore)} px-2 py-0.5 rounded-lg`}
              >
                {ch.avgScore.toFixed(0)}
              </span>
              <div
                className="w-full rounded-t-lg bg-primary/60"
                style={{ height: `${Math.max(8, (ch.avgScore / 100) * 100)}px` }}
              />
              <span className="text-[10px] text-muted-foreground text-center leading-tight truncate w-full">
                {ch.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <div className="min-h-dvh bg-background">
      <Navbar
        homeLink={<Link href="/" />}
        logo={<YouTubeIcon className="h-8 w-8 sm:h-10 sm:w-10 text-foreground" />}
        appName="YouTube Analyzer"
        search={<SearchChannel compact />}
        themeIconClassName="text-muted-foreground"
        actions={<AccountSpacer />}
      />
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-5xl px-3 py-5 sm:px-4 sm:py-8">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          }
        >
          <CompareContent />
        </Suspense>
      </main>
    </div>
  );
}
