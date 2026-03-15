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
    return Response.json(
      { error: "Not authenticated" },
      { status: 401, headers: corsHeaders }
    );
  }

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
      const context = (body.context ?? "").slice(0, 200_000);

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
    console.error("AI query error:", error);
    return Response.json(
      { error: "Failed to process question" },
      { status: 500, headers: corsHeaders }
    );
  }
}
