import { getArtistStats } from "@/lib/analytics/artists";
import { withErrorHandling } from "@/lib/route-handler";

export const maxDuration = 60;

export const GET = withErrorHandling("stats-artists", async () => {
  const stats = await getArtistStats();
  return Response.json(stats, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
});
