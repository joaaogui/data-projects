import { getPropertyFullDetails } from "@/lib/dataset-store";
import {
  isQuintoAndarUnavailableHtml,
  recordListingDeactivation,
} from "@/lib/listing-deactivations";
import { cleanListingText } from "@/lib/listing-normalization";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const PHOTOS_CACHE_FILE = join(process.cwd(), "src/data/photos-cache.json");
const TMP_PHOTOS_CACHE_FILE = join(tmpdir(), "housing-photos-cache.json");
const SCRAPER_WORKSPACE_DIR = "/Users/joao.guilherme/.cursor/Empty";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const ALLOWED_LISTING_HOST_REGEX =
  /^(?:www\.)?(?:quintoandar\.com\.br|zapimoveis\.com\.br|vivareal\.com\.br|netimoveis\.com(?:\.br)?|imovelweb\.com\.br)$/i;

export function isValidAllowedListingUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    return ALLOWED_LISTING_HOST_REGEX.test(parsed.hostname);
  } catch {
    return false;
  }
}

async function fetchHtml(targetUrl: string): Promise<string | null> {
  if (!isValidAllowedListingUrl(targetUrl)) {
    return null;
  }
  const res = await fetch(targetUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return null;
  if (res.url && !isValidAllowedListingUrl(res.url)) {
    return null;
  }
  return res.text();
}

export interface ExtractedPhoto {
  room: string | null;
  url: string;
}

type PhotoEntry = ExtractedPhoto;
type PhotosCacheMap = Record<string, PhotoEntry[]>;

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
const asArr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null =>
  typeof v === "string" && v !== "$undefined" && v.trim() !== ""
    ? v.trim()
    : null;

function readPhotosCacheFile(filePath: string): PhotosCacheMap {
  if (!existsSync(/*turbopackIgnore: true*/ filePath)) return {};
  try {
    const raw = JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ filePath, "utf8"),
    ) as unknown;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      return raw as PhotosCacheMap;
    }
    return {};
  } catch {
    return {};
  }
}

let memPhotosCache: Record<string, PhotoEntry[]> | null = null;
const verifiedCompleteKeys = new Set<string>();
const negativeLookupExpiry = new Map<string, number>();
const NEGATIVE_TTL_MS = 5 * 60 * 1000;
const inFlightLookups = new Map<string, Promise<PhotoEntry[]>>();
const lastLookupSource = new Map<
  string,
  "glue-api" | "http" | "playwright" | "cache" | "none"
>();

export function loadPhotosCache(): PhotosCacheMap {
  if (!memPhotosCache) {
    memPhotosCache = {
      ...readPhotosCacheFile(PHOTOS_CACHE_FILE),
      ...readPhotosCacheFile(TMP_PHOTOS_CACHE_FILE),
    };
  }
  return memPhotosCache;
}

function savePhotosCache(cache: PhotosCacheMap): void {
  memPhotosCache = cache;
  const serialized = `${JSON.stringify(cache, null, 2)}\n`;
  try {
    mkdirSync(dirname(PHOTOS_CACHE_FILE), { recursive: true });
    writeFileSync(PHOTOS_CACHE_FILE, serialized, "utf8");
  } catch {
    // Ignore read-only filesystem errors in serverless environments
  }
  try {
    writeFileSync(TMP_PHOTOS_CACHE_FILE, serialized, "utf8");
  } catch {
    // Ignore /tmp write errors
  }
}

const QUINTO_PHOTO_ID_REGEX =
  /\/img\/(?:xxl|med|xl|sm|lg)\/(?:original)?(\d{8,10})-/i;

export function filterForeignQuintoAndarPhotos(
  photos: ExtractedPhoto[],
  listingId: string | number | null | undefined,
): ExtractedPhoto[] {
  const idStr = String(listingId ?? "").trim();
  if (!/^\d{8,10}$/.test(idStr)) return photos;
  return photos.filter((p) => {
    const match = QUINTO_PHOTO_ID_REGEX.exec(p.url);
    return !match || match[1] === idStr;
  });
}

