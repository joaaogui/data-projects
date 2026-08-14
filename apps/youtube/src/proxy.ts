import { NextResponse, type NextRequest } from "next/server";

// Signing in is optional. Searching a channel and reading its dashboard are the
// primary flow and work anonymously; signing in adds syncing, saved channels,
// AI features and admin.
//
// Everything that mutates state or exposes per-user data enforces auth inside
// its own route handler (`auth()` / `requireAdmin()`), which is the real
// boundary -- the cookie check below only proves a cookie exists, not that it is
// valid. This list therefore covers just the pages that have no server-side
// check of their own.
const PROTECTED_PAGE_PREFIXES = ["/admin"];

function isProtectedPage(pathname: string): boolean {
  return PROTECTED_PAGE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!isProtectedPage(pathname)) {
    return NextResponse.next();
  }

  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    const signInUrl = new URL("/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}
