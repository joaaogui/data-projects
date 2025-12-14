"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchShowSearch } from "@/services/show";

export function useShowSearch(title: string | null) {
  return useQuery({
    queryKey: ["show-search", title],
    queryFn: () => fetchShowSearch(title!),
    enabled: !!title,
  });
}

