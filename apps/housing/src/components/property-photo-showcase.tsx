"use client";

import { isRecentlyPublishedListing } from "@/lib/property-filters";
import type { CityHubCode, EvaluatedProperty } from "@/types/housing";

export { isRecentlyPublishedListing };
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Heart,
  Images,
  Loader2,
  Maximize2,
} from "lucide-react";
import { useEffect, useState } from "react";

export const MAX_CLIENT_PHOTOS_CACHE_ENTRIES = 35;

const clientPhotosCache = new Map<
  string,
  Array<{ room: string | null; url: string }>
>();
const clientDescriptionsCache = new Map<string, string>();

export function getClientDescriptionCached(propKey: string): string | null {
  return clientDescriptionsCache.get(propKey) ?? null;
}

function setClientDescriptionCached(propKey: string, desc: string): void {
  if (!desc) return;
  if (clientDescriptionsCache.has(propKey)) {
    clientDescriptionsCache.delete(propKey);
  }
  clientDescriptionsCache.set(propKey, desc);
  while (clientDescriptionsCache.size > MAX_CLIENT_PHOTOS_CACHE_ENTRIES) {
    const oldestKey = clientDescriptionsCache.keys().next().value;
    if (!oldestKey) break;
    clientDescriptionsCache.delete(oldestKey);
  }
}

export function getClientPhotosCached(
  propKey: string,
): Array<{ room: string | null; url: string }> | undefined {
  const existing = clientPhotosCache.get(propKey);
  if (!existing) return undefined;
  // Refresh LRU order
  clientPhotosCache.delete(propKey);
  clientPhotosCache.set(propKey, existing);
  return existing;
}

export function setClientPhotosCached(
  propKey: string,
  photos: Array<{ room: string | null; url: string }>,
): void {
  if (clientPhotosCache.has(propKey)) {
    clientPhotosCache.delete(propKey);
  }
  clientPhotosCache.set(propKey, photos);
  while (clientPhotosCache.size > MAX_CLIENT_PHOTOS_CACHE_ENTRIES) {
    const oldestKey = clientPhotosCache.keys().next().value;
    if (!oldestKey) break;
    clientPhotosCache.delete(oldestKey);
    completedPhotoFetchKeys.delete(oldestKey);
  }
}

export function getClientPhotosCacheSize(): number {
  return clientPhotosCache.size;
}

export const inFlightPhotoRequests = new Map<
  string,
  Promise<Array<{ room: string | null; url: string }>>
>();

export const completedPhotoFetchKeys = new Set<string>();

export function fetchPropertyPhotosShared(params: {
  provider: string;
  id: string;
  url: string;
}): Promise<Array<{ room: string | null; url: string }>> {
  const propKey = `${params.provider}:${params.id}`;
  const existing = inFlightPhotoRequests.get(propKey);
  if (existing) {
    return existing;
  }

  const query = new URLSearchParams({
    provider: params.provider,
    id: params.id,
    url: params.url,
  });

  const reqPromise = fetch(`/api/photos?${query.toString()}`)
    .then((r) => (r.ok ? r.json() : null))
    .then(
      (
        data: {
          ok?: boolean;
          photos?: Array<{ room: string | null; url: string }>;
          description?: string | null;
        } | null,
      ) => {
        if (typeof data?.description === "string" && data.description.trim()) {
          setClientDescriptionCached(propKey, data.description);
        }
        if (data?.ok && Array.isArray(data.photos)) {
          completedPhotoFetchKeys.add(propKey);
          if (data.photos.length > 0) {
            const prev = getClientPhotosCached(propKey);
            if (!prev || data.photos.length >= prev.length) {
              setClientPhotosCached(propKey, data.photos);
            }
          }
          return data.photos;
        }
        return [];
      },
    )
    .catch(() => [])
    .finally(() => {
      inFlightPhotoRequests.delete(propKey);
    });

  inFlightPhotoRequests.set(propKey, reqPromise);
  return reqPromise;
}

