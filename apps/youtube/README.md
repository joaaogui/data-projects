# YouTube Analyzer

A modern web application to analyze YouTube channel statistics and video performance.

## Tech Stack

- **Framework:** Next.js 15.1 (App Router)
- **UI:** React 18, shadcn/ui components
- **Styling:** Tailwind CSS with dark/light theme (next-themes)
- **Data Fetching:** TanStack Query
- **Tables:** TanStack Table
- **Language:** TypeScript
- **Dev Server:** Turbopack

## Getting Started

### Prerequisites

- Node.js 22+ (see `.nvmrc`)

### Installation

```bash
# Remove old dependencies if migrating
rm -rf node_modules .next

# Install dependencies
npm install

# Run development server with Turbopack
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Environment Variables

Create a `.env.local` file based on `.env.example`:

```env
YOUTUBE_API_KEY=your_youtube_api_key_here
GROQ_API_KEY=your_groq_api_key_here
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
```

#### API Keys

- **YOUTUBE_API_KEY** (server-side): Get from [Google Cloud Console](https://console.cloud.google.com/). ⚠️ Keep secret!
- **GROQ_API_KEY** (server-side): Optional. For AI features using Groq. ⚠️ Keep secret!
- **GOOGLE_AI_API_KEY** (server-side): Optional. For AI features using Google AI. ⚠️ Keep secret!
- **NEXT_PUBLIC_POSTHOG_KEY** (client-side): Optional. For analytics. PostHog keys are safe to expose publicly as they are write-only.

## Features

- 🔍 Search YouTube channels by name
- 📊 View video statistics (views, likes, comments, favorites)
- 📈 Custom scoring algorithm for video performance
- 🌗 Dark/Light theme toggle
- 📱 Responsive design
- ⚡ Fast data loading with caching
- 📋 Sortable and paginated data tables

## Scripts

```bash
npm run dev      # Start dev server with Turbopack
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Deployment

This project is configured for Vercel deployment with Node.js 22 support.

## License

[AGPL-3.0](../../LICENSE)
