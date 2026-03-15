import { getModel } from "@/lib/ai-providers";
import { SYSTEM_PROMPT } from "@/lib/ai-query";
import { auth } from "@/lib/auth";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import { aiQuerySchema } from "@/lib/schemas";
import {
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  corsHeaders as sharedCorsHeaders,
  withRateLimitHeaders,
} from "@data-projects/shared";
import { convertToModelMessages, streamText } from "ai";

const corsHeaders = mergeHeaders(sharedCorsHeaders, {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    console.log(`[AI Query] POST auth=failed`);
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders }
    );
  }
  console.log(`[AI Query] POST auth=ok`);

  try {
    const clientIp = getClientIp(request);
    const rateLimitResult = checkRateLimit(
      `ai-query:${clientIp}`,
      RATE_LIMITS.search
    );

    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(
        rateLimitResult,
        "Too many requests. Please try again later.",
        corsHeaders
      );
    }

    const body = await request.json();

    if (body.messages) {
      if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 100) {
        return Response.json(
          { error: "messages must be an array with 1-100 items" },
          { status: 400, headers: corsHeaders }
        );
      }
      const context = (body.context ?? "").slice(0, 200_000);
      const messageCount = body.messages.length;
      console.log(`[AI Query] mode=multi-turn contextLength=${context.length} messageCount=${messageCount} model=${getModel()}`);

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
    console.log(`[AI Query] mode=single contextLength=${trimmedContext.length} model=${getModel()}`);
    console.log(
      `[AI Query] Question: "${question}" | Context: ${trimmedContext.length} chars`
    );

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
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error(`[AI Query] Error: ${errMsg}`);
    if (errStack) console.error(`[AI Query] Stack: ${errStack}`);
    return Response.json(
      { error: "Failed to process question" },
      { status: 500, headers: corsHeaders }
    );
  }
}