/**
 * Upgrades a property photo URL to maximum available resolution for the fullscreen gallery modal.
 * - QuintoAndar: `/img/med/` (450x300) -> `/img/xxl/` (1152x768)
 * - Zap Imóveis / VivaReal: `dimension=...` -> `dimension=1920x1440`
 * - ImovelWeb: `/720x532/` or `/360x266/` -> `/1200x1200/`
 */
/** Bare quintoandar.com.br photo URLs answer with a 301 to www; request www directly. */
export function canonicalPhotoHost(url: string): string {
  return url.startsWith("https://quintoandar.com.br/")
    ? `https://www.${url.slice("https://".length)}`
    : url;
}

export function getHighResPhotoUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  const url = canonicalPhotoHost(rawUrl);
  if (url.includes("quintoandar.com.br/img/")) {
    return url.replace(/\/img\/(?:sm|med|lg|xl)\//, "/img/xxl/");
  }
  if (
    url.includes("resizedimgs.zapimoveis.com.br") ||
    url.includes("resizedimgs.vivareal.com")
  ) {
    return url.replace(/dimension=\d+x\d+/, "dimension=1920x1440");
  }
  if (url.includes("imovelwebcdn.com/avisos/")) {
    return url.replace(/\/(?:360x266|720x532|730x532)\//, "/1200x1200/");
  }
  return url;
}

/**
 * Right-sizes a property photo URL to compact resolution for the main ~240px Bento card cover
 * (~0.5–0.66 MiB decoded bitmap instead of 1.83 MiB).
 * - QuintoAndar: `/img/med/` (450x300, ~15KB)
 * - Zap Imóveis / VivaReal: `dimension=480x360` (~11KB WebP, 0.66 MiB decoded)
 * - ImovelWeb: `/360x266/` (~9KB, 0.36 MiB decoded)
 */
export function getCardPhotoUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  const url = canonicalPhotoHost(rawUrl);
  if (url.includes("quintoandar.com.br/img/")) {
    return url.replace(/\/img\/(?:sm|med|lg|xl|xxl)\//, "/img/med/");
  }
  if (
    url.includes("resizedimgs.zapimoveis.com.br") ||
    url.includes("resizedimgs.vivareal.com")
  ) {
    return url.replace(/dimension=\d+x\d+/, "dimension=480x360");
  }
  if (url.includes("imovelwebcdn.com/avisos/")) {
    return url.replace(
      /\/(?:360x266|720x532|730x532|1200x1200)\//,
      "/360x266/",
    );
  }
  return url;
}

/**
 * Requests true small thumbnails for secondary card tiles (~110px wide) and 96x64px modal filmstrip
 * (~0.36 MiB decoded instead of 1.83 MiB — a 5x reduction in decoded bitmap RAM per thumbnail).
 * - QuintoAndar: `/img/med/` (450x300, smallest valid QuintoAndar CDN preset)
 * - Zap Imóveis / VivaReal: `dimension=360x270` (~7.5KB WebP, 0.37 MiB decoded)
 * - ImovelWeb: `/360x266/` (~9KB, 0.36 MiB decoded)
 */
export function getThumbPhotoUrl(rawUrl: string): string {
  if (!rawUrl) return rawUrl;
  const url = canonicalPhotoHost(rawUrl);
  if (url.includes("quintoandar.com.br/img/")) {
    return url.replace(/\/img\/(?:sm|med|lg|xl|xxl)\//, "/img/med/");
  }
  if (
    url.includes("resizedimgs.zapimoveis.com.br") ||
    url.includes("resizedimgs.vivareal.com")
  ) {
    return url.replace(/dimension=\d+x\d+/, "dimension=360x270");
  }
  if (url.includes("imovelwebcdn.com/avisos/")) {
    return url.replace(
      /\/(?:360x266|720x532|730x532|1200x1200)\//,
      "/360x266/",
    );
  }
  return url;
}

export function getFallbackPhotoUrl(
  failedUrl: string,
  originalUrl: string,
): string | null {
  if (failedUrl.includes("/img/xxl/")) {
    return failedUrl.replace("/img/xxl/", "/img/xl/");
  }
  if (failedUrl.includes("/img/xl/")) {
    return failedUrl.replace("/img/xl/", "/img/med/");
  }
  if (failedUrl.includes("dimension=1920x1440")) {
    return failedUrl.replace("dimension=1920x1440", "dimension=1280x960");
  }
  if (failedUrl.includes("dimension=1280x960")) {
    return failedUrl.replace("dimension=1280x960", "dimension=870x707");
  }
  if (failedUrl.includes("dimension=870x707")) {
    return failedUrl.replace("dimension=870x707", "dimension=800x600");
  }
  if (failedUrl.includes("dimension=480x360")) {
    return failedUrl.replace("dimension=480x360", "dimension=800x600");
  }
  if (failedUrl.includes("dimension=360x270")) {
    return failedUrl.replace("dimension=360x270", "dimension=800x600");
  }
  if (failedUrl.includes("/1200x1200/")) {
    return failedUrl.replace("/1200x1200/", "/720x532/");
  }
  if (failedUrl.includes("/730x532/")) {
    return failedUrl.replace("/730x532/", "/720x532/");
  }
  if (failedUrl.includes("/720x532/")) {
    return failedUrl.replace("/720x532/", "/360x266/");
  }
  const canonicalOriginal = canonicalPhotoHost(originalUrl);
  if (failedUrl !== canonicalOriginal) {
    return canonicalOriginal;
  }
  return null;
}

export function handleImgError(
  e: React.SyntheticEvent<HTMLImageElement>,
  originalUrl: string,
) {
  const img = e.currentTarget;
  img.referrerPolicy = "no-referrer";
  const attempts = Number(img.dataset.fallbackAttempts ?? "0");
  if (attempts >= 4) {
    img.dataset.fallbackExhausted = "true";
    img.style.opacity = "0";
    return;
  }
  const fallback = getFallbackPhotoUrl(img.src, originalUrl);
  if (fallback && fallback !== img.src) {
    img.dataset.fallbackAttempts = String(attempts + 1);
    img.src = fallback;
  } else {
    img.dataset.fallbackExhausted = "true";
    img.style.opacity = "0";
  }
}

export const CITY_BADGE_MODAL: Record<
  CityHubCode,
  { ufLabel: string; className: string }
> = {
  BH: {
    ufLabel: "BH",
    className:
      "border-teal-400/40 bg-teal-500/20 text-teal-200",
  },
  CP: {
    ufLabel: "CP",
    className:
      "border-indigo-400/40 bg-indigo-500/20 text-indigo-200",
  },
  RJ: {
    ufLabel: "RJ",
    className:
      "border-cyan-400/40 bg-cyan-500/20 text-cyan-200",
  },
  SP: {
    ufLabel: "SP",
    className:
      "border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-200",
  },
  BSB: {
    ufLabel: "BSB · Ref",
    className:
      "border-amber-400/45 bg-amber-500/20 text-amber-200",
  },
};


export function PropertyCardPhotoShowcase({
  property,
  onOpenGallery,
  isFavorite = false,
  onToggleFavorite,
  compact = false,
}: {
  property: EvaluatedProperty;
  onOpenGallery: (initialIndex: number) => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  compact?: boolean;
}) {
  const propKey = `${property.provider}:${property.id}`;
  const [loadedPhotos, setLoadedPhotos] = useState<
    Array<{ room: string | null; url: string }>
  >(() => {
    const cached = getClientPhotosCached(propKey);
    const initial = property.samplePhotos ?? [];
    return cached && cached.length > initial.length ? cached : initial;
  });
  const [isLoadingCardPhotos, setIsLoadingCardPhotos] =
    useState<boolean>(false);

  // Sync loadedPhotos if parent passes updated property.samplePhotos
  useEffect(() => {
    const cached = getClientPhotosCached(propKey);
    const incoming = property.samplePhotos ?? [];
    const best = cached && cached.length > incoming.length ? cached : incoming;
    if (best.length > loadedPhotos.length) {
      setLoadedPhotos(best);
    }
  }, [propKey, property.samplePhotos, loadedPhotos.length]);

  // Auto-fetch /api/photos on mount when loadedPhotos is empty and property.url is available
  useEffect(() => {
    if (loadedPhotos.length > 0 || !property.url) return;
    const cached = getClientPhotosCached(propKey);
    if (cached && cached.length > 0) {
      setLoadedPhotos(cached);
      return;
    }
    if (completedPhotoFetchKeys.has(propKey)) return;

    let cancelled = false;
    setIsLoadingCardPhotos(true);
    void fetchPropertyPhotosShared({
      provider: property.provider,
      id: property.id,
      url: property.url,
    })
      .then((fetchedPhotos) => {
        if (cancelled) return;
        if (fetchedPhotos.length > 0) {
          setLoadedPhotos(fetchedPhotos);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCardPhotos(false);
      });

    return () => {
      cancelled = true;
    };
  }, [propKey, property.provider, property.id, property.url, loadedPhotos.length]);

  const photos = loadedPhotos;
  const totalPhotos = photos.length;
  const totalAvailablePhotos = Math.max(
    totalPhotos,
    property.photosCount ?? totalPhotos,
  );
  const [activeMainIdx, setActiveMainIdx] = useState<number>(0);

  const safeMainIdx = totalPhotos > 0 ? activeMainIdx % totalPhotos : 0;
  const widthClasses = compact
    ? "w-full md:w-64 lg:w-72 2xl:w-80"
    : "w-full md:w-76 lg:w-88 xl:w-96";

  const ensureAllPhotosLoadedOnDemand = () => {
    if (
      totalAvailablePhotos > totalPhotos &&
      property.url &&
      !completedPhotoFetchKeys.has(propKey)
    ) {
      void fetchPropertyPhotosShared({
        provider: property.provider,
        id: property.id,
        url: property.url,
      }).then((fetched) => {
        if (fetched.length > loadedPhotos.length) {
          setLoadedPhotos(fetched);
        }
      });
    }
  };

  const handlePrevInline = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (totalPhotos <= 1) return;
    ensureAllPhotosLoadedOnDemand();
    setActiveMainIdx((prev) => (prev - 1 + totalPhotos) % totalPhotos);
  };

  const handleNextInline = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (totalPhotos <= 1) return;
    ensureAllPhotosLoadedOnDemand();
    setActiveMainIdx((prev) => (prev + 1) % totalPhotos);
  };

  const handlePhotoClick = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (totalPhotos === 0) return;
    onOpenGallery(index);
  };

  // Top-left rank & new entry / deactivated overlay shared across all layouts
  const rankOverlay = (
    <div className="pointer-events-none absolute left-2.5 top-2.5 z-10 flex flex-wrap items-center gap-1.5">
      <span className="rounded-md bg-slate-950/85 px-2 py-0.5 font-mono text-xs font-bold text-white shadow-sm backdrop-blur-xs">
        #{property.overallRank ?? "—"}
      </span>
      {property.isActive === false ? (
        <span className="rounded-md bg-rose-600/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-xs">
          Desativado
        </span>
      ) : (
        isRecentlyPublishedListing(property) && (
          <span className="rounded-md bg-emerald-600/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-xs">
            Novo
          </span>
        )
      )}
    </div>
  );

  const favoriteOverlay = onToggleFavorite ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggleFavorite();
      }}
      aria-label={
        isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"
      }
      title={isFavorite ? "Remover dos favoritos" : "Salvar nos favoritos"}
      className={`absolute right-2.5 top-2.5 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border shadow-md backdrop-blur-xs transition-all hover:scale-105 ${
        isFavorite
          ? "border-rose-500/60 bg-slate-950/85 text-rose-500"
          : "border-white/25 bg-slate-950/70 text-white/90 hover:bg-slate-950/90 hover:text-rose-400"
      }`}
    >
      <Heart
        className={`h-4 w-4 ${isFavorite ? "fill-rose-500 text-rose-500" : ""}`}
      />
    </button>
  ) : null;

  // Case 0: No photos available (or currently loading from /api/photos)
  if (totalPhotos === 0) {
    return (
      <div className={`relative flex h-52 shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border bg-muted text-xs text-muted-foreground sm:h-56 ${widthClasses}`}>
        {rankOverlay}
        {favoriteOverlay}
        {isLoadingCardPhotos ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
            <span className="animate-pulse font-medium">
              Carregando fotos...
            </span>
          </>
        ) : (
          <>
            <Camera className="h-6 w-6 opacity-40" />
            <span>Sem fotos disponíveis</span>
          </>
        )}
      </div>
    );
  }

  // Case 1: Single photo — large, crisp cover
  if (totalPhotos === 1) {
    const mainPhoto = photos[0]!;
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={`Abrir foto ampliada de ${property.neighborhood}`}
        onClick={(e) => handlePhotoClick(e, 0)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onOpenGallery(0);
          }
        }}
        className={`group relative h-52 shrink-0 cursor-zoom-in overflow-hidden rounded-xl border bg-muted select-none sm:h-56 ${widthClasses}`}
      >
        {rankOverlay}
        {favoriteOverlay}
        <img
          key={mainPhoto.url}
          src={getCardPhotoUrl(mainPhoto.url)}
          referrerPolicy="no-referrer"
          onError={(e) => handleImgError(e, mainPhoto.url)}
          alt={mainPhoto.room ?? property.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/75 via-black/30 to-transparent px-3 pt-6 pb-2.5">
          <span className="truncate text-[11px] font-medium text-white/95">
            {mainPhoto.room ?? "Vista do imóvel"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-950/80 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-xs transition-colors group-hover:bg-primary">
            <Maximize2 className="h-3 w-3" />
            Ampliar
          </span>
        </div>
      </div>
    );
  }

  // Case 2: Two photos — on mobile (< sm) show full-width hero with inline arrows + counter; on sm+ show split showcase (65% left main, 35% right secondary)
  if (totalPhotos === 2) {
    const mainPhoto = photos[safeMainIdx]!;
    const secondaryIdx = (safeMainIdx + 1) % 2;
    const secondaryPhoto = photos[secondaryIdx]!;

    return (
      <div className={`relative grid h-52 shrink-0 grid-cols-12 gap-1.5 overflow-hidden rounded-xl border bg-muted/40 p-0 select-none sm:h-56 sm:p-1 ${widthClasses}`}>
        {rankOverlay}
        {favoriteOverlay}

        {/* Left Main Photo (full-width on < sm, 7 cols on sm+) */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Abrir galeria na foto ${safeMainIdx + 1}`}
          onClick={(e) => handlePhotoClick(e, safeMainIdx)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onOpenGallery(safeMainIdx);
            }
          }}
          className="group relative col-span-12 sm:col-span-7 h-full cursor-zoom-in overflow-hidden rounded-xl sm:rounded-lg bg-muted"
        >
          <img
            key={mainPhoto.url}
            src={getCardPhotoUrl(mainPhoto.url)}
            referrerPolicy="no-referrer"
            onError={(e) => handleImgError(e, mainPhoto.url)}
            alt={mainPhoto.room ?? `${property.title} - Foto ${safeMainIdx + 1}`}
            loading="lazy"
          decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <button
            type="button"
            onClick={handlePrevInline}
            aria-label="Foto anterior"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/75 p-1.5 text-white opacity-90 shadow-xs transition-opacity hover:bg-slate-950 sm:left-1.5 sm:p-1 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNextInline}
            aria-label="Próxima foto"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/75 p-1.5 text-white opacity-90 shadow-xs transition-opacity hover:bg-slate-950 sm:right-1.5 sm:p-1 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <ChevronRight className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-2.5 pt-5 pb-2">
            <span className="truncate text-[11px] font-medium text-white/95">
              {mainPhoto.room ?? `Foto ${safeMainIdx + 1}`}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-950/80 px-2 py-0.5 font-mono text-[10px] font-semibold text-white/95 backdrop-blur-xs sm:hidden">
              <Images className="h-3 w-3 text-purple-300" />
              {safeMainIdx + 1}/2 · Galeria
            </span>
          </div>
        </div>

        {/* Right Secondary Photo (hidden on < sm, 5 cols on sm+) */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Abrir galeria na foto ${secondaryIdx + 1}`}
          onClick={(e) => handlePhotoClick(e, secondaryIdx)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onOpenGallery(secondaryIdx);
            }
          }}
          className="group relative hidden sm:block sm:col-span-5 h-full cursor-zoom-in overflow-hidden rounded-lg bg-muted"
        >
          <img
            key={secondaryPhoto.url}
            src={getThumbPhotoUrl(secondaryPhoto.url)}
            referrerPolicy="no-referrer"
            onError={(e) => handleImgError(e, secondaryPhoto.url)}
            alt={
              secondaryPhoto.room ??
              `${property.title} - Foto ${secondaryIdx + 1}`
            }
            loading="lazy"
          decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-end bg-gradient-to-t from-black/75 via-black/25 to-transparent p-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-slate-950/85 px-2 py-1 text-[11px] font-semibold text-white shadow-xs backdrop-blur-xs transition-colors group-hover:bg-primary">
              <Images className="h-3 w-3" />
              Ver 2 fotos
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Case 3+: On mobile (< sm), full-width hero with swipe/arrow controls & gallery pill; on sm+, Bento / Mosaic layout (1 large left + 2 stacked right)
  const mainPhoto = photos[safeMainIdx]!;
  const secondIdx = (safeMainIdx + 1) % totalPhotos;
  const thirdIdx = (safeMainIdx + 2) % totalPhotos;
  const secondPhoto = photos[secondIdx]!;
  const thirdPhoto = photos[thirdIdx]!;
  const extraPhotosCount = Math.max(0, totalAvailablePhotos - 3);

  return (
    <div className={`relative grid h-52 shrink-0 grid-cols-12 gap-1.5 overflow-hidden rounded-xl border bg-muted/40 p-0 select-none sm:h-56 sm:p-1 md:h-60 ${widthClasses}`}>
      {rankOverlay}
      {favoriteOverlay}

      {/* Left Main Hero Photo (100% width on < sm, ~66% width on sm+) */}
      <div
        role="button"
        tabIndex={0}
        aria-label={`Abrir galeria de fotos (${totalAvailablePhotos} fotos) na foto ${safeMainIdx + 1}`}
        onClick={(e) => handlePhotoClick(e, safeMainIdx)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onOpenGallery(safeMainIdx);
          }
        }}
        className="group relative col-span-12 sm:col-span-8 h-full cursor-zoom-in overflow-hidden rounded-xl sm:rounded-lg bg-muted"
      >
        <img
          key={mainPhoto.url}
          src={getCardPhotoUrl(mainPhoto.url)}
          referrerPolicy="no-referrer"
          onError={(e) => handleImgError(e, mainPhoto.url)}
          alt={mainPhoto.room ?? `${property.title} - Foto ${safeMainIdx + 1}`}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Inline Prev / Next Arrows (Visible on mobile touch screens, hover on sm+) */}
        <button
          type="button"
          onClick={handlePrevInline}
          title="Foto anterior"
          aria-label="Foto anterior"
          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/75 p-1.5 text-white opacity-90 shadow-xs transition-opacity hover:bg-slate-950 sm:left-1.5 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <ChevronLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleNextInline}
          title="Próxima foto"
          aria-label="Próxima foto"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/75 p-1.5 text-white opacity-90 shadow-xs transition-opacity hover:bg-slate-950 sm:right-1.5 sm:opacity-0 sm:group-hover:opacity-100"
        >
          <ChevronRight className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>

        {/* Bottom Caption & Index Indicator */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-1.5 bg-gradient-to-t from-black/85 via-black/35 to-transparent px-2.5 pt-6 pb-2">
          <span className="truncate text-[11px] font-medium text-white/95">
            {mainPhoto.room ?? `Foto ${safeMainIdx + 1}`}
          </span>
          {/* Mobile (< sm): combined counter + gallery trigger badge */}
          <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-950/85 px-2 py-0.5 font-mono text-[10px] font-semibold text-white shadow-2xs backdrop-blur-xs sm:hidden">
            <Images className="h-3 w-3 text-purple-300" />
            {safeMainIdx + 1}/{totalPhotos} · Ver Galeria ({totalAvailablePhotos})
          </span>
          {/* Desktop/Tablet (sm+): compact index counter */}
          <span className="hidden sm:inline-block shrink-0 rounded bg-slate-950/75 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white/90">
            {safeMainIdx + 1}/{totalPhotos}
          </span>
        </div>
      </div>

      {/* Right Stacked Secondary Photos (~34% width, hidden on < sm so thumbnails never crowd on mobile) */}
      <div className="hidden sm:grid sm:col-span-4 h-full grid-rows-2 gap-1.5">
        {/* Top-Right Photo */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Abrir galeria na foto ${secondIdx + 1}`}
          onClick={(e) => handlePhotoClick(e, secondIdx)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onOpenGallery(secondIdx);
            }
          }}
          className="group relative h-full w-full cursor-zoom-in overflow-hidden rounded-lg bg-muted"
        >
          <img
            key={secondPhoto.url}
            src={getThumbPhotoUrl(secondPhoto.url)}
            referrerPolicy="no-referrer"
            onError={(e) => handleImgError(e, secondPhoto.url)}
            alt={
              secondPhoto.room ?? `${property.title} - Foto ${secondIdx + 1}`
            }
            loading="lazy"
          decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {secondPhoto.room && (
            <span className="pointer-events-none absolute bottom-1.5 left-1.5 max-w-[90%] truncate rounded bg-slate-950/75 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
              {secondPhoto.room}
            </span>
          )}
        </div>

        {/* Bottom-Right Photo + Gallery Trigger Overlay */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Abrir galeria completa (${totalAvailablePhotos} fotos)`}
          onClick={(e) => handlePhotoClick(e, thirdIdx)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              onOpenGallery(thirdIdx);
            }
          }}
          className="group relative h-full w-full cursor-zoom-in overflow-hidden rounded-lg bg-muted"
        >
          <img
            key={thirdPhoto.url}
            src={getThumbPhotoUrl(thirdPhoto.url)}
            referrerPolicy="no-referrer"
            onError={(e) => handleImgError(e, thirdPhoto.url)}
            alt={thirdPhoto.room ?? `${property.title} - Foto ${thirdIdx + 1}`}
            loading="lazy"
          decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div
            className={`pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 p-1.5 text-center transition-colors ${
              extraPhotosCount > 0
                ? "bg-slate-950/55 group-hover:bg-slate-950/40"
                : "bg-gradient-to-t from-black/80 via-black/25 to-transparent justify-end"
            }`}
          >
            {extraPhotosCount > 0 ? (
              <>
                <span className="font-mono text-sm font-bold text-white drop-shadow-xs">
                  +{extraPhotosCount} {extraPhotosCount === 1 ? "foto" : "fotos"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-xs">
                  <Images className="h-3 w-3" />
                  Galeria ({totalAvailablePhotos})
                </span>
              </>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-950/85 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-xs group-hover:bg-primary">
                <Images className="h-3 w-3" />
                Galeria ({totalAvailablePhotos})
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
