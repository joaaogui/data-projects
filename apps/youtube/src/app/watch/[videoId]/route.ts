import { redirectToVideoTimeline } from "@/lib/video-redirect";
import { withErrorHandling } from "@data-projects/shared/route-handler";

/**
 * Target of the `youtu.be/ID`, `/shorts/ID`, `/live/ID` and `/embed/ID`
 * rewrites in `next.config.mjs`. The ID travels as a path segment because query
 * params added by a rewrite aren't visible to route handlers.
 */
export const GET = withErrorHandling("video-link", async (request, { params }) => {
  const { videoId } = await params;
  return redirectToVideoTimeline(request, videoId);
});
