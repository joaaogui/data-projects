"use client";

import { useRouter } from "next/navigation";
import { SearchAutocomplete } from "@data-projects/ui";
import { useShowSuggestions } from "@/hooks/use-show-suggestions";
import type { OMDBSearchItem } from "@/types/omdb";

interface SearchTitleProps {
  initialValue?: string;
  compact?: boolean;
}

export function SearchTitle({ initialValue = "", compact = false }: Readonly<SearchTitleProps>) {
  const router = useRouter();

  return (
    <SearchAutocomplete<OMDBSearchItem>
      initialValue={initialValue}
      compact={compact}
      placeholder="Enter the show name..."
      useSuggestions={useShowSuggestions}
      getSuggestionKey={(item) => item.imdbID}
      getSuggestionValue={(item) => item.Title}
      renderSuggestion={({ item }) => (
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-medium">{item.Title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {item.Year}
          </span>
        </div>
      )}
      onSubmit={(value) => router.push(`/${encodeURIComponent(value)}`)}
      onSelect={(item) => router.push(`/${encodeURIComponent(item.Title)}`)}
      inputClassName="pl-9 focus:border-gold focus:ring-gold/20"
      buttonClassName="gradient-gold text-black font-semibold hover:opacity-90 transition-opacity"
      dropdownClassName="z-[900]"
      testIds={{
        form: "search-form",
        input: "search-input",
        button: "search-button",
        dropdown: "suggestions-dropdown",
      }}
    />
  );
}
