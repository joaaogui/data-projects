import { describe, it, expect } from "vitest";
import { validateSearchQuery, validateChannelId } from "@/lib/validation";

describe("validateSearchQuery", () => {
  it("accepts a normal search string", () => {
    const result = validateSearchQuery("react tutorial");
    expect(result).toEqual({ valid: true, sanitized: "react tutorial" });
  });

  it("trims whitespace and returns sanitized value", () => {
    const result = validateSearchQuery("  hello world  ");
    expect(result).toEqual({ valid: true, sanitized: "hello world" });
  });

  it("accepts allowed special characters", () => {
    const result = validateSearchQuery("what's new? #react @v2.0 (beta)!");
    expect(result.valid).toBe(true);
  });

  it("rejects null", () => {
    const result = validateSearchQuery(null as unknown as string);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("required");
  });

  it("rejects undefined", () => {
    const result = validateSearchQuery(undefined as unknown as string);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("required");
  });

  it("rejects empty string", () => {
    const result = validateSearchQuery("");
    expect(result.valid).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    const result = validateSearchQuery("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("rejects string exceeding maxLength of 100", () => {
    const long = "a".repeat(101);
    const result = validateSearchQuery(long);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too long");
  });

  it("accepts string exactly at maxLength of 100", () => {
    const exact = "a".repeat(100);
    const result = validateSearchQuery(exact);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe(exact);
  });

  it("accepts a single character", () => {
    const result = validateSearchQuery("a");
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe("a");
  });

  it("rejects disallowed characters like angle brackets", () => {
    const result = validateSearchQuery("<script>alert(1)</script>");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("invalid characters");
  });
});

describe("validateChannelId", () => {
  it("accepts a typical YouTube channel ID", () => {
    const result = validateChannelId("UC_x5XG1OV2P6uZZ5FSM9Ttw");
    expect(result).toEqual({ valid: true, sanitized: "UC_x5XG1OV2P6uZZ5FSM9Ttw" });
  });

  it("accepts alphanumeric with hyphens and underscores", () => {
    const result = validateChannelId("abc-123_XYZ");
    expect(result.valid).toBe(true);
  });

  it("rejects null", () => {
    const result = validateChannelId(null as unknown as string);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("required");
  });

  it("rejects empty string", () => {
    const result = validateChannelId("");
    expect(result.valid).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    const result = validateChannelId("   ");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("empty");
  });

  it("rejects string exceeding maxLength of 50", () => {
    const long = "a".repeat(51);
    const result = validateChannelId(long);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too long");
  });

  it("accepts string exactly at maxLength of 50", () => {
    const exact = "a".repeat(50);
    const result = validateChannelId(exact);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe(exact);
  });

  it("accepts a single character", () => {
    const result = validateChannelId("X");
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe("X");
  });

  it("rejects spaces in channel ID", () => {
    const result = validateChannelId("UC x5XG1OV2P6");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("invalid characters");
  });

  it("rejects special characters not in [a-zA-Z0-9_-]", () => {
    const result = validateChannelId("UC@channel!");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("invalid characters");
  });
});
