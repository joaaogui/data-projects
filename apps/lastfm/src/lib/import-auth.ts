import "server-only";
import { timingSafeEqual } from "node:crypto";
import { AppError } from "./errors";
import { env } from "./env";

function tokensEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

/**
 * POST /api/import requires `Authorization: Bearer <token>` matching
 * IMPORT_SECRET or ADMIN_TOKEN. Fails closed when neither secret is configured.
 */
export function assertImportAuthorized(request: Request): void {
  const expected = [env.IMPORT_SECRET, env.ADMIN_TOKEN].filter(
    (value): value is string => typeof value === "string" && value.length > 0
  );

  if (expected.length === 0) {
    throw new AppError(
      "UNAUTHORIZED",
      "Import is not configured. Set IMPORT_SECRET or ADMIN_TOKEN.",
      401
    );
  }

  const provided = extractBearerToken(request);
  if (!provided || !expected.some((secret) => tokensEqual(provided, secret))) {
    throw new AppError("UNAUTHORIZED", "Unauthorized", 401);
  }
}
