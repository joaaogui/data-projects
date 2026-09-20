import { describe, expect, it } from "vitest";
import { AppError, toErrorResponse } from "../errors";

describe("toErrorResponse", () => {
  it("returns AppError message and status", () => {
    const error = new AppError("NOT_FOUND", "Resource not found", 404);
    expect(toErrorResponse(error)).toEqual({
      message: "Resource not found",
      status: 404,
    });
  });

  it("never leaks raw Error.message for unknown errors", () => {
    expect(toErrorResponse(new Error("db password=secret host=internal"))).toEqual({
      message: "Internal server error",
      status: 500,
    });
  });

  it("returns a generic 500 for non-Error values", () => {
    expect(toErrorResponse("boom")).toEqual({
      message: "Internal server error",
      status: 500,
    });
  });
});
