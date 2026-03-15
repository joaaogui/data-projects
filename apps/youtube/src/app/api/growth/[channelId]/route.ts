import { auth } from "@/lib/auth";
import { getChannelGrowth } from "@/lib/channel-snapshots";
import { withErrorHandling } from "@/lib/route-handler";
import { validateChannelId } from "@/lib/validation";
import { NextResponse } from "next/server";

export const GET = withErrorHandling("growth:GET", async (_request, { params }) => {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await params;
  const v = validateChannelId(channelId);
  if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });

  const snapshots = await getChannelGrowth(channelId);

  return NextResponse.json({ snapshots });
});
