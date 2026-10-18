import "server-only";

import { createRuntimeKv } from "@/lib/runtime-kv";
import { loadActiveSnapshot, type PhotoGalleries } from "@/lib/snapshot-store";

export type GalleryPhoto = PhotoGalleries[string][number];

/** Galleries resolved on demand by /api/photos after the snapshot was published. */
export const runtimePhotoGalleries = createRuntimeKv<GalleryPhoto[]>("photo-gallery", 60_000);

let merged: { galleries: PhotoGalleries; signature: string } | null = null;

/** Snapshot galleries overlaid with on-demand resolutions; `signature` changes when either does. */
export async function loadPhotoGalleries(): Promise<{ galleries: PhotoGalleries; signature: string }> {
  const [snapshot, runtime] = await Promise.all([loadActiveSnapshot(), runtimePhotoGalleries.all()]);
  const signature = `${snapshot.galleriesHash}|${runtimePhotoGalleries.signature()}`;
  if (merged?.signature === signature) return merged;
  merged = {
    galleries:
      runtime.size > 0
        ? {
            ...snapshot.galleries,
            // jsonb reorders object keys; keep the {room, url} shape the snapshot uses.
            ...Object.fromEntries(
              [...runtime].map(([key, photos]) => [key, photos.map((p) => ({ room: p.room ?? null, url: p.url }))]),
            ),
          }
        : snapshot.galleries,
    signature,
  };
  return merged;
}