function extractQuintoPhotosFromHouseInfo(houseInfo: Rec): ExtractedPhoto[] {
  const listingId = str(houseInfo["id"]) ?? String(houseInfo["id"] ?? "");
  const photos = asArr(houseInfo["photos"]).map(asRec);
  const condo = asRec(houseInfo["condominium"]);
  const condoPhotos = asArr(condo["images"]).map(asRec);
  const allCandidates = [...photos, ...condoPhotos];

  const toQuintoImgUrl = (rawUrl: string): string =>
    rawUrl.startsWith("http")
      ? rawUrl.replace(/\/img\/(?:sm|med|lg|xl)\//, "/img/xxl/")
      : `https://www.quintoandar.com.br/img/xxl/${rawUrl}`;

  const out: ExtractedPhoto[] = [];
  const usedUrls = new Set<string>();
  const targetPatterns: [string, RegExp][] = [
    ["Cozinha", /cozinha/i],
    ["Sala", /\bsala\b/i],
    ["Quarto", /quarto|su[ií]te|studio/i],
    ["Banheiro", /banheiro|lavabo/i],
    ["Varanda/Vista", /varanda|vista/i],
    ["Fachada/Portaria", /fachada|hall|portaria|entrada/i],
  ];

  for (const [fallbackRoom, regex] of targetPatterns) {
    const match = allCandidates.find((p) => {
      const u = str(p["url"]);
      const sub = str(p["subtitle"]) ?? "";
      return u !== null && !usedUrls.has(u) && regex.test(sub);
    });
    const rawUrl = str(match?.["url"]);
    if (rawUrl) {
      usedUrls.add(rawUrl);
      out.push({
        room: str(match?.["subtitle"]) ?? fallbackRoom,
        url: toQuintoImgUrl(rawUrl),
      });
    }
  }

  for (const p of allCandidates) {
    const rawUrl = str(p["url"]);
    if (!rawUrl || usedUrls.has(rawUrl)) continue;
    usedUrls.add(rawUrl);
    const sub = str(p["subtitle"]);
    out.push({
      room: sub && sub !== "Foto sem legenda" ? sub : null,
      url: toQuintoImgUrl(rawUrl),
    });
  }

  return filterForeignQuintoAndarPhotos(out, listingId);
}

function unwrapNextFlightScripts(scripts: string[]): string[] {
  const joined = scripts
    .map((script) => {
      const match =
        /^self\.__next_f\.push\(\[1,("(?:\\.|[^"\\])*")\]\)/.exec(
          script.trim(),
        );
      if (!match?.[1]) return "";
      try {
        return JSON.parse(match[1]) as string;
      } catch {
        return "";
      }
    })
    .join("");
  return joined.split("\n").filter(Boolean);
}

function parseFlightRowPayload(line: string): Rec | null {
  const bracket = line.indexOf(':["$"');
  const start = bracket !== -1 ? bracket + 1 : line.indexOf(":") + 1;
  if (start <= 0) return null;
  try {
    const parsed: unknown = JSON.parse(line.slice(start));
    return Array.isArray(parsed) && parsed.length >= 4
      ? asRec(parsed[3])
      : asRec(parsed);
  } catch {
    return null;
  }
}

export function extractPhotosFromHtml(
  provider: string,
  html: string,
  url: string,
): ExtractedPhoto[] {
  // 1. QuintoAndar
  if (provider === "quintoandar" || url.includes("quintoandar.com.br")) {
    const nextDataMatch =
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
    if (nextDataMatch?.[1]) {
      try {
        const parsed = JSON.parse(nextDataMatch[1]) as Rec;
        const props = asRec(parsed["props"]);
        const pageProps = asRec(props["pageProps"]);
        const initialState = asRec(pageProps["initialState"]);
        const house = asRec(initialState["house"]);
        const houseInfo = asRec(house["houseInfo"]);
        if (houseInfo["id"]) {
          const photos = extractQuintoPhotosFromHouseInfo(houseInfo);
          if (photos.length > 0) return photos;
        }
      } catch {
        // Fallback below
      }
    }
  }

  // 2. Zap Imóveis / VivaReal
  if (
    provider === "zapimoveis" ||
    provider === "vivareal" ||
    url.includes("zapimoveis.com.br") ||
    url.includes("vivareal.com.br")
  ) {
    const scripts: string[] = [];
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = scriptRegex.exec(html)) !== null) {
      if (m[1]?.includes("__next_f.push")) {
        scripts.push(m[1]);
      }
    }

    for (const line of unwrapNextFlightScripts(scripts)) {
      if (!line.includes('"pageData":')) continue;
      const payload = parseFlightRowPayload(line);
      const pageData = asRec(asRec(payload?.["baseData"])["pageData"]);
      const listing = asRec(pageData["listing"]);
      const medias = asRec(listing["medias"]);
      const images = asArr(medias["images"]).map(asRec);
      if (images.length > 0) {
        const out: ExtractedPhoto[] = [];
        const seen = new Set<string>();
        for (const imgObj of images) {
          const rawSrc =
            str(imgObj["dangerousSrc"]) ??
            str(imgObj["src"]) ??
            str(imgObj["url"]);
          if (!rawSrc) continue;
          const resolved = rawSrc
            .replace("{description}", "foto")
            .replace("{action}", "fit-in")
            .replace("{width}", "1920")
            .replace("{height}", "1440")
            .replace(/dimension=\d+x\d+/, "dimension=1920x1440");
          if (seen.has(resolved)) continue;
          seen.add(resolved);
          out.push({ room: str(imgObj["alt"]), url: resolved });
        }
        if (out.length > 0) return out;
      }
    }
  }

  // 3. Netimóveis
  if (provider === "netimoveis" || url.includes("netimoveis.com")) {
    const out: ExtractedPhoto[] = [];
    const seen = new Set<string>();
    const imgTagRegex = /<img[^>]*class="[^"]*gallery-image[^"]*"[^>]*>/gi;
    let m: RegExpExecArray | null;
    while ((m = imgTagRegex.exec(html)) !== null) {
      const tag = m[0];
      const srcMatch = /(?:data-src|data-fb|src)="([^"]+)"/i.exec(tag);
      const captionMatch = /(?:data-caption|alt)="([^"]*)"/i.exec(tag);
      const rawUrl = srcMatch?.[1]?.trim();
      if (!rawUrl || !rawUrl.startsWith("http") || seen.has(rawUrl)) continue;
      seen.add(rawUrl);
      const cap = captionMatch?.[1]?.trim() ?? "";
      const room = cap.includes(" - ")
        ? cap.split(" - ")[0]?.trim() || null
        : cap || null;
      out.push({ room, url: rawUrl });
    }
    if (out.length > 0) return out;
  }

  // 4. Imovelweb
  if (provider === "imovelweb" || url.includes("imovelweb.com.br")) {
    const out: ExtractedPhoto[] = [];
    const seen = new Set<string>();
    const picRegex = /"url(?:1200x1200|730x532)"\s*:\s*"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = picRegex.exec(html)) !== null) {
      const raw = m[1]?.replace(/\\u002F/g, "/").replace(/\\\//g, "/");
      if (!raw) continue;
      const hiRes = raw.replace(
        /\/(?:360x266|720x532|730x532)\//,
        "/1200x1200/",
      );
      if (seen.has(hiRes)) continue;
      seen.add(hiRes);
      out.push({ room: null, url: hiRes });
    }
    if (out.length > 0) return out;
  }

  return [];
}

