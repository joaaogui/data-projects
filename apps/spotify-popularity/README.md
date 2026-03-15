# Spotify Popularity

A web app that shows every track an artist has ever released on Spotify, ranked by popularity score. Includes 30-second audio previews powered by Deezer, so you can listen while you browse.

## Features

- Search for any Spotify artist with autocomplete (images and genres in suggestions)
- Full album catalog traversal -- surfaces every track, not just top 10
- Tracks ranked by Spotify's popularity score (0-100)
- 30-second audio previews via Deezer with built-in play/pause controls
- Album cover art with playback indicator
- Dark/light theme with Spotify-inspired green accent
- Sortable, paginated table (25 tracks per page)
- Fully responsive layout

### How It Works

The app uses the Spotify Web API (client credentials flow) to:

1. Search for the artist
2. Fetch all albums (albums, singles, compilations)
3. Fetch all tracks across every album
4. Deduplicate tracks and sort by Spotify's popularity metric

Audio previews come from the Deezer API as a fallback source, since Spotify's own preview URLs are not always available. Track names are cleaned (removing "Remastered", parenthetical notes, etc.) to improve Deezer match accuracy.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | shadcn/ui, Radix UI |
| Styling | Tailwind CSS |
| Data Fetching | TanStack Query |
| Tables | TanStack Table |
| APIs | Spotify Web API, Deezer Search API |
| Theme | next-themes |
| Analytics | PostHog |
| Fonts | Geist Sans, Geist Mono |

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm 9.15+ (monorepo root)
- A [Spotify Developer](https://developer.spotify.com/dashboard) account

### Environment Variables

Create a `.env.local` file (see `.env.example`):

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key  # optional, analytics
```

| Variable | Required | Description |
|----------|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Yes | From [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) |
| `SPOTIFY_CLIENT_SECRET` | Yes | From [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog project key (client-side, write-only) |

### Installation

From the monorepo root:

```bash
pnpm install
pnpm dev --filter spotify-popularity
```

Or from this directory:

```bash
pnpm dev    # starts on port 3002
```

## API Routes

| Endpoint | Description |
|----------|-------------|
| `GET /api/artist/[name]` | Search artist and return all tracks sorted by popularity. Cached 1h (s-maxage), rate-limited 30 req/min |
| `GET /api/suggest/[query]` | Artist search suggestions (up to 8). Cached 1h in-memory, rate-limited 60 req/min |
| `GET /api/preview?track=...&artist=...` | Fetch 30-second preview URL from Deezer. Cached 7 days |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home (search, suggestion links, theme toggle)
│   ├── layout.tsx                  # Root layout (Geist fonts, providers, audio context)
│   ├── artist/[name]/page.tsx      # Artist page (header, tracks table)
│   ├── globals.css                 # Global styles (Spotify green accent)
│   └── api/
│       ├── artist/[name]/          # Artist + full track catalog
│       ├── suggest/[query]/        # Autocomplete suggestions
│       └── preview/                # Deezer audio preview lookup
├── components/
│   ├── artist-header.tsx           # Artist image, name, Spotify link, genres
│   ├── search-artist.tsx           # Search autocomplete (with artist images)
│   ├── track-cover.tsx             # Album art with play/pause overlay
│   ├── audio-player-provider.tsx   # Global audio playback context
│   ├── logo.tsx                    # App logo
│   ├── spotify-attribution.tsx     # "Data from Spotify" attribution
│   └── tracks-table/
│       ├── index.tsx               # Table wrapper
│       ├── columns.tsx             # Column definitions (#, cover, track, year, popularity)
│       ├── data-table.tsx          # DataTable with pagination
│       └── loading.tsx             # Skeleton loading state
├── services/
│   ├── artist.ts                   # API client (fetchArtistTracks, fetchArtistSuggestions)
│   └── preview.ts                  # Deezer preview fetcher
├── hooks/
│   ├── use-artist-tracks.ts        # TanStack Query hook for artist data
│   ├── use-artist-suggestions.ts   # Autocomplete suggestions hook
│   └── use-track-preview.ts        # Deezer preview hook (7-day stale time)
└── lib/
    ├── spotify/
    │   ├── api.ts                  # Spotify API functions (search, albums, tracks)
    │   ├── auth.ts                 # Client credentials flow with token caching
    │   └── types.ts                # Spotify type definitions
    ├── validation.ts               # Artist name validation
    └── rate-limit.ts               # Rate limiting config
```

## Deployment

Configured for Vercel with `npx turbo-ignore` for smart builds. API routes include CORS headers for cross-origin access.

## License

[AGPL-3.0](../../LICENSE)
