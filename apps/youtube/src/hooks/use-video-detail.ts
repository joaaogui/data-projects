"use client";

import { fetchVideoDetail } from "@/services/channel-client";
import { useQuery } from "@tanstack/react-query";

export function useVideoDescription(
  videoId: string,
  initialDescription: string | undefined
) {
  const hasInitialValue = initialDescription !== undefined;
  const query = useQuery({
    queryKey: ["video-detail", videoId],
    queryFn: () => fetchVideoDetail(videoId),
    enabled: !hasInitialValue,
    staleTime: 60 * 60 * 1000,
  });

  return {
    description:
      initialDescription ?? query.data?.description ?? "",
    isLoading: !hasInitialValue && query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
  };
}
