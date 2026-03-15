"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchChannelSearch } from "@/services/channel-client";

export function useChannelSearch(query: string | null) {
  return useQuery({
    queryKey: ["channel-search", query],
    queryFn: () => fetchChannelSearch(query!), // NOSONAR
    enabled: !!query,
  });
}

