# IMDb Best Season

A web application that ranks TV show seasons based on their episode ratings. Search for any series, see every season ranked from best to worst, and drill into individual episode scores -- all aggregated from OMDb and TMDB.

## Features

- Search for any TV series with autocomplete suggestions
- Seasons ranked by median episode rating (combining IMDb and TMDB scores when available)
- Episode-by-episode breakdown with IMDb links and dual-source ratings
- Best season highlighted in the results table
- Dark/light theme with system preference detection
- Fully responsive layout

### How Ranking Works

Each season's score is the **median** of its episode ratings. When TMDB data is available, episode ratings are averaged across both sources for more robust results. The median (rather than mean) reduces the impact of outlier episodes on a season's ranking.

### Data Sources

- **OMDb API** (required) -- primary source for show metadata, season info, and IMDb episode ratings
- **TMDB API** (optional) -- when configured, adds per-episode ratings as a second data point, improving accuracy

Both sources are cached in-memory (24h TTL, up to 1000 entries) and rate-limited (30 req/min for search, 60 req/min for suggestions).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | shadcn/ui, Radix UI |
| Styling | Tailwind CSS |
| Data Fetching | TanStack Query |
| Tables | TanStack Table |
| Theme | next-themes |
| Testing | Playwright (E2E) |
| Analytics | PostHog |
| Fonts | Libre Baskerville, JetBrains Mono |

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm 9.15+ (monorepo root)

### Environment Variables

Create a `.env.local` file (see `.env.example`):

```env
OMDB_API_KEY=your_omdb_api_key
TMDB_API_KEY=your_tmdb_api_key          # optional, improves episode ratings
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key # optional, analytics
```

| Variable | Required | Description |
|----------|----------|-------------|
| `OMDB_API_KEY` | Yes | Get a free key at [omdbapi.com](https://www.omdbapi.com/apikey.aspx) (1,000 req/day) |
| `TMDB_API_KEY` | No | Get a key at [themoviedb.org](https://www.themoviedb.org/settings/api). Adds a second rating source |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog project key (client-side, write-only) |

### Installation

From the monorepo root:

```bash
pnpm install
pnpm dev --filter imdb-best-season
```

Or from this directory:

```bash
pnpm dev    # starts on port 3001
```

### Running Tests

```bash
pnpm test           # run Playwright E2E tests (headless)
pnpm test:headed    # run tests with browser visible
pnpm test:ui        # open Playwright UI mode
pnpm test:debug     # run tests with Playwright inspector
pnpm test:report    # view test report
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                # Home (search, suggestion links, theme toggle)
│   ├── layout.tsx              # Root layout (fonts, providers, metadata)
│   ├── [title]/page.tsx        # Show results (header, info, seasons table)
│   ├── not-found.tsx           # 404 page
│   ├── globals.css             # Global styles (gold accent, gradient bg)
│   └── api/
│       ├── search/[title]/     # Show search + season ranking (OMDb + TMDB)
│       └── suggest/[query]/    # Autocomplete suggestions (OMDb)
├── components/
│   ├── show-header.tsx         # Navbar with logo, search, theme toggle
│   ├── show-info.tsx           # Poster, title, plot, multi-source ratings
│   ├── seasons-table.tsx       # Ranked seasons table (best season highlighted)
│   ├── episode-dialog.tsx      # Episode list dialog with dual ratings
│   ├── search-title.tsx        # Search autocomplete
│   └── loading-skeleton.tsx    # Loading states
├── services/
│   └── show.ts                 # API client (fetchShowSearch, fetchShowSuggestions)
├── hooks/
│   ├── use-show-search.ts      # TanStack Query hook for show data
│   └── use-show-suggestions.ts # Autocomplete suggestions hook
├── lib/
│   ├── cache.ts                # In-memory cache (24h TTL, 1000 entries)
│   ├── validation.ts           # Title sanitization and validation
│   └── rate-limit.ts           # Rate limiting config
├── types/
│   └── omdb.ts                 # OMDb/TMDB type definitions
└── e2e/
    └── home.spec.ts            # Playwright E2E tests
```

## Deployment

Configured for Vercel with `npx turbo-ignore` for smart builds. API routes include CORS headers for cross-origin access.

## License

[AGPL-3.0](../../LICENSE)
