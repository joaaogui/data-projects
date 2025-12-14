"use client"

import Image from "next/image"
import { useRouter } from "next/navigation"
import { SearchAutocomplete } from "@data-projects/ui"
import { useArtistSuggestions } from "@/hooks/use-artist-suggestions"
import type { ArtistSuggestion } from "@/services/artist"

interface SearchArtistProps {
  className?: string
  compact?: boolean
}

export function SearchArtist({ className, compact = false }: Readonly<SearchArtistProps>) {
  const router = useRouter()
  return (
    <SearchAutocomplete<ArtistSuggestion>
      className={className}
      compact={compact}
      placeholder="Enter artist or band name..."
      useSuggestions={useArtistSuggestions}
      getSuggestionKey={(item) => item.id}
      getSuggestionValue={(item) => item.name}
      renderSuggestion={({ item }) => {
        const subtitle = item.genres?.[0]
        return (
          <div className="flex items-center gap-3">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover ring-1 ring-border/50"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-muted ring-1 ring-border/50" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{item.name}</div>
              {subtitle && (
                <div className="truncate text-xs text-muted-foreground">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
        )
      }}
      onSubmit={(value) => router.push(`/artist/${encodeURIComponent(value)}`)}
      onSelect={(item) => router.push(`/artist/${encodeURIComponent(item.name)}`)}
      inputClassName={`${
        compact ? "pl-9" : "pl-10"
      } focus:border-spotify focus:ring-spotify/20 placeholder:text-muted-foreground/60 transition-all duration-200`}
      buttonClassName="bg-spotify hover:bg-spotify/90 text-spotify-foreground font-semibold transition-all duration-200 disabled:opacity-50"
    />
  )
}
