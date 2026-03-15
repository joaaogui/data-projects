"use client";

import { formatCompact, getScoreColorClass } from "@/lib/format";
import { YouTubeIcon } from "@/components/youtube-icon";
import { SearchChannel } from "@/components/search-channel";
import { Navbar } from "@data-projects/ui";
import { BarChart3, Eye, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

function CompareContent() {
  const searchParams = useSearchParams();
  const channelIds = searchParams.get("channels")?.split(",").filter(Boolean) ?? [];
  const [data, setData] = useState<ChannelComparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (channelIds.length < 2) {
      setError("Please provide at least 2 channel IDs in the URL (?channels=id1,id2)");
      setLoading(false);
      return;
    }
    fetch(`/api/compare?channels=${channelIds.join(",")}`)
      .then((res) =>
        res.ok ? res.json() : res.json().then((d) => { throw new Error(d.error); })
      )
      .then((d) => setData(d.channels))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">Loading comparison...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  const maxViews = Math.max(...data.map((d) => d.totalViews), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Channel Comparison</h1>
        <span className="text-sm text-muted-foreground">({data.length} channels)</span>
      </div>

      {/* KPI Comparison Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-2 text-muted-foreground font-medium">Channel</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Videos</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Total Views</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Avg Score</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">Engagement</th>
              <th className="text-left py-3 px-2 text-muted-foreground font-medium">Top Video</th>
            </tr>
          </thead>
          <tbody>
            {data.map((ch) => (
              <tr
                key={ch.channelId}
                className="border-b border-border/20 hover:bg-muted/30 transition-colors"
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
      <div className="bg-card border border-border/40 rounded-2xl p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          Total Views
        </h3>
        <div className="space-y-3">
          {data.map((ch) => (
            <div key={ch.channelId} className="flex items-center gap-3">
              <span className="text-xs font-medium w-32 truncate">{ch.title}</span>
              <div className="flex-1 h-6 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all duration-500"
                  style={{ width: `${(ch.totalViews / maxViews) * 100}%` }}
                />
              </div>
              <span className="text-xs tabular-nums font-medium w-16 text-right">
                {formatCompact(ch.totalViews)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Score Comparison */}
      <div className="bg-card border border-border/40 rounded-2xl p-5">
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
    <div className="min-h-screen bg-background">
      <Navbar
        homeLink={<Link href="/" />}
        logo={<YouTubeIcon className="h-8 w-8 sm:h-10 sm:w-10 text-foreground" />}
        appName="YouTube Analyzer"
        search={<SearchChannel compact />}
        themeIconClassName="text-primary"
      />
      <main className="max-w-5xl mx-auto px-4 py-8">
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
