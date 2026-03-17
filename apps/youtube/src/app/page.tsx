import { PulseDashboard } from "@/components/pulse/pulse-dashboard";
import { RecentChannels } from "@/components/recent-channels";
import { SearchChannel } from "@/components/search-channel";
import { LazyWebGLBackground as WebGLBackground } from "@/components/webgl-background-lazy";
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
    accent: "from-teal-500/20 to-emerald-500/20 dark:from-teal-500/10 dark:to-emerald-500/10",
    iconColor: "text-teal-600 dark:text-teal-400",
  },
  {
    icon: Sparkles,
    label: "AI-powered insights",
    description: "Ask natural language questions about any channel's video catalog",
    accent: "from-violet-500/20 to-purple-500/20 dark:from-violet-500/10 dark:to-purple-500/10",
    iconColor: "text-violet-600 dark:text-violet-400",
  },
  {
    icon: TrendingUp,
    label: "Engagement breakdown",
    description: "Rates, trends, and per-1K metrics for likes, comments, and views",
    accent: "from-amber-500/20 to-orange-500/20 dark:from-amber-500/10 dark:to-orange-500/10",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
];

const FEATURED_CHANNELS = [
  { id: "UC6nSFpj9HTCZ5t-N3Rm3-HA", name: "Vsauce", description: "Science & curiosity", emoji: "🧠" },
  { id: "UCHnyfMqiRRG1u-2MsSQLbXA", name: "Veritasium", description: "Science & engineering", emoji: "⚡" },
  { id: "UCYO_jab_esuFRV4b17AJtAw", name: "3Blue1Brown", description: "Math visualizations", emoji: "📐" },
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
      <WebGLBackground />
      <div className="fixed left-4 top-4 z-60">
        <ThemeToggle iconClassName="text-primary" />
      </div>

      {isSignedIn ? (
        <div className="relative z-10 flex-1 px-4 py-8 sm:py-12">
          <div className="w-full max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <YouTubeIcon className="h-7 w-7 text-foreground" />
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Channel Pulse</h1>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your YouTube intelligence feed
                </p>
              </div>
              <div className="w-full sm:w-80">
                <SearchChannel compact />
              </div>
            </div>

            <PulseDashboard />

            <div className="pt-4">
              <RecentChannels />
            </div>

            <div>
              <div className="flex items-center gap-3 justify-center mb-4">
                <div className="h-px w-12 bg-border/50" />
                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Explore channels
                </h2>
                <div className="h-px w-12 bg-border/50" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                {FEATURED_CHANNELS.map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/channel/${ch.id}`}
                    className="group rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 text-center hover:bg-muted/50 hover:border-primary/30 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                  >
                    <span className="text-2xl block mb-2">{ch.emoji}</span>
                    <p className="font-semibold group-hover:text-primary transition-colors">{ch.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ch.description}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-16 sm:py-20">
          <div className="w-full max-w-2xl space-y-12 text-center">
            <div className="space-y-5">
              <div className="animate-scale-in" style={{ animationDelay: "0ms" }}>
                <div className="flex justify-center">
                  <div className="relative">
                    <YouTubeIcon className="h-14 w-14 text-foreground relative z-10" />
                    <div className="absolute inset-0 blur-2xl bg-primary/15 rounded-full scale-150" />
                  </div>
                </div>
              </div>
              <div className="animate-fade-up space-y-4" style={{ animationDelay: "80ms" }}>
                <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1]">
                  Understand any
                  <br />
                  YouTube channel{" "}
                  <span className="text-gradient">
                    in seconds
                  </span>
                </h1>
                <p className="text-lg sm:text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
                  Analyze video performance, score content quality, and uncover hidden patterns with AI
                </p>
              </div>
            </div>

            <div className="animate-fade-up relative z-20" style={{ animationDelay: "160ms" }}>
              <div className="relative flex justify-center">
                <div className="w-full max-w-xl animate-pulse-glow rounded-2xl" style={{ animationDelay: "2000ms", animationIterationCount: 3 }}>
                  <SearchChannel />
                </div>
              </div>
              <p className="text-xs text-muted-foreground/60 mt-3">
                Paste a channel URL or search by name
              </p>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: "240ms" }}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl mx-auto">
                {FEATURES.map((f, i) => (
                  <div
                    key={f.label}
                    className="group noise rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 transition-all duration-300"
                    style={{ animationDelay: `${240 + i * 60}ms` }}
                  >
                    <div className={`inline-flex rounded-xl bg-linear-to-br ${f.accent} p-2.5 mb-3`}>
                      <f.icon className={`h-5 w-5 ${f.iconColor}`} />
                    </div>
                    <p className="font-semibold text-sm mb-1.5">{f.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: "320ms" }}>
              <RecentChannels />
            </div>

            <div className="animate-fade-up" style={{ animationDelay: "400ms" }}>
              <div className="space-y-4">
                <div className="flex items-center gap-3 justify-center">
                  <div className="h-px w-12 bg-border/50" />
                  <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Or try these channels
                  </h2>
                  <div className="h-px w-12 bg-border/50" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto">
                  {FEATURED_CHANNELS.map((ch) => (
                    <Link
                      key={ch.id}
                      href={`/channel/${ch.id}`}
                      className="group rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4 text-center hover:bg-muted/50 hover:border-primary/30 hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                    >
                      <span className="text-2xl block mb-2">{ch.emoji}</span>
                      <p className="font-semibold group-hover:text-primary transition-colors">{ch.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{ch.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: "480ms" }}>
              <Link
                href={`/compare?channels=${FEATURED_CHANNELS[0].id},${FEATURED_CHANNELS[1].id}`}
                className="group flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 max-w-lg mx-auto hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-linear-to-br from-blue-500/20 to-indigo-500/20 dark:from-blue-500/10 dark:to-indigo-500/10 p-2.5">
                    <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-sm group-hover:text-primary transition-colors">Compare Channels</p>
                    <p className="text-xs text-muted-foreground">Side-by-side channel metrics and performance</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            </div>
          </div>
        </div>
      )}

      <footer className="relative z-10 py-5 text-sm text-muted-foreground border-t border-border/20 backdrop-blur-sm">
        <p className="text-center text-xs">
          Powered by{" "}
          <a
            href="https://developers.google.com/youtube/v3"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary/80 hover:text-primary hover:underline transition-colors"
          >
            YouTube Data API
          </a>
          <span className="mx-2 text-border">&middot;</span>
          <span className="text-muted-foreground/50">Transcripts stored server-side</span>
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
