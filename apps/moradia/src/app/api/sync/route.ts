import { syncBatchToNeon } from "@/lib/dataset-store";
import type {
  NeighborhoodEntry,
  SlimPropertyRecord,
} from "@/types/moradia";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const expectedSecret = process.env.MORADIA_SYNC_SECRET?.trim();
  if (expectedSecret) {
    const authHeader = request.headers.get("authorization") ?? "";
    if (authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const body = (await request.json()) as {
    neighborhoods?: NeighborhoodEntry[];
    properties?: SlimPropertyRecord[];
  };

  const stats = await syncBatchToNeon(body);
  return NextResponse.json({ ok: true, ...stats });
}
