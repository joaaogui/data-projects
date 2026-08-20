"use client";

import type { ArtistDetail, ArtistStats } from "@/lib/analytics/artists";
import type { EvolutionStats } from "@/lib/analytics/evolution";
import type { LibraryKind, LibraryResult } from "@/lib/analytics/library";
import type { OverviewStats } from "@/lib/analytics/overview";
import type { TemporalStats } from "@/lib/analytics/temporal";
import { getJson } from "@/services/api-client";
import { useQuery } from "@tanstack/react-query";

/**
 * Analytics run over the whole 225k-row table, so they are expensive to
 * recompute and never change unless an import runs. A long stale time keeps
 * navigation between pages instant; the import hook invalidates ["stats"].
 */
const STALE_TIME_MS = 5 * 60 * 1000;

export function useOverview() {
  return useQuery<OverviewStats>({
    queryKey: ["stats", "overview"],
    queryFn: () => getJson<OverviewStats>("/api/stats/overview"),
    staleTime: STALE_TIME_MS,
  });
}

export function useTemporal() {
  return useQuery<TemporalStats>({
    queryKey: ["stats", "temporal"],
    queryFn: () => getJson<TemporalStats>("/api/stats/temporal"),
    staleTime: STALE_TIME_MS,
  });
}

export function useArtistStats() {
  return useQuery<ArtistStats>({
    queryKey: ["stats", "artists"],
    queryFn: () => getJson<ArtistStats>("/api/stats/artists"),
    staleTime: STALE_TIME_MS,
  });
}

export function useEvolution() {
  return useQuery<EvolutionStats>({
    queryKey: ["stats", "evolution"],
    queryFn: () => getJson<EvolutionStats>("/api/stats/evolution"),
    staleTime: STALE_TIME_MS,
  });
}

export function useArtistDetail(name: string | null) {
  return useQuery<ArtistDetail>({
    queryKey: ["stats", "artist", name],
    queryFn: () => getJson<ArtistDetail>(`/api/artist/${encodeURIComponent(name!)}`), // NOSONAR
    enabled: !!name,
    staleTime: STALE_TIME_MS,
    retry: false,
  });
}

export function useLibrary(kind: LibraryKind, query: string) {
  return useQuery<LibraryResult>({
    queryKey: ["stats", "library", kind, query],
    queryFn: () =>
      getJson<LibraryResult>(
        `/api/library?kind=${kind}&q=${encodeURIComponent(query)}&limit=500`
      ),
    staleTime: STALE_TIME_MS,
    placeholderData: (previous) => previous,
  });
}
