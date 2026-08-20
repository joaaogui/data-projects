import { getTemporalStats } from "@/lib/analytics/temporal";
import { withErrorHandling } from "@/lib/route-handler";

export const maxDuration = 60;

export const GET = withErrorHandling("stats-temporal", async () => {
  const stats = await getTemporalStats();
  return Response.json(stats, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
});
