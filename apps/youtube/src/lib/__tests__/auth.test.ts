import { afterEach, describe, expect, it, vi } from "vitest";

let capturedConfig: Record<string, unknown> | undefined;

vi.mock("next-auth", () => ({
  default: vi.fn((config: Record<string, unknown>) => {
    capturedConfig = config;
    return {
      handlers: {},
      auth: vi.fn(),
      signIn: vi.fn(),
      signOut: vi.fn(),
    };
  }),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn(() => ({})),
}));

interface AuthCallbacks {
  signIn: (params: { profile?: { email?: string } }) => boolean;
  session: (params: { session: { user: object; expires: string }; token: Record<string, unknown> }) => Record<string, unknown>;
}

async function loadAuth(allowedEmails: string) {
  vi.stubEnv("ALLOWED_EMAILS", allowedEmails);
  vi.resetModules();
  capturedConfig = undefined;
  await import("../auth");
  return capturedConfig!.callbacks as AuthCallbacks;
}

describe("auth", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("ALLOWED_EMAILS parsing", () => {
    const parse = (raw: string) =>
      raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

    it("handles empty string", () => {
      expect(parse("")).toEqual([]);
    });

    it("handles comma-separated emails with varied casing and spaces", () => {
      expect(
        parse("Alice@Example.com, bob@test.com , charlie@foo.bar")
      ).toEqual(["alice@example.com", "bob@test.com", "charlie@foo.bar"]);
    });

    it("handles trailing comma", () => {
      expect(parse("user@test.com,")).toEqual(["user@test.com"]);
    });

    it("handles only whitespace entries", () => {
      expect(parse(" , , ")).toEqual([]);
    });
  });

  describe("signIn callback", () => {
    it("allows any email when ALLOWED_EMAILS is empty", async () => {
      const { signIn } = await loadAuth("");
      expect(signIn({ profile: { email: "anyone@example.com" } })).toBe(true);
    });

    it("allows a listed email", async () => {
      const { signIn } = await loadAuth("allowed@test.com");
      expect(signIn({ profile: { email: "allowed@test.com" } })).toBe(true);
    });

    it("blocks an unlisted email", async () => {
      const { signIn } = await loadAuth("allowed@test.com");
      expect(signIn({ profile: { email: "hacker@evil.com" } })).toBe(false);
    });

    it("matches case-insensitively", async () => {
      const { signIn } = await loadAuth("User@Example.COM");
      expect(signIn({ profile: { email: "user@example.com" } })).toBe(true);
    });

    it("rejects when profile has no email", async () => {
      const { signIn } = await loadAuth("allowed@test.com");
      expect(signIn({ profile: {} })).toBe(false);
    });

    it("rejects when profile is undefined", async () => {
      const { signIn } = await loadAuth("allowed@test.com");
      expect(signIn({ profile: undefined })).toBe(false);
    });
  });

  describe("session callback", () => {
    it("sets hasYoutubeAccess true when token has access_token", async () => {
      const { session } = await loadAuth("");
      const result = session({
        session: { user: {}, expires: "" },
        token: { access_token: "tok_123" },
      });
      expect(result.hasYoutubeAccess).toBe(true);
      expect(result.accessToken).toBe("tok_123");
    });

    it("sets hasYoutubeAccess false when token lacks access_token", async () => {
      const { session } = await loadAuth("");
      const result = session({
        session: { user: {}, expires: "" },
        token: {},
      });
      expect(result.hasYoutubeAccess).toBe(false);
      expect(result.accessToken).toBeUndefined();
    });
  });
});
