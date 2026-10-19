import { db } from "@/db";
import { videos } from "@/db/schema";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { parseVideoId, timelinePath } from "@/lib/video-link";
import { getVideoChannelId } from "@/lib/youtube-server";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Redirects a YouTube video ID to its channel's Timeline with the video opened.
 *
 * Synced videos resolve from the database; for anything else the YouTube API
 * supplies the channel, and the channel page offers to sync it.
 */
export async function redirectToVideoTimeline(
  request: NextRequest,
  rawVideoId: string | null | undefined
): Promise<NextResponse> {
  const videoId = parseVideoId(rawVideoId);
  if (!videoId) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const [row] = await db
    .select({ channelId: videos.channelId })
    .from(videos)
    .where(eq(videos.id, videoId))
    .limit(1);

  let channelId: string | null = row?.channelId ?? null;

  if (!channelId) {
    // Only the API fallback costs quota, so only it is rate limited.
    const rateLimit = checkRateLimit(
      `yt-video-link:${getClientIp(request)}`,
      RATE_LIMITS.channel
    );
    if (!rateLimit.success) {
      return new NextResponse("Too many requests. Please try again later.", {
        status: 429,
      });
    }
    channelId = await getVideoChannelId(videoId);
  }

  if (!channelId) {
    return new NextResponse("Video not found", { status: 404 });
  }

  return NextResponse.redirect(
    new URL(timelinePath(channelId, videoId), request.url)
  );
}
