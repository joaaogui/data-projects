# IMDb Best Season

A web application that ranks TV show seasons based on their IMDb episode ratings. Find out which season of your favorite show is the best!

## Features

- 🔍 Search for any TV series by name
- 📊 View all seasons ranked by average IMDb rating
- ⭐ See episode-by-episode ratings for each season
- 🌓 Dark/Light theme toggle
- 📱 Fully responsive design

## Tech Stack

- **Framework:** Next.js 15.1 (App Router)
- **Language:** TypeScript
- **UI Components:** shadcn/ui + Radix UI
- **Styling:** Tailwind CSS
- **Data Fetching:** TanStack Query
- **Tables:** TanStack Table
- **Theme:** next-themes
- **Dev Server:** Turbopack

## Getting Started

### Prerequisites

- Node.js 22 (see `.nvmrc`)
- npm or yarn

### Environment Variables

Create a `.env.local` file in the root directory (see `.env.example`):

```env
OMDB_API_KEY=your_omdb_api_key
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
```

#### API Keys

- **OMDB_API_KEY** (server-side): Get your free API key at [OMDb API](https://www.omdbapi.com/apikey.aspx). Free tier allows 1,000 requests/day.
- **NEXT_PUBLIC_POSTHOG_KEY** (client-side): Optional. For analytics. PostHog keys are safe to expose publicly as they are write-only.

### Installation

```bash
# Install dependencies
npm install

# Run development server with Turbopack
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Deployment

This project is configured for deployment on Vercel:

1. Push your code to GitHub
2. Import the project in Vercel
3. Add the `OMDB_API_KEY` environment variable
4. Deploy!

The `.nvmrc` file ensures Node.js 22 is used during build.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   └── search/        # Search endpoint
│   ├── [title]/           # Dynamic show page
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── ...               # Feature components
├── lib/                   # Utilities
└── types/                 # TypeScript types
```

## License

[AGPL-3.0](../../LICENSE)
