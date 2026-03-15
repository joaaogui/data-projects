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

export function useDiscoverEvolution(channelId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["discover-evolution", channelId];

  const [data, setData] = useState<EvolutionData | null>(
    () => queryClient.getQueryData<EvolutionData>(queryKey) ?? null,
  );

  const mutation = useMutation({
    mutationFn: () => fetchDiscoverAI<EvolutionData>("evolution", channelId),
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

export function useDiscoverDna(channelId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["discover-dna", channelId];

  const [data, setData] = useState<DnaData | null>(
    () => queryClient.getQueryData<DnaData>(queryKey) ?? null,
  );

  const mutation = useMutation({
    mutationFn: () => fetchDiscoverAI<DnaData>("dna", channelId),
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

export function useDiscoverStarterPack(channelId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["discover-starter-pack", channelId];

  const [data, setData] = useState<StarterPackData | null>(
    () => queryClient.getQueryData<StarterPackData>(queryKey) ?? null,
  );

  const mutation = useMutation({
    mutationFn: () => fetchDiscoverAI<StarterPackData>("starter-pack", channelId),
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

export function useDiscoverRabbitHole(channelId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["discover-rabbit-hole", channelId];

  const [data, setData] = useState<RabbitHoleData | null>(
    () => queryClient.getQueryData<RabbitHoleData>(queryKey) ?? null,
  );

  const mutation = useMutation({
    mutationFn: () => fetchDiscoverAI<RabbitHoleData>("rabbit-hole", channelId),
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
