import {
  getLibrary,
  LIBRARY_DEFAULT_LIMIT,
  type LibraryKind,
} from "@/lib/analytics/library";
import { withErrorHandling } from "@/lib/route-handler";

export const maxDuration = 60;

const MAX_QUERY_LENGTH = 100;

export const GET = withErrorHandling("library", async (request) => {
  const { searchParams } = new URL(request.url);
  const kind: LibraryKind = searchParams.get("kind") === "tracks" ? "tracks" : "artists";

  const rawQuery = searchParams.get("q")?.trim() ?? "";
  if (rawQuery.length > MAX_QUERY_LENGTH) {
    return Response.json({ error: "Search query is too long" }, { status: 400 });
  }

  const limitParam = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? limitParam
    : LIBRARY_DEFAULT_LIMIT;

  const result = await getLibrary(kind, rawQuery || null, limit);

  return Response.json(result, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" },
  });
});
