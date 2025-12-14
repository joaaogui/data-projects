import * as React from "react";
import Link from "next/link";
import { cn } from "@data-projects/shared";

export interface SuggestionLinksProps {
  suggestions: string[];
  hrefForSuggestion: (suggestion: string) => string;
  linkClassName?: string;
}

export function SuggestionLinks({
  suggestions,
  hrefForSuggestion,
  linkClassName,
}: Readonly<SuggestionLinksProps>) {
  return (
    <>
      {suggestions.map((suggestion, index) => (
        <span key={suggestion}>
          <Link
            href={hrefForSuggestion(suggestion)}
            className={cn(
              "text-foreground font-medium transition-colors",
              linkClassName
            )}
          >
            {suggestion}
          </Link>
          {index < suggestions.length - 1 &&
            (index === suggestions.length - 2 ? ", or " : ", ")}
        </span>
      ))}
    </>
  );
}


