import { analysisRequestSchema, type AnalysisRequest } from "./schemas";

/** A full 300-battle history is about 135 KB, so this leaves headroom without inviting abuse. */
export const MAX_ANALYSIS_REQUEST_BYTES = 512 * 1024;

export interface AnalysisRequestRejection {
  ok: false;
  status: 400 | 413;
  code: "INVALID_REQUEST" | "PAYLOAD_TOO_LARGE";
  message: string;
  issues?: string[];
}

export type ParsedAnalysisRequest =
  | { ok: true; value: AnalysisRequest }
  | AnalysisRequestRejection;

export function tooLarge(): AnalysisRequestRejection {
  return {
    ok: false,
    status: 413,
    code: "PAYLOAD_TOO_LARGE",
    message: "The saved battle history is too large to send.",
  };
}

export function parseAnalysisRequestBody(
  rawBody: string,
): ParsedAnalysisRequest {
  if (new TextEncoder().encode(rawBody).length > MAX_ANALYSIS_REQUEST_BYTES) {
    return tooLarge();
  }

  let json: unknown = {};
  if (rawBody.trim() !== "") {
    try {
      json = JSON.parse(rawBody);
    } catch {
      return {
        ok: false,
        status: 400,
        code: "INVALID_REQUEST",
        message: "The analysis request was not valid JSON.",
      };
    }
  }

  const parsed = analysisRequestSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_REQUEST",
      message: "The analysis request did not match the expected shape.",
      issues: parsed.error.issues
        .slice(0, 5)
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
    };
  }

  return { ok: true, value: parsed.data };
}
