import { db } from "@/db";
import { channels, videos } from "@/db/schema";
import { auth } from "@/lib/auth";
import { withErrorHandling } from "@/lib/route-handler";
import { validateChannelId } from "@/lib/validation";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = withErrorHandling("report:GET", async (_request, { params }) => {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await params;
  const v = validateChannelId(channelId);
  if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });

  const [channel] = await db
    .select()
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  const videoRows = await db
    .select()
    .from(videos)
    .where(eq(videos.channelId, channelId));

  if (videoRows.length === 0) {
    return NextResponse.json({ error: "No videos synced" }, { status: 400 });
  }

  const totalViews = videoRows.reduce((s, v) => s + v.views, 0);
  const avgScore = videoRows.reduce((s, v) => s + v.score, 0) / videoRows.length;
  const topVideos = [...videoRows].sort((a, b) => b.score - a.score).slice(0, 10);
  const bottomVideos = [...videoRows].sort((a, b) => a.score - b.score).slice(0, 5);

  const scoreDistribution = [0, 0, 0, 0, 0];
  for (const vid of videoRows) {
    const bucket = Math.min(4, Math.floor(vid.score / 20));
    scoreDistribution[bucket]++;
  }

  const formatNum = (n: number) => n.toLocaleString("en-US");
  const bucketLabels = ["0-20", "20-40", "40-60", "60-80", "80-100"];
  const scoreClass = (score: number): string => {
    if (score >= 80) return "score-high";
    if (score >= 40) return "score-mid";
    return "score-low";
  };

  const avgEngagement =
    videoRows.reduce(
      (s, vid) => s + ((vid.rates as Record<string, number>)?.engagementRate ?? 0),
      0
    ) / videoRows.length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${channel.title} - Channel Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a2e; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 18px; margin-top: 32px; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
    .subtitle { color: #6b7280; font-size: 14px; margin-bottom: 32px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .kpi { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: center; }
    .kpi-value { font-size: 24px; font-weight: 700; }
    .kpi-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px; border-bottom: 2px solid #e5e7eb; font-weight: 600; color: #374151; }
    td { padding: 8px; border-bottom: 1px solid #f3f4f6; }
    .score { display: inline-block; padding: 2px 8px; border-radius: 6px; font-weight: 700; font-size: 12px; }
    .score-high { background: #d1fae5; color: #065f46; }
    .score-mid { background: #fef3c7; color: #92400e; }
    .score-low { background: #fee2e2; color: #991b1b; }
    .dist-bar { display: flex; align-items: flex-end; gap: 8px; height: 80px; margin: 12px 0; }
    .dist-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .dist-fill { width: 100%; border-radius: 4px 4px 0 0; background: #6366f1; min-height: 2px; }
    .dist-label { font-size: 10px; color: #6b7280; }
    .dist-count { font-size: 11px; font-weight: 600; }
    .footer { margin-top: 48px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; }
    @media print { body { padding: 20px; } .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>${channel.title}</h1>
  <p class="subtitle">Channel Analysis Report &middot; ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-value">${videoRows.length}</div><div class="kpi-label">Videos</div></div>
    <div class="kpi"><div class="kpi-value">${formatNum(totalViews)}</div><div class="kpi-label">Total Views</div></div>
    <div class="kpi"><div class="kpi-value">${avgScore.toFixed(1)}</div><div class="kpi-label">Avg Score</div></div>
    <div class="kpi"><div class="kpi-value">${avgEngagement.toFixed(1)}</div><div class="kpi-label">Avg Eng/1K</div></div>
  </div>

  <h2>Score Distribution</h2>
  <div class="dist-bar">
    ${scoreDistribution.map((count, i) => `
      <div class="dist-item">
        <div class="dist-count">${count}</div>
        <div class="dist-fill" style="height: ${Math.max(2, (count / Math.max(...scoreDistribution, 1)) * 60)}px"></div>
        <div class="dist-label">${bucketLabels[i]}</div>
      </div>
    `).join("")}
  </div>

  <h2>Top 10 Videos</h2>
  <table>
    <thead><tr><th>#</th><th>Title</th><th>Score</th><th>Views</th><th>Likes</th><th>Comments</th></tr></thead>
    <tbody>
      ${topVideos.map((vid, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${vid.title}</td>
          <td><span class="score ${scoreClass(vid.score)}">${vid.score.toFixed(0)}</span></td>
          <td>${formatNum(vid.views)}</td>
          <td>${formatNum(vid.likes)}</td>
          <td>${formatNum(vid.comments)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <h2>Bottom 5 Videos</h2>
  <table>
    <thead><tr><th>#</th><th>Title</th><th>Score</th><th>Views</th></tr></thead>
    <tbody>
      ${bottomVideos.map((vid, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${vid.title}</td>
          <td><span class="score score-low">${vid.score.toFixed(0)}</span></td>
          <td>${formatNum(vid.views)}</td>
        </tr>
      `).join("")}
    </tbody>
  </table>

  <div class="footer">
    Generated by YouTube Analyzer &middot; ${new Date().toISOString().slice(0, 10)}
  </div>

  <script class="no-print">
    // Auto-trigger print dialog for PDF saving
    if (new URLSearchParams(window.location.search).has('print')) {
      window.onload = () => setTimeout(() => window.print(), 500);
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
});
