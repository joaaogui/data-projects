import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getScoredProperties: vi.fn(),
  coerceWeights: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/server-scoring", () => ({
  getScoredProperties: mocks.getScoredProperties,
}));
vi.mock("@/lib/property-query", () => ({
  coerceWeights: mocks.coerceWeights,
  toDetailsDTO: vi.fn((p: { provider: string; id: string }) => ({
    key: `${p.provider}:${p.id}`,
    detailsLoaded: true,
  })),
}));

import { POST } from "./route";

const PROP_A = { provider: "quintoandar", id: "1", title: "A" };
const PROP_B = { provider: "zapimoveis", id: "2", title: "B" };

function postReq(body: unknown, raw = false): Request {
  return new Request("http://localhost/api/properties/details", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.coerceWeights.mockImplementation((raw: unknown) => raw ?? { coerced: null });
  mocks.getScoredProperties.mockResolvedValue({
    datasetHash: "hash-abc",
    properties: [PROP_A, PROP_B],
  });
});

describe("POST /api/properties/details", () => {
  it("returns details DTOs for known keys, dropping unknown keys", async () => {
    const res = await POST(
      postReq({ keys: ["quintoandar:1", "unknown:9", "zapimoveis:2"], weights: { a: 1 } }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({
      ok: true,
      datasetHash: "hash-abc",
      items: [
        { key: "quintoandar:1", detailsLoaded: true },
        { key: "zapimoveis:2", detailsLoaded: true },
      ],
    });
    expect(mocks.getScoredProperties).toHaveBeenCalledWith(
      { a: 1 },
      { enabledHiddenCities: [], signal: expect.any(AbortSignal) },
    );
  });

  it("passes enableBsbBenchmark=true through as enabledHiddenCities ['BSB']", async () => {
    await POST(postReq({ keys: [], enableBsbBenchmark: true }));
    expect(mocks.getScoredProperties).toHaveBeenCalledWith(
      expect.anything(),
      { enabledHiddenCities: ["BSB"], signal: expect.any(AbortSignal) },
    );
  });

  it("treats missing / non-array keys as empty and filters non-string keys", async () => {
    const res1 = await POST(postReq({}));
    await expect(res1.json()).resolves.toEqual({ ok: true, datasetHash: "hash-abc", items: [] });
    const res2 = await POST(postReq({ keys: "quintoandar:1" }));
    await expect(res2.json()).resolves.toEqual({ ok: true, datasetHash: "hash-abc", items: [] });
    const res3 = await POST(postReq({ keys: [42, null, "quintoandar:1"] }));
    const json3 = (await res3.json()) as { items: unknown[] };
    expect(json3.items).toHaveLength(1);
  });

  it("caps keys at 60", async () => {
    const keys = Array.from({ length: 75 }, () => "quintoandar:1");
    const res = await POST(postReq({ keys }));
    const json = (await res.json()) as { items: unknown[] };
    expect(json.items).toHaveLength(60);
  });

  it("rejects invalid JSON with 400", async () => {
    const res = await POST(postReq("{oops", true));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "invalid JSON" });
    expect(mocks.getScoredProperties).not.toHaveBeenCalled();
  });

  it("returns 500 when scoring fails", async () => {
    mocks.getScoredProperties.mockRejectedValueOnce(new Error("boom"));
    const res = await POST(postReq({ keys: ["quintoandar:1"] }));
    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "details failed" });
  });
});
