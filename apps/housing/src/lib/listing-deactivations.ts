import type { SlimPropertyRecord } from "@/types/housing";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Listings found offline after the last scrape (e.g. QuintoAndar "Esse imóvel está indisponível").
 * Applied on top of the snapshot/Neon rows so the next scrape sync cannot resurrect them.
 */
export type ListingDeactivations = Record<
  string,
  { deactivatedAt: string; reason: string }
>;

const LOCAL_FILE = join(process.cwd(), "src/data/listing-deactivations.json");
const TMP_FILE = join(tmpdir(), "housing-listing-deactivations.json");

const QUINTOANDAR_UNAVAILABLE_REGEX =
  /esse\s+im[oó]vel\s+est[aá]\s+indispon[ií]vel/i;

export function isQuintoAndarUnavailableHtml(html: string): boolean {
  return QUINTOANDAR_UNAVAILABLE_REGEX.test(html);
}

function readFile(filePath: string): ListingDeactivations {
  if (!existsSync(/*turbopackIgnore: true*/ filePath)) return {};
  try {
    const raw = JSON.parse(
      readFileSync(/*turbopackIgnore: true*/ filePath, "utf8"),
    ) as unknown;
    return raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as ListingDeactivations)
      : {};
  } catch {
    return {};
  }
}

export function loadListingDeactivations(): ListingDeactivations {
  return { ...readFile(LOCAL_FILE), ...readFile(TMP_FILE) };
}

export function recordListingDeactivation(key: string, reason: string): void {
  const current = loadListingDeactivations();
  if (current[key]) return;
  current[key] = { deactivatedAt: new Date().toISOString(), reason };
  const serialized = `${JSON.stringify(current, null, 2)}\n`;
  try {
    mkdirSync(dirname(LOCAL_FILE), { recursive: true });
    writeFileSync(LOCAL_FILE, serialized, "utf8");
  } catch {
    // Read-only filesystem on serverless; /tmp below still records it for this instance.
  }
  try {
    writeFileSync(TMP_FILE, serialized, "utf8");
  } catch {
    // Ignore /tmp write errors
  }
}

/** A listing republished after it was recorded offline is treated as active again. */
export function applyListingDeactivations<
  T extends Pick<
    SlimPropertyRecord,
    "provider" | "id" | "isActive" | "deactivatedAt" | "listingUpdatedAt"
  >,
>(props: T[], deactivations: ListingDeactivations): T[] {
  if (Object.keys(deactivations).length === 0) return props;
  return props.map((p) => {
    const hit = deactivations[`${p.provider}:${p.id}`];
    if (!hit || p.isActive === false) return p;
    if (
      p.listingUpdatedAt &&
      Date.parse(p.listingUpdatedAt) > Date.parse(hit.deactivatedAt)
    ) {
      return p;
    }
    return {
      ...p,
      isActive: false,
      deactivatedAt: p.deactivatedAt ?? hit.deactivatedAt,
    };
  });
}
