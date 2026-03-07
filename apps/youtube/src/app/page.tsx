import Link from "next/link";
import { SearchChannel } from "@/components/search-channel";
import { RecentChannels } from "@/components/recent-channels";
import { BarChart3, Sparkles, TrendingUp } from "lucide-react";

function YouTubeIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

const FEATURES = [
  { icon: BarChart3, label: "Score every video", description: "Multi-factor scoring across reach, engagement, consistency, and community" },
  { icon: Sparkles, label: "AI-powered insights", description: "Ask natural language questions about any channel's video catalog" },
  { icon: TrendingUp, label: "Engagement breakdown", description: "Rates, trends, and per-1K metrics for likes, comments, and views" },
];

const FEATURED_CHANNELS = [
  { id: "UC6nSFpj9HTCZ5t-N3Rm3-HA", name: "Vsauce", description: "Science & curiosity" },
  { id: "UCHnyfMqiRRG1u-2MsSQLbXA", name: "Veritasium", description: "Science & engineering" },
  { id: "UCYO_jab_esuFRV4b17AJtAw", name: "3Blue1Brown", description: "Math visualizations" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-10 text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <YouTubeIcon className="h-14 w-14 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              Understand any YouTube channel{" "}
              <span className="bg-gradient-to-r from-primary via-red-500 to-orange-500 bg-clip-text text-transparent">
                in seconds
              </span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Analyze video performance, score content quality, and uncover hidden patterns with AI
            </p>
          </div>

          <div className="relative z-10 flex justify-center">
            <SearchChannel />
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-2 text-muted-foreground">
                <f.icon className="h-4 w-4 text-primary/70" />
                <span>{f.label}</span>
              </div>
            ))}
          </div>

          <RecentChannels />

          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Or try these channels
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
              {FEATURED_CHANNELS.map((ch) => (
                <Link
                  key={ch.id}
                  href={`/channel/${ch.id}`}
                  className="group rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm p-4 text-center hover:bg-muted/50 hover:border-primary/30 transition-all"
                >
                  <p className="font-semibold group-hover:text-primary transition-colors">{ch.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ch.description}</p>
                </Link>
              ))}
            </div>
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
          <span className="mx-1.5">&middot;</span>
          <span className="text-muted-foreground/70">Results cached locally for 30 days</span>
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
