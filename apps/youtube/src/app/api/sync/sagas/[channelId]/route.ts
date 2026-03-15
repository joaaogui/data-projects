import { startSyncJob } from "@/lib/sync-route";
import { syncChannelSagas } from "@/lib/sync-sagas";
import { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const body = (await request.json().catch(() => ({}))) as { mode?: string };
  const mode =
    body.mode === "incremental" || body.mode === "reset" ? body.mode : "full";
  console.log("[Sync Sagas] request received", { channelId, mode });
  return startSyncJob({
    request,
    channelId,
    type: "sagas",
    requireChannel: true,
    run: (id, jobId) => syncChannelSagas(id, jobId, mode),
  });
}