export async function fetchZapGlueApiPhotos(
  idOrUrl: string,
): Promise<{ photos: ExtractedPhoto[]; isDeactivated: boolean }> {
  const idMatch = /(\d{7,12})/.exec(idOrUrl);
  const zapId = idMatch?.[1];
  if (!zapId) return { photos: [], isDeactivated: false };

  const parseMediaList = (rawMedias: unknown[]): ExtractedPhoto[] => {
    const out: ExtractedPhoto[] = [];
    const seen = new Set<string>();
    for (const m of rawMedias.map(asRec)) {
      const mediaType = str(m["type"]);
      if (mediaType && mediaType.toUpperCase() !== "IMAGE") continue;
      const rawUrl = str(m["url"]) ?? str(m["src"]) ?? str(m["dangerousSrc"]);
      if (!rawUrl) continue;
      const resolved = rawUrl
        .replace("{description}", "foto")
        .replace("{action}", "fit-in")
        .replace("{width}", "1920")
        .replace("{height}", "1440")
        .replace(/\.jpg\?/, ".webp?")
        .replace(/dimension=\d+x\d+/, "dimension=1920x1440");
      if (seen.has(resolved)) continue;
      seen.add(resolved);
      out.push({ room: str(m["description"]) ?? str(m["alt"]), url: resolved });
    }
    return out;
  };

  // 1. Try /v2/listings?portal=ZAP&categoryPage=RESULT&id={id}
  try {
    const res = await fetch(
      `https://glue-api.zapimoveis.com.br/v2/listings?portal=ZAP&categoryPage=RESULT&includeFields=search(result(listings(listing(id,status),medias)))&id=${zapId}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "x-domain": "www.zapimoveis.com.br",
          Origin: "https://www.zapimoveis.com.br",
          Referer: "https://www.zapimoveis.com.br/",
        },
        signal: AbortSignal.timeout(6500),
      },
    );
    if (res.ok) {
      const data = asRec(await res.json());
      const item = asRec(
        asArr(asRec(asRec(data["search"])["result"])["listings"])[0],
      );
      const listing = asRec(item["listing"]);
      if (str(listing["id"]) === zapId) {
        const status = str(listing["status"]);
        const isDeactivated =
          status !== null && status.toUpperCase() !== "ACTIVE";
        const photos = parseMediaList(asArr(item["medias"]));
        if (photos.length > 0 || isDeactivated) {
          return { photos, isDeactivated };
        }
      }
    }
  } catch {
    // Fallback below
  }

  // 2. Try /v2/listing/{id}
  try {
    const res = await fetch(
      `https://glue-api.zapimoveis.com.br/v2/listing/${zapId}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
          "x-domain": "www.zapimoveis.com.br",
          Origin: "https://www.zapimoveis.com.br",
          Referer: "https://www.zapimoveis.com.br/",
        },
        signal: AbortSignal.timeout(6500),
      },
    );
    if (res.status === 404 || res.status === 410) {
      return { photos: [], isDeactivated: true };
    }
    if (!res.ok) return { photos: [], isDeactivated: false };

    const data = asRec(await res.json());
    const listing = asRec(data["listing"]);
    const status = str(listing["status"]);
    const isDeactivated =
      !listing["id"] || (status !== null && status.toUpperCase() !== "ACTIVE");

    const photos = parseMediaList([
      ...asArr(data["medias"]),
      ...asArr(asRec(listing["medias"])["images"]),
    ]);
    return { photos, isDeactivated };
  } catch {
    return { photos: [], isDeactivated: false };
  }
}

