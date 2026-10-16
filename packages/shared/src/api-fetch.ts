export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const DEFAULT_RATE_LIMIT_MESSAGE =
  "Too many requests. Please wait a moment and try again.";

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit & { fallbackError?: string },
): Promise<T> {
  const response = await fetch(input, init);
  if (response.ok) {
    return (await response.json()) as T;
  }

  const fallback =
    response.status === 429
      ? DEFAULT_RATE_LIMIT_MESSAGE
      : (init?.fallbackError ?? "Request failed");
  const contentType = response.headers?.get?.("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as {
        error?: string | { message?: string };
        message?: string;
      };
      const nested =
        typeof body.error === "object" && body.error !== null
          ? body.error.message
          : undefined;
      const message =
        (typeof body.error === "string" ? body.error : nested) ??
        body.message ??
        fallback;
      throw new ApiError(message, response.status);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(fallback, response.status);
    }
  }

  throw new ApiError(fallback, response.status);
}
