import { apiFetch, ApiError } from "@data-projects/shared";
import type { SearchResult, OMDBSearchItem } from "@/types/omdb";

export { ApiError };

export async function fetchShowSearch(title: string): Promise<SearchResult> {
  return apiFetch<SearchResult>(`/api/search/${encodeURIComponent(title)}`, {
    fallbackError: "Failed to search for show",
  });
}

export async function fetchShowSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<OMDBSearchItem[]> {
  return apiFetch<OMDBSearchItem[]>(
    `/api/suggest/${encodeURIComponent(query)}`,
    {
      signal,
      fallbackError: "Failed to fetch suggestions",
    }
  );
}
