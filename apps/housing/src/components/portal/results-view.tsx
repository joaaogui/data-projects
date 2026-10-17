"use client";

import dynamic from "next/dynamic";
import { PropertyCard } from "@/components/portal/property-card";
import type { PropertyQuestionItem } from "@/types/housing";

import { RotateCcw } from "lucide-react";

import type { PortalController } from "@/components/portal/use-portal-controller";

const PropertyMapView = dynamic(
  () => import("@/components/property-map-view").then((m) => m.PropertyMapView),
  {
    ssr: false,
    loading: () => (
      <div className="h-full w-full rounded-xl border bg-muted/40" />
    ),
  },
);

const EMPTY_QA_LIST: PropertyQuestionItem[] = [];

export function ResultsView({ ctl }: { ctl: PortalController }) {
  const {
    cardsListRef,
    displayedProperties,
    expandedId,
    extraDescriptionsByKey,
    extraPhotosByKey,
    favoriteKeys,
    filteredTotal,
    focusCardInList,
    focusedPropertyKey,
    hoveredPropertyKey,
    isQueryLoading,
    listMatchesQuery,
    mapProperties,
    mountedWindow,
    openChatForProperty,
    pinnedChatPropertyKey,
    qaItemsByPropertyKey,
    resetAllFilters,
    selectedCities,
    selectedMapPropertyKey,
    setExpandedId,
    setGalleryState,
    setHoveredPropertyKey,
    setSelectedMapPropertyKey,
    setViewMode,
    setVisibleCount,
    showChatDrawer,
    toggleFavorite,
    viewMode,
    visibleCount,
  } = ctl;
  return (
    <>
      {/* Properties Content: Split-Screen (Lista + Mapa), Só Lista, or Só Mapa */}
      {viewMode === "map" ? (
        <div className="space-y-3">
          <div className="h-[calc(100vh-8rem)] min-h-[600px] w-full">
            <PropertyMapView
              properties={mapProperties}
              totalFilteredCount={filteredTotal}
              onLoadMore={() => setVisibleCount((c) => c + 30)}
              selectedCity={
                selectedCities.length === 1 ? selectedCities[0]! : "ALL"
              }
              favoriteKeys={favoriteKeys}
              hoveredPropertyKey={hoveredPropertyKey}
              selectedPropertyKey={selectedMapPropertyKey}
              onHoverProperty={setHoveredPropertyKey}
              onSelectProperty={setSelectedMapPropertyKey}
              onFocusCardInList={focusCardInList}
              onToggleFavorite={toggleFavorite}
              onOpenGallery={(property, initialIndex) =>
                setGalleryState({ property, initialIndex })
              }
            />
          </div>
          {visibleCount < filteredTotal && (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + 30)}
                className="rounded-lg border bg-card px-5 py-2.5 text-xs font-semibold hover:bg-secondary"
              >
                Carregar mais imóveis no mapa ({visibleCount} de {filteredTotal}
                )
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          className={
            viewMode === "split"
              ? "grid grid-cols-1 gap-4 xl:grid-cols-12 items-start"
              : "space-y-3"
          }
        >
          {/* Properties List */}
          <div
            ref={cardsListRef}
            aria-busy={isQueryLoading || !listMatchesQuery}
            className={`${
              viewMode === "split"
                ? "xl:col-span-7 space-y-3 order-2 xl:order-1"
                : "space-y-3"
            } transition-opacity ${!listMatchesQuery ? "opacity-70" : ""}`}
          >
            {filteredTotal === 0 && !focusedPropertyKey && (
              <div className="rounded-xl border border-dashed bg-card p-8 text-center space-y-2.5">
                <p className="text-sm font-semibold text-foreground">
                  Nenhum imóvel encontrado com a combinação atual de filtros.
                </p>
                <p className="text-xs text-muted-foreground">
                  Experimente relaxar o filtro de andar/cobertura, valor ou
                  comodidades cumulativas.
                </p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="inline-flex items-center gap-1.5 rounded-lg border bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Limpar todos os filtros
                </button>
              </div>
            )}
            {displayedProperties.map((prop, cardIdx) => {
              const key = `${prop.provider}:${prop.id}`;
              const isExpanded = expandedId === key;
              const isMapHighlighted =
                hoveredPropertyKey === key || selectedMapPropertyKey === key;
              const isNearViewport =
                (cardIdx >= mountedWindow.start &&
                  cardIdx < mountedWindow.end) ||
                isExpanded ||
                isMapHighlighted ||
                key === focusedPropertyKey;
              return (
                <PropertyCard
                  key={key}
                  prop={prop}
                  cardIdx={cardIdx}
                  isExpanded={isExpanded}
                  isMapHighlighted={isMapHighlighted}
                  isNearViewport={isNearViewport}
                  isSelectedOnMap={selectedMapPropertyKey === key}
                  isPinnedInChat={
                    showChatDrawer && pinnedChatPropertyKey === key
                  }
                  isFav={favoriteKeys.includes(key)}
                  viewMode={viewMode}
                  extraPhotos={extraPhotosByKey[key]}
                  extraDescription={extraDescriptionsByKey[key]}
                  qaList={qaItemsByPropertyKey.get(key) ?? EMPTY_QA_LIST}
                  setExpandedId={setExpandedId}
                  setHoveredPropertyKey={setHoveredPropertyKey}
                  setSelectedMapPropertyKey={setSelectedMapPropertyKey}
                  setViewMode={setViewMode}
                  setGalleryState={setGalleryState}
                  toggleFavorite={toggleFavorite}
                  openChatForProperty={openChatForProperty}
                />
              );
            })}

            {visibleCount < filteredTotal && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + 30)}
                  className="rounded-lg border bg-card px-5 py-2.5 text-xs font-semibold hover:bg-secondary"
                >
                  Carregar mais imóveis ({visibleCount} de {filteredTotal})
                </button>
              </div>
            )}
          </div>

          {viewMode === "split" && (
            <div className="xl:col-span-5 xl:sticky xl:top-3 h-[360px] sm:h-[420px] xl:h-[calc(100vh-1.5rem)] order-1 xl:order-2">
              <PropertyMapView
                properties={mapProperties}
                selectedCity={
                  selectedCities.length === 1 ? selectedCities[0]! : "ALL"
                }
                favoriteKeys={favoriteKeys}
                hoveredPropertyKey={hoveredPropertyKey}
                selectedPropertyKey={selectedMapPropertyKey}
                onHoverProperty={setHoveredPropertyKey}
                onSelectProperty={setSelectedMapPropertyKey}
                onFocusCardInList={focusCardInList}
                onToggleFavorite={toggleFavorite}
                onOpenGallery={(property, initialIndex) =>
                  setGalleryState({ property, initialIndex })
                }
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
