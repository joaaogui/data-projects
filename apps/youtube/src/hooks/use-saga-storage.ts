"use client";

import type { Saga } from "@/types/youtube";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

async function fetchSagas(channelId: string): Promise<Saga[]> {
  const res = await fetch(`/api/sagas/${channelId}`);
  if (!res.ok) return [];
  return res.json();
}

async function syncPlaylistSagasApi(channelId: string): Promise<Saga[]> {
  const res = await fetch(`/api/sagas/${channelId}/sync-playlists`, { method: "POST" });
  if (!res.ok) return [];
  return res.json();
}

async function saveAiSagasApi(
  channelId: string,
  aiSagas: Saga[]
): Promise<Saga[]> {
  const res = await fetch(`/api/sagas/${channelId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sagas: aiSagas, source: "ai-detected" }),
  });
  if (!res.ok) throw new Error("Failed to save AI sagas");
  const data = await res.json();
  return data.sagas;
}

async function deleteAiSagasApi(channelId: string): Promise<void> {
  const res = await fetch(`/api/sagas/${channelId}?source=ai-detected`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete AI sagas");
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

  const { data: allSagas = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchSagas(channelId!),
    enabled: !!channelId,
    staleTime: 60_000,
  });

  const syncPlaylistsMutation = useMutation({
    mutationFn: () => syncPlaylistSagasApi(channelId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const saveAiMutation = useMutation({
    mutationFn: (aiSagas: Saga[]) => saveAiSagasApi(channelId!, aiSagas),
    onSuccess: (merged) => {
      queryClient.setQueryData(queryKey, merged);
    },
  });

  const deleteAiMutation = useMutation({
    mutationFn: () => deleteAiSagasApi(channelId!),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, (prev: Saga[] | undefined) =>
        (prev ?? []).filter((s) => s.source !== "ai-detected")
      );
    },
  });

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => patchSagaApi(channelId!, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated);
    },
  });

  const playlistSagas = allSagas.filter((s) => s.source === "playlist");
  const aiSagas = allSagas.filter((s) => s.source === "ai-detected");

  const setAiSagas = useCallback(
    (newAiSagas: Saga[]) => {
      queryClient.setQueryData(queryKey, (prev: Saga[] | undefined) => {
        const playlists = (prev ?? []).filter((s) => s.source === "playlist");
        const manual = (prev ?? []).filter((s) => s.source === "manual");
        return [...playlists, ...manual, ...newAiSagas];
      });
    },
    [queryClient, queryKey]
  );

  const saveAiSagas = useCallback(
    (sagasToSave: Saga[]) => {
      if (!channelId) return Promise.resolve();
      console.log(`[Saga Storage] Saving ${sagasToSave.length} AI sagas for ${channelId}`);
      return saveAiMutation.mutateAsync(sagasToSave).catch((err) => {
        console.error("[Saga Storage] Failed to save:", err);
      });
    },
    [channelId, saveAiMutation]
  );

  const deleteAiSagas = useCallback(() => {
    if (!channelId) return Promise.resolve();
    console.log(`[Saga Storage] Deleting AI sagas for ${channelId}`);
    return deleteAiMutation.mutateAsync().catch((err) => {
      console.error("[Saga Storage] Failed to delete:", err);
    });
  }, [channelId, deleteAiMutation]);

  const assignVideos = useCallback(
    (sagaId: string, videoIds: string[]) => {
      if (!channelId) return Promise.resolve();
      return patchMutation.mutateAsync({ action: "assign", sagaId, videoIds });
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

  const syncPlaylists = useCallback(() => {
    if (channelId) syncPlaylistsMutation.mutate();
  }, [channelId, syncPlaylistsMutation]);

  return {
    allSagas,
    playlistSagas,
    aiSagas,
    setAiSagas,
    saveAiSagas,
    deleteAiSagas,
    assignVideos,
    unassignVideos,
    createManualSaga,
    syncPlaylists,
    isLoading,
  };
}
