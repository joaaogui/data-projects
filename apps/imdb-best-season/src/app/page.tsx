import Image from "next/image";
import Link from "next/link";
import { SearchTitle } from "@/components/search-title";
import { SuggestionLinks, ThemeToggle } from "@data-projects/ui";

const SUGGESTIONS = ["Breaking Bad", "The Wire", "The Office"];

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="absolute top-4 right-4">
        <ThemeToggle iconClassName="text-gold" />
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-xl space-y-8 text-center">
          <div className="relative w-64 h-40 mx-auto animate-scale-in">
            <Image
              src="/images/logo.png"
              alt="IMDb Best Season"
              fill
              className="object-contain dark:invert dark:brightness-200"
              priority
            />
          </div>

          <div className="space-y-2 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <h1 data-testid="main-heading" className="text-2xl md:text-3xl font-bold tracking-tight">
              Find the <span className="text-gold">Best Season</span>
            </h1>
            <p data-testid="tagline" className="text-muted-foreground">
              Discover which season of your favorite TV show is the highest rated according to IMDb
            </p>
          </div>

          <div
            className="relative z-10 flex justify-center animate-fade-in"
            style={{ animationDelay: "200ms" }}
          >
            <SearchTitle />
          </div>

          <div
            className="text-sm text-muted-foreground animate-fade-in"
            style={{ animationDelay: "300ms" }}
          >
            <p>
              Try searching for{" "}
              <SuggestionLinks
                suggestions={SUGGESTIONS}
                hrefForSuggestion={(suggestion) => `/${encodeURIComponent(suggestion)}`}
                linkClassName="hover:text-gold"
              />
            </p>
          </div>
        </div>
      </div>

      <footer data-testid="footer" className="relative py-4 text-sm text-muted-foreground border-t border-border/50">
        <p className="text-center">
          Powered by{" "}
          <a
            href="https://www.omdbapi.com/"
            target="_blank"
            rel="noopener noreferrer"
            data-testid="omdb-link"
            className="text-gold hover:underline"
          >
            OMDb API
          </a>
        </p>
        <a
          href="https://github.com/joaaogui/data-projects"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="View source on GitHub"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </a>
      </footer>
    </main>
  );
}
