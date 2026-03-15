import { auth } from "@/lib/auth";
import { getChannelGrowth } from "@/lib/channel-snapshots";
import { validateChannelId } from "@/lib/validation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await params;
  const v = validateChannelId(channelId);
  if (!v.valid) return NextResponse.json({ error: v.error }, { status: 400 });

  const snapshots = await getChannelGrowth(channelId);

  return NextResponse.json({ snapshots });
}
