import { AuthBadge } from "@/components/auth-badge";
import { HousingPortal } from "@/components/housing-portal";
import { filtersFromSearch } from "@/lib/filter-url";
import { withNeighborhoodResearch } from "@/lib/neighborhood-research";
import { parseExplorerFiltersObject } from "@/lib/property-filters";
import {
  buildQueryKey,
  DEFAULT_PAGE_SIZE,
  runPropertyQuery,
  toQueryFilters,
  type PropertyQueryRequest,
} from "@/lib/property-query";
import { loadSharedPreferences } from "@/lib/preferences-store";
import { weightsSchemaVersion } from "@/lib/saved-views";
import { sanitizeAndMigrateWeights } from "@/lib/scoring-engine";
import { getDatasetMeta, getScoredProperties } from "@/lib/server-scoring";

export const dynamic = "force-dynamic";

function toSearch(params: Record<string, string | string[] | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    for (const v of Array.isArray(value) ? value : value === undefined ? [] : [value]) search.append(key, v);
  }
  return search.toString();
}

export default async function HousingHomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [preferences, params] = await Promise.all([loadSharedPreferences(), searchParams]);
  // Filters in the URL (shared link, back/forward) win over the saved ones.
  const urlFilters = filtersFromSearch(toSearch(params));
  const state = urlFilters ?? parseExplorerFiltersObject(preferences.filters);
  const weights = sanitizeAndMigrateWeights(
    preferences.weights,
    weightsSchemaVersion(preferences.schemaVersion),
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
  const initialQuery = runPropertyQuery(scored, request);
  initialQuery.items = withNeighborhoodResearch(initialQuery.items);
  return (
    <>
      <HousingPortal
        initialMeta={meta}
        initialQuery={initialQuery}
        initialQueryKey={buildQueryKey(request)}
        initialPreferences={preferences}
        initialUrlFilters={urlFilters}
      />
      <AuthBadge />
    </>
  );
}
