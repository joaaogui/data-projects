import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createSupercellFetcher,
  encodedTag,
  MissingConfigurationError,
  normalizePlayerTag,
  SUPERCELL_ERROR_GUIDANCE,
  SupercellApiError,
  SupercellNetworkError,
  supercellUpstreamStatus,
} from "./supercell";

describe("supercell proxy client and error taxonomy", () => {
  const originalKey = process.env.TEST_SUPERCELL_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.TEST_SUPERCELL_API_KEY;
    } else {
      process.env.TEST_SUPERCELL_API_KEY = originalKey;
    }
    vi.restoreAllMocks();
  });

  it("normalizes and URI-encodes player tags consistently", () => {
    expect(normalizePlayerTag("y0glcu0gl")).toBe("#Y0GLCU0GL");
    expect(normalizePlayerTag("  #y0glcu0gl ")).toBe("#Y0GLCU0GL");
    expect(normalizePlayerTag("##Y0GLCU0GL")).toBe("#Y0GLCU0GL");
    expect(encodedTag("y0glcu0gl")).toBe("%23Y0GLCU0GL");
    expect(encodedTag("#Y0GLCU0GL")).toBe("%23Y0GLCU0GL");
  });

  it.each([
    [401, "AUTHORIZATION_FAILED", 503, /access was rejected/i],
    [403, "AUTHORIZATION_FAILED", 503, /access was rejected/i],
    [404, "PLAYER_NOT_FOUND", 404, /could not be found/i],
    [429, "UPSTREAM_RATE_LIMITED", 429, /temporarily limiting requests/i],
    [503, "UPSTREAM_MAINTENANCE", 503, /under maintenance/i],
    [500, "UPSTREAM_UNAVAILABLE", 503, /temporarily unavailable/i],
    [502, "UPSTREAM_UNAVAILABLE", 503, /temporarily unavailable/i],
    [400, "UPSTREAM_REQUEST_FAILED", 502, /rejected the request/i],
  ] as const)(
    "maps HTTP %i to SupercellApiError code %s and upstream status %i",
    (status, expectedCode, expectedUpstreamStatus, expectedMessage) => {
      const error = new SupercellApiError(status, "Brawl Stars");
      expect(error.name).toBe("SupercellApiError");
      expect(error.status).toBe(status);
      expect(error.code).toBe(expectedCode);
      expect(error.publicMessage).toMatch(expectedMessage);
      expect(supercellUpstreamStatus(error)).toBe(expectedUpstreamStatus);
    },
  );

  it("throws MissingConfigurationError when the API key env var is absent", async () => {
    delete process.env.TEST_SUPERCELL_API_KEY;
    const fetcher = createSupercellFetcher({
      serviceName: "Clash Royale",
      baseUrl: "https://proxy.royaleapi.dev/v1",
      apiKeyEnvVar: "TEST_SUPERCELL_API_KEY",
    });

    await expect(fetcher("/players/%23VGURQ0QQ2")).rejects.toBeInstanceOf(
      MissingConfigurationError,
    );
  });

  it("throws SupercellNetworkError when fetch fails at the network layer", async () => {
    process.env.TEST_SUPERCELL_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("socket hang up"),
    );

    const fetcher = createSupercellFetcher({
      serviceName: "Clash Royale",
      baseUrl: "https://proxy.royaleapi.dev/v1",
      apiKeyEnvVar: "TEST_SUPERCELL_API_KEY",
    });

    await expect(fetcher("/players/%23VGURQ0QQ2")).rejects.toMatchObject({
      name: "SupercellNetworkError",
      code: "UPSTREAM_UNAVAILABLE",
    });
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("socket hang up"),
    );
    await expect(fetcher("/players/%23VGURQ0QQ2")).rejects.toBeInstanceOf(
      SupercellNetworkError,
    );
  });

  it("throws SupercellApiError with mapped status when upstream returns non-2xx", async () => {
    process.env.TEST_SUPERCELL_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ reason: "notFound" }), { status: 404 }),
    );

    const fetcher = createSupercellFetcher({
      serviceName: "Brawl Stars",
      baseUrl: "https://bsproxy.royaleapi.dev/v1",
      apiKeyEnvVar: "TEST_SUPERCELL_API_KEY",
    });

    await expect(fetcher("/players/%23Y0GLCU0GL")).rejects.toMatchObject({
      name: "SupercellApiError",
      status: 404,
      code: "PLAYER_NOT_FOUND",
    });
  });

  it("sends Bearer authorization and returns parsed JSON on 200", async () => {
    process.env.TEST_SUPERCELL_API_KEY = "secret-token";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ tag: "#Y0GLCU0GL" }), { status: 200 }),
      );

    const fetcher = createSupercellFetcher({
      serviceName: "Brawl Stars",
      baseUrl: "https://bsproxy.royaleapi.dev/v1",
      apiKeyEnvVar: "TEST_SUPERCELL_API_KEY",
    });

    const result = await fetcher<{ tag: string }>("/players/%23Y0GLCU0GL");
    expect(result).toEqual({ tag: "#Y0GLCU0GL" });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const [, init] = fetchSpy.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("Authorization")).toBe("Bearer secret-token");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("exports guidance entries for all standard error codes", () => {
    expect(Object.keys(SUPERCELL_ERROR_GUIDANCE)).toEqual(
      expect.arrayContaining([
        "CONFIGURATION_MISSING",
        "AUTHORIZATION_FAILED",
        "PLAYER_NOT_FOUND",
        "UPSTREAM_RATE_LIMITED",
        "UPSTREAM_MAINTENANCE",
        "UPSTREAM_UNAVAILABLE",
        "RATE_LIMITED",
      ]),
    );
  });
});
