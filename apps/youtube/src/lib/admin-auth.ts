import { auth } from "./auth";
import { NextResponse } from "next/server";

const ADMIN_EMAILS = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email || (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
