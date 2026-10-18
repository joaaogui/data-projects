import { createRuntimeKv } from "@/lib/runtime-kv";
import type { SlimPropertyRecord } from "@/types/housing";

/**
 * Listings found offline after the last scrape (e.g. QuintoAndar "Esse imóvel está indisponível").
 * Applied on top of the snapshot/Neon rows so the next scrape sync cannot resurrect them.
 */
export type ListingDeactivations = Record<
  string,
  { deactivatedAt: string; reason: string }
>;

const store = createRuntimeKv<ListingDeactivations[string]>("listing-deactivation", 60_000);

const QUINTOANDAR_UNAVAILABLE_REGEX =
  /esse\s+im[oó]vel\s+est[aá]\s+indispon[ií]vel/i;

export function isQuintoAndarUnavailableHtml(html: string): boolean {
  return QUINTOANDAR_UNAVAILABLE_REGEX.test(html);
}

export async function loadListingDeactivations(): Promise<ListingDeactivations> {
  return Object.fromEntries(await store.all());
}

export async function recordListingDeactivation(key: string, reason: string): Promise<void> {
  const current = await store.all();
  if (current.has(key)) return;
  await store.set(key, { deactivatedAt: new Date().toISOString(), reason });
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
