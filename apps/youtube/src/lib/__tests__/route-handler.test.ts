import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mockWarn = vi.fn();
const mockError = vi.fn();

vi.mock("@/lib/logger", () => ({
  logger: {
    child: () => ({ warn: mockWarn, error: mockError }),
  },
}));

vi.mock("@/lib/errors", async () => {
  const { AppError } = await vi.importActual<typeof import("@/lib/errors")>(
    "@/lib/errors",
  );
  return {
    AppError,
    isAppError: (e: unknown) => e instanceof AppError,
    toErrorResponse: (e: unknown) => {
      if (e instanceof AppError) return { message: e.message, status: e.status };
      const message = e instanceof Error ? e.message : "Internal server error";
      return { message, status: 500 };
    },
  };
});

import { withErrorHandling } from "../route-handler";
import { AppError } from "../errors";

function createMockRequest(url = "http://localhost/api/test") {
  return new NextRequest(url);
}

const dummyCtx = { params: Promise.resolve({}) };

describe("withErrorHandling", () => {
  beforeEach(() => {
    mockWarn.mockClear();
    mockError.mockClear();
  });

  it("passes through successful responses", async () => {
    const handler = withErrorHandling("test", async () =>
      NextResponse.json({ ok: true }),
    );

    const res = await handler(createMockRequest(), dummyCtx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("catches AppError and returns JSON with correct status", async () => {
    const handler = withErrorHandling("test", async () => {
      throw new AppError("NOT_FOUND", "Resource not found", 404);
    });

    const res = await handler(createMockRequest(), dummyCtx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Resource not found" });
  });

  it("catches generic Error and returns 500", async () => {
    const handler = withErrorHandling("test", async () => {
      throw new Error("something broke");
    });

    const res = await handler(createMockRequest(), dummyCtx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "something broke" });
  });

  it("catches non-Error values and returns 500", async () => {
    const handler = withErrorHandling("test", async () => {
      throw "string error";
    });

    const res = await handler(createMockRequest(), dummyCtx);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Internal server error" });
  });

  it("logs AppError as warning with status", async () => {
    const handler = withErrorHandling("test", async () => {
      throw new AppError("BAD_INPUT", "Invalid input", 400);
    });

    await handler(createMockRequest(), dummyCtx);

    expect(mockWarn).toHaveBeenCalledOnce();
    expect(mockWarn.mock.calls[0][0]).toMatchObject({ status: 400 });
    expect(mockWarn.mock.calls[0][1]).toBe("Invalid input");
    expect(mockError).not.toHaveBeenCalled();
  });

  it("logs generic Error as error-level", async () => {
    const handler = withErrorHandling("test", async () => {
      throw new Error("boom");
    });

    await handler(createMockRequest(), dummyCtx);

    expect(mockError).toHaveBeenCalledOnce();
    expect(mockError.mock.calls[0][1]).toBe("Unhandled route error");
    expect(mockWarn).not.toHaveBeenCalled();
  });
});
