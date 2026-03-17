import { db } from "@/db";
import { channels, savedChannels, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getPlanLimits, type PlanTier } from "@/lib/plan-limits";
import { withErrorHandling } from "@/lib/route-handler";
import { and, desc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = withErrorHandling("saved-channels:GET", async () => {
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
});

export const POST = withErrorHandling("saved-channels:POST", async (request) => {
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

  const [channelRow] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.id, channelId))
    .limit(1);

  if (!channelRow) {
    await db
      .insert(channels)
      .values({ id: channelId, title: channelId, fetchedAt: new Date() })
      .onConflictDoNothing();
  }

  const [existing] = await db
    .select({ id: savedChannels.id })
    .from(savedChannels)
    .where(eq(savedChannels.id, id))
    .limit(1);

  if (!existing) {
    const [user] = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.email, userId))
      .limit(1);

    const plan = (user?.plan ?? "free") as PlanTier;
    const limits = getPlanLimits(plan);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(savedChannels)
      .where(eq(savedChannels.userId, userId));

    if (count >= limits.maxTrackedChannels) {
      return NextResponse.json(
        {
          error: `Tracked channel limit reached (${count}/${limits.maxTrackedChannels}). Upgrade your plan to track more.`,
          limit: limits.maxTrackedChannels,
          current: count,
          plan,
        },
        { status: 403 }
      );
    }
  }

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
});

export const DELETE = withErrorHandling("saved-channels:DELETE", async (request) => {
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
});
