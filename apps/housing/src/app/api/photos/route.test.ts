import { beforeEach, describe, expect, it, vi } from "vitest";

const CACHED_PHOTOS = Array.from({ length: 7 }, (_, i) => ({
  room: `Foto ${i}`,
  url: `https://cdn.example/photos/cachehit/${i}.jpg`,
}));

const mocks = vi.hoisted(() => ({
  getPropertyFullDetails: vi.fn(),
  isAuthenticated: vi.fn(),
  galleries: {} as Record<string, Array<{ room: string | null; url: string }>>,
}));
mocks.galleries["quintoandar:cachehit"] = CACHED_PHOTOS;

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/dataset-store", () => ({
  getPropertyFullDetails: mocks.getPropertyFullDetails,
}));
vi.mock("@/lib/auth", () => ({
  isAuthenticated: mocks.isAuthenticated,
}));
vi.mock("@/lib/photo-galleries", () => ({
  loadPhotoGalleries: vi.fn(async () => ({ galleries: mocks.galleries, signature: "test" })),
  runtimePhotoGalleries: { set: vi.fn(async () => undefined) },
}));
vi.mock("@/lib/listing-deactivations", () => ({
  isQuintoAndarUnavailableHtml: vi.fn(() => false),
  recordListingDeactivation: vi.fn(),
}));
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return {
    ...actual,
    existsSync: vi.fn((p: Parameters<typeof actual.existsSync>[0]) =>
      String(p).includes("extract-listing-photos") ? false : actual.existsSync(p),
    ),
  };
});

import {
  extractPhotosFromHtml,
  fetchZapGlueApiPhotos,
  filterForeignQuintoAndarPhotos,
  GET,
  isValidAllowedListingUrl,
} from "./route";

function htmlRes(html: string, url: string) {
  return { ok: true, status: 200, url, text: async () => html, json: async () => ({}) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPropertyFullDetails.mockReturnValue(null);
  mocks.isAuthenticated.mockReturnValue(true);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("fetch not stubbed for this test");
    }),
  );
});

describe("isValidAllowedListingUrl", () => {
  it("accepts https on allowed hosts (with/without www)", () => {
    expect(isValidAllowedListingUrl("https://www.quintoandar.com.br/imovel/1")).toBe(true);
    expect(isValidAllowedListingUrl("https://quintoandar.com.br/imovel/1")).toBe(true);
    expect(isValidAllowedListingUrl("https://www.zapimoveis.com.br/imovel/1")).toBe(true);
    expect(isValidAllowedListingUrl("https://www.vivareal.com.br/imovel/1")).toBe(true);
    expect(isValidAllowedListingUrl("https://www.netimoveis.com/imovel/1")).toBe(true);
    expect(isValidAllowedListingUrl("https://www.imovelweb.com.br/imovel/1")).toBe(true);
  });
  it("rejects http, look-alike hosts and garbage", () => {
    expect(isValidAllowedListingUrl("http://www.quintoandar.com.br/imovel/1")).toBe(false);
    expect(isValidAllowedListingUrl("https://quintoandar.com.br.evil.example/1")).toBe(false);
    expect(isValidAllowedListingUrl("https://evilquintoandar.com.br/1")).toBe(false);
    expect(isValidAllowedListingUrl("not a url")).toBe(false);
    expect(isValidAllowedListingUrl("")).toBe(false);
  });
});

describe("filterForeignQuintoAndarPhotos", () => {
  it("drops photos whose embedded photo-id differs from the listing id", () => {
    const photos = [
      { room: null, url: "https://www.quintoandar.com.br/img/xxl/original12345678-a.jpg" },
      { room: null, url: "https://www.quintoandar.com.br/img/xxl/original87654321-b.jpg" },
      { room: null, url: "https://cdn.example/no-id.jpg" },
    ];
    expect(filterForeignQuintoAndarPhotos(photos, "12345678")).toEqual([photos[0], photos[2]]);
  });
  it("returns input untouched for non-numeric/short ids", () => {
    const photos = [{ room: null, url: "https://x/img/xxl/original87654321-b.jpg" }];
    expect(filterForeignQuintoAndarPhotos(photos, "abc")).toBe(photos);
    expect(filterForeignQuintoAndarPhotos(photos, null)).toBe(photos);
  });
});

