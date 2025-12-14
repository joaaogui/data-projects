import type { SearchResult, OMDBSearchItem } from "@/types/omdb";

export async function fetchShowSearch(title: string): Promise<SearchResult> {
  const response = await fetch(`/api/search/${encodeURIComponent(title)}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to search for show");
  }

  return response.json();
}

export async function fetchShowSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<OMDBSearchItem[]> {
  const response = await fetch(`/api/suggest/${encodeURIComponent(query)}`, {
    signal,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch suggestions");
  }

  return response.json();
}



