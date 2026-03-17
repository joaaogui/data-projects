import { db } from "@/db";
import { savedChannels, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getPlanLimits, type PlanTier } from "@/lib/plan-limits";
import { withErrorHandling } from "@/lib/route-handler";
import { checkSyncQuota } from "@/lib/user-service";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = withErrorHandling("quota:GET", async () => {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, session.user.email))
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const plan = (user.plan ?? "free") as PlanTier;
  const limits = getPlanLimits(plan);
  const syncQuota = await checkSyncQuota(user.id);

  const [{ trackedCount }] = await db
    .select({ trackedCount: sql<number>`count(*)::int` })
    .from(savedChannels)
    .where(eq(savedChannels.userId, session.user.email));

  return NextResponse.json({
    plan,
    planLabel: limits.label,
    sync: {
      used: syncQuota.used,
      limit: syncQuota.limit,
      allowed: syncQuota.allowed,
    },
    tracked: {
      current: trackedCount,
      limit: limits.maxTrackedChannels,
    },
  });
});
