export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(
  input: RequestInfo | URL,
  init?: RequestInit & { fallbackError?: string }
): Promise<T> {
  const response = await fetch(input, init);
  if (response.ok) {
    return (await response.json()) as T;
  }

  const fallback = init?.fallbackError ?? "Request failed";
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as { error?: string; message?: string };
      const message = body.error ?? body.message ?? fallback;
      throw new ApiError(message, response.status);
    } catch {
      throw new ApiError(fallback, response.status);
    }
  }

  throw new ApiError(fallback, response.status);
}


