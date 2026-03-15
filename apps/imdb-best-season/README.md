# IMDb Best Season

A web application that ranks TV show seasons based on their episode ratings. Search for any series, see every season ranked from best to worst, and drill into individual episode scores -- all aggregated from OMDb and TMDB.

## Features

- **Search with autocomplete** -- type a show name and get instant suggestions from OMDb. The home page includes quick-access links to popular shows (Breaking Bad, The Wire, The Office) to get started immediately.

- **Season ranking** -- every season is ranked by its median episode rating. When TMDB data is available, each episode's rating is the average of its IMDb and TMDB scores, combining two independent audiences. The median (rather than mean) is used so a single bad episode doesn't tank an otherwise great season.

- **Episode-by-episode breakdown** -- click any season to open a dialog showing every episode with its title, IMDb link, and ratings from both sources. Episodes missing a TMDB score display a tooltip explaining the fallback to IMDb-only data.

- **Best season highlight** -- the top-ranked season is visually highlighted in the table so it's immediately obvious which season comes out on top.

- **Show metadata** -- alongside the rankings, the app displays the show's poster, title, plot summary, total season count, and aggregate ratings from IMDb, Rotten Tomatoes, and TMDB (when available).

- **Dark/light theme** -- toggle between themes with system preference detection.

- **Responsive layout** -- works on desktop, tablet, and mobile.

### How Ranking Works

Each season's score is the **median** of its episode ratings:

1. Fetch all episode ratings from OMDb (IMDb scores)
2. If TMDB is configured, fetch per-episode ratings from TMDB as well
3. For each episode, compute the average across available sources
4. Take the median of all episode averages within each season
5. Rank seasons from highest to lowest median

The median was chosen over the mean because TV seasons often have one or two outlier episodes (a weak finale, a bottle episode) that would disproportionately drag down an otherwise strong season. The median gives a more representative picture of the typical episode quality.

### Data Sources

**OMDb API** (required) -- the primary source. Provides show metadata (title, year, poster, plot, ratings), season structure, and per-episode IMDb ratings. Free tier allows 1,000 requests/day.

**TMDB API** (optional) -- when a TMDB API key is configured, the app searches for the show on TMDB, fetches per-episode ratings from their community, and averages them with IMDb scores. This dual-source approach smooths out biases inherent in any single rating platform.

Both sources are cached in-memory with a 24-hour TTL and a max of 1,000 entries. Search and suggestion endpoints are rate-limited (30 req/min for search, 60 req/min for suggestions) using the shared rate limiter from `@data-projects/shared`.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | shadcn/ui, Radix UI (Dialog, Tooltip) |
| Styling | Tailwind CSS with gold accent theme |
| Data Fetching | TanStack Query v5 |
| Tables | TanStack Table v8 (sorting, pagination) |
| Theme | next-themes (dark/light + system detection) |
| Testing | Playwright (E2E tests) |
| Analytics | PostHog |
| Fonts | Libre Baskerville (serif headings), JetBrains Mono (data) |

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/search/[title]` | Search for a show, fetch all seasons and episodes, compute rankings. Combines OMDb + TMDB data. Cached 24h, rate-limited 30 req/min |
| GET | `/api/suggest/[query]` | Autocomplete suggestions from OMDb series search. Cached 1h, rate-limited 60 req/min |

Both routes include CORS headers and input validation (title sanitization, length limits, allowed characters).

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
| `OMDB_API_KEY` | Yes | Get a free key at [omdbapi.com](https://www.omdbapi.com/apikey.aspx). Free tier: 1,000 req/day |
| `TMDB_API_KEY` | No | Get a key at [themoviedb.org](https://www.themoviedb.org/settings/api). When set, adds a second rating source for more robust rankings |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog project API key (client-side, write-only -- safe to expose) |

### Installation

From the monorepo root:

```bash
pnpm install
pnpm dev --filter imdb-best-season    # starts on port 3001
```

### Running Tests

Playwright E2E tests cover the home page, search flow, theme toggling, show results, and accessibility:

```bash
pnpm test           # run all E2E tests (headless Chromium)
pnpm test:headed    # run tests with browser visible
pnpm test:ui        # open Playwright's interactive UI mode
pnpm test:debug     # run tests with the Playwright inspector attached
pnpm test:report    # open the HTML test report
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                # Home (search input, suggestion links, theme toggle)
│   ├── layout.tsx              # Root layout (Libre Baskerville + JetBrains Mono, providers)
│   ├── [title]/page.tsx        # Show results (ShowInfo, SeasonsTable, loading/error states)
│   ├── not-found.tsx           # 404 page with navigation back to search
│   ├── globals.css             # Gold accent, gradient background, custom scrollbar
│   └── api/
│       ├── search/[title]/     # Show search + season ranking (OMDb + TMDB)
│       └── suggest/[query]/    # Autocomplete suggestions (OMDb)
├── components/
│   ├── show-header.tsx         # Navbar with logo, search autocomplete, theme toggle
│   ├── show-info.tsx           # Show poster, title, plot, IMDb/RT/TMDB ratings
│   ├── seasons-table.tsx       # Ranked seasons table (best season highlighted)
│   ├── episode-dialog.tsx      # Episode list dialog (IMDb + TMDB ratings, N/A tooltips)
│   ├── search-title.tsx        # Search autocomplete powered by OMDb suggestions
│   └── loading-skeleton.tsx    # Loading states (home skeleton, results skeleton)
├── services/
│   └── show.ts                 # API client (fetchShowSearch, fetchShowSuggestions)
├── hooks/
│   ├── use-show-search.ts      # TanStack Query hook for show data
│   └── use-show-suggestions.ts # Autocomplete suggestions hook (via createSuggestionsHook)
├── lib/
│   ├── cache.ts                # In-memory LRU cache (24h TTL, 1000 entries)
│   ├── validation.ts           # Title sanitization (max 200 chars, allowed characters)
│   └── rate-limit.ts           # Rate limiting config (search: 30/min, suggest: 60/min)
├── types/
│   └── omdb.ts                 # OMDb/TMDB type definitions (Show, RankedSeason, EpisodeRating, etc.)
└── e2e/
    └── home.spec.ts            # Playwright E2E tests (search, navigation, theme, a11y)
```

## Deployment

Configured for Vercel with `npx turbo-ignore` for smart builds -- only rebuilds when files in this app or its shared dependencies change. API routes include CORS headers (`Access-Control-Allow-Origin: *`) and `X-Content-Type-Options: nosniff`.

## License

[AGPL-3.0](../../LICENSE)