describe("extractPhotosFromHtml", () => {
  it("extracts QuintoAndar photos from __NEXT_DATA__ and upgrades size segment", () => {
    const html = `<script id="__NEXT_DATA__">${JSON.stringify({
      props: {
        pageProps: {
          initialState: {
            house: {
              houseInfo: {
                id: "12345678",
                photos: [
                  { url: "original12345678-1.jpg", subtitle: "Sala" },
                  { url: "https://www.quintoandar.com.br/img/med/original12345678-2.jpg", subtitle: "Cozinha" },
                ],
                condominium: { images: [] },
              },
            },
          },
        },
      },
    })}</script>`;
    const out = extractPhotosFromHtml("quintoandar", html, "https://www.quintoandar.com.br/x");
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(out.every((p) => p.url.includes("/img/xxl/"))).toBe(true);
  });

  it("extracts Netimóveis gallery images with room from caption prefix", () => {
    const html =
      `<img class="gallery-image" data-src="https://img.example/1.jpg" data-caption="Sala - vista">` +
      `<img class="other" src="https://img.example/skip.jpg">` +
      `<img class="gallery-image" src="https://img.example/2.jpg" alt="Quarto">`;
    const out = extractPhotosFromHtml("netimoveis", html, "https://www.netimoveis.com/x");
    expect(out).toEqual([
      { room: "Sala", url: "https://img.example/1.jpg" },
      { room: "Quarto", url: "https://img.example/2.jpg" },
    ]);
  });

  it("extracts Imovelweb hi-res urls and dedupes", () => {
    const html = `"url1200x1200":"https://img.example/360x266/a.jpg" "url730x532":"https://img.example/360x266/a.jpg"`;
    const out = extractPhotosFromHtml("imovelweb", html, "https://www.imovelweb.com.br/x");
    expect(out).toEqual([{ room: null, url: "https://img.example/1200x1200/a.jpg" }]);
  });

  it("extracts Zap/VivaReal photos from Next flight scripts", () => {
    const payload = {
      baseData: {
        pageData: {
          listing: {
            medias: {
              images: [
                { dangerousSrc: "https://img.example/{description}.webp?action={action}&dimension=640x480", alt: "Sala" },
              ],
            },
          },
        },
      },
    };
    const line = `x:["$","y",null,${JSON.stringify(payload)}]`;
    const script = `self.__next_f.push([1,${JSON.stringify(`${line}\n`)}])`;
    const out = extractPhotosFromHtml(
      "zapimoveis",
      `<script>${script}</script>`,
      "https://www.zapimoveis.com.br/x",
    );
    expect(out).toEqual([
      { room: "Sala", url: "https://img.example/foto.webp?action=fit-in&dimension=1920x1440" },
    ]);
  });

  it("returns [] for unknown providers / empty html", () => {
    expect(extractPhotosFromHtml("other", "<html></html>", "https://example.com")).toEqual([]);
    expect(extractPhotosFromHtml("quintoandar", "<html>no data</html>", "https://www.quintoandar.com.br/x")).toEqual([]);
  });
});

describe("fetchZapGlueApiPhotos", () => {
  it("returns empty without fetching when no numeric id is present", async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    await expect(fetchZapGlueApiPhotos("sem-id")).resolves.toEqual({
      photos: [],
      isDeactivated: false,
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("maps glue v2 search medias and rewrites dimensions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          search: {
            result: {
              listings: [
                {
                  listing: { id: "2915407598", status: "ACTIVE" },
                  medias: [
                    { type: "IMAGE", url: "https://img.example/a.jpg?dimension=640x480", description: "Sala" },
                    { type: "VIDEO", url: "https://img.example/v.mp4" },
                  ],
                },
              ],
            },
          },
        }),
      })),
    );
    const out = await fetchZapGlueApiPhotos("2915407598");
    expect(out.isDeactivated).toBe(false);
    expect(out.photos).toEqual([
      { room: "Sala", url: "https://img.example/a.webp?dimension=1920x1440" },
    ]);
  });

  it("flags deactivation from non-ACTIVE status and from a 404 on the detail endpoint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/v2/listings")
          ? {
              ok: true,
              status: 200,
              json: async () => ({
                search: { result: { listings: [{ listing: { id: "2915407599", status: "INACTIVE" }, medias: [] }] } },
              }),
            }
          : { ok: false, status: 200, json: async () => ({}) },
      ),
    );
    await expect(fetchZapGlueApiPhotos("2915407599")).resolves.toEqual({
      photos: [],
      isDeactivated: true,
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/v2/listings")
          ? { ok: false, status: 500, json: async () => ({}) }
          : { ok: false, status: 404, json: async () => ({}) },
      ),
    );
    await expect(fetchZapGlueApiPhotos("2915407599")).resolves.toEqual({
      photos: [],
      isDeactivated: true,
    });
  });
});

