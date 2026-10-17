import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AUTH_COOKIE_NAME, isAuthenticated, requireAuth, sanitizeNextPath, sessionValueFor } from "./auth";

const TOKEN = "test-token-not-a-secret";

function req(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/qa", { method: "POST", headers });
}

describe("auth", () => {
  const original = process.env.HOUSING_AUTH_TOKEN;
  beforeEach(() => {
    process.env.HOUSING_AUTH_TOKEN = TOKEN;
  });
  afterEach(() => {
    process.env.HOUSING_AUTH_TOKEN = original;
  });

  it("accepts the token header, bearer header and session cookie", () => {
    expect(isAuthenticated(req({ "x-housing-token": TOKEN }))).toBe(true);
    expect(isAuthenticated(req({ authorization: `Bearer ${TOKEN}` }))).toBe(true);
    expect(isAuthenticated(req({ cookie: `a=1; ${AUTH_COOKIE_NAME}=${sessionValueFor(TOKEN)}` }))).toBe(true);
  });

  it("rejects missing or wrong credentials", () => {
    expect(isAuthenticated(req())).toBe(false);
    expect(isAuthenticated(req({ "x-housing-token": "nope" }))).toBe(false);
    expect(isAuthenticated(req({ cookie: `${AUTH_COOKIE_NAME}=${TOKEN}` }))).toBe(false);
    expect(requireAuth(req())?.status).toBe(401);
    expect(requireAuth(req({ "x-housing-token": TOKEN }))).toBeNull();
  });

  it("fails closed when no token is configured", () => {
    delete process.env.HOUSING_AUTH_TOKEN;
    expect(isAuthenticated(req({ "x-housing-token": "" }))).toBe(false);
    expect(requireAuth(req())?.status).toBe(503);
  });

  it("only redirects to same-origin paths", () => {
    expect(sanitizeNextPath("/x?y=1")).toBe("/x?y=1");
    expect(sanitizeNextPath("//evil.example.com")).toBe("/");
    expect(sanitizeNextPath("https://evil.example.com")).toBe("/");
    expect(sanitizeNextPath(undefined)).toBe("/");
  });
});
