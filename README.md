# Data Projects

A monorepo of web apps that turn entertainment APIs into interactive dashboards -- analyze YouTube channels, rank TV show seasons, and explore Spotify artist catalogs.

Built with Next.js 16, TypeScript, and a shared component library. Each app connects to a different public API (YouTube, OMDb/TMDB, Spotify, Deezer) and presents the data through searchable, sortable, and themeable interfaces.

## Apps

### [YouTube Analyzer](apps/youtube) -- [youtube.joaog.space](https://youtube.joaog.space)

The most complete app in this repo. A full-stack platform for deep YouTube channel analysis.

Sync an entire channel's video catalog into a Neon Postgres database, then explore it through a 5-tab dashboard: **Overview** (KPIs, score distribution, top performers), **Videos** (filterable table with engagement rates), **Timeline** (chronological trends), **Sagas** (AI-detected narrative arcs grouping related uploads), and **Discover** (AI-generated starter packs, evolution timelines, channel DNA profiles).

Every video gets a 0-100 score computed from five weighted components -- reach, engagement, momentum, efficiency, and community -- using sigmoid normalization and duration-aware bucketing so short and long videos are compared fairly.

The sync pipeline runs as Inngest background jobs with real-time SSE progress streaming. An AI chat drawer (Cmd+J) lets you ask natural language questions with full channel context. Channels can be compared side-by-side (2-5 at once), and reports can be shared via expiring snapshot links.

**Stack:** Neon Postgres, Drizzle ORM, NextAuth (Google OAuth), Inngest, Vercel AI SDK (Gemini 2.0 Flash / Groq), React Three Fiber, Vitest, PostHog.

[Full documentation -->](apps/youtube/README.md)

---

### [IMDb Best Season](apps/imdb-best-season)

Find out which season of any TV series is the best.

Search for a show and the app fetches every episode's rating from OMDb and (optionally) TMDB, computes each season's median score, and presents a ranked table from best to worst. Click any season to see the episode-by-episode breakdown with IMDb links and dual-source ratings. The median-based ranking reduces the impact of single outlier episodes on a season's overall standing.

Both data sources are cached in-memory (24h TTL) and rate-limited. The app includes Playwright E2E tests covering search, navigation, theme toggling, and accessibility.

**Stack:** OMDb API, TMDB API (optional), Playwright, PostHog. Libre Baskerville + JetBrains Mono typography with a gold accent theme.

[Full documentation -->](apps/imdb-best-season/README.md)

---

### [Spotify Popularity](apps/spotify-popularity)

See every track an artist has ever released on Spotify, ranked by popularity score.

Unlike Spotify's own interface (which only shows the top 10), this app traverses the artist's full album catalog -- albums, singles, compilations -- deduplicates tracks, and ranks them all by Spotify's internal popularity metric (0-100). Each track has a 30-second audio preview powered by the Deezer API, with a built-in play/pause player that works directly from the table.

**Stack:** Spotify Web API (client credentials flow), Deezer Search API, PostHog. Geist typography with Spotify's green accent.

[Full documentation -->](apps/spotify-popularity/README.md)

---

## Tech Stack

All three apps share the same core stack through the monorepo's shared packages. The YouTube app extends it significantly with database, auth, AI, and background job infrastructure.

| Layer | Technology | Used by |
|-------|-----------|---------|
| Monorepo | Turborepo + pnpm workspaces | All |
| Framework | Next.js 16 (App Router, Turbopack) | All |
| Language | TypeScript 5 | All |
| Styling | Tailwind CSS + CSS variables theming | All |
| UI Components | shadcn/ui + Radix UI + Lucide icons | All |
| Data Fetching | TanStack Query v5 | All |
| Tables | TanStack Table v8 | All |
| Theme | next-themes (dark/light + system) | All |
| Analytics | PostHog | All |
| Deployment | Vercel | All |
| Database | Neon Postgres + Drizzle ORM | YouTube |
| Auth | NextAuth v5 + Google OAuth | YouTube |
| AI | Vercel AI SDK, Google Gemini 2.0 Flash, Groq Llama 3.1 | YouTube |
| Background Jobs | Inngest (sync pipeline, scheduled cleanup) | YouTube |
| 3D Graphics | React Three Fiber + Three.js | YouTube |
| Unit Tests | Vitest + @vitest/coverage-v8 | YouTube |
| E2E Tests | Playwright | IMDb |

