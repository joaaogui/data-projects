import { createRateLimiter, getClientIp, type RateLimiter } from "@data-projects/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isValidAllowedListingUrl } from "./listing-url";
import { processScoped } from "./process-cache";

export const cityCodeSchema = z.enum(["BH", "CP", "SP", "RJ", "BSB"]);
const looseRecord = z.record(z.string(), z.unknown());
const propertyKeySchema = z.string().trim().min(1).max(200);

export const qaPostSchema = z.object({
  action: z.enum(["ask", "answer", "delete", "clear"]).default("ask"),
  id: z.string().trim().max(200).optional(),
  propertyKey: z.string().max(500).optional(),
  question: z.string().max(10_000).optional(),
  answer: z.string().max(100_000).optional(),
  propertySnapshot: looseRecord.optional(),
  contextSummary: z.string().max(50_000).optional(),
  weights: looseRecord.optional(),
  enabledHiddenCities: z.array(z.string().max(10)).max(10).optional(),
});

/** Loose so schema additions (e.g. saved views) pass through to the store. */
export const preferencesSaveSchema = z.looseObject({
  filters: looseRecord.optional(),
  weights: looseRecord.optional(),
  activePresetId: z.string().max(200).optional(),
  favorites: z.array(propertyKeySchema).max(5_000).optional(),
  savedViews: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        name: z.string().trim().min(1).max(60),
        filters: looseRecord,
        createdAt: z.string().max(40).optional(),
      }),
    )
    .max(30)
    .optional(),
  clientUpdatedAt: z.string().max(100).optional(),
});

const neighborhoodNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[\p{L}\p{N} .'()/-]+$/u, "bairro inválido");

export const scrapeRunSchema = z.object({
  action: z.enum(["start", "cancel"]).default("start"),
  cities: z.array(cityCodeSchema).max(10).optional(),
  neighborhoods: z.array(neighborhoodNameSchema).max(200).optional(),
  customUrl: z
    .string()
    .trim()
    .max(2_000)
    .refine((u) => u === "" || isValidAllowedListingUrl(u), "URL de portal não permitida")
    .optional(),
  mode: z.enum(["full_sync", "verify_only", "custom_url"]).optional(),
  keys: z
    .array(z.string().regex(/^[a-z]+:[\w.-]{1,80}$/, "chave inválida"))
    .max(5_000)
    .optional(),
  maxPages: z.number().int().min(1).max(50).optional(),
});

export const geocodeSchema = z.object({
  items: z
    .array(
      z.object({
        key: propertyKeySchema,
        cityCode: cityCodeSchema,
        city: z.string().max(200).default(""),
        neighborhood: z.string().max(200).default(""),
        street: z.string().max(300).default(""),
        streetNumber: z.string().max(40).nullable().default(null),
      }),
    )
    .max(200)
    .default([]),
});

export const syncSchema = z.object({
  neighborhoods: z.array(looseRecord).max(5_000).optional(),
  properties: z.array(looseRecord).max(100_000).optional(),
});

export const loginSchema = z.object({
  token: z.string().trim().min(1).max(500),
  next: z.string().max(500).optional(),
});

export const photosQuerySchema = z.object({
  provider: z.string().trim().min(1).max(40).regex(/^[a-z]+$/),
  id: z.string().trim().min(1).max(80).regex(/^[\w.-]+$/),
  url: z.string().trim().max(2_000).default(""),
});

export type ParseResult<T> = { ok: true; data: T } | { ok: false; response: NextResponse };

function invalid(error: z.ZodError): NextResponse {
  const issue = error.issues[0];
  const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  return NextResponse.json(
    { ok: false, error: `Requisição inválida — ${where}${issue?.message ?? "formato inesperado"}` },
    { status: 400 },
  );
}

export function parseWith<T>(schema: z.ZodType<T>, value: unknown): ParseResult<T> {
  const parsed = schema.safeParse(value);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, response: invalid(parsed.error) };
}

export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Corpo JSON inválido." }, { status: 400 }),
    };
  }
  return parseWith(schema, raw);
}

const limiters = processScoped<Map<string, RateLimiter>>("api-rate-limiters", () => new Map());

/** Per-client fixed-window limit (in-memory, per instance). Returns a 429 response when exceeded. */
export function enforceRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  let limiter = limiters.get(bucket);
  if (!limiter) {
    limiter = createRateLimiter({ limit, windowMs });
    limiters.set(bucket, limiter);
  }
  const decision = limiter.check(getClientIp(request));
  if (decision.success) return null;
  return NextResponse.json(
    { ok: false, error: "Muitas requisições. Tente novamente em instantes." },
    { status: 429, headers: { "Retry-After": String(decision.retryAfter ?? 60) } },
  );
}
