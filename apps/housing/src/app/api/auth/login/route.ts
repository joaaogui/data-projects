import { enforceRateLimit, loginSchema, parseWith } from "@/lib/api-guards";
import {
  AUTH_COOKIE_MAX_AGE_S,
  AUTH_COOKIE_NAME,
  getAuthToken,
  isValidToken,
  sanitizeNextPath,
  sessionValueFor,
} from "@/lib/auth";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function readBody(request: Request): Promise<{ raw: unknown; isForm: boolean }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return { raw: await request.json().catch(() => null), isForm: false };
  }
  const form = await request.formData().catch(() => null);
  return {
    raw: form ? { token: form.get("token") ?? "", next: form.get("next") ?? undefined } : null,
    isForm: true,
  };
}

export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "auth-login", 10, 15 * 60_000);
  if (limited) return limited;

  const { raw, isForm } = await readBody(request);
  const parsed = parseWith(loginSchema, raw);
  const nextPath = sanitizeNextPath(parsed.ok ? parsed.data.next : undefined);
  const token = getAuthToken();
  const success = Boolean(token && parsed.ok && isValidToken(parsed.data.token));
  logger.info("api/auth", "login attempt", { success });

  if (!success || !token) {
    if (isForm) {
      const back = new URL("/login", request.url);
      back.searchParams.set("error", token ? "1" : "unconfigured");
      back.searchParams.set("next", nextPath);
      return NextResponse.redirect(back, 303);
    }
    return NextResponse.json(
      { ok: false, error: token ? "Token inválido." : "Autenticação não configurada." },
      { status: token ? 401 : 503 },
    );
  }

  const response = isForm
    ? NextResponse.redirect(new URL(nextPath, request.url), 303)
    : NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, sessionValueFor(token), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE_S,
  });
  return response;
}
