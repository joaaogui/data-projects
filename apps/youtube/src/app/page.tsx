import Link from "next/link";
import { Info } from "lucide-react";
import { SuggestionLinks } from "@data-projects/ui";

function YouTubeIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}
import { SearchChannel } from "@/components/search-channel";

const SUGGESTIONS = ["VSauce", "Veritasium", "Luiz Do Som"];

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-xl space-y-8 text-center">
          <div className="flex justify-center">
            <YouTubeIcon className="h-32 w-32 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary via-red-500 to-orange-500 bg-clip-text text-transparent">YouTube Analyzer</span>
            </h1>
            <p className="text-muted-foreground">
              Analyze channel statistics and video performance
            </p>
          </div>

          <div className="relative z-10 flex justify-center">
            <SearchChannel />
          </div>

          <div className="text-sm text-muted-foreground">
            <p>
              Try searching for{" "}
              <SuggestionLinks
                suggestions={SUGGESTIONS}
                hrefForSuggestion={(suggestion) =>
                  `/channel/search/${encodeURIComponent(suggestion)}`
                }
                linkClassName="hover:text-primary"
              />
            </p>
          </div>

          <div className="flex items-start gap-2 text-xs text-muted-foreground/70 bg-muted/30 rounded-lg p-3 text-left">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <p>
              This app uses the YouTube Data API with limited daily quota. Results are cached locally for 30 days to minimize API usage.
            </p>
          </div>
        </div>
      </div>

      <footer className="relative py-4 text-sm text-muted-foreground border-t border-border/50">
        <p className="text-center">
          Powered by{" "}
          <a
            href="https://developers.google.com/youtube/v3"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            YouTube Data API
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
