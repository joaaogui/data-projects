import { fetchChannelPlaylists, fetchPlaylistVideoIds } from "@/lib/youtube-server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { validateChannelId } from "@/lib/validation";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";

const log = createTaggedLogger("playlists");

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const GET = withErrorHandling("playlists", async (request, { params }) => {
  const { channelId } = await params;
  log.info({ channelId }, "Request received");

  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(
    `yt-playlists:${clientIp}`,
    RATE_LIMITS.channel
  );

  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(
      rateLimitResult,
      "Too many requests. Please try again later.",
      corsHeaders
    );
  }

  const validation = validateChannelId(channelId);
  if (!validation.valid) {
    return Response.json(
      { error: validation.error },
      { status: 400, headers: corsHeaders }
    );
  }

  const start = Date.now();
  const playlists = await fetchChannelPlaylists(validation.sanitized!); // NOSONAR

  const playlistsWithVideos = await Promise.all(
    playlists.map(async (playlist) => ({
      ...playlist,
      videoIds: await fetchPlaylistVideoIds(playlist.playlistId),
    }))
  );

  const totalVideoIds = playlistsWithVideos.reduce((sum, pl) => sum + pl.videoIds.length, 0);
  const elapsedMs = Date.now() - start;
  log.info({ elapsedMs, playlistCount: playlistsWithVideos.length, totalVideoIds }, "Completed");

  return Response.json(playlistsWithVideos, {
    headers: mergeHeaders(
      corsHeaders,
      withRateLimitHeaders(rateLimitResult),
      { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" }
    ),
  });
});
