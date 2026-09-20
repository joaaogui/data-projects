import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, apiFetch } from "./api-fetch";

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ ok: true, value: 42 }),
      }),
    );

    await expect(apiFetch<{ ok: boolean; value: number }>("/x")).resolves.toEqual({
      ok: true,
      value: 42,
    });
  });

  it("rethrows ApiError from a JSON error body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: { get: () => "application/json" },
        json: async () => ({ error: "Too many requests" }),
      }),
    );

    await expect(apiFetch("/x")).rejects.toMatchObject({
      name: "ApiError",
      message: "Too many requests",
      status: 429,
    });
    await expect(apiFetch("/x")).rejects.toBeInstanceOf(ApiError);
  });

  it("reads nested error.message objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        headers: { get: () => "application/json" },
        json: async () => ({ error: { message: "Nested failure" } }),
      }),
    );

    await expect(apiFetch("/x")).rejects.toMatchObject({
      message: "Nested failure",
      status: 400,
    });
  });

  it("uses fallbackError when JSON body has no error fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        headers: { get: () => "application/json" },
        json: async () => ({}),
      }),
    );

    await expect(apiFetch("/x", { fallbackError: "Upstream down" })).rejects.toMatchObject({
      message: "Upstream down",
      status: 502,
    });
  });

  it("falls back for non-JSON error responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: { get: () => "text/html" },
      }),
    );

    await expect(apiFetch("/x")).rejects.toMatchObject({
      message: "Request failed",
      status: 503,
    });
  });

  it("uses fallback when the JSON body cannot be parsed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => "application/json" },
        json: async () => {
          throw new Error("bad json");
        },
      }),
    );

    await expect(apiFetch("/x", { fallbackError: "Boom" })).rejects.toMatchObject({
      message: "Boom",
      status: 500,
    });
  });
});
