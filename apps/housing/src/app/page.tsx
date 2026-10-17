import { AuthBadge } from "@/components/auth-badge";
import { HousingPortal } from "@/components/housing-portal";
import { parseExplorerFiltersObject } from "@/lib/property-filters";
import {
  buildQueryKey,
  DEFAULT_PAGE_SIZE,
  runPropertyQuery,
  toQueryFilters,
  type PropertyQueryRequest,
} from "@/lib/property-query";
import { loadSharedPreferences } from "@/lib/preferences-store";
import { sanitizeAndMigrateWeights } from "@/lib/scoring-engine";
import { getDatasetMeta, getScoredProperties } from "@/lib/server-scoring";

export const dynamic = "force-dynamic";

export default async function HousingHomePage() {
  const preferences = await loadSharedPreferences();
  const state = parseExplorerFiltersObject(preferences.filters);
  const weights = sanitizeAndMigrateWeights(
    preferences.weights,
    preferences.schemaVersion ?? 2,
  );
  const request: PropertyQueryRequest = {
    filters: toQueryFilters(state),
    weights,
    favorites: state.onlyFavorites ? (preferences.favorites ?? []) : [],
    offset: 0,
    limit: DEFAULT_PAGE_SIZE,
    includeFacets: true,
    allFavorites: preferences.favorites ?? [],
  };
  const [scored, meta] = await Promise.all([
    getScoredProperties(weights, { enabledHiddenCities: state.enabledHiddenCities }),
    getDatasetMeta(),
  ]);
  return (
    <>
      <HousingPortal
        initialMeta={meta}
        initialQuery={runPropertyQuery(scored, request)}
        initialQueryKey={buildQueryKey(request)}
        initialPreferences={preferences}
      />
      <AuthBadge />
    </>
  );
}
