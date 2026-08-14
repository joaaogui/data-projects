import { PulseDashboard } from "@/components/pulse/pulse-dashboard";
import { RecentChannels } from "@/components/recent-channels";
import { SearchChannel } from "@/components/search-channel";
import { YouTubeIcon } from "@/components/youtube-icon";
import { auth } from "@/lib/auth";
import { ThemeToggle } from "@data-projects/ui";
import { ArrowRight, BarChart3, Sparkles, TrendingUp } from "lucide-react";
import Link from "next/link";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://youtube.joaog.space";

const JSON_LD_WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "YouTube Analyzer",
  url: SITE_URL,
  description:
    "Free tool to analyze YouTube channel statistics, video performance metrics, views, and engagement.",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/channel/search/{search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

const JSON_LD_APP = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "YouTube Analyzer",
  url: SITE_URL,
  applicationCategory: "AnalyticsTool",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  description:
    "Analyze video performance, score content quality, and uncover hidden patterns with AI.",
  featureList: [
    "Channel-relative video scoring",
    "AI-powered natural language insights",
    "Engagement rate breakdown and trends",
    "Video timeline visualization",
    "Saga and series detection",
  ],
};

const FEATURES = [
  {
    icon: BarChart3,
    label: "Score every video",
    description: "Channel-relative scoring across reach, engagement, momentum, efficiency, and community",
  },
  {
    icon: Sparkles,
    label: "AI-powered insights",
    description: "Ask natural language questions about any channel's video catalog",
  },
  {
    icon: TrendingUp,
    label: "Engagement breakdown",
    description: "Rates, trends, and per-1K metrics for likes, comments, and views",
  },
];

const FEATURED_CHANNELS = [
  { id: "UC6nSFpj9HTCZ5t-N3Rm3-HA", name: "Vsauce", description: "Science & curiosity" },
  { id: "UCHnyfMqiRRG1u-2MsSQLbXA", name: "Veritasium", description: "Science & engineering" },
  { id: "UCYO_jab_esuFRV4b17AJtAw", name: "3Blue1Brown", description: "Math visualizations" },
];

export default async function HomePage() {
  const session = await auth();
  const isSignedIn = !!session?.user;

  return (
    <main className="min-h-screen flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_WEBSITE) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD_APP) }}
      />
      <div className="fixed left-4 top-4 z-60">
        <ThemeToggle iconClassName="text-muted-foreground" />
      </div>

      {isSignedIn ? (
        <div className="relative z-10 flex-1 px-6 py-10">
          <div className="mx-auto w-full max-w-5xl space-y-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                <YouTubeIcon className="h-6 w-6 text-foreground" />
                <h1 className="text-xl font-medium tracking-tight">Channel Pulse</h1>
              </div>
              <div className="w-full sm:w-80">
                <SearchChannel compact />
              </div>
            </div>

            <PulseDashboard />

            <RecentChannels />

            <div className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Explore channels
              </h2>
              <div className="divide-y divide-border border-y border-border">
                {FEATURED_CHANNELS.map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/channel/${ch.id}`}
                    className="group flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ch.name}</p>
                      <p className="text-xs text-muted-foreground">{ch.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex-1 px-6 py-20 sm:py-28">
          <div className="mx-auto w-full max-w-3xl space-y-16">
            <div className="animate-fade-up space-y-5">
              <YouTubeIcon className="h-9 w-9 text-foreground" />
              <h1 className="max-w-2xl text-4xl font-medium leading-[1.1] tracking-tight sm:text-5xl">
                Understand any YouTube channel in seconds
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
                Analyze video performance, score content quality, and uncover
                hidden patterns with AI.
              </p>
            </div>

            <div className="animate-fade-up relative z-20 space-y-2" style={{ animationDelay: "60ms" }}>
              <SearchChannel />
              <p className="text-xs text-muted-foreground">
                Paste a channel URL or search by name
              </p>
            </div>

            <div className="animate-fade-up grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3" style={{ animationDelay: "120ms" }}>
              {FEATURES.map((f) => (
                <div key={f.label} className="bg-background p-5">
                  <f.icon className="mb-3 h-4 w-4 text-muted-foreground" />
                  <p className="mb-1.5 text-sm font-medium">{f.label}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {f.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="animate-fade-up" style={{ animationDelay: "180ms" }}>
              <RecentChannels />
            </div>

            <div className="animate-fade-up space-y-3" style={{ animationDelay: "240ms" }}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Try these channels
              </h2>
              <div className="divide-y divide-border border-y border-border">
                {FEATURED_CHANNELS.map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/channel/${ch.id}`}
                    className="group flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{ch.name}</p>
                      <p className="text-xs text-muted-foreground">{ch.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                ))}
                <Link
                  href={`/compare?channels=${FEATURED_CHANNELS[0].id},${FEATURED_CHANNELS[1].id}`}
                  className="group flex items-center justify-between gap-4 py-3.5 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Compare channels</p>
                    <p className="text-xs text-muted-foreground">
                      Side-by-side metrics and performance
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="relative z-10 border-t border-border py-5 text-sm text-muted-foreground">
        <p className="text-center text-xs">
          Powered by{" "}
          <a
            href="https://developers.google.com/youtube/v3"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            YouTube Data API
          </a>
          <span className="mx-2 text-border">&middot;</span>
          <span>Transcripts stored server-side</span>
        </p>
        <a
          href="https://github.com/joaaogui/data-projects"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
          aria-label="View source on GitHub"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
        </a>
      </footer>
    </main>
  );
}
