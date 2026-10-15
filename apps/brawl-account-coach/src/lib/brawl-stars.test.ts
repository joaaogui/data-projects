import { afterEach, describe, expect, it, vi } from "vitest";

import {
  brawlFetch,
  BrawlStarsApiError,
  BrawlStarsNetworkError,
  encodedTag,
  MissingConfigurationError,
  normalizePlayerTag,
  PLAYER_TAG,
} from "./brawl-stars";

describe("brawl-stars client and error handling", () => {
  const originalKey = process.env.BRAWL_STARS_API_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.BRAWL_STARS_API_KEY;
    } else {
      process.env.BRAWL_STARS_API_KEY = originalKey;
    }
    vi.restoreAllMocks();
  });

  it("pins the demo account tag", () => {
    expect(PLAYER_TAG).toBe("Y0GLCU0GL");
  });

  it("normalizes and URI-encodes player tags consistently", () => {
    expect(normalizePlayerTag("y0glcu0gl")).toBe("#Y0GLCU0GL");
    expect(normalizePlayerTag("  #y0glcu0gl ")).toBe("#Y0GLCU0GL");
    expect(normalizePlayerTag("##Y0GLCU0GL")).toBe("#Y0GLCU0GL");
    expect(encodedTag("y0glcu0gl")).toBe("%23Y0GLCU0GL");
    expect(encodedTag("#Y0GLCU0GL")).toBe("%23Y0GLCU0GL");
  });

  it.each([
    [401, "AUTHORIZATION_FAILED", /access was rejected/i],
    [403, "AUTHORIZATION_FAILED", /access was rejected/i],
    [404, "PLAYER_NOT_FOUND", /could not be found/i],
    [429, "UPSTREAM_RATE_LIMITED", /temporarily limiting requests/i],
    [503, "UPSTREAM_MAINTENANCE", /under maintenance/i],
    [500, "UPSTREAM_UNAVAILABLE", /temporarily unavailable/i],
    [502, "UPSTREAM_UNAVAILABLE", /temporarily unavailable/i],
    [400, "UPSTREAM_REQUEST_FAILED", /rejected the request/i],
  ] as const)(
    "maps HTTP %i to BrawlStarsApiError code %s",
    (status, expectedCode, expectedMessage) => {
      const error = new BrawlStarsApiError(status);
      expect(error.name).toBe("BrawlStarsApiError");
      expect(error.status).toBe(status);
      expect(error.code).toBe(expectedCode);
      expect(error.publicMessage).toMatch(expectedMessage);
    },
  );

  it("throws MissingConfigurationError when BRAWL_STARS_API_KEY is absent", async () => {
    delete process.env.BRAWL_STARS_API_KEY;
    await expect(brawlFetch("/brawlers")).rejects.toBeInstanceOf(
      MissingConfigurationError,
    );
  });

  it("throws BrawlStarsNetworkError when fetch fails at the network layer", async () => {
    process.env.BRAWL_STARS_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("socket hang up"),
    );

    await expect(brawlFetch("/brawlers")).rejects.toBeInstanceOf(
      BrawlStarsNetworkError,
    );
  });

  it("throws BrawlStarsApiError with mapped status when upstream returns non-2xx", async () => {
    process.env.BRAWL_STARS_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ reason: "notFound" }), { status: 404 }),
    );

    await expect(brawlFetch("/players/%23Y0GLCU0GL")).rejects.toMatchObject({
      name: "BrawlStarsApiError",
      status: 404,
      code: "PLAYER_NOT_FOUND",
    });
  });
});
