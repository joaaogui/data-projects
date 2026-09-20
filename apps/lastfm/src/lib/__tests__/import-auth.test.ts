import { afterEach, describe, expect, it, vi } from "vitest";

describe("assertImportAuthorized", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function loadAuth(env: {
    IMPORT_SECRET?: string;
    ADMIN_TOKEN?: string;
  }) {
    vi.stubEnv("IMPORT_SECRET", env.IMPORT_SECRET ?? "");
    vi.stubEnv("ADMIN_TOKEN", env.ADMIN_TOKEN ?? "");
    vi.stubEnv("POSTGRES_URL", "postgresql://test:test@localhost/test");
    vi.stubEnv("LASTFM_API_KEY", "test-key");
    vi.stubEnv("LASTFM_USERNAME", "test-user");
    vi.resetModules();
    return import("../import-auth");
  }

  function requestWithBearer(token?: string) {
    const headers = new Headers();
    if (token) headers.set("authorization", `Bearer ${token}`);
    return new Request("http://localhost/api/import", {
      method: "POST",
      headers,
    });
  }

  it("fails closed when no secrets are configured", async () => {
    const { assertImportAuthorized } = await loadAuth({});
    const { AppError } = await import("../errors");
    expect(() => assertImportAuthorized(requestWithBearer("anything"))).toThrow(
      AppError,
    );
    try {
      assertImportAuthorized(requestWithBearer("anything"));
    } catch (error) {
      expect(error).toMatchObject({
        status: 401,
        message: "Import is not configured. Set IMPORT_SECRET or ADMIN_TOKEN.",
      });
    }
  });

  it("rejects missing Authorization header", async () => {
    const { assertImportAuthorized } = await loadAuth({
      IMPORT_SECRET: "import-secret",
    });
    const { AppError } = await import("../errors");
    expect(() => assertImportAuthorized(requestWithBearer())).toThrow(AppError);
  });

  it("rejects a wrong bearer token", async () => {
    const { assertImportAuthorized } = await loadAuth({
      IMPORT_SECRET: "import-secret",
    });
    const { AppError } = await import("../errors");
    expect(() => assertImportAuthorized(requestWithBearer("wrong"))).toThrow(
      AppError,
    );
  });

  it("accepts IMPORT_SECRET", async () => {
    const { assertImportAuthorized } = await loadAuth({
      IMPORT_SECRET: "import-secret",
    });
    expect(() =>
      assertImportAuthorized(requestWithBearer("import-secret")),
    ).not.toThrow();
  });

  it("accepts ADMIN_TOKEN", async () => {
    const { assertImportAuthorized } = await loadAuth({
      ADMIN_TOKEN: "admin-token",
    });
    expect(() =>
      assertImportAuthorized(requestWithBearer("admin-token")),
    ).not.toThrow();
  });
});
