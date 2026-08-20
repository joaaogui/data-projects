import { getArtistDetail } from "@/lib/analytics/artists";
import { withErrorHandling } from "@/lib/route-handler";

export const maxDuration = 60;

export const GET = withErrorHandling<{ params: Promise<{ name: string }> }>(
  "artist-detail",
  async (_request, { params }) => {
    const { name } = await params;
    const artist = decodeURIComponent(name).trim();

    if (!artist || artist.length > 300) {
      return Response.json({ error: "Invalid artist name" }, { status: 400 });
    }

    const detail = await getArtistDetail(artist);
    if (!detail) {
      return Response.json({ error: "Artist not found" }, { status: 404 });
    }

    return Response.json(detail, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
    });
  }
);
