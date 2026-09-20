import { describe, expect, it } from "vitest";
import { validateTitle } from "./validation";

describe("validateTitle", () => {
  it("rejects empty input", () => {
    expect(validateTitle("")).toMatchObject({ valid: false });
    expect(validateTitle(null)).toMatchObject({ valid: false });
  });

  it("accepts a normal series title", () => {
    expect(validateTitle("Breaking Bad")).toMatchObject({ valid: true });
  });

  it("strips disallowed characters before validating", () => {
    const result = validateTitle("Game<>of Thrones");
    expect(result.valid).toBe(true);
  });
});
