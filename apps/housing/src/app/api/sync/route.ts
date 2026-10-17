import { parseJsonBody, syncSchema } from "@/lib/api-guards";
import { syncBatchToNeon } from "@/lib/dataset-store";
import { logger } from "@/lib/logger";
import type {
  NeighborhoodEntry,
  SlimPropertyRecord,
} from "@/types/housing";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const t0 = performance.now();
  const expectedSecret = process.env.HOUSING_SYNC_SECRET?.trim();
  if (!expectedSecret) {
    logger.warn("api/sync", "POST rejected: HOUSING_SYNC_SECRET not configured");
    return NextResponse.json(
      { error: "Sync endpoint disabled: HOUSING_SYNC_SECRET not configured" },
      { status: 503 },
    );
  }
  const authHeader = request.headers.get("authorization") ?? "";
  if (authHeader !== `Bearer ${expectedSecret}`) {
    logger.warn("api/sync", "POST rejected: unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsedBody = await parseJsonBody(request, syncSchema);
  if (!parsedBody.ok) return parsedBody.response;
  const body = parsedBody.data as {
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
