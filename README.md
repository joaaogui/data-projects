# Data Projects

A monorepo of web apps that turn entertainment and gaming APIs into interactive dashboards -- analyze YouTube channels, rank TV show seasons, explore Spotify artist catalogs, dissect a decade of Last.fm listening, optimize Clash Royale decks, and coach Brawl Stars account progression.

Built with Next.js 16, TypeScript, and shared workspace packages. Each app connects to a public or game API (YouTube, OMDb/TMDB, Spotify, Deezer, Last.fm, Clash Royale, Brawl Stars) and pairs deterministic domain metrics with searchable, sortable, or AI-assisted interfaces.

## Apps

### [YouTube Analyzer](apps/youtube) -- [youtube.joaog.space](https://youtube.joaog.space)

The most complete app in this repo. A full-stack platform for deep YouTube channel analysis.

Sync an entire channel's video catalog into a Neon Postgres database, then explore it through a 5-tab dashboard: **Overview** (KPIs, score distribution, top performers), **Videos** (filterable table with engagement rates), **Timeline** (chronological trends), **Sagas** (AI-detected narrative arcs grouping related uploads), and **Discover** (AI-generated starter packs, evolution timelines, channel DNA profiles).

Every video gets a 0-100 score computed from five weighted components -- reach, engagement, momentum, efficiency, and community -- using sigmoid normalization and duration-aware bucketing so short and long videos are compared fairly.

The sync pipeline runs as Inngest background jobs with real-time SSE progress streaming. An AI chat drawer (Cmd+J) lets you ask natural language questions with full channel context. Channels can be compared side-by-side (2-5 at once), and reports can be shared via expiring snapshot links.

**Stack:** Neon Postgres, Drizzle ORM, NextAuth (Google OAuth), Inngest, Vercel AI SDK (Gemini 2.0 Flash / Groq), React Three Fiber, Vitest, PostHog.

[Full documentation -->](apps/youtube/README.md)

---

### [IMDb Best Season](apps/imdb-best-season) -- [imdb.joaog.space](https://imdb.joaog.space)

Find out which season of any TV series is the best.

Search for a show and the app fetches every episode's rating from OMDb and (optionally) TMDB, computes each season's median score, and presents a ranked table from best to worst. Click any season to see the episode-by-episode breakdown with IMDb links and dual-source ratings. The median-based ranking reduces the impact of single outlier episodes on a season's overall standing.

Both data sources are cached in-memory (24h TTL) and rate-limited. The app includes Playwright E2E tests covering search, navigation, theme toggling, and accessibility.

**Stack:** OMDb API, TMDB API (optional), Playwright, Vitest, PostHog. Libre Baskerville + JetBrains Mono typography with a gold accent theme.

[Full documentation -->](apps/imdb-best-season/README.md)

---

### [Listening Habits](apps/lastfm) -- [lastfm.joaog.space](https://lastfm.joaog.space)

Deep analysis of a Last.fm scrobble history -- the questions Last.fm's own charts cannot answer.

Last.fm's aggregate endpoints only tell you what you played most. This app imports the entire play-by-play record (225k scrobbles across a decade) into Postgres, then computes things that need the raw stream: an hour-by-weekday heatmap, a per-day calendar going back to the first scrobble, listening sessions detected from gaps between plays, and consecutive-day streaks.

The more interesting half is behavioural. Every artist is classified by how they moved through rotation -- **companion**, **phase**, **abandoned**, **recent**, or **casual** -- from their active span and how much of their listening collapsed into a single month. Alongside that: discovery rate over time, comeback detection (a long silence followed by a return that stuck), year-over-year rank movement, one-hit wonders, and concentration measured as both top-10 share and normalised Shannon entropy.

The import is one resumable mechanism for both the initial backfill and ongoing syncs. It pins its upper bound so page numbers stay stable mid-run, works in bounded chunks that save a cursor, and leans on a unique index so a retried page is harmless.

**Stack:** Last.fm API, Neon Postgres, Drizzle ORM, recharts, TanStack Table, Vitest. Tables live in a dedicated `lastfm` Postgres schema so the database can be shared safely.

