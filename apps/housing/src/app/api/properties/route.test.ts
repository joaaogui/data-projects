import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getScoredProperties: vi.fn(),
  getDatasetMeta: vi.fn(),
  runPropertyQuery: vi.fn(),
  coerceWeights: vi.fn(),
  afterCallbacks: [] as Array<() => Promise<void> | void>,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/server-scoring", () => ({
  getScoredProperties: mocks.getScoredProperties,
  getDatasetMeta: mocks.getDatasetMeta,
}));
vi.mock("@/lib/property-query", () => ({
  coerceWeights: mocks.coerceWeights,
  runPropertyQuery: mocks.runPropertyQuery,
  toQueryFilters: vi.fn((state: unknown) => ({ fromState: state })),
}));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: vi.fn((cb: () => Promise<void> | void) => {
      mocks.afterCallbacks.push(cb);
    }),
  };
});

import { GET, POST } from "./route";

function postReq(body: unknown, raw = false): Request {
  return new Request("http://localhost/api/properties", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.afterCallbacks.length = 0;
  mocks.coerceWeights.mockImplementation((raw: unknown) => ({ coerced: raw ?? null }));
  mocks.getScoredProperties.mockResolvedValue({ datasetHash: "hash-1", properties: [] });
  mocks.getDatasetMeta.mockResolvedValue({ totalCount: 2, source: "snapshot" });
  mocks.runPropertyQuery.mockImplementation(() => ({
    ok: true,
    key: "k1",
    datasetHash: "hash-1",
    total: 1,
    offset: 0,
    items: [{ provider: "quintoandar", id: "1" }],
  }));
});

describe("GET /api/properties (warm-up)", () => {
  it("returns 204 no-store and schedules scoring with parsed weights + hidden cities", async () => {
    const w = encodeURIComponent(JSON.stringify({ minAreaM2: 40 }));
    const res = await GET(new Request(`http://localhost/api/properties?w=${w}&hidden=BSB`));
    expect(res.status).toBe(204);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.text()).toBe("");
    expect(mocks.coerceWeights).toHaveBeenCalledWith({ minAreaM2: 40 });
    expect(mocks.afterCallbacks).toHaveLength(1);
    await mocks.afterCallbacks[0]!();
    expect(mocks.getScoredProperties).toHaveBeenCalledWith(
      { coerced: { minAreaM2: 40 } },
      { enabledHiddenCities: ["BSB"] },
    );
  });

  it("falls back to null weights on malformed w JSON and no hidden cities", async () => {
    const res = await GET(new Request("http://localhost/api/properties?w=not-json"));
    expect(res.status).toBe(204);
    expect(mocks.coerceWeights).toHaveBeenCalledWith(null);
    await mocks.afterCallbacks[0]!();
    expect(mocks.getScoredProperties).toHaveBeenCalledWith(
      { coerced: null },
      { enabledHiddenCities: [] },
    );
  });
});

describe("POST /api/properties", () => {
  it("happy path: returns query response with meta + timings + Server-Timing header", async () => {
    const res = await POST(
      postReq({
        filters: { selectedCities: ["BH"] },
        weights: { minAreaM2: 50 },
        favorites: ["quintoandar:1", 42, "", "zapimoveis:2"],
        offset: 5,
        limit: 10,
        includeFacets: true,
        includeMeta: true,
        mode: "page",
        activeFilterLabels: ["BH", 7],
        allFavorites: ["quintoandar:1"],
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("server-timing")).toMatch(/score;dur=[\d.]+, query;dur=[\d.]+/);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.ok).toBe(true);
    expect(json.total).toBe(1);
    expect(json.meta).toEqual({ totalCount: 2, source: "snapshot" });
    expect(json.timings).toEqual(
      expect.objectContaining({ scoreMs: expect.any(Number), queryMs: expect.any(Number) }),
    );
    expect(mocks.getDatasetMeta).toHaveBeenCalledTimes(1);
    const reqArg = mocks.runPropertyQuery.mock.calls[0]![1] as Record<string, unknown>;
    expect(reqArg.favorites).toEqual(["quintoandar:1", "zapimoveis:2"]);
    expect(reqArg.activeFilterLabels).toEqual(["BH"]);
    expect(reqArg.allFavorites).toEqual(["quintoandar:1"]);
    expect(reqArg.offset).toBe(5);
    expect(reqArg.limit).toBe(10);
    expect(reqArg.mode).toBe("page");
    expect(reqArg.includeFacets).toBe(true);
    expect(reqArg.includeMeta).toBe(true);
  });

  it("defaults unknown mode to page and non-number offset/limit; skips meta when not requested", async () => {
    const res = await POST(postReq({ mode: "bogus", offset: "3", limit: "9" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.meta).toBeUndefined();
    expect(mocks.getDatasetMeta).not.toHaveBeenCalled();
    const reqArg = mocks.runPropertyQuery.mock.calls[0]![1] as Record<string, unknown>;
    expect(reqArg.mode).toBe("page");
    expect(reqArg.offset).toBe(0);
    expect(reqArg.limit).toBeUndefined();
    expect(reqArg.favorites).toEqual([]);
  });

  it("accepts copyTop50 / activeKeys modes verbatim", async () => {
    await POST(postReq({ mode: "copyTop50" }));
    await POST(postReq({ mode: "activeKeys" }));
    expect(
      mocks.runPropertyQuery.mock.calls.map((c) => (c[1] as Record<string, unknown>).mode),
    ).toEqual(["copyTop50", "activeKeys"]);
  });

  it("rejects invalid JSON with 400", async () => {
    const res = await POST(postReq("{not json", true));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "invalid JSON" });
    expect(mocks.getScoredProperties).not.toHaveBeenCalled();
  });

  it("returns 500 when scoring fails", async () => {
    mocks.getScoredProperties.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(postReq({}));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "query failed" });
  });
});
