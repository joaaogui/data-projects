import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ASSET_PREFIXES = [
  "/api/auth",
  "/api/health",
  "/signin",
  "/_next/",
  "/favicon.ico",
  "/favicon.svg",
  "/og-image",
  "/img/",
];

const PUBLIC_PAGE_PREFIXES = ["/channel/"];

const PUBLIC_EXACT = new Set(["/", "/sitemap.xml", "/robots.txt"]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_ASSET_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  if (PUBLIC_PAGE_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return new NextResponse(null, { status: 401 });
    }
    const signInUrl = new URL("/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", req.nextUrl.href);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}
