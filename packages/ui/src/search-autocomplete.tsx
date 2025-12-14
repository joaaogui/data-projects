"use client";

import * as React from "react";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@data-projects/shared";
import { Input } from "./input";
import { Button } from "./button";

export interface SearchAutocompleteTestIds {
  form?: string;
  input?: string;
  button?: string;
  dropdown?: string;
}

export interface SearchAutocompleteProps<TItem> {
  initialValue?: string;
  className?: string;
  compact?: boolean;
  placeholder?: string;
  inputName?: string;
  debounceMs?: number;
  minQueryLength?: number;
  maxSuggestions?: number;

  useSuggestions: (args: {
    query: string;
    enabled?: boolean;
  }) => { data?: TItem[]; isFetching: boolean };

  getSuggestionKey: (item: TItem) => React.Key;
  getSuggestionValue: (item: TItem) => string;
  renderSuggestion?: (args: {
    item: TItem;
    isActive: boolean;
  }) => React.ReactNode;

  onSubmit: (value: string) => void;
  onSelect: (item: TItem) => void;

  inputClassName?: string;
  buttonClassName?: string;
  dropdownClassName?: string;
  testIds?: SearchAutocompleteTestIds;
}

export function SearchAutocomplete<TItem>({
  initialValue = "",
  className,
  compact = false,
  placeholder = "Search…",
  inputName = "search",
  debounceMs = 300,
  minQueryLength = 2,
  maxSuggestions = 8,
  useSuggestions,
  getSuggestionKey,
  getSuggestionValue,
  renderSuggestion,
  onSubmit,
  onSelect,
  inputClassName,
  buttonClassName,
  dropdownClassName,
  testIds,
}: Readonly<SearchAutocompleteProps<TItem>>) {
  const [value, setValue] = React.useState(initialValue);
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const committedValueRef = React.useRef<string | null>(null);

  const normalizedQuery = React.useMemo(() => value.trim(), [value]);

  React.useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      setDebouncedQuery(normalizedQuery);
    }, debounceMs);

    return () => globalThis.clearTimeout(timer);
  }, [normalizedQuery, debounceMs]);

  const shouldFetch = React.useMemo(() => {
    if (!isFocused || isSubmitting) return false;
    if (
      committedValueRef.current &&
      normalizedQuery === committedValueRef.current
    ) {
      return false;
    }
    return debouncedQuery.length >= minQueryLength;
  }, [isFocused, isSubmitting, normalizedQuery, debouncedQuery, minQueryLength]);

  const { data: suggestions = [], isFetching: isSuggestLoading } = useSuggestions({
    query: debouncedQuery,
    enabled: shouldFetch,
  });

  const displayedSuggestions = React.useMemo(
    () => suggestions.slice(0, maxSuggestions),
    [suggestions, maxSuggestions]
  );

  React.useEffect(() => {
    if (closeTimerRef.current) {
      globalThis.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (!isFocused || isSubmitting) {
      setIsOpen(false);
      return;
    }

    if (committedValueRef.current && normalizedQuery === committedValueRef.current) {
      setIsOpen(false);
      return;
    }

    if (normalizedQuery.length < minQueryLength) {
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (displayedSuggestions.length > 0) {
      setIsOpen(true);
      setHighlightedIndex(0);
    } else if (!isSuggestLoading) {
      setIsOpen(false);
    }
  }, [
    isFocused,
    isSubmitting,
    normalizedQuery,
    minQueryLength,
    displayedSuggestions,
    isSuggestLoading,
  ]);

  const submit = React.useCallback(() => {
    const committed = value.trim();
    if (!committed) return;

    committedValueRef.current = committed;
    setIsOpen(false);
    setHighlightedIndex(-1);
    setIsSubmitting(true);
    onSubmit(committed);
  }, [value, onSubmit]);

  const select = React.useCallback(
    (item: TItem) => {
      const next = getSuggestionValue(item);
      committedValueRef.current = next;
      setValue(next);
      setIsOpen(false);
      setHighlightedIndex(-1);
      setIsSubmitting(true);
      onSelect(item);
    },
    [getSuggestionValue, onSelect]
  );

  const handleSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    submit();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      if (!isOpen && displayedSuggestions.length > 0) setIsOpen(true);
      if (displayedSuggestions.length > 0) {
        event.preventDefault();
        setHighlightedIndex((current) =>
          Math.min(current + 1, displayedSuggestions.length - 1)
        );
      }
      return;
    }

    if (event.key === "ArrowUp") {
      if (displayedSuggestions.length > 0) {
        event.preventDefault();
        setHighlightedIndex((current) => Math.max(current - 1, 0));
      }
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (event.key === "Enter") {
      if (isOpen && highlightedIndex >= 0 && displayedSuggestions[highlightedIndex]) {
        event.preventDefault();
        select(displayedSuggestions[highlightedIndex]);
        return;
      }
      submit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-testid={testIds?.form}
      className={cn("flex gap-2 w-full", compact ? "max-w-md" : "max-w-xl", className)}
    >
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {isSuggestLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        <Input
          type="text"
          name={inputName}
          autoComplete="off"
          placeholder={placeholder}
          data-testid={testIds?.input}
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            if (
              committedValueRef.current &&
              nextValue.trim() !== committedValueRef.current
            ) {
              committedValueRef.current = null;
            }
            setValue(nextValue);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (displayedSuggestions.length > 0) setIsOpen(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            closeTimerRef.current = globalThis.setTimeout(() => {
              setIsOpen(false);
              setHighlightedIndex(-1);
            }, 120);
          }}
          disabled={isSubmitting}
          className={cn(
            "pl-10 bg-card/50 border-border/50",
            isSuggestLoading ? "pr-10" : "",
            compact ? "h-9 text-sm" : "h-12 text-base",
            inputClassName
          )}
        />

        {isOpen && (isSuggestLoading || displayedSuggestions.length > 0) && (
          <div
            data-testid={testIds?.dropdown}
            className={cn(
              "absolute left-0 right-0 top-full mt-2 rounded-md border border-border/50 bg-card/95 backdrop-blur-sm shadow-xl z-[200] overflow-hidden",
              dropdownClassName
            )}
          >
            {isSuggestLoading && displayedSuggestions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading…</span>
              </div>
            ) : (
              <ul>
                {displayedSuggestions.map((item, index) => {
                  const isActive = index === highlightedIndex;
                  return (
                    <li key={getSuggestionKey(item)}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => select(item)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={cn(
                          "w-full text-left px-3 py-2 transition-colors",
                          isActive ? "bg-muted/60" : "hover:bg-muted/40"
                        )}
                      >
                        {renderSuggestion ? (
                          renderSuggestion({ item, isActive })
                        ) : (
                          <span className="truncate font-medium">
                            {getSuggestionValue(item)}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || !value.trim()}
        data-testid={testIds?.button}
        className={cn(compact ? "h-9 px-3 sm:px-4" : "h-12 px-3 sm:px-6", buttonClassName)}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <Search className="h-4 w-4 sm:hidden" />
            <span className="hidden sm:inline">Search</span>
          </>
        )}
      </Button>
    </form>
  );
}


