import { redirectToVideoTimeline } from "@/lib/video-redirect";
import { withErrorHandling } from "@data-projects/shared/route-handler";

/**
 * Replace `youtube.com` with this site's host in a video URL and keep the rest
 * (`/watch?v=ID`): it lands on that video in its channel's Timeline.
 */
export const GET = withErrorHandling("video-link", (request) =>
  redirectToVideoTimeline(request, request.nextUrl.searchParams.get("v"))
);
