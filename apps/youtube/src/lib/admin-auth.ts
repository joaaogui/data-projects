import { NextResponse } from "next/server";
import { auth } from "./auth";
import { allowedEmails } from "./env";

export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email || allowedEmails.length === 0 || !allowedEmails.includes(email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
