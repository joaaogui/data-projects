import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth", () => ({
  getSpotifyToken: vi.fn().mockResolvedValue("test-token"),
  invalidateToken: vi.fn(),
}));

import { searchArtist } from "./api";

function mockSearch(items: Array<{ id: string; name: string }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        artists: { items },
      }),
    }),
  );
}

describe("searchArtist", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an exact case-insensitive match", async () => {
    mockSearch([
      { id: "1", name: "Radiohead" },
      { id: "2", name: "Radio Head Cover Band" },
    ]);

    const artist = await searchArtist("radiohead");
    expect(artist?.id).toBe("1");
    expect(artist?.name).toBe("Radiohead");
  });

  it("returns null when only fuzzy matches exist", async () => {
    mockSearch([
      { id: "1", name: "The Beatles" },
      { id: "2", name: "Beatles Tribute" },
    ]);

    await expect(searchArtist("Beatle")).resolves.toBeNull();
  });

  it("returns null for empty results", async () => {
    mockSearch([]);
    await expect(searchArtist("zzzz-no-such-artist")).resolves.toBeNull();
  });

  it("trims whitespace before matching", async () => {
    mockSearch([{ id: "9", name: "Daft Punk" }]);
    const artist = await searchArtist("  Daft Punk  ");
    expect(artist?.id).toBe("9");
  });
});

describe("searchArtists", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("clamps limit between 1 and 10 in the search URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ artists: { items: [] } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { searchArtists } = await import("./api");

    await searchArtists("ab", 99);
    expect(fetchMock.mock.calls[0][0]).toContain("limit=10");

    fetchMock.mockClear();
    await searchArtists("ab", 0);
    expect(fetchMock.mock.calls[0][0]).toContain("limit=1");
  });
});
