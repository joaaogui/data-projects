"use client";

import type { CityHubCode, EvaluatedProperty } from "@/types/moradia";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Images,
  Loader2,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const clientPhotosCache = new Map<
  string,
  Array<{ room: string | null; url: string }>
>();

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
        } | null,
      ) => {
        if (data?.ok && Array.isArray(data.photos)) {
          completedPhotoFetchKeys.add(propKey);
          if (data.photos.length > 0) {
            const prev = clientPhotosCache.get(propKey);
            if (!prev || data.photos.length >= prev.length) {
              clientPhotosCache.set(propKey, data.photos);
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
 * - Zap Imóveis / VivaReal: `dimension=800x600` -> `dimension=1920x1440`
 * - ImovelWeb: `/720x532/` or `/360x266/` -> `/1200x1200/`
 */
export function getHighResPhotoUrl(url: string): string {
  if (!url) return url;
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
 * Upgrades a property photo URL to crisp high resolution for the inline Bento card showcase.
 */
export function getCardPhotoUrl(url: string): string {
  if (!url) return url;
  if (url.includes("quintoandar.com.br/img/")) {
    return url.replace(/\/img\/(?:sm|med|lg|xl)\//, "/img/xxl/");
  }
  if (
    url.includes("resizedimgs.zapimoveis.com.br") ||
    url.includes("resizedimgs.vivareal.com")
  ) {
    return url.replace(/dimension=\d+x\d+/, "dimension=1280x960");
  }
  if (url.includes("imovelwebcdn.com/avisos/")) {
    return url.replace(/\/(?:360x266|720x532|730x532)\//, "/1200x1200/");
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
  if (failedUrl.includes("/1200x1200/")) {
    return failedUrl.replace("/1200x1200/", "/720x532/");
  }
  if (failedUrl.includes("/720x532/")) {
    return failedUrl.replace("/720x532/", "/360x266/");
  }
  if (failedUrl !== originalUrl) {
    return originalUrl;
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

const CITY_BADGE_MODAL: Record<
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
    const cached = clientPhotosCache.get(propKey);
    const initial = property.samplePhotos ?? [];
    return cached && cached.length > initial.length ? cached : initial;
  });
  const [isLoadingCardPhotos, setIsLoadingCardPhotos] =
    useState<boolean>(false);

  // Sync loadedPhotos if parent passes updated property.samplePhotos
  useEffect(() => {
    const cached = clientPhotosCache.get(propKey);
    const incoming = property.samplePhotos ?? [];
    const best = cached && cached.length > incoming.length ? cached : incoming;
    if (best.length > loadedPhotos.length) {
      setLoadedPhotos(best);
    }
  }, [propKey, property.samplePhotos, loadedPhotos.length]);

  // Auto-fetch /api/photos on mount when loadedPhotos is empty and property.url is available
  useEffect(() => {
    if (loadedPhotos.length > 0 || !property.url) return;
    const cached = clientPhotosCache.get(propKey);
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

  const handlePrevInline = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (totalPhotos <= 1) return;
    setActiveMainIdx((prev) => (prev - 1 + totalPhotos) % totalPhotos);
  };

  const handleNextInline = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (totalPhotos <= 1) return;
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
        property.isNewEntry && (
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
            src={getCardPhotoUrl(secondaryPhoto.url)}
            referrerPolicy="no-referrer"
            onError={(e) => handleImgError(e, secondaryPhoto.url)}
            alt={
              secondaryPhoto.room ??
              `${property.title} - Foto ${secondaryIdx + 1}`
            }
            loading="lazy"
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
            src={getCardPhotoUrl(secondPhoto.url)}
            referrerPolicy="no-referrer"
            onError={(e) => handleImgError(e, secondPhoto.url)}
            alt={
              secondPhoto.room ?? `${property.title} - Foto ${secondIdx + 1}`
            }
            loading="lazy"
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
            src={getCardPhotoUrl(thirdPhoto.url)}
            referrerPolicy="no-referrer"
            onError={(e) => handleImgError(e, thirdPhoto.url)}
            alt={thirdPhoto.room ?? `${property.title} - Foto ${thirdIdx + 1}`}
            loading="lazy"
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

export function PropertyPhotoGalleryModal({
  property,
  initialIndex = 0,
  onClose,
  isFavorite = false,
  onToggleFavorite,
  onPhotosLoaded,
}: {
  property: EvaluatedProperty;
  initialIndex?: number;
  onClose: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPhotosLoaded?: (photos: Array<{ room: string | null; url: string }>) => void;
}) {
  const propKey = `${property.provider}:${property.id}`;
  const [galleryPhotos, setGalleryPhotos] = useState<
    Array<{ room: string | null; url: string }>
  >(() => {
    const cached = clientPhotosCache.get(propKey);
    const initial = property.samplePhotos ?? [];
    return cached && cached.length > initial.length ? cached : initial;
  });
  const [isLoadingAllPhotos, setIsLoadingAllPhotos] = useState<boolean>(false);

  const photos = galleryPhotos;
  const totalPhotos = photos.length;
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    totalPhotos > 0
      ? Math.max(0, Math.min(initialIndex, totalPhotos - 1))
      : 0,
  );
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  useEffect(() => {
    const expectedCount = property.photosCount ?? 0;
    const cached = clientPhotosCache.get(propKey);
    if (cached && cached.length > galleryPhotos.length) {
      setGalleryPhotos(cached);
      onPhotosLoaded?.(cached);
      return;
    }
    const shouldFetchMore =
      Boolean(property.url) &&
      !completedPhotoFetchKeys.has(propKey) &&
      (expectedCount > galleryPhotos.length || galleryPhotos.length <= 6);
    if (!shouldFetchMore) return;

    let cancelled = false;
    setIsLoadingAllPhotos(true);
    void fetchPropertyPhotosShared({
      provider: property.provider,
      id: property.id,
      url: property.url,
    })
      .then((fetchedPhotos) => {
        if (cancelled) return;
        if (fetchedPhotos.length > galleryPhotos.length) {
          setGalleryPhotos(fetchedPhotos);
          onPhotosLoaded?.(fetchedPhotos);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAllPhotos(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    propKey,
    property.provider,
    property.id,
    property.url,
    property.photosCount,
    galleryPhotos.length,
    onPhotosLoaded,
  ]);

  const goPrev = useCallback(() => {
    if (totalPhotos <= 1) return;
    setActiveIndex((prev) => (prev - 1 + totalPhotos) % totalPhotos);
  }, [totalPhotos]);

  const goNext = useCallback(() => {
    if (totalPhotos <= 1) return;
    setActiveIndex((prev) => (prev + 1) % totalPhotos);
  }, [totalPhotos]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (isZoomed) {
          setIsZoomed(false);
        } else {
          onClose();
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, goNext, goPrev, isZoomed]);

  if (totalPhotos === 0) return null;

  const safeIndex = Math.max(0, Math.min(activeIndex, totalPhotos - 1));
  const currentPhoto = photos[safeIndex]!;
  const cityBadge = CITY_BADGE_MODAL[property.cityCode];
  const providerLabel =
    property.provider === "quintoandar"
      ? "QuintoAndar"
      : property.provider === "vivareal"
      ? "VivaReal"
      : property.provider === "netimoveis"
      ? "Netimóveis"
      : property.provider === "imovelweb"
      ? "ImovelWeb"
      : "Zap Imóveis";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Galeria de fotos — ${property.neighborhood}, ${property.street}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950/95 p-1.5 text-white backdrop-blur-md sm:p-3"
    >
      {/* Top Header Bar */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex w-full max-w-[96vw] flex-wrap items-center justify-between gap-1.5 rounded-xl border border-white/10 bg-slate-900/85 px-2.5 py-1.5 shadow-lg backdrop-blur-md sm:gap-2 sm:px-3"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <span className="shrink-0 rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-[11px] font-bold text-white sm:px-2 sm:text-xs">
            #{property.overallRank ?? "—"}
          </span>
          <span
            className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[11px] font-bold sm:px-2 sm:text-xs ${cityBadge.className}`}
          >
            {cityBadge.ufLabel}
          </span>
          {property.isActive === false && (
            <span className="shrink-0 rounded-md border border-rose-500/50 bg-rose-500/20 px-2 py-0.5 text-[11px] font-bold text-rose-200">
              Desativado
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xs font-bold sm:text-base">
              {property.neighborhood} — {property.street}
              {property.streetNumber ? `, ${property.streetNumber}` : ""}
            </h3>
            <p className="truncate text-[11px] text-slate-300 sm:text-xs">
              {property.condominiumName
                ? `${property.condominiumName} · `
                : ""}
              {property.areaM2} m² · {property.bedrooms} quarto(s) ·{" "}
              {property.parkingSpaces} vaga(s)
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-xs lg:flex">
            <span className="font-bold text-purple-300">
              {property.finalScore.toFixed(1)} pts
            </span>
            <span className="text-white/30">|</span>
            <span className="font-bold text-emerald-300">
              Pacote R$ {property.totalMonthly.toLocaleString("pt-BR")}/mês
            </span>
          </div>

          {onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              aria-label={
                isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"
              }
              title={
                isFavorite ? "Remover dos favoritos" : "Salvar nos favoritos"
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition-colors sm:px-2.5 ${
                isFavorite
                  ? "border-rose-500/50 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30"
                  : "border-white/20 bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Heart
                className={`h-3.5 w-3.5 ${
                  isFavorite ? "fill-rose-500 text-rose-500" : ""
                }`}
              />
              <span className="hidden sm:inline">
                {isFavorite ? "Favoritado" : "Favoritar"}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsZoomed((z) => !z)}
            aria-label={isZoomed ? "Reduzir zoom" : "Tela cheia máxima"}
            title={isZoomed ? "Reduzir zoom" : "Expandir foto para tela cheia"}
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/20 sm:px-2.5"
          >
            {isZoomed ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Ajustar</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Tela cheia</span>
              </>
            )}
          </button>

          <a
            href={property.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-white/20 sm:gap-1.5 sm:px-2.5"
          >
            <span className="hidden sm:inline">Abrir no </span>
            <span>{providerLabel}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar galeria (Esc)"
            title="Fechar galeria (Esc)"
            className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/10 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-rose-500/80 sm:px-2.5"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">Fechar</span>
          </button>
        </div>
      </div>

      {/* Center Stage — fills maximum screen real estate */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-auto my-1 flex min-h-0 w-full max-w-[96vw] flex-1 flex-col items-center justify-center overflow-hidden"
      >
        {totalPhotos > 1 && (
          <button
            type="button"
            onClick={goPrev}
            aria-label="Foto anterior (Seta esquerda)"
            title="Foto anterior (←)"
            className="absolute left-2 z-20 rounded-full border border-white/25 bg-slate-900/85 p-2.5 text-white shadow-xl transition-all hover:scale-105 hover:bg-slate-800 sm:left-3 sm:p-3.5"
          >
            <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        )}

        <div className="relative flex h-full w-full min-h-0 items-center justify-center p-1">
          <img
            key={currentPhoto.url}
            src={getHighResPhotoUrl(currentPhoto.url)}
            referrerPolicy="no-referrer"
            onError={(e) => handleImgError(e, currentPhoto.url)}
            onClick={() => setIsZoomed((z) => !z)}
            alt={
              currentPhoto.room ??
              `${property.neighborhood} - Foto ${safeIndex + 1}`
            }
            className={
              isZoomed
                ? "max-h-full w-full max-w-[96vw] cursor-zoom-out rounded-lg object-contain shadow-2xl select-none transition-all duration-200"
                : "max-h-full w-full max-w-[94vw] cursor-zoom-in rounded-xl object-contain shadow-2xl select-none transition-all duration-200"
            }
          />
        </div>

        {totalPhotos > 1 && (
          <button
            type="button"
            onClick={goNext}
            aria-label="Próxima foto (Seta direita)"
            title="Próxima foto (→)"
            className="absolute right-2 z-20 rounded-full border border-white/25 bg-slate-900/85 p-2.5 text-white shadow-xl transition-all hover:scale-105 hover:bg-slate-800 sm:right-3 sm:p-3.5"
          >
            <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        )}

        {/* Active Photo Counter + Room Label (Floating Pill) */}
        <div className="pointer-events-none absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 flex-col items-center gap-1 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/85 px-3.5 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm">
            <span className="font-mono text-purple-300">
              Foto {safeIndex + 1} de {totalPhotos}
            </span>
            {currentPhoto.room && (
              <>
                <span className="text-white/30">·</span>
                <span>{currentPhoto.room}</span>
              </>
            )}
            {isLoadingAllPhotos && (
              <>
                <span className="text-white/30">·</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-purple-200">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Carregando todas as{" "}
                  {Math.max(totalPhotos, property.photosCount ?? totalPhotos)}{" "}
                  fotos...
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Interactive Thumbnail Filmstrip */}
      {!isZoomed && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-auto w-full max-w-[96vw] rounded-xl border border-white/10 bg-slate-900/85 px-2.5 py-1.5 backdrop-blur-md"
        >
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {photos.map((photo, idx) => {
              const isSelected = idx === safeIndex;
              return (
                <button
                  key={`${photo.url}-${idx}`}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`group relative h-14 w-22 shrink-0 overflow-hidden rounded-lg border transition-all sm:h-16 sm:w-26 ${
                    isSelected
                      ? "border-purple-400 ring-2 ring-purple-400 opacity-100 scale-[1.02]"
                      : "border-white/15 opacity-55 hover:opacity-90"
                  }`}
                >
                  <img
                    src={getCardPhotoUrl(photo.url)}
                    referrerPolicy="no-referrer"
                    onError={(e) => handleImgError(e, photo.url)}
                    alt={photo.room ?? `Miniatura ${idx + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-medium text-white">
                    {photo.room ?? `#${idx + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
