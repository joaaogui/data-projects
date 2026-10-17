import { syncBatchToNeon } from "@/lib/dataset-store";
import { logger } from "@/lib/logger";
import type {
  NeighborhoodEntry,
  SlimPropertyRecord,
} from "@/types/moradia";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const t0 = performance.now();
  const expectedSecret = process.env.MORADIA_SYNC_SECRET?.trim();
  if (!expectedSecret) {
    logger.warn("api/sync", "POST rejected: MORADIA_SYNC_SECRET not configured");
    return NextResponse.json(
      { error: "Sync endpoint disabled: MORADIA_SYNC_SECRET not configured" },
      { status: 503 },
    );
  }
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${expectedSecret}`) {
    logger.warn("api/sync", "POST rejected: unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    neighborhoods?: NeighborhoodEntry[];
    properties?: SlimPropertyRecord[];
  };

  const stats = await syncBatchToNeon(body);
  const durationMs = Math.round((performance.now() - t0) * 100) / 100;
  logger.info("api/sync", "POST completed", {
    ...stats,
    durationMs,
  });
  return NextResponse.json({ ok: true, ...stats });
}
