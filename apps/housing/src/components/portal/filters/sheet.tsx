"use client";

import { createFilterStore, useFilterSelector, type FilterStore } from "@/components/portal/filter-store";
import { AdvancedSection } from "@/components/portal/filters/sections/advanced";
import { ApartmentSection } from "@/components/portal/filters/sections/apartment";
import { BuildingSection } from "@/components/portal/filters/sections/building";
import { ListingSection } from "@/components/portal/filters/sections/listing";
import { LocationSection } from "@/components/portal/filters/sections/location";
import { PriceSizeSection } from "@/components/portal/filters/sections/price-size";
import type { SectionContext } from "@/components/portal/filters/sections/shared";
import type { PortalController } from "@/components/portal/use-portal-controller";
import { clearFilters, countActiveFilters } from "@/lib/filter-state";
import { toQueryFilters } from "@/lib/property-query";
import type { CityHubCode } from "@/types/housing";
import { Loader2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

const COUNT_DEBOUNCE_MS = 200;

/** Debounced live result count (and facet counts) for the draft filters. */
function useDraftCount(ctl: PortalController, draft: FilterStore) {
  const state = useFilterSelector(draft, (s) => s);
  const [result, setResult] = useState<{ total: number | null; counts?: Record<string, number> }>({
    total: null,
  });
  const [loading, setLoading] = useState(false);
  const { postPropertyQuery, queryWeights, favoriteKeys } = ctl;
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      postPropertyQuery(
        {
          filters: toQueryFilters(state),
          weights: queryWeights,
          favorites: state.onlyFavorites ? favoriteKeys : [],
          mode: "count",
        },
        controller.signal,
      )
        .then((data) => {
          if (controller.signal.aborted) return;
          setResult({ total: data.total, counts: data.optionCounts });
          setLoading(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, COUNT_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [state, postPropertyQuery, queryWeights, favoriteKeys]);
  return { ...result, loading, activeCount: countActiveFilters(state) };
}

export function FilterSheet({
  ctl,
  onClose,
  header,
  variant = "overlay",
  id,
}: {
  ctl: PortalController;
  onClose: () => void;
  /** Extra row under the title (saved views). */
  header?: (draft: FilterStore) => ReactNode;
  /** "inline" opens in the page flow right below the filter bar; "overlay" is the drawer/bottom sheet. */
  variant?: "overlay" | "inline";
  id?: string;
}) {
  const [draft] = useState(() => createFilterStore(ctl.filterStore.getState()));
  const { total, counts, loading } = useDraftCount(ctl, draft);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const inline = variant === "inline";

  useEffect(() => {
    if (!inline) closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    if (!inline) document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      if (!inline) document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, inline]);

  const { handleToggleHiddenCity, filterStore, applyFilterPatch } = ctl;
  const onToggleHiddenCity = useCallback(
    (city: CityHubCode) => {
      handleToggleHiddenCity(city);
      const main = filterStore.getState();
      draft.setState({
        enabledHiddenCities: main.enabledHiddenCities,
        selectedCities: main.selectedCities,
        selectedNeighborhoods: main.selectedNeighborhoods,
      });
    },
    [handleToggleHiddenCity, filterStore, draft],
  );

  const ctx: SectionContext = useMemo(
    () => ({
      store: draft,
      counts,
      neighborhoodOptions: ctl.availableNeighborhoodOptions,
      ineligibleActiveCount: ctl.ineligibleActiveCount,
      deactivatedTotalCount: ctl.deactivatedTotalCount,
      enabledHiddenCities: ctl.enabledHiddenCities,
      onToggleHiddenCity,
    }),
    [
      draft,
      counts,
      ctl.availableNeighborhoodOptions,
      ctl.ineligibleActiveCount,
      ctl.deactivatedTotalCount,
      ctl.enabledHiddenCities,
      onToggleHiddenCity,
    ],
  );

  const apply = () => {
    applyFilterPatch(draft.getState());
    onClose();
  };

  const body = (
    <>
      <div className="flex items-center justify-between border-b px-4 py-2.5 sm:px-5">
          <h2 className="text-[15px] font-bold">Filtros</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border hover:bg-secondary sm:h-8 sm:w-8"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {header?.(draft)}
        <div
          className={
            inline
              ? "grid gap-x-6 px-4 pb-4 sm:px-5 lg:grid-cols-2"
              : "flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-5"
          }
        >
          <PriceSizeSection ctx={ctx} />
          <LocationSection ctx={ctx} />
          <ApartmentSection ctx={ctx} />
          <BuildingSection ctx={ctx} />
          <ListingSection ctx={ctx} />
          <AdvancedSection ctx={ctx} />
        </div>
        <div className="flex gap-2 border-t bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <button
            type="button"
            onClick={() => draft.setState(clearFilters(draft.getState()))}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-[13px] font-semibold hover:bg-secondary sm:min-h-10"
          >
            Limpar tudo
          </button>
          <button
            type="button"
            onClick={apply}
            data-testid="apply-filters"
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground hover:opacity-90 sm:min-h-10"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {total === null
              ? "Ver imóveis"
              : `Ver ${total.toLocaleString("pt-BR")} ${total === 1 ? "imóvel" : "imóveis"}`}
          </button>
        </div>
    </>
  );

  if (inline) {
    return (
      <section
        id={id}
        aria-label="Filtros"
        data-testid="filter-sheet"
        className="flex flex-col rounded-lg border bg-card"
      >
        {body}
      </section>
    );
  }

  return (
    <div className="fixed inset-0 z-50" data-testid="filter-sheet">
      <button
        type="button"
        aria-label="Fechar filtros"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-foreground/35 backdrop-blur-[1px]"
      />
      <aside
        id={id}
        role="dialog"
        aria-modal="true"
        aria-label="Filtros"
        className="absolute inset-x-0 bottom-0 flex h-[88dvh] flex-col rounded-t-2xl border-t bg-card shadow-2xl sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:h-auto sm:w-[440px] sm:rounded-none sm:border-l sm:border-t-0"
      >
        <span aria-hidden="true" className="mx-auto mt-2 h-1 w-10 rounded-full bg-border sm:hidden" />
        {body}
      </aside>
    </div>
  );
}
