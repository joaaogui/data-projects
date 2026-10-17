import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Single-user auth: one secret (`HOUSING_AUTH_TOKEN`). Tools send it as `x-housing-token` or
 * `Authorization: Bearer`; the browser gets a session cookie holding an HMAC of it from /login.
 */
export const AUTH_COOKIE_NAME = "housing_session";
export const AUTH_HEADER_NAME = "x-housing-token";
export const AUTH_COOKIE_MAX_AGE_S = 180 * 24 * 60 * 60;

export function getAuthToken(): string | null {
  return process.env.HOUSING_AUTH_TOKEN?.trim() || null;
}

export function sessionValueFor(token: string): string {
  return createHmac("sha256", token).update("housing-session-v1").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = createHmac("sha256", "housing-cmp").update(a).digest();
  const right = createHmac("sha256", "housing-cmp").update(b).digest();
  return timingSafeEqual(left, right);
}

export function isValidToken(candidate: string | null | undefined): boolean {
  const token = getAuthToken();
  return Boolean(token && candidate && safeEqual(candidate.trim(), token));
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

export function isAuthenticated(request: Request): boolean {
  const token = getAuthToken();
  if (!token) return false;
  const headerToken =
    request.headers.get(AUTH_HEADER_NAME) ??
    /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ??
    null;
  if (headerToken && safeEqual(headerToken.trim(), token)) return true;
  const session = readCookie(request, AUTH_COOKIE_NAME);
  return Boolean(session && safeEqual(session, sessionValueFor(token)));
}

/** Returns an error response when the request is not authenticated, or null to proceed. */
export function requireAuth(request: Request): NextResponse | null {
  if (!getAuthToken()) {
    return NextResponse.json(
      { ok: false, error: "Autenticação não configurada (HOUSING_AUTH_TOKEN)." },
      { status: 503 },
    );
  }
  if (isAuthenticated(request)) return null;
  return NextResponse.json(
    { ok: false, error: "Não autenticado. Entre em /login.", login: "/login" },
    { status: 401, headers: { "Cache-Control": "no-store" } },
  );
}

export function sanitizeNextPath(raw: unknown): string {
  return typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")
    ? raw
    : "/";
}
