import { db } from "@/db";
import { sharedReports } from "@/db/schema";
import { formatCompact, getScoreColorClass } from "@/lib/format";
import { eq } from "drizzle-orm";
import { BarChart3, Eye, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  readonly params: Promise<{ reportId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { reportId } = await params;
  const [report] = await db
    .select()
    .from(sharedReports)
    .where(eq(sharedReports.id, reportId))
    .limit(1);

  if (!report) return { title: "Report Not Found" };

  return {
    title: `${report.channelTitle} - Channel Report`,
    description: `Analysis of ${report.channelTitle}: ${report.snapshotData.videoCount} videos, ${formatCompact(report.snapshotData.totalViews)} views`,
  };
}

export default async function ReportPage({ params }: PageProps) {
  const { reportId } = await params;
  const [report] = await db
    .select()
    .from(sharedReports)
    .where(eq(sharedReports.id, reportId))
    .limit(1);

  if (!report) notFound();

  if (report.expiresAt && report.expiresAt < new Date()) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">Report Expired</h1>
          <p className="text-muted-foreground">This shared report has expired.</p>
        </div>
      </main>
    );
  }

  const { snapshotData: data } = report;
  const BUCKET_LABELS = ["0-20", "20-40", "40-60", "60-80", "80-100"];

  return (
    <main className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{report.channelTitle}</h1>
          <p className="text-sm text-muted-foreground">
            Channel analysis snapshot &middot; {new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border/40 rounded-2xl p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold tabular-nums">{data.videoCount}</p>
            <p className="text-xs text-muted-foreground">videos</p>
          </div>
          <div className="bg-card border border-border/40 rounded-2xl p-4 text-center">
            <Eye className="h-5 w-5 mx-auto mb-1 text-sky-500" />
            <p className="text-2xl font-bold tabular-nums">{formatCompact(data.totalViews)}</p>
            <p className="text-xs text-muted-foreground">total views</p>
          </div>
          <div className="bg-card border border-border/40 rounded-2xl p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <p className={`text-2xl font-bold tabular-nums ${getScoreColorClass(data.avgScore)}`}>{data.avgScore.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">avg score</p>
          </div>
          <div className="bg-card border border-border/40 rounded-2xl p-4 text-center">
            <p className="text-2xl font-bold tabular-nums">{data.avgEngagement.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">avg eng/1K</p>
          </div>
        </div>

        {/* Score Distribution */}
        <div className="bg-card border border-border/40 rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-3">Score Distribution</h3>
          <div className="flex items-end gap-2 h-20 justify-center">
            {data.scoreDistribution.map((count, i) => {
              const maxCount = Math.max(...data.scoreDistribution, 1);
              return (
                <div key={BUCKET_LABELS[i]} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-[10px] tabular-nums text-muted-foreground">{count}</span>
                  <div
                    className="w-full max-w-[40px] rounded-t bg-primary/60"
                    style={{ height: `${(count / maxCount) * 60}px` }}
                  />
                  <span className="text-[9px] text-muted-foreground">{BUCKET_LABELS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-card border border-border/40 rounded-2xl p-5">
          <h3 className="text-sm font-semibold mb-3">Top Performers</h3>
          <div className="space-y-2">
            {data.topPerformers.map((v, i) => (
              <div key={`${v.title}-${v.views}-${i}`} className="flex items-center gap-3">
                <div className="relative w-16 aspect-video rounded overflow-hidden bg-muted shrink-0">
                  <Image src={v.thumbnail} alt={v.title} fill sizes="64px" className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium line-clamp-1">{v.title}</p>
                  <p className="text-[10px] text-muted-foreground">{formatCompact(v.views)} views</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${getScoreColorClass(v.score)}`}>
                  {v.score.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Generated by <Link href="/" className="text-primary hover:underline">YouTube Analyzer</Link>
          {report.expiresAt && <> &middot; Expires {new Date(report.expiresAt).toLocaleDateString()}</>}
        </p>
      </div>
    </main>
  );
}
