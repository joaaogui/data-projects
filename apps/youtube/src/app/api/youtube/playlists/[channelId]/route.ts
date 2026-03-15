import { fetchChannelPlaylists, fetchPlaylistVideoIds } from "@/lib/youtube-server";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { validateChannelId, getSafeErrorMessage } from "@/lib/validation";
import {
  corsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";

const TAG = "[Playlists]";

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  try {
    const { channelId } = await params;
    console.log(`${TAG} Request received channelId=${channelId}`);

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
    const playlists = await fetchChannelPlaylists(validation.sanitized!);

    const playlistsWithVideos = await Promise.all(
      playlists.map(async (playlist) => ({
        ...playlist,
        videoIds: await fetchPlaylistVideoIds(playlist.playlistId),
      }))
    );

    const totalVideoIds = playlistsWithVideos.reduce((sum, pl) => sum + pl.videoIds.length, 0);
    const elapsedMs = Date.now() - start;
    console.log(`${TAG} Completed in ${elapsedMs}ms playlistCount=${playlistsWithVideos.length} totalVideoIds=${totalVideoIds}`);

    return Response.json(playlistsWithVideos, {
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult),
        { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" }
      ),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`${TAG} Error: ${errMsg}`);
    if (errStack) console.error(`${TAG} Stack: ${errStack}`);
    return Response.json(
      { error: getSafeErrorMessage(error, "Failed to fetch channel playlists") },
      { status: 500, headers: corsHeaders }
    );
  }
}
