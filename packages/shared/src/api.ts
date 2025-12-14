import type { RateLimitResult } from "./rate-limit";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export function optionsResponse(headers: HeadersInit = corsHeaders): Response {
  return new Response(null, { status: 204, headers });
}

export function mergeHeaders(...headersList: HeadersInit[]): Headers {
  const headers = new Headers();
  for (const item of headersList) {
    if (!item) continue;
    new Headers(item).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
}

export function withRateLimitHeaders(
  rateLimitResult: RateLimitResult,
  headers: HeadersInit = {}
): Headers {
  return mergeHeaders(headers, {
    "X-RateLimit-Remaining": String(rateLimitResult.remaining),
    "X-RateLimit-Reset": String(rateLimitResult.resetTime),
  });
}

export function rateLimitExceededResponse(
  rateLimitResult: RateLimitResult,
  message: string = "Too many requests. Please try again later.",
  headers: HeadersInit = corsHeaders
): Response {
  return Response.json(
    { error: message },
    {
      status: 429,
      headers: mergeHeaders(headers, {
        "Retry-After": String(rateLimitResult.retryAfter ?? 60),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(rateLimitResult.resetTime),
      }),
    }
  );
}


