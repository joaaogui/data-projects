"use client";

import { FilterStoreContext } from "@/components/portal/filter-store";
import { BenchmarkBanner } from "@/components/portal/benchmark-banner";
import { CityToolbar } from "@/components/portal/city-toolbar";
import { FiltersPanel } from "@/components/portal/filters-panel";
import { NeighborhoodsTab } from "@/components/portal/neighborhoods-tab";
import { PortalHeader } from "@/components/portal/portal-header";
import { ResultsView } from "@/components/portal/results-view";
import { ScrapePanel } from "@/components/portal/scrape-panel";
import {
  usePortalController,
  type HousingPortalProps,
} from "@/components/portal/use-portal-controller";
import { WeightsPanel } from "@/components/portal/weights-panel";
import dynamic from "next/dynamic";

export {
  MAX_EXTRA_PHOTOS_CACHE_ENTRIES,
  upsertBoundedRecord,
} from "@/components/portal/constants";
export * from "@/lib/property-filters";

const PropertyChatDrawer = dynamic(
  () =>
    import("@/components/property-chat-drawer").then(
      (m) => m.PropertyChatDrawer,
    ),
  { ssr: false },
);
const PropertyPhotoGalleryModal = dynamic(
  () =>
    import("@/components/property-photo-gallery-modal").then(
      (m) => m.PropertyPhotoGalleryModal,
    ),
  { ssr: false },
);

export function HousingPortal(props: HousingPortalProps) {
  const ctl = usePortalController(props);
  const {
    activeTab,
    chatScrollTargetKey,
    clearChatHistory,
    deletePropertyQuestion,
    favoriteKeys,
    filteredTotal,
    focusCardInList,
    galleryState,
    handleConsumeChatScrollTarget,
    handleSelectChatThread,
    isSubmittingChatQuestion,
    pinnedChatProperty,
    pinnedChatPropertyKey,
    qaItems,
    setExtraPhotosByKey,
    setGalleryState,
    setPinnedChatPropertyKey,
    setShowChatDrawer,
    showChatDrawer,
    submitChatQuestion,
    toggleFavorite,
    upsertBoundedRecord,
  } = ctl;
  return (
    <FilterStoreContext.Provider value={ctl.filterStore}>
      <div className="space-y-3">
        <PortalHeader ctl={ctl} />
        <ScrapePanel ctl={ctl} />
        <WeightsPanel ctl={ctl} />
        <CityToolbar ctl={ctl} />
        {activeTab === "properties" && (
          <section className="space-y-3">
            <BenchmarkBanner ctl={ctl} />
            <FiltersPanel ctl={ctl} />
            <ResultsView ctl={ctl} />
          </section>
        )}
        <NeighborhoodsTab ctl={ctl} />
        {galleryState && (
          <PropertyPhotoGalleryModal
            property={galleryState.property}
            initialIndex={galleryState.initialIndex}
            isFavorite={favoriteKeys.includes(
              `${galleryState.property.provider}:${galleryState.property.id}`,
            )}
            onToggleFavorite={() =>
              toggleFavorite(
                `${galleryState.property.provider}:${galleryState.property.id}`,
              )
            }
            onPhotosLoaded={(loadedPhotos) => {
              const k = `${galleryState.property.provider}:${galleryState.property.id}`;
              setExtraPhotosByKey((prev) =>
                upsertBoundedRecord(prev, k, loadedPhotos),
              );
            }}
            onClose={() => setGalleryState(null)}
          />
        )}

        <PropertyChatDrawer
          open={showChatDrawer}
          onOpenChange={setShowChatDrawer}
          qaItems={qaItems}
          activeThreadKey={pinnedChatPropertyKey}
          pinnedProperty={pinnedChatProperty}
          onSelectThread={handleSelectChatThread}
          onFocusProperty={(propertyKey) => {
            setPinnedChatPropertyKey(propertyKey);
            focusCardInList(propertyKey);
          }}
          onSubmitQuestion={submitChatQuestion}
          onDeleteQuestion={deletePropertyQuestion}
          onClearHistory={clearChatHistory}
          isSubmitting={isSubmittingChatQuestion}
          scrollTargetPropertyKey={chatScrollTargetKey}
          onConsumeScrollTarget={handleConsumeChatScrollTarget}
          filteredCount={filteredTotal}
        />
      </div>
    </FilterStoreContext.Provider>
  );
}
