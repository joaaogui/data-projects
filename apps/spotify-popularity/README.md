# Spotify Popularity

A modern web app that shows the most popular tracks of any artist on Spotify.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![TanStack Query](https://img.shields.io/badge/TanStack_Query-5-red)
![TanStack Table](https://img.shields.io/badge/TanStack_Table-8-orange)
![shadcn/ui](https://img.shields.io/badge/shadcn%2Fui-latest-black)

## Features

- 🔍 Search for any artist on Spotify
- 📊 View all tracks ranked by popularity score
- 🎨 Beautiful dark theme with Spotify-inspired design
- 📱 Fully responsive design
- ⚡ Fast and efficient with TanStack Query caching
- 📋 Sortable, paginated table with TanStack Table

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Data Fetching:** TanStack Query
- **Tables:** TanStack Table
- **API:** Spotify Web API

## Getting Started

### Prerequisites

- Node.js 18+ 
- A Spotify Developer account

### Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/spotify-popularity.git
cd spotify-popularity
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file with your credentials (see `.env.example`):

```env
SPOTIFY_CLIENT_ID=your_client_id_here
SPOTIFY_CLIENT_SECRET=your_client_secret_here
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
```

#### API Keys

- **SPOTIFY_CLIENT_ID** & **SPOTIFY_CLIENT_SECRET** (server-side): Get your credentials at [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). ⚠️ Keep secret secure!
- **NEXT_PUBLIC_POSTHOG_KEY** (client-side): Optional. For analytics. PostHog keys are safe to expose publicly as they are write-only.

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── artist/        # Artist endpoint
│   ├── artist/[name]/     # Artist page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── tracks-table/      # TanStack Table implementation
│   ├── artist-header.tsx  # Artist info display
│   ├── logo.tsx           # App logo
│   ├── providers.tsx      # React Query provider
│   └── search-artist.tsx  # Search input component
├── hooks/
│   └── use-artist-tracks.ts  # React Query hook
└── lib/
    ├── spotify/           # Spotify API layer
    │   ├── api.ts         # API functions
    │   ├── auth.ts        # Token management
    │   └── types.ts       # TypeScript types
    └── utils.ts           # Utility functions
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## License

[AGPL-3.0](../../LICENSE)
