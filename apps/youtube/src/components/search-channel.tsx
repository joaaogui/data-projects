"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { SearchAutocomplete } from "@data-projects/ui";
import { useChannelSuggestions } from "@/hooks/use-channel-suggestions";
import type { ChannelSuggestion } from "@/services/channel";

interface SearchChannelProps {
  initialValue?: string;
  compact?: boolean;
}

export function SearchChannel({ initialValue = "", compact = false }: Readonly<SearchChannelProps>) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <SearchAutocomplete<ChannelSuggestion>
      initialValue={initialValue}
      compact={compact}
      placeholder="Search for a YouTube channel..."
      useSuggestions={useChannelSuggestions}
      getSuggestionKey={(item) => item.channelId}
      getSuggestionValue={(item) => item.channelTitle}
      renderSuggestion={({ item }) => (
        <div className="flex items-center gap-3">
          {item.thumbnails?.default?.url ? (
            <Image
              src={item.thumbnails.default.url}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-border/50"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-muted ring-1 ring-border/50" />
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="truncate font-medium">{item.channelTitle}</span>
            {item.videoCount !== undefined && (
              <span className="text-xs text-muted-foreground">
                {item.videoCount.toLocaleString()} videos
              </span>
            )}
          </div>
        </div>
      )}
      onSubmit={(value) => {
        startTransition(() => {
          router.push(`/channel/search/${encodeURIComponent(value)}`)
        })
      }}
      onSelect={(item) => {
        startTransition(() => {
          router.push(`/channel/${item.channelId}`)
        })
      }}
      inputClassName="focus:border-primary focus:ring-primary/20"
      buttonClassName="font-semibold"
    />
  );
}
