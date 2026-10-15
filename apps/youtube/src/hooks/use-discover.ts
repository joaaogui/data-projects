"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export interface EvolutionEra {
  period: string;
  startDate: string;
  endDate: string;
  topics: string[];
  style: string;
  description: string;
  videoCount: number;
}

export interface EvolutionData {
  eras: EvolutionEra[];
  summary: string;
}

export interface DnaTrait {
  category: string;
  value: string;
  examples: string[];
}

export interface DnaData {
  traits: DnaTrait[];
  catchphrases: string[];
  style: string;
  summary: string;
}

export interface StarterPick {
  videoId: string;
  reason: string;
  category: "signature" | "best" | "gem" | "recent" | "classic";
}

export interface StarterPackData {
  picks: StarterPick[];
  intro: string;
}

export interface RabbitHoleMention {
  name: string;
  context: string;
  frequency: number;
  videoIds: string[];
}

export interface RabbitHoleData {
  mentions: RabbitHoleMention[];
}

async function fetchDiscoverAI<T>(endpoint: string, channelId: string): Promise<T> {
  const res = await fetch(`/api/discover/${endpoint}/${channelId}`, {
    method: "POST",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(data.error ?? `Failed to fetch ${endpoint}`);
  }
  return res.json();
}

export function useDiscoverSection<T>(
  endpoint: string,
  queryKeyName: string,
  channelId: string,
) {
  const queryClient = useQueryClient();
  const queryKey = [queryKeyName, channelId];

  const [data, setData] = useState<T | null>(
    () => queryClient.getQueryData<T>(queryKey) ?? null,
  );

  const mutation = useMutation({
    mutationFn: () => fetchDiscoverAI<T>(endpoint, channelId),
    onSuccess: (result) => {
      setData(result);
      queryClient.setQueryData(queryKey, result);
    },
  });

  return {
    data,
    generate: mutation.mutate,
    isLoading: mutation.isPending,
    error: mutation.error?.message ?? null,
  };
}

export function useDiscoverEvolution(channelId: string) {
  return useDiscoverSection<EvolutionData>("evolution", "discover-evolution", channelId);
}

export function useDiscoverDna(channelId: string) {
  return useDiscoverSection<DnaData>("dna", "discover-dna", channelId);
}

export function useDiscoverStarterPack(channelId: string) {
  return useDiscoverSection<StarterPackData>("starter-pack", "discover-starter-pack", channelId);
}

export function useDiscoverRabbitHole(channelId: string) {
  return useDiscoverSection<RabbitHoleData>("rabbit-hole", "discover-rabbit-hole", channelId);
}