/**
 * Photo lists are keyed by the query string (provider, id, url), so the CDN can serve repeats.
 * Empty results expire quickly so a later scrape or live lookup can fill them in.
 */
function photoListCacheHeaders(hasPhotos: boolean): Record<string, string> {
  return {
    "Cache-Control": hasPhotos
      ? "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
      : "public, max-age=0, s-maxage=600",
  };
}

export async function GET(request: Request) {
  const t0 = performance.now();
  try {
    const { searchParams } = new URL(request.url);
    const provider = (searchParams.get("provider") ?? "").trim();
    const id = (searchParams.get("id") ?? "").trim();
    const rawUrlParam = (searchParams.get("url") ?? "").trim();

    if (!provider || !id) {
      const durationMs = Math.round((performance.now() - t0) * 100) / 100;
      logger.warn("api/photos", "GET rejected missing provider or id", {
        provider,
        id,
        durationMs,
      });
      return NextResponse.json(
        {
          ok: false,
          photos: [],
          error: "Parâmetros provider e id são obrigatórios.",
        },
        { status: 400 },
      );
    }

    if (rawUrlParam && !isValidAllowedListingUrl(rawUrlParam)) {
      const durationMs = Math.round((performance.now() - t0) * 100) / 100;
      logger.warn("api/photos", "GET rejected disallowed url param", {
        provider,
        id,
        rawUrlParam,
        durationMs,
      });
      return NextResponse.json(
        {
          ok: false,
          photos: [],
          error: "Parâmetro url inválido ou domínio não permitido.",
        },
        { status: 400 },
      );
    }

    const cacheKey = `${provider}:${id}`;
    const hadMemCacheBeforeLoad = memPhotosCache !== null;
    const cache = loadPhotosCache();

    const negExp = negativeLookupExpiry.get(cacheKey);
    if (negExp !== undefined && Date.now() >= negExp) {
      negativeLookupExpiry.delete(cacheKey);
      verifiedCompleteKeys.delete(cacheKey);
    }

    const storedProp = getPropertyFullDetails(provider, id);
    const fullDescription = cleanListingText(
      storedProp?.description ?? storedProp?.generatedDescription ?? null,
    );

    const cachedRaw = cache[cacheKey];
    const cached = Array.isArray(cachedRaw)
      ? provider === "quintoandar"
        ? filterForeignQuintoAndarPhotos(cachedRaw, id)
        : cachedRaw
      : undefined;
    if (
      (Array.isArray(cached) && cached.length > 6) ||
      verifiedCompleteKeys.has(cacheKey)
    ) {
      const photos = Array.isArray(cached) ? cached : [];
      const durationMs = Math.round((performance.now() - t0) * 100) / 100;
      logger.info("api/photos", "GET cache hit", {
        provider,
        id,
        source: hadMemCacheBeforeLoad ? "memory-cache" : "disk-cache",
        responseSource: photos.length > 0 ? "cache" : "none",
        photosCount: photos.length,
        durationMs,
      });
      return NextResponse.json(
        {
          ok: photos.length > 0,
          photos,
          description: fullDescription,
          source: photos.length > 0 ? "cache" : "none",
        },
        { headers: photoListCacheHeaders(photos.length > 0) },
      );
    }

    const url = (storedProp?.url ?? "").trim() || rawUrlParam;

    if (!url || !isValidAllowedListingUrl(url)) {
      const durationMs = Math.round((performance.now() - t0) * 100) / 100;
      logger.warn("api/photos", "GET rejected missing or invalid resolved url", {
        provider,
        id,
        url: url || null,
        durationMs,
      });
      return NextResponse.json(
        {
          ok: false,
          photos: [],
          error: "Parâmetros provider, id e url válidos são obrigatórios.",
        },
        { status: 400 },
      );
    }

    let lookupPromise = inFlightLookups.get(cacheKey);
    const joinedSingleFlight = Boolean(lookupPromise);
    if (!lookupPromise) {
      lookupPromise = (async (): Promise<PhotoEntry[]> => {
        // 0. For Zap Imóveis / VivaReal, try fast Glue API v2 endpoint first (bypasses Cloudflare HTML rate limits)
        if (
          provider === "zapimoveis" ||
          provider === "vivareal" ||
          url.includes("zapimoveis.com.br") ||
          url.includes("vivareal.com.br")
        ) {
          const glueRes = await fetchZapGlueApiPhotos(id || url);
          if (glueRes.photos.length > 0) {
            verifiedCompleteKeys.add(cacheKey);
            negativeLookupExpiry.delete(cacheKey);
            cache[cacheKey] = glueRes.photos;
            savePhotosCache(cache);
            lastLookupSource.set(cacheKey, "glue-api");
            return glueRes.photos;
          }
        }

        // 1. Try fast HTTP fetch (with VivaReal <-> Zap mirror fallback if rate-limited)
        const candidateUrls = [url];
        if (url.includes("www.zapimoveis.com.br")) {
          candidateUrls.push(
            url.replace("www.zapimoveis.com.br", "www.vivareal.com.br"),
          );
        } else if (url.includes("www.vivareal.com.br")) {
          candidateUrls.push(
            url.replace("www.vivareal.com.br", "www.zapimoveis.com.br"),
          );
        }

        for (const targetUrl of candidateUrls) {
          try {
            const html = await fetchHtml(targetUrl);
            if (html && provider === "quintoandar" && isQuintoAndarUnavailableHtml(html)) {
              recordListingDeactivation(cacheKey, "QuintoAndar: imóvel indisponível");
              logger.info("api/photos", "QuintoAndar listing unavailable; recorded as inactive", {
                provider,
                id,
              });
            }
            if (html) {
              const extracted = extractPhotosFromHtml(
                provider,
                html,
                targetUrl,
              );
              if (extracted.length > 0) {
                verifiedCompleteKeys.add(cacheKey);
                negativeLookupExpiry.delete(cacheKey);
                cache[cacheKey] = extracted;
                savePhotosCache(cache);
                lastLookupSource.set(cacheKey, "http");
                return extracted;
              }
            }
          } catch (err) {
            logger.warn("api/photos", "HTTP photo extraction candidate failed", {
              provider,
              id,
              targetUrl,
              error: err,
            });
          }
        }

        // 2. Fallback to local Playwright script when not running on Vercel
        if (
          !process.env.VERCEL &&
          existsSync(
            /*turbopackIgnore: true*/ join(
              SCRAPER_WORKSPACE_DIR,
              "scripts/extract-listing-photos.ts",
            ),
          )
        ) {
          try {
            const { stdout } = await execFileAsync(
              process.execPath,
              [
                "scripts/extract-listing-photos.ts",
                "--provider",
                provider,
                "--url",
                url,
              ],
              {
                cwd: SCRAPER_WORKSPACE_DIR,
                timeout: 22_000,
              },
            );
            const parsed = JSON.parse(stdout.trim()) as {
              ok?: boolean;
              photos?: ExtractedPhoto[];
            };
            const rawExtractedPhotos = Array.isArray(parsed.photos)
              ? parsed.photos
              : [];
            const cleanedPhotos =
              provider === "quintoandar"
                ? filterForeignQuintoAndarPhotos(rawExtractedPhotos, id)
                : rawExtractedPhotos;
            if (cleanedPhotos.length > 0) {
              verifiedCompleteKeys.add(cacheKey);
              negativeLookupExpiry.delete(cacheKey);
              cache[cacheKey] = cleanedPhotos;
              savePhotosCache(cache);
              lastLookupSource.set(cacheKey, "playwright");
              return cleanedPhotos;
            }
          } catch (err) {
            logger.warn("api/photos", "Playwright fallback failed", {
              provider,
              id,
              url,
              error: err,
            });
          }
        }

        if (Array.isArray(cached) && cached.length > 0) {
          verifiedCompleteKeys.add(cacheKey);
          negativeLookupExpiry.delete(cacheKey);
          cache[cacheKey] = cached;
          lastLookupSource.set(cacheKey, "cache");
          return cached;
        }

        verifiedCompleteKeys.add(cacheKey);
        negativeLookupExpiry.set(cacheKey, Date.now() + NEGATIVE_TTL_MS);
        cache[cacheKey] = [];
        lastLookupSource.set(cacheKey, "none");
        return [];
      })().finally(() => {
        inFlightLookups.delete(cacheKey);
      });

      inFlightLookups.set(cacheKey, lookupPromise);
    }

    const photos = await lookupPromise;
    const source =
      lastLookupSource.get(cacheKey) ?? (photos.length > 0 ? "cache" : "none");
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;

    logger.info("api/photos", "GET resolved", {
      provider,
      id,
      source: joinedSingleFlight
        ? "single-flight"
        : source === "cache"
          ? "disk-cache"
          : "live",
      upstreamSource: source,
      photosCount: photos.length,
      durationMs,
    });

    return NextResponse.json(
      {
        ok: photos.length > 0,
        photos,
        description: fullDescription,
        source,
      },
      { headers: photoListCacheHeaders(photos.length > 0) },
    );
  } catch (err) {
    const durationMs = Math.round((performance.now() - t0) * 100) / 100;
    logger.error("api/photos", "GET unhandled error", {
      durationMs,
      error: err,
    });
    return NextResponse.json({ ok: false, photos: [] }, { status: 200 });
  }
}