describe("GET /api/photos", () => {
  it("rejects missing provider or id with 400", async () => {
    const res = await GET(new Request("http://localhost/api/photos?provider=quintoandar"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      photos: [],
      error: "Parâmetros provider e id são obrigatórios.",
    });
  });

  it("rejects a disallowed url param with 400", async () => {
    const url = encodeURIComponent("https://evil.example/imovel/1");
    const res = await GET(
      new Request(`http://localhost/api/photos?provider=quintoandar&id=1&url=${url}`),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/domínio não permitido/);
  });

  it("serves a >6-photo cache hit without fetching, with long cache headers", async () => {
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    const res = await GET(
      new Request("http://localhost/api/photos?provider=quintoandar&id=cachehit"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("max-age=3600");
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.ok).toBe(true);
    expect(json.source).toBe("cache");
    expect(json.photos).toHaveLength(7);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("serves anonymous visitors the cached list only, without live lookups or shared caching", async () => {
    mocks.isAuthenticated.mockReturnValue(false);
    const fetchFn = vi.fn();
    vi.stubGlobal("fetch", fetchFn);
    const target = encodeURIComponent("https://www.netimoveis.com/imovel/anon1");
    const res = await GET(
      new Request(`http://localhost/api/photos?provider=netimoveis&id=anon1&url=${target}`),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    await expect(res.json()).resolves.toMatchObject({ ok: false, photos: [], source: "none" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("rejects when neither stored listing nor param provides a valid url", async () => {
    const res = await GET(
      new Request("http://localhost/api/photos?provider=netimoveis&id=nolink1"),
    );
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toMatch(/url válidos são obrigatórios/);
  });

  it("resolves live Netimóveis photos over HTTP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        htmlRes(
          `<img class="gallery-image" data-src="https://img.example/live1.jpg" data-caption="Sala - ampla">`,
          String(url),
        ),
      ),
    );
    const target = encodeURIComponent("https://www.netimoveis.com/imovel/live1");
    const res = await GET(
      new Request(`http://localhost/api/photos?provider=netimoveis&id=live-neti-1&url=${target}`),
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ ok: true, source: "http" });
    expect(json.photos).toEqual([{ room: "Sala", url: "https://img.example/live1.jpg" }]);
  });

  it("resolves Zap photos via the glue API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        status: 200,
        url: String(url),
        text: async () => "",
        json: async () => ({
          search: {
            result: {
              listings: [
                {
                  listing: { id: "2915407600", status: "ACTIVE" },
                  medias: [{ type: "IMAGE", url: "https://img.example/z.jpg?dimension=1x1", alt: "Quarto" }],
                },
              ],
            },
          },
        }),
      })),
    );
    const target = encodeURIComponent("https://www.zapimoveis.com.br/imovel/2915407600");
    const res = await GET(
      new Request(`http://localhost/api/photos?provider=zapimoveis&id=2915407600&url=${target}`),
    );
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ ok: true, source: "glue-api" });
    expect(json.photos).toEqual([
      { room: "Quarto", url: "https://img.example/z.webp?dimension=1920x1440" },
    ]);
  });

  it("returns ok:false/source none with short cache headers when no photos are found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => htmlRes("<html><body>sem fotos</body></html>", String(url))),
    );
    const target = encodeURIComponent("https://www.imovelweb.com.br/imovel/empty1");
    const res = await GET(
      new Request(`http://localhost/api/photos?provider=imovelweb&id=empty1&url=${target}`),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=600");
    await expect(res.json()).resolves.toMatchObject({ ok: false, photos: [], source: "none" });
  });

  it("swallows unhandled errors as 200 {ok:false, photos:[]}", async () => {
    mocks.getPropertyFullDetails.mockImplementationOnce(() => {
      throw new Error("store exploded");
    });
    const res = await GET(
      new Request("http://localhost/api/photos?provider=quintoandar&id=boom1"),
    );
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: false, photos: [] });
  });
});
