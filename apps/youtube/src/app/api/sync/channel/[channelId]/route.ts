import { startSyncJob, upsertChannelPlaceholder } from "@/lib/sync-route";
import { syncChannelVideos } from "@/lib/sync-videos";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  console.log("[Sync Videos] request received", { channelId });
  return startSyncJob({
    request,
    channelId,
    type: "videos",
    beforeStart: (id) => upsertChannelPlaceholder(id),
    run: syncChannelVideos,
  });
}
