import { db } from "@/db";
import { sharedComparisons } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createTaggedLogger } from "@/lib/logger";
import { withErrorHandling } from "@/lib/route-handler";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const log = createTaggedLogger("compare-share");

export const POST = withErrorHandling("compare-share:POST", async (req) => {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const { channelIds, channelTitles, snapshotData } = body;

  if (!Array.isArray(channelIds) || channelIds.length < 2 || channelIds.length > 4) {
    return NextResponse.json(
      { error: "Comparison requires 2-4 channels" },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID().slice(0, 8);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.insert(sharedComparisons).values({
    id,
    channelIds,
    channelTitles,
    snapshotData,
    expiresAt,
  });

  log.info({ id, channelCount: channelIds.length }, "Comparison shared");

  return NextResponse.json({ id, url: `/compare/shared/${id}` });
});

export const GET = withErrorHandling("compare-share:GET", async (req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing comparison ID" }, { status: 400 });
  }

  const [comparison] = await db
    .select()
    .from(sharedComparisons)
    .where(eq(sharedComparisons.id, id))
    .limit(1);

  if (!comparison) {
    return NextResponse.json({ error: "Comparison not found" }, { status: 404 });
  }

  if (comparison.expiresAt && comparison.expiresAt < new Date()) {
    return NextResponse.json({ error: "Comparison has expired" }, { status: 410 });
  }

  return NextResponse.json(comparison);
});
