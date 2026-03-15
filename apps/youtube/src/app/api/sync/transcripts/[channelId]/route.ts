import { clearNullTranscripts, startSyncJob } from "@/lib/sync-route";
import { syncChannelTranscripts } from "@/lib/sync-transcripts";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const retry = request.nextUrl.searchParams.get("retry") === "true";
  console.log("[Sync Transcripts] request received", { channelId, retry });
  return startSyncJob({
    request,
    channelId,
    type: "transcripts",
    requireChannel: true,
    beforeStart: retry ? (id) => clearNullTranscripts(id) : undefined,
    run: syncChannelTranscripts,
  });
}
