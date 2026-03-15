import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import dayjs from "dayjs";

export async function getOrCreateUser(profile: {
  email: string;
  name?: string | null;
  image?: string | null;
}) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, profile.email))
    .limit(1);

  if (existing) {
    await db
      .update(users)
      .set({ lastActiveAt: new Date() })
      .where(eq(users.id, existing.id));
    return existing;
  }

  const id = crypto.randomUUID();
  const [user] = await db
    .insert(users)
    .values({
      id,
      email: profile.email,
      name: profile.name ?? null,
      image: profile.image ?? null,
    })
    .returning();

  return user;
}

export async function checkSyncQuota(userId: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
}> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) return { allowed: false, used: 0, limit: 0 };

  const resetAt = dayjs(user.syncUsageResetAt);
  const now = dayjs();

  if (now.isAfter(resetAt.add(1, "day"))) {
    await db
      .update(users)
      .set({ syncUsageToday: 0, syncUsageResetAt: new Date() })
      .where(eq(users.id, userId));
    return { allowed: true, used: 0, limit: user.syncQuotaDaily };
  }

  return {
    allowed: user.syncUsageToday < user.syncQuotaDaily,
    used: user.syncUsageToday,
    limit: user.syncQuotaDaily,
  };
}

export async function incrementSyncUsage(userId: string) {
  await db
    .update(users)
    .set({
      syncUsageToday: sql`${users.syncUsageToday} + 1`,
    })
    .where(eq(users.id, userId));
}
