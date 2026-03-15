import { NextResponse } from "next/server";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError || (error instanceof Error && error.name === "AppError");
}

export function toErrorResponse(error: unknown): { message: string; status: number } {
  if (isAppError(error)) {
    return { message: error.message, status: error.status };
  }
  const message = error instanceof Error ? error.message : "Internal server error";
  return { message, status: 500 };
}

export function handleRouteError(error: unknown): NextResponse {
  const { message, status } = toErrorResponse(error);
  return NextResponse.json({ error: message }, { status });
}
