import { getOverviewStats } from "@/lib/analytics/overview";
import { withErrorHandling } from "@/lib/route-handler";

export const maxDuration = 60;

export const GET = withErrorHandling("stats-overview", async () => {
  const stats = await getOverviewStats();
  return Response.json(stats, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
});
