import { getModel } from "@/lib/ai-providers";
import { SYSTEM_PROMPT } from "@/lib/ai-query";
import { auth } from "@/lib/auth";
import { createTaggedLogger } from "@/lib/logger";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { withErrorHandling } from "@/lib/route-handler";
import { aiQuerySchema } from "@/lib/schemas";
import {
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  corsHeaders as sharedCorsHeaders,
  withRateLimitHeaders,
} from "@data-projects/shared";
import { convertToModelMessages, streamText } from "ai";

const log = createTaggedLogger("ai-query");

const corsHeaders = mergeHeaders(sharedCorsHeaders, {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export const POST = withErrorHandling("ai-query", async (req, _ctx) => {
  const session = await auth();
  if (!session) {
    log.info("POST auth=failed");
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders }
    );
  }
  log.info("POST auth=ok");

  const clientIp = getClientIp(req);
  const rateLimitResult = checkRateLimit(
    `ai-query:${clientIp}`,
    RATE_LIMITS.aiQuery
  );

  if (!rateLimitResult.success) {
    return rateLimitExceededResponse(
      rateLimitResult,
      "Too many requests. Please try again later.",
      corsHeaders
    );
  }

  const body = await req.json();

  if (body.messages) {
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 100) {
      return Response.json(
        { error: "messages must be an array with 1-100 items" },
        { status: 400, headers: corsHeaders }
      );
    }
    const context = (body.context ?? "").slice(0, 200_000);
    const messageCount = body.messages.length;
    log.info({ mode: "multi-turn", contextLength: context.length, messageCount }, "Processing query");

    const result = streamText({
      model: getModel(),
      system: `${SYSTEM_PROMPT}\n\n## Channel Data\n${context}`,
      messages: await convertToModelMessages(body.messages),
      temperature: 0.3,
      maxOutputTokens: 1500,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: body.messages,
      headers: mergeHeaders(
        corsHeaders,
        withRateLimitHeaders(rateLimitResult)
      ),
    });
  }

  const parsed = aiQuerySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0].message },
      { status: 400, headers: corsHeaders }
    );
  }
  const { question, context } = parsed.data;
  const trimmedContext = context.slice(0, 200_000);
  log.info({ mode: "single", contextLength: trimmedContext.length, question }, "Processing query");

  const result = streamText({
    model: getModel(),
    system: `${SYSTEM_PROMPT}\n\n## Channel Data\n${trimmedContext}`,
    messages: [{ role: "user", content: question }],
    temperature: 0.3,
    maxOutputTokens: 1500,
  });

  return result.toTextStreamResponse({
    headers: mergeHeaders(
      corsHeaders,
      withRateLimitHeaders(rateLimitResult)
    ),
  });
});
