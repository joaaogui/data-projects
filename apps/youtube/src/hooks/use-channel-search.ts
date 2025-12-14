"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchChannelSearch } from "@/services/channel";

export function useChannelSearch(query: string | null) {
  return useQuery({
    queryKey: ["channel-search", query],
    queryFn: () => fetchChannelSearch(query!),
    enabled: !!query,
  });
}

