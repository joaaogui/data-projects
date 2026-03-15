# Spotify Popularity

A web app that shows every track an artist has ever released on Spotify, ranked by popularity score. Unlike Spotify's own interface (which only surfaces the top 10), this app traverses the full album catalog and lets you listen to 30-second previews right from the table.

## Features

- **Full catalog search** -- search for any artist with autocomplete suggestions that show artist images and genres. The home page includes quick-access links to get started (KATSEYE, Dj Xablau, Red Hot Chili Peppers).

- **Every track ranked** -- the app fetches all albums (albums, singles, compilations), pulls every track, deduplicates across releases (e.g. remastered versions, deluxe editions), and sorts by Spotify's internal popularity score (0-100). This can surface hundreds of tracks that Spotify's own UI would never show you.

- **30-second audio previews** -- each track has a play button on its album cover art. Clicking it streams a 30-second preview from the Deezer API. If the track isn't found on Deezer, it falls back silently. An `AudioPlayerProvider` context manages playback globally -- playing a new track automatically pauses the previous one.

- **Track name cleaning** -- to improve Deezer match accuracy, the app strips parenthetical notes ("Remastered 2023"), brackets ("[Deluxe Edition]"), and other noise from track names before searching. Artist names are also simplified (first name before commas or ampersands).

- **Album cover art** -- each row shows the album cover with a play/pause overlay that animates on hover and during playback.

- **Dark/light theme** -- Spotify-inspired green accent in both modes, with system preference detection and manual toggle.

- **Sortable, paginated table** -- 25 tracks per page with columns for rank (#), cover art, track name (with album and explicit badge), release year, and popularity score. All columns are sortable.

- **Fully responsive** -- works on desktop, tablet, and mobile with adaptive column visibility.

### How It Works

The app uses the Spotify Web API with the **client credentials flow** (no user login needed):

1. **Search** -- find the artist by name via Spotify's search endpoint
2. **Albums** -- fetch all albums (paginated) across album types: albums, singles, and compilations
3. **Batch album details** -- fetch full album objects in batches of 20 (Spotify's API limit) to get track listings
4. **Track aggregation** -- collect all tracks across all albums, deduplicate by name (case-insensitive, ignoring remaster suffixes), and keep the version with the highest popularity
5. **Sort** -- rank all tracks by Spotify's popularity metric (0-100, updated frequently by Spotify based on recent plays)

**Token management** -- the app caches the OAuth access token in memory and automatically refreshes it when it expires. Token expiry is tracked with a buffer to avoid edge-case failures.

**Deezer previews** -- since Spotify's own preview URLs are frequently null or unavailable in many regions, the app uses the Deezer Search API as a fallback. Preview URLs are cached for 7 days to minimize Deezer API calls.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | shadcn/ui, Radix UI |
| Styling | Tailwind CSS with Spotify green accent |
| Data Fetching | TanStack Query v5 |
| Tables | TanStack Table v8 (sorting, pagination) |
| APIs | Spotify Web API (client credentials), Deezer Search API |
| Theme | next-themes (dark/light + system detection) |
| Analytics | PostHog |
| Fonts | Geist Sans, Geist Mono |

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/artist/[name]` | Search for an artist and return all tracks sorted by popularity. Fetches full album catalog, deduplicates tracks, and sorts. Cached 1h (`s-maxage`), 2h stale-while-revalidate. Rate-limited 30 req/min |
| GET | `/api/suggest/[query]` | Artist search suggestions (up to 8 results with images and genres). Cached 1h in-memory (1000 entries). Rate-limited 60 req/min |
| GET | `/api/preview?track=...&artist=...` | Fetch 30-second preview URL from Deezer. Cleans track name and simplifies artist name for better matching. Cached 7 days (`s-maxage`). Returns `{ preview: string \| null }` |

All routes include input validation, error handling, rate limiting (from `@data-projects/shared`), and CORS headers.

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm 9.15+ (monorepo root)
- A [Spotify Developer](https://developer.spotify.com/dashboard) account (free)

### Environment Variables

Create a `.env.local` file (see `.env.example`):

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key  # optional, analytics
```

| Variable | Required | Description |
|----------|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Yes | Client ID from [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Create an app, no redirect URI needed (client credentials flow) |
| `SPOTIFY_CLIENT_SECRET` | Yes | Client secret from the same Spotify app |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog project API key (client-side, write-only -- safe to expose) |

### Installation

From the monorepo root:

```bash
pnpm install
pnpm dev --filter spotify-popularity    # starts on port 3002
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home (search, suggestion links, theme toggle)
│   ├── layout.tsx                  # Root layout (Geist fonts, providers, AudioPlayerProvider)
│   ├── artist/[name]/page.tsx      # Artist page (header + tracks table, loading/error states)
│   ├── globals.css                 # Spotify green accent, glow effects, table hover animations
│   └── api/
│       ├── artist/[name]/          # Full track catalog endpoint (Spotify API)
│       ├── suggest/[query]/        # Artist search suggestions (Spotify API)
│       └── preview/                # 30-second preview URL (Deezer API)
├── components/
│   ├── artist-header.tsx           # Artist image, name, Spotify link, track count, genres
│   ├── search-artist.tsx           # Search autocomplete (with artist images and genre tags)
│   ├── track-cover.tsx             # Album art with play/pause overlay and Deezer preview
│   ├── audio-player-provider.tsx   # Global audio playback context (play/pause/toggle)
│   ├── logo.tsx                    # App logo (Music2 icon + "Spotify Popularity")
│   ├── spotify-attribution.tsx     # "Data from Spotify" attribution link
│   └── tracks-table/
│       ├── index.tsx               # Table wrapper
│       ├── columns.tsx             # Column definitions (#, cover, track, year, popularity)
│       ├── data-table.tsx          # DataTable with pagination (25 per page)
│       └── loading.tsx             # Skeleton loading rows
├── services/
│   ├── artist.ts                   # API client (fetchArtistTracks, fetchArtistSuggestions)
│   └── preview.ts                  # Deezer preview fetcher
├── hooks/
│   ├── use-artist-tracks.ts        # TanStack Query hook for artist data
│   ├── use-artist-suggestions.ts   # Autocomplete suggestions hook (via createSuggestionsHook)
│   └── use-track-preview.ts        # Deezer preview hook (7-day stale time)
└── lib/
    ├── spotify/
    │   ├── api.ts                  # Spotify API functions (searchArtist, getArtistAlbums, getSeveralAlbums, getTracks, getArtistTopTracks)
    │   ├── auth.ts                 # Client credentials flow with token caching and auto-refresh
    │   └── types.ts                # Spotify type definitions (SpotifyArtist, SpotifyTrack, SpotifyAlbum, etc.)
    ├── validation.ts               # Artist name validation and sanitization
    └── rate-limit.ts               # Rate limiting config (artist: 30/min, suggest: 60/min)
```

## Deployment

Configured for Vercel with `npx turbo-ignore` for smart builds -- only rebuilds when files in this app or its shared dependencies change. API routes include CORS headers (`Access-Control-Allow-Origin: *`) and `X-Content-Type-Options: nosniff`.

## License

[AGPL-3.0](../../LICENSE)
