# Data Projects

A monorepo of web apps that turn entertainment APIs into interactive dashboards -- analyze YouTube channels, rank TV show seasons, and explore Spotify artist catalogs.

## Apps

### [YouTube Analyzer](apps/youtube) -- [youtube.joaog.space](https://youtube.joaog.space)

The most complete app in this repo. A full-stack platform for deep YouTube channel analysis: sync entire video catalogs into a Postgres database, score every video with a 5-component algorithm, explore AI-generated "sagas" (narrative arcs across uploads), compare channels side-by-side, and chat with an AI assistant that has full context about any channel's data.

**Highlights:** Neon Postgres + Drizzle ORM, Google OAuth, Inngest background jobs, AI chat (Gemini / Groq), real-time sync via SSE, shareable reports, admin dashboard.

[Read more →](apps/youtube/README.md)

### [IMDb Best Season](apps/imdb-best-season)

Find out which season of any TV series is the best. Aggregates episode-level ratings from OMDb and TMDB, ranks seasons by median score, and lets you drill into individual episode ratings.

**Highlights:** Dual data sources (OMDb + TMDB), Playwright E2E tests, in-memory caching.

[Read more →](apps/imdb-best-season/README.md)

### [Spotify Popularity](apps/spotify-popularity)

See every track an artist has ever released, ranked by Spotify's popularity score. Includes 30-second Deezer previews with a built-in audio player.

**Highlights:** Spotify Web API + Deezer previews, in-app audio playback, full album catalog traversal.

[Read more →](apps/spotify-popularity/README.md)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| UI Components | shadcn/ui + Radix UI |
| Data Fetching | TanStack Query |
| Tables | TanStack Table |
| Database | Neon Postgres + Drizzle ORM (YouTube) |
| Auth | NextAuth + Google OAuth (YouTube) |
| AI | Vercel AI SDK, Google Gemini, Groq (YouTube) |
| Background Jobs | Inngest (YouTube) |
| Testing | Vitest (YouTube), Playwright (IMDb) |
| Analytics | PostHog |
| Deployment | Vercel |

## Shared Packages

| Package | What it provides |
|---------|-----------------|
| `@data-projects/shared` | `cn` utility, in-memory cache, rate limiting, CORS helpers, API fetch wrapper, validation, `createSuggestionsHook` factory |
| `@data-projects/ui` | DataTable, SearchAutocomplete, Navbar, Button, Card, Dialog, Tooltip, ThemeToggle, Providers (QueryClient + PostHog + theme) |
| `@data-projects/tailwind-config` | Shared design tokens, CSS variable-based theming, keyframes and animations |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9.15+

### Installation

```bash
pnpm install

pnpm dev        # run all apps in development mode
pnpm build      # build all apps
pnpm lint       # lint all apps
```

Each app requires its own environment variables. See the individual READMEs for details:

- [YouTube Analyzer](apps/youtube/README.md#environment-variables)
- [IMDb Best Season](apps/imdb-best-season/README.md#environment-variables)
- [Spotify Popularity](apps/spotify-popularity/README.md#environment-variables)

## Project Structure

```
├── apps/
│   ├── youtube/              # YouTube channel analyzer (port 3003)
│   ├── imdb-best-season/     # TV show season ranker (port 3001)
│   └── spotify-popularity/   # Spotify track explorer (port 3002)
├── packages/
│   ├── shared/               # Shared utilities, hooks, and API helpers
│   ├── ui/                   # Shared UI component library
│   └── tailwind-config/      # Shared Tailwind preset and design tokens
├── turbo.json                # Turborepo task pipeline
└── pnpm-workspace.yaml       # Workspace configuration
```

## License

[AGPL-3.0](LICENSE)
