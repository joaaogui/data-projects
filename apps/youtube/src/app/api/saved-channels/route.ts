import { db } from "@/db";
import { channels, savedChannels } from "@/db/schema";
import { auth } from "@/lib/auth";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rows = await db
    .select({
      channelId: savedChannels.channelId,
      label: savedChannels.label,
      pinned: savedChannels.pinned,
      lastVisitedAt: savedChannels.lastVisitedAt,
      channelTitle: channels.title,
      thumbnailUrl: channels.thumbnailUrl,
    })
    .from(savedChannels)
    .leftJoin(channels, eq(savedChannels.channelId, channels.id))
    .where(eq(savedChannels.userId, session.user.email))
    .orderBy(desc(savedChannels.pinned), desc(savedChannels.lastVisitedAt))
    .limit(50);

  return NextResponse.json({ channels: rows });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { channelId, label, pinned } = body as {
    channelId: string;
    label?: string;
    pinned?: boolean;
  };

  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const userId = session.user.email;
  const id = `${userId}-${channelId}`;

  await db
    .insert(savedChannels)
    .values({
      id,
      userId,
      channelId,
      label: label ?? null,
      pinned: pinned ? 1 : 0,
      lastVisitedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: savedChannels.id,
      set: {
        lastVisitedAt: new Date(),
        ...(label !== undefined && { label }),
        ...(pinned !== undefined && { pinned: pinned ? 1 : 0 }),
      },
    });

  return NextResponse.json({ saved: true });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { channelId } = await request.json();
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  await db
    .delete(savedChannels)
    .where(
      and(
        eq(savedChannels.userId, session.user.email),
        eq(savedChannels.channelId, channelId)
      )
    );

  return NextResponse.json({ deleted: true });
}
