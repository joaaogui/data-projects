import "server-only";

import {
  applyListingDeactivations,
  loadListingDeactivations,
} from "@/lib/listing-deactivations";
import { hashContent } from "@/lib/listing-features-store";
import { cleanListingText } from "@/lib/listing-normalization";
import { ensureSignalKeysAndLabels } from "@/lib/listing-signals";
import { loadPhotoGalleries } from "@/lib/photo-galleries";
import { processScoped } from "@/lib/process-cache";
import { loadActiveSnapshot, type PhotoGalleries } from "@/lib/snapshot-store";
import type { NeighborhoodEntry, SlimPropertyRecord } from "@/types/housing";

interface DatasetStoreState {
  fullByKey: { contentHash: string; map: Map<string, SlimPropertyRecord> } | null;
  slimmed: { sig: string; props: SlimPropertyRecord[] } | null;
  served: { sig: string; value: ServedListings } | null;
}

const state = processScoped<DatasetStoreState>("dataset-store", () => ({
  fullByKey: null,
  slimmed: null,
  served: null,
}));

export async function getPropertyFullDetails(
  provider: string,
  id: string,
): Promise<SlimPropertyRecord | null> {
  const snapshot = await loadActiveSnapshot();
  if (state.fullByKey?.contentHash !== snapshot.contentHash) {
    const rawProps = (snapshot.data.properties ?? []) as unknown as SlimPropertyRecord[];
    state.fullByKey = {
      contentHash: snapshot.contentHash,
      map: new Map(rawProps.map((p) => [`${p.provider}:${String(p.id)}`, p])),
    };
  }
  return state.fullByKey.map.get(`${provider}:${id}`) ?? null;
}

function capRelevantPlaces(
  places: SlimPropertyRecord["placesNearby"] | undefined | null,
): SlimPropertyRecord["placesNearby"] {
  if (!Array.isArray(places) || places.length <= 8) {
    return places ?? [];
  }
  const first6 = places.slice(0, 6);
  const rest = places.slice(6);
  const extras: SlimPropertyRecord["placesNearby"] = [];
  if (!first6.some((p) => p.type === "PARK_OR_GREEN_AREA")) {
    const park = rest.find((p) => p.type === "PARK_OR_GREEN_AREA");
    if (park) extras.push(park);
  }
  if (!first6.some((p) => p.type === "SHOPPING_MALL")) {
    const mall = rest.find((p) => p.type === "SHOPPING_MALL");
    if (mall) extras.push(mall);
  }
  if (
    !first6.some((p) => p.type === "ESTACAO_METRO_OU_TREM") &&
    extras.length < 2
  ) {
    const subway = rest.find((p) => p.type === "ESTACAO_METRO_OU_TREM");
    if (subway) extras.push(subway);
  }
  for (const r of rest) {
    if (first6.length + extras.length >= 8) break;
    if (!extras.includes(r)) extras.push(r);
  }
  return [...first6, ...extras].slice(0, 8);
}

export interface ServedListings {
  updatedAt: string;
  source: "neon" | "snapshot";
  neighborhoods: NeighborhoodEntry[];
  /** Listings as the engine scores them (full description, all cached photos, deactivations applied). */
  properties: SlimPropertyRecord[];
  /** Hash of everything listing features depend on (photos excluded). */
  featureHash: string;
  /** Changes whenever `properties` changes (features + photo galleries). */
  servedHash: string;
}

function mergeCachedPhotos(
  p: SlimPropertyRecord,
  galleries: PhotoGalleries,
): Pick<SlimPropertyRecord, "samplePhotos" | "photosCount"> {
  const cachedPhotos = galleries[`${p.provider}:${p.id}`];
  const basePhotos = p.samplePhotos ?? [];
  const resolvedPhotos =
    Array.isArray(cachedPhotos) &&
    cachedPhotos.length >= basePhotos.length &&
    cachedPhotos.length > 0
      ? cachedPhotos
      : basePhotos;
  return {
    samplePhotos: resolvedPhotos,
    photosCount: Math.max(
      p.photosCount ?? 0,
      Array.isArray(cachedPhotos) ? cachedPhotos.length : 0,
      basePhotos.length,
    ),
  };
}

/**
 * Listings for server-side scoring: the active snapshot with the field normalization the browser
 * used to receive (capped nearby places, cleaned description, no generated description), photo
 * galleries merged in and runtime deactivations applied.
 */
export async function loadServedListings(): Promise<ServedListings> {
  const [snapshot, photos, deactivations] = await Promise.all([
    loadActiveSnapshot(),
    loadPhotoGalleries(),
    loadListingDeactivations(),
  ]);
  const deactivationsSig = JSON.stringify(
    Object.entries(deactivations).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  const sig = `${snapshot.contentHash}|${photos.signature}|${deactivationsSig}`;
  if (state.served?.sig === sig) return state.served.value;

  const slimSig = `${snapshot.contentHash}|${photos.signature}`;
  if (state.slimmed?.sig !== slimSig) {
    const rawProps = (snapshot.data.properties ?? []) as unknown as SlimPropertyRecord[];
    state.slimmed = {
      sig: slimSig,
      props: rawProps.map((p) =>
        ensureSignalKeysAndLabels({
          ...p,
          ...mergeCachedPhotos(p, photos.galleries),
          placesNearby: capRelevantPlaces(p.placesNearby),
          description: cleanListingText(p.description),
          generatedDescription: null,
          sourceSearch: null,
          publishedAt: p.publishedAt ?? null,
          listingUpdatedAt: p.listingUpdatedAt ?? null,
          isActive: p.isActive ?? true,
          deactivatedAt: p.deactivatedAt ?? null,
        }),
      ),
    };
  }

  const properties = applyListingDeactivations(state.slimmed.props, deactivations);
  const featureHash = hashContent("served-v1", snapshot.contentHash, deactivationsSig);
  const value: ServedListings = {
    updatedAt: snapshot.data.updatedAt,
    source: snapshot.source === "neon" ? "neon" : "snapshot",
    neighborhoods: (snapshot.data.neighborhoods ?? []) as unknown as NeighborhoodEntry[],
    properties,
    featureHash,
    servedHash: hashContent(featureHash, photos.signature),
  };
  state.served = { sig, value };
  return value;
}
