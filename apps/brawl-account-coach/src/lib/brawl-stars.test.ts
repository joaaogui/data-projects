import { afterEach, describe, expect, it, vi } from "vitest";

import {
  brawlFetch,
  BrawlStarsApiError,
  BrawlStarsNetworkError,
  MissingConfigurationError,
  PLAYER_TAG,
} from "./brawl-stars";

describe("brawl-stars client", () => {
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

  it("wires brawlFetch to BRAWL_STARS_API_KEY and shared error classes", async () => {
    delete process.env.BRAWL_STARS_API_KEY;
    await expect(brawlFetch("/brawlers")).rejects.toBeInstanceOf(
      MissingConfigurationError,
    );

    process.env.BRAWL_STARS_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new Error("socket hang up"),
    );
    await expect(brawlFetch("/brawlers")).rejects.toBeInstanceOf(
      BrawlStarsNetworkError,
    );

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ reason: "notFound" }), { status: 404 }),
    );
    await expect(brawlFetch("/players/%23Y0GLCU0GL")).rejects.toBeInstanceOf(
      BrawlStarsApiError,
    );
  });
});