[Full documentation -->](apps/lastfm/README.md)

---

### [Spotify Popularity](apps/spotify-popularity) -- [spotify.joaog.space](https://spotify.joaog.space)

See every track an artist has ever released on Spotify, ranked by popularity score.

Unlike Spotify's own interface (which only shows the top 10), this app traverses the artist's full album catalog -- albums, singles, compilations -- deduplicates tracks, and ranks them all by Spotify's internal popularity metric (0-100). Each track has a 30-second audio preview powered by the Deezer API, with a built-in play/pause player that works directly from the table.

**Stack:** Spotify Web API (client credentials flow), Deezer Search API, Vitest, PostHog. Geist typography with Spotify's green accent.

[Full documentation -->](apps/spotify-popularity/README.md)

---

### [Clash Deck Advisor](apps/clash-deck-advisor) -- [clash.joaog.space](https://clash.joaog.space)

Personal Clash Royale deck workshop and collection-aware advisor for player `#VGURQ0QQ2`.

Evaluates either the active 8-card deck (**Improve current deck** mode, recommending targeted swaps that preserve the deck's archetype) or the full card collection (**Best from collection** mode, assembling the strongest legal deck the account can field). Candidate decks are generated across configured AI providers, validated against 2026 special-slot rules (0-2 Evolutions, 0-2 Champions, at most 3 special slots total) and owned cards, scored deterministically across a 123-card role and mechanics knowledge base, and hill-climbed over the collection before an AI explanation pass summarizes matchups, replay notes from recent losses, and level-impact warnings.

Includes one-click "Open in Clash Royale" deep links, a 30-minute server-side analysis cache, and a rate-limited manual refresh.

**Stack:** Clash Royale API (`proxy.royaleapi.dev`), Vercel AI SDK (Google Gemini 3.5 Flash Lite / 3.6 Flash, Groq `openai/gpt-oss-120b`), Zod 4, Vitest. Fraunces + Manrope typography in a "Royal Workshop" aesthetic.

---

### [Brawl Account Coach](apps/brawl-account-coach) -- [brawl.joaog.space](https://brawl.joaog.space)

Personal Brawl Stars progression dossier and account coach for player `#Y0GLCU0GL`.

Fetches the live player profile, full brawler roster, brawler catalog, and recent battle log through the RoyaleAPI proxy, then computes deterministic account metrics: roster unlock coverage, P1-P11 power distribution, peak trophy retention, under-pushed high-power brawlers, and recent win/loss trends by mode. An AI coaching pass with multi-provider fallback produces an account health score, up to 5 upgrade priorities, trophy-push targets, recommended builds strictly cross-checked against owned gadgets, Star Powers, gears, and Hypercharges, battle log diagnosis, low-value investments to avoid, and a three-step next-session action plan.

**Stack:** Brawl Stars API (`bsproxy.royaleapi.dev`), Vercel AI SDK (Google Gemini 3.5 Flash Lite / 3.6 Flash, Groq `openai/gpt-oss-120b`), Zod 4, Vitest. Bungee + Nunito Sans typography in an arcade-dossier aesthetic.

---

## Tech Stack

The four catalog and analytics apps (`youtube`, `imdb-best-season`, `spotify-popularity`, `lastfm`) share UI primitives and utilities through the monorepo's workspace packages, while `clash-deck-advisor` and `brawl-account-coach` are standalone Next.js 16 apps with server-only game API and AI coaching pipelines.

| Layer | Technology | Used by |
|-------|-----------|---------|
| Monorepo | Turborepo + pnpm workspaces | All |
| Framework | Next.js 16 (App Router, Turbopack) | All |
| Language | TypeScript 5 | All |
| Styling | Tailwind CSS + CSS variables theming | All |
| UI Components | shadcn/ui + Radix UI + Lucide icons | YouTube, IMDb, Spotify, Listening Habits |
| Data Fetching | TanStack Query v5 | YouTube, IMDb, Spotify, Listening Habits |
| Tables | TanStack Table v9 | YouTube, IMDb, Spotify, Listening Habits |
| Theme | next-themes (dark/light + system) | YouTube, IMDb, Spotify, Listening Habits |
| Analytics | PostHog | YouTube, IMDb, Spotify |
| Deployment | Vercel | All |
| Database | Neon Postgres + Drizzle ORM | YouTube, Listening Habits |
| Charts | recharts (heatmaps hand-rolled as CSS grids) | Listening Habits |
| Auth | NextAuth v5 + Google OAuth | YouTube |
| AI | Vercel AI SDK, Google Gemini, Groq | YouTube, Clash Deck Advisor, Brawl Account Coach |
| Background Jobs | Inngest (sync pipeline, scheduled cleanup) | YouTube |
| 3D Graphics | React Three Fiber + Three.js | YouTube |
| Unit Tests | Vitest | All |
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
pnpm dev --filter lastfm-habits       # Listening Habits only (port 3004)
pnpm dev --filter clash-deck-advisor  # Clash Deck Advisor only (port 3012)
pnpm dev --filter brawl-account-coach # Brawl Account Coach only (port 3013)
```

### Build, Lint & Test

```bash
pnpm build      # build all apps (Turborepo-orchestrated)
pnpm lint       # lint all apps and packages
pnpm typecheck  # type-check all apps and packages
pnpm test       # run Vitest unit tests across all apps and packages
pnpm clean      # remove .next, dist, and node_modules
```

### Environment Variables

Each app requires its own `.env.local`. See the individual READMEs and `.env.example` files for the full list:

- [YouTube Analyzer](apps/youtube/README.md#environment-variables) -- 12+ variables (5 required)
- [IMDb Best Season](apps/imdb-best-season/README.md#environment-variables) -- 3 variables (1 required)
- [Spotify Popularity](apps/spotify-popularity/README.md#environment-variables) -- 3 variables (2 required)
- [Listening Habits](apps/lastfm/README.md#environment) -- 6 variables (4 required)
- [Clash Deck Advisor](apps/clash-deck-advisor/.env.example) -- 3 variables (`CLASH_ROYALE_API_KEY` required, plus `GOOGLE_GENERATIVE_AI_API_KEY` and/or `GROQ_API_KEY`)
- [Brawl Account Coach](apps/brawl-account-coach/.env.example) -- 3 variables (`BRAWL_STARS_API_KEY` required, plus `GOOGLE_GENERATIVE_AI_API_KEY` and/or `GROQ_API_KEY`)

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
│   ├── spotify-popularity/   # Spotify track explorer         (port 3002)
│   │   ├── src/app/          #   3 API routes, 2 pages
│   │   ├── src/components/   #   8 React components
│   │   └── src/lib/spotify/  #   Spotify API + auth layer
│   ├── lastfm/               # Last.fm listening analysis     (port 3004)
│   │   ├── src/app/          #   7 API routes, 7 pages
│   │   ├── src/components/   #   charts and dashboard UI
│   │   └── src/lib/analytics/ #  temporal and behavioural analysis
│   ├── clash-deck-advisor/   # Clash Royale deck workshop     (port 3012)
│   │   ├── src/app/          #   2 API routes, 1 page
│   │   ├── src/components/   #   8 React components
│   │   └── src/lib/          #   Archetype engine, scoring, AI, validation
│   └── brawl-account-coach/  # Brawl Stars account coach      (port 3013)
│       ├── src/app/          #   2 API routes, 1 page
│       ├── src/components/   #   7 React components
│       └── src/lib/          #   Account metrics, AI coaching, validation
├── packages/
│   ├── shared/               # Utilities, hooks, API helpers
│   ├── ui/                   # Shared component library
│   └── tailwind-config/      # Shared design tokens + preset
├── turbo.json                # Turborepo task pipeline
├── pnpm-workspace.yaml       # Workspace configuration
└── package.json              # Root scripts (dev, build, lint, test, typecheck, clean)
```

## License

[AGPL-3.0](LICENSE)
