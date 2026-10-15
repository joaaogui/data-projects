"use client";

import type { Saga } from "@/types/youtube";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useChannel } from "./use-channel-context";

async function fetchSagas(channelId: string): Promise<Saga[]> {
  const res = await fetch(`/api/sagas/${channelId}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to load sagas");
  }
  return res.json();
}

async function patchSagaApi(
  channelId: string,
  body: Record<string, unknown>
): Promise<Saga[]> {
  const res = await fetch(`/api/sagas/${channelId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to update saga");
  const data = await res.json();
  return data.sagas;
}

export function useSagaStorage(channelId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["sagas", channelId], [channelId]);
  const { pushSagaLog } = useChannel();

  const { data: allSagas = [], isLoading, error } = useQuery({
    queryKey,
    queryFn: () => fetchSagas(channelId!), // NOSONAR
    enabled: !!channelId,
    staleTime: 60_000,
  });

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchSagaApi(channelId!, body), // NOSONAR
    onSuccess: (updated, variables) => {
      queryClient.setQueryData(queryKey, updated);
      const action = variables.action as string;
      if (action === "assign") {
        const sagaName = updated.find((s: Saga) => s.id === variables.sagaId)?.name ?? "Unknown";
        const count = (variables.videoIds as string[])?.length ?? 0;
        pushSagaLog(`Manual: assigned ${count} video${count === 1 ? "" : "s"} to "${sagaName}"`);
      } else if (action === "unassign") {
        const count = (variables.videoIds as string[])?.length ?? 0;
        pushSagaLog(`Manual: unassigned ${count} video${count === 1 ? "" : "s"}`);
      } else if (action === "create") {
        const name = variables.name as string;
        const count = (variables.videoIds as string[])?.length ?? 0;
        pushSagaLog(`Manual: created saga "${name}" with ${count} video${count === 1 ? "" : "s"}`);
      }
    },
  });

  const playlistSagas = allSagas.filter((s) => s.source === "playlist");
  const aiSagas = allSagas.filter((s) => s.source === "ai-detected");

  const assignVideos = useCallback(
    (sagaId: string, videoIds: string[], neighborContext?: { leftSaga?: { id: string; name: string }; rightSaga?: { id: string; name: string } }) => {
      if (!channelId) return Promise.resolve();
      return patchMutation.mutateAsync({ action: "assign", sagaId, videoIds, neighborContext });
    },
    [channelId, patchMutation]
  );

  const unassignVideos = useCallback(
    (sagaId: string, videoIds: string[]) => {
      if (!channelId) return Promise.resolve();
      return patchMutation.mutateAsync({ action: "unassign", sagaId, videoIds });
    },
    [channelId, patchMutation]
  );

  const createManualSaga = useCallback(
    (name: string, videoIds: string[]) => {
      if (!channelId) return Promise.resolve();
      return patchMutation.mutateAsync({ action: "create", name, videoIds });
    },
    [channelId, patchMutation]
  );

  return {
    allSagas,
    playlistSagas,
    aiSagas,
    assignVideos,
    unassignVideos,
    createManualSaga,
    isLoading,
    error: error instanceof Error ? error.message : null,
  };
}