## Shared Packages

Three internal packages keep the apps consistent and reduce duplication:

### `@data-projects/shared`

Utilities and hooks shared across all apps:

- `cn()` -- class name utility (clsx + tailwind-merge)
- `createCache()` -- in-memory LRU cache with TTL, max size, and hit/miss stats
- `checkRateLimit()` / `createRateLimitConfig()` -- per-IP rate limiting with sliding windows
- `apiFetch()` / `ApiError` -- fetch wrapper with structured error handling
- `corsHeaders` / `optionsResponse` / `withRateLimitHeaders` -- HTTP response helpers
- `createSuggestionsHook()` -- factory for building TanStack Query-based autocomplete hooks
- `createValidator()` / `getSafeErrorMessage()` -- input validation and safe error extraction

### `@data-projects/ui`

Shared React component library:

- **Layout:** Navbar, Providers (QueryClient + ThemeProvider + PostHog)
- **Data:** DataTable (TanStack Table wrapper with sorting, filtering, pagination, expandable rows, sticky headers)
- **Forms:** SearchAutocomplete (debounced search with keyboard navigation and custom renderers), SuggestionLinks
- **Primitives:** Button (7 variants), Card, Input, Dialog, Tooltip, Popover, Skeleton
- **Theme:** ThemeToggle (light/dark with MutationObserver sync), ThemeProvider
- **Analytics:** PostHogProvider (auto page-view tracking)

### `@data-projects/tailwind-config`

Shared Tailwind preset providing:

- CSS variable-based color system (background, foreground, primary, secondary, muted, accent, destructive, border, input, ring)
- Dark mode via `class` strategy
- Border radius tokens (sm, md, lg from `--radius`)
- Custom keyframes and animations (fade-in, scale-in, shimmer, accordion-down/up)
- `tailwindcss-animate` plugin

Each app extends this preset and defines the CSS variables in its own `globals.css` to create its unique visual identity (gold for IMDb, Spotify green, teal/violet for YouTube).

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9.15+

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev                              # run all apps simultaneously
pnpm dev --filter youtube-analyzer    # YouTube only (port 3003)
pnpm dev --filter imdb-best-season    # IMDb only (port 3001)
pnpm dev --filter spotify-popularity  # Spotify only (port 3002)
```

### Build & Lint

```bash
pnpm build      # build all apps (Turborepo-orchestrated)
pnpm lint       # lint all apps and packages
pnpm clean      # remove .next, dist, and node_modules
```

### Environment Variables

Each app requires its own `.env.local`. See the individual READMEs for the full list:

- [YouTube Analyzer](apps/youtube/README.md#environment-variables) -- 12 variables (5 required)
- [IMDb Best Season](apps/imdb-best-season/README.md#environment-variables) -- 3 variables (1 required)
- [Spotify Popularity](apps/spotify-popularity/README.md#environment-variables) -- 3 variables (2 required)

## Project Structure

```
data-projects/
├── apps/
│   ├── youtube/              # YouTube channel analyzer       (port 3003)
│   │   ├── src/app/          #   42+ API routes, 6 pages
│   │   ├── src/components/   #   30+ React components
│   │   ├── src/db/           #   Drizzle schema (13 tables)
│   │   └── src/lib/          #   Scoring, sync, AI, auth
│   ├── imdb-best-season/     # TV show season ranker          (port 3001)
│   │   ├── src/app/          #   2 API routes, 2 pages
│   │   ├── src/components/   #   6 React components
│   │   └── e2e/              #   Playwright E2E tests
│   └── spotify-popularity/   # Spotify track explorer         (port 3002)
│       ├── src/app/          #   3 API routes, 2 pages
│       ├── src/components/   #   8 React components
│       └── src/lib/spotify/  #   Spotify API + auth layer
├── packages/
│   ├── shared/               # Utilities, hooks, API helpers
│   ├── ui/                   # Shared component library
│   └── tailwind-config/      # Shared design tokens + preset
├── turbo.json                # Turborepo task pipeline
├── pnpm-workspace.yaml       # Workspace configuration
└── package.json              # Root scripts (dev, build, lint, clean)
```

## License

[AGPL-3.0](LICENSE)
