"use client";

import type { EvaluatedProperty } from "@/types/housing";

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Loader2,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CITY_BADGE_MODAL,
  completedPhotoFetchKeys,
  fetchPropertyPhotosShared,
  getClientPhotosCached,
  getHighResPhotoUrl,
  getThumbPhotoUrl,
  handleImgError,
} from "@/components/property-photo-showcase";

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
  onPhotosLoaded?: (
    photos: Array<{ room: string | null; url: string }>,
  ) => void;
}) {
  const propKey = `${property.provider}:${property.id}`;
  const [galleryPhotos, setGalleryPhotos] = useState<
    Array<{ room: string | null; url: string }>
  >(() => {
    const cached = getClientPhotosCached(propKey);
    const initial = property.samplePhotos ?? [];
    return cached && cached.length > initial.length ? cached : initial;
  });
  const [isLoadingAllPhotos, setIsLoadingAllPhotos] = useState<boolean>(false);

  const photos = galleryPhotos;
  const totalPhotos = photos.length;
  const [activeIndex, setActiveIndex] = useState<number>(() =>
    totalPhotos > 0 ? Math.max(0, Math.min(initialIndex, totalPhotos - 1)) : 0,
  );
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const expectedCount = property.photosCount ?? 0;
    const cached = getClientPhotosCached(propKey);
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
    if (typeof document !== "undefined") {
      previouslyFocusedRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    }
    modalRef.current?.focus();

    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, []);

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
      } else if (e.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusable.length === 0) {
          e.preventDefault();
          modalRef.current.focus();
          return;
        }
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (!active || active === first || active === modalRef.current) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (!active || active === last) {
            e.preventDefault();
            first.focus();
          }
        }
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
      ref={modalRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Galeria de fotos — ${property.neighborhood}, ${property.street}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950/95 p-1.5 text-white backdrop-blur-md outline-hidden sm:p-3"
    >
      {/* Top Header Bar */}
      <div className="mx-auto flex w-full max-w-[96vw] flex-wrap items-center justify-between gap-1.5 rounded-xl border border-white/10 bg-slate-900/85 px-2.5 py-1.5 shadow-lg backdrop-blur-md sm:gap-2 sm:px-3">
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
              {property.condominiumName ? `${property.condominiumName} · ` : ""}
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
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        role="presentation"
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
            decoding="async"
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
                  {Math.max(
                    totalPhotos,
                    property.photosCount ?? totalPhotos,
                  )}{" "}
                  fotos...
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Interactive Thumbnail Filmstrip (Sliding Window of at most 15 thumbnails) */}
      {!isZoomed &&
        (() => {
          const MAX_FILMSTRIP_THUMBS = 15;
          const halfWindow = Math.floor(MAX_FILMSTRIP_THUMBS / 2);
          let windowStart = Math.max(0, safeIndex - halfWindow);
          const windowEnd = Math.min(
            totalPhotos,
            windowStart + MAX_FILMSTRIP_THUMBS,
          );
          if (windowEnd - windowStart < MAX_FILMSTRIP_THUMBS) {
            windowStart = Math.max(0, windowEnd - MAX_FILMSTRIP_THUMBS);
          }
          const visibleThumbSlices = photos
            .slice(windowStart, windowEnd)
            .map((photo, offset) => ({ photo, idx: windowStart + offset }));

          return (
            <div className="mx-auto w-full max-w-[96vw] rounded-xl border border-white/10 bg-slate-900/85 px-2.5 py-1.5 backdrop-blur-md">
              <div className="flex items-center justify-center gap-2 overflow-x-auto pb-0.5">
                {windowStart > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveIndex(0)}
                    title="Ir para a primeira foto (#1)"
                    className="h-14 shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 font-mono text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/15 hover:text-white sm:h-16"
                  >
                    « #1
                  </button>
                )}
                {visibleThumbSlices.map(({ photo, idx }) => {
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
                        src={getThumbPhotoUrl(photo.url)}
                        referrerPolicy="no-referrer"
                        onError={(e) => handleImgError(e, photo.url)}
                        alt={photo.room ?? `Miniatura ${idx + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 max-w-[90%] truncate rounded bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-medium text-white">
                        {photo.room ?? `#${idx + 1}`}
                      </span>
                    </button>
                  );
                })}
                {windowEnd < totalPhotos && (
                  <button
                    type="button"
                    onClick={() => setActiveIndex(totalPhotos - 1)}
                    title={`Ir para a última foto (#${totalPhotos})`}
                    className="h-14 shrink-0 rounded-lg border border-white/15 bg-white/5 px-2.5 font-mono text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/15 hover:text-white sm:h-16"
                  >
                    #{totalPhotos} »
                  </button>
                )}
              </div>
            </div>
          );
        })()}
    </div>
  );
}
