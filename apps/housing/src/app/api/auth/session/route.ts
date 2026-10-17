import { getAuthToken, isAuthenticated } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return NextResponse.json(
    { configured: getAuthToken() !== null, authenticated: isAuthenticated(request) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
