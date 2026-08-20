import { getEvolutionStats } from "@/lib/analytics/evolution";
import { withErrorHandling } from "@/lib/route-handler";

export const maxDuration = 60;

export const GET = withErrorHandling("stats-evolution", async () => {
  const stats = await getEvolutionStats();
  return Response.json(stats, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
});
