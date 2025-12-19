import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkRateLimit, getClientIp, RATE_LIMITS } from "@/lib/rate-limit";
import {
  corsHeaders as sharedCorsHeaders,
  mergeHeaders,
  optionsResponse,
  rateLimitExceededResponse,
  withRateLimitHeaders,
} from "@data-projects/shared";

const corsHeaders = mergeHeaders(sharedCorsHeaders, {
  "Access-Control-Allow-Methods": "POST, OPTIONS",
});

const SYSTEM_PROMPT = `You are a query translator for a YouTube video analytics app. Convert natural language questions about videos into structured JSON queries.

Available video fields:
- title: string (video title)
- days: number (days since upload - IMPORTANT: 0 = uploaded today, 1 = yesterday, 30 = one month ago, 365 = one year ago. Higher number = OLDER video)
- duration: number (video length in seconds)
- views: number (view count)
- likes: number (like count)
- comments: number (comment count)
- score: number (0-100, overall performance score)
- rates.viewsPerDay: number
- rates.viewsPerMinute: number
- rates.engagementRate: number (likes + comments per 1000 views)
- rates.likeRate: number (likes per 1000 views)
- rates.commentRate: number (comments per 1000 views)

Output a JSON object with this structure:
{
  "filters": {
    "fieldName": { "operator": value }
  },
  "sort": { "field": "fieldName", "order": "asc" | "desc" },
  "limit": number,
  "explanation": "Brief explanation of what this query does"
}

Operators: "eq", "gt", "gte", "lt", "lte", "contains" (for title only)

Examples:
- "most viewed video" → { "sort": { "field": "views", "order": "desc" }, "limit": 1, "explanation": "Video with the highest view count" }
- "videos from last week" → { "filters": { "days": { "lte": 7 } }, "explanation": "All videos uploaded in the last 7 days" }
- "videos over 1 million views" → { "filters": { "views": { "gte": 1000000 } }, "explanation": "All videos with 1M+ views" }
- "longest video" → { "sort": { "field": "duration", "order": "desc" }, "limit": 1, "explanation": "Video with the longest duration" }
- "oldest videos" → { "sort": { "field": "days", "order": "desc" }, "explanation": "Videos sorted by age, oldest first (highest days = oldest)" }
- "newest videos" → { "sort": { "field": "days", "order": "asc" }, "explanation": "Videos sorted by age, newest first (lowest days = newest)" }
- "hidden gems" or "underrated" → { "sort": { "field": "views", "order": "asc" }, "limit": 20, "explanation": "Videos with lowest views (potential hidden gems)" }
- "high engagement low views" → { "sort": { "field": "rates.engagementRate", "order": "desc" }, "filters": { "views": { "lt": 100000 } }, "limit": 20, "explanation": "High engagement videos with under 100K views" }

Time references:
- "last month" = days <= 30
- "last week" = days <= 7
- "last year" = days <= 365
- "today" = days == 0
- "yesterday" = days == 1
- "recent" = days <= 7

IMPORTANT: Output ONLY valid JSON, no markdown, no explanation outside the JSON.`;

export type AIProvider = "groq" | "gemini";

async function queryGroq(question: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const groq = new Groq({ apiKey });
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: question },
  ];

  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  const estimatedTokens = Math.ceil(totalChars / 4);

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages,
    temperature: 0.1,
    max_tokens: 500,
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}

async function queryGemini(question: string): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_AI_API_KEY not configured");
  }

  const totalChars = SYSTEM_PROMPT.length + question.length;
  const estimatedTokens = Math.ceil(totalChars / 4);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: SYSTEM_PROMPT + "\n\nUser question: " + question }],
      },
    ],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 500,
    },
  });

  const response = result.response;
  const text = response.text().trim();

  return text;
}

export async function OPTIONS() {
  return optionsResponse(corsHeaders);
}

export async function POST(request: Request) {
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
    const { question, provider = "groq" } = body as {
      question: string;
      provider?: AIProvider;
    };

    if (!question || typeof question !== "string" || question.length > 500) {
      return Response.json(
        { error: "Invalid question" },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[AI Query] Question: "${question}" | Provider: ${provider}`);

    let text: string;
    try {
      if (provider === "gemini") {
        text = await queryGemini(question);
      } else {
        text = await queryGroq(question);
      }
    } catch (providerError) {
      const message =
        providerError instanceof Error
          ? providerError.message
          : "Provider error";
      console.error(`[AI Query] Provider error (${provider}):`, message);
      return Response.json(
        { error: message },
        { status: 503, headers: corsHeaders }
      );
    }

    console.log(`[AI Query] Raw response: ${text}`);

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[AI Query] Failed to extract JSON from response");
      return Response.json(
        { error: "Failed to parse AI response" },
        { status: 500, headers: corsHeaders }
      );
    }

    const query = JSON.parse(jsonMatch[0]);

    console.log(`[AI Query] Parsed query:`, JSON.stringify(query, null, 2));

    return Response.json(query, {
      headers: mergeHeaders(corsHeaders, withRateLimitHeaders(rateLimitResult)),
    });
  } catch (error) {
    console.error("AI query error:", error);
    return Response.json(
      { error: "Failed to process question" },
      { status: 500, headers: corsHeaders }
    );
  }
}
