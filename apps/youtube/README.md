# YouTube Analyzer

A full-stack web application for deep YouTube channel analysis. Sync an entire channel's video catalog into a database, score every video with a multi-dimensional algorithm, explore AI-detected narrative arcs ("sagas"), compare channels side-by-side, and chat with an AI assistant that has full context about any channel's data.

**Live at [youtube.joaog.space](https://youtube.joaog.space)**

## Features

### Channel Dashboard

A 5-tab interface for exploring any YouTube channel:

- **Overview** -- subscriber count, total views, upload cadence, score distribution, top performers
- **Videos** -- sortable, filterable table of every video with scores, views, likes, comments, engagement rates
- **Timeline** -- chronological view of uploads with performance trends over time
- **Sagas** -- groups of related videos organized into narrative arcs (from playlists, AI detection, or manual curation)
- **Discover** -- AI-generated insights: starter pack, evolution timeline, channel DNA, rabbit hole recommendations

### Video Scoring

Every video is scored on a 0-100 scale using five weighted components:

| Component | What it measures |
|-----------|-----------------|
| Reach | Raw view count relative to channel size |
| Engagement | Like rate, comment rate, and combined engagement rate |
| Momentum | Views per day, accounting for video age |
| Efficiency | Views per minute of content (engagement density) |
| Community | Comment-to-view ratio and discussion depth |

Scores are computed using sigmoid normalization with duration-aware bucketing (short/medium/long videos are compared within their own class). The final score is a power mean of the five components.

### Sync Pipeline

Videos, transcripts, and sagas are synced from the YouTube Data API through a multi-step pipeline:

1. **Video sync** -- fetches all uploads via the channel's uploads playlist, paginating through the API
2. **Transcript sync** -- pulls auto-generated or manual transcripts for each video
3. **Saga sync** -- imports playlists and runs AI detection to group videos into narrative arcs

Each step runs as an Inngest background job with real-time progress streamed to the client via SSE. Sync jobs are tracked in the database with status, progress, and logs.

### AI Features

Powered by the Vercel AI SDK with Google Gemini 2.0 Flash or Groq Llama 3.1 as providers:

- **AI Chat (Cmd+J)** -- streaming multi-turn conversation with full channel context (video stats, scores, transcripts). Ask questions like "what's this channel's most underrated video?" or "summarize the gaming saga"
- **Saga Detection** -- AI analyzes video titles, descriptions, and timestamps to identify recurring series and narrative arcs
- **Topic Extraction** -- automatic topic tagging for videos based on content
- **Discover Features:**
  - *Starter Pack* -- the essential videos for a new viewer
  - *Evolution Timeline* -- how the channel's content has changed over time
  - *Channel DNA* -- what makes this channel unique
  - *Rabbit Hole* -- deep-dive viewing paths through related content

### Channel Comparison

Compare 2-5 channels side-by-side across metrics like average score, engagement rate, upload cadence, and total views. Comparisons can be shared via expiring snapshot links.

### Shareable Reports

Generate shareable report links for any channel analysis. Reports capture a snapshot of the channel's data at the time of creation and expire after a set period.

### Authentication & User Management

Google OAuth with YouTube readonly scope. Users have daily sync quotas based on their plan (free/pro/enterprise). Saved channels persist across sessions with labels and pinning.

### Admin Dashboard

Protected admin interface for monitoring system health:

- Database statistics (channels, videos, transcripts, sagas)
- Active and historical sync jobs with log inspection
- Bulk operations and cleanup tools
- Saga correction tracking

### Additional UX

- **Command palette (Cmd+K)** for quick navigation
- **Context rail sidebar** for switching between dashboard tabs
- **WebGL animated background** on the home page
- **Dark/light theme** with system preference detection
- **PostHog analytics** for usage tracking

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Next.js App Router                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │  Pages   │  │API Routes│  │  React Server       │ │
│  │  (SSR)   │  │  (42+)   │  │  Components         │ │
│  └──────────┘  └────┬─────┘  └────────────────────┘ │
│                     │                                │
│  ┌──────────────────┼────────────────────────────┐   │
│  │                  ▼                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐  │   │
│  │  │ Drizzle  │  │ AI SDK   │  │  Inngest   │  │   │
│  │  │   ORM    │  │(Gemini/  │  │ (bg jobs)  │  │   │
│  │  │          │  │  Groq)   │  │            │  │   │
│  │  └────┬─────┘  └──────────┘  └────────────┘  │   │
│  │       │            Server-side libraries      │   │
│  └───────┼───────────────────────────────────────┘   │
│          │                                           │
└──────────┼───────────────────────────────────────────┘
           │
    ┌──────▼──────┐    ┌──────────────┐    ┌───────────┐
    │ Neon Postgres│    │ YouTube Data │    │  Google   │
    │  (13 tables) │    │    API v3    │    │  OAuth    │
    └─────────────┘    └──────────────┘    └───────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React Compiler) |
| Language | TypeScript 5 |
| Database | Neon Postgres, Drizzle ORM |
| Auth | NextAuth v5, Google OAuth |
| AI | Vercel AI SDK, Google Gemini 2.0 Flash, Groq Llama 3.1 |
| Background Jobs | Inngest |
| Styling | Tailwind CSS 4 |
| UI | shadcn/ui, Radix UI, Lucide icons |
| Data | TanStack Query, TanStack Table |
| 3D | React Three Fiber, Three.js |
| Testing | Vitest, @vitest/coverage-v8 |
| Analytics | PostHog |
| Logging | Pino |
| Validation | Zod |
| Deployment | Vercel |

## Database Schema

13 tables managed by Drizzle ORM:

| Table | Purpose |
|-------|---------|
| `channels` | Channel metadata (title, subscribers, views, description, country) |
| `videos` | Video data with scores, score components, engagement rates, topics |
| `transcripts` | Full-text transcripts with excerpts and language info |
| `sagas` | Video groupings (playlist-based, AI-detected, or manual) with reasoning and summaries |
| `sync_jobs` | Sync pipeline tracking (status, progress, logs, errors) |
| `saga_corrections` | User corrections to saga assignments |
| `shared_reports` | Shareable channel report snapshots |
| `shared_comparisons` | Shareable multi-channel comparison snapshots |
| `comments` | Video comments with author info and like counts |
| `channel_snapshots` | Historical subscriber/view/video count snapshots |
| `saved_channels` | Per-user saved channels with labels and pinning |
| `suggestion_cache` | Cached channel search suggestions |
| `users` | User accounts with plan tiers and sync quotas |

## Environment Variables

Create a `.env.local` file (see `.env.example`):

```env
# Required
POSTGRES_URL=postgresql://...
AUTH_SECRET=your_nextauth_secret
AUTH_GOOGLE_ID=your_google_oauth_client_id
AUTH_GOOGLE_SECRET=your_google_oauth_client_secret
YOUTUBE_API_KEY=your_youtube_data_api_key

# Optional
ALLOWED_EMAILS=user@example.com,admin@example.com
GROQ_API_KEY=your_groq_api_key
GOOGLE_AI_API_KEY=your_google_ai_api_key
SYNC_SECRET=your_sync_secret
CRON_SECRET=your_cron_secret
NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key
LOG_LEVEL=debug
```

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_URL` | Yes | Neon Postgres connection string |
| `AUTH_SECRET` | Yes | NextAuth encryption secret |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth client ID (from [Cloud Console](https://console.cloud.google.com/)) |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth client secret |
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key |
| `ALLOWED_EMAILS` | No | Comma-separated allowlist for sign-in |
| `GROQ_API_KEY` | No | Groq API key for AI features |
| `GOOGLE_AI_API_KEY` | No | Google AI (Gemini) API key for AI features |
| `SYNC_SECRET` | No | Secret for programmatic sync triggers |
| `CRON_SECRET` | No | Bearer token for Vercel cron cleanup |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog project key (client-side, write-only) |
| `LOG_LEVEL` | No | Pino log level (default: `info` in prod, `debug` in dev) |

## Scripts

```bash
pnpm dev             # start dev server on port 3003 (Turbopack)
pnpm build           # production build
pnpm start           # start production server
pnpm lint            # run ESLint
pnpm typecheck       # run TypeScript type checking

pnpm test            # run Vitest tests
pnpm test:watch      # run tests in watch mode
pnpm test:coverage   # run tests with coverage report

pnpm db:push         # push schema changes to database
pnpm db:generate     # generate Drizzle migrations
pnpm db:migrate      # run pending migrations
pnpm db:studio       # open Drizzle Studio (DB browser)
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                        # Home (search, featured channels, compare CTA)
│   ├── layout.tsx                      # Root layout (fonts, providers, metadata)
│   ├── channel/[channelId]/            # Channel dashboard (5-tab interface)
│   ├── compare/                        # Multi-channel comparison
│   ├── report/[reportId]/              # Shared report viewer
│   ├── admin/                          # Admin dashboard
│   ├── signin/                         # Sign-in page
│   └── api/
│       ├── ai/query/                   # AI chat endpoint (streaming)
│       ├── youtube/                     # YouTube API proxies (search, channel, stats)
│       ├── sync/                        # Sync pipeline (start, status, stream, cancel)
│       ├── sagas/                       # Saga CRUD and playlist sync
│       ├── discover/                    # AI-powered discover features
│       ├── transcripts/                 # Transcript retrieval and search
│       ├── comments/                    # Video comments
│       ├── compare/                     # Comparison data and sharing
│       ├── share/                       # Report sharing
│       ├── admin/                       # Admin operations
│       ├── inngest/                     # Inngest webhook handler
│       └── cron/cleanup/               # Scheduled cleanup (Vercel cron)
├── components/
│   ├── channel-dashboard.tsx           # Main dashboard orchestrator
│   ├── channel-header.tsx              # Channel info header
│   ├── channel-overview.tsx            # Overview tab
│   ├── videos-table/                   # Videos tab (filterable, sortable)
│   ├── timeline-view.tsx               # Timeline tab
│   ├── sagas-view.tsx                  # Sagas tab
│   ├── discover-view.tsx               # Discover tab (AI features)
│   ├── ai-query-chat.tsx               # AI chat drawer (Cmd+J)
│   ├── command-palette.tsx             # Command palette (Cmd+K)
│   ├── context-rail.tsx                # Sidebar navigation
│   ├── sync-status-bar.tsx             # Real-time sync progress
│   ├── search-channel.tsx              # Channel search autocomplete
│   ├── score-ring.tsx                  # Visual score indicator
│   └── webgl-background.tsx            # Animated 3D background
├── db/
│   ├── index.ts                        # Drizzle client (Neon serverless)
│   └── schema.ts                       # All 13 table definitions
├── lib/
│   ├── scoring.ts                      # 5-component scoring algorithm
│   ├── youtube-server.ts               # YouTube Data API wrapper
│   ├── ai-providers.ts                 # Gemini / Groq provider config
│   ├── ai-query.ts                     # AI chat system prompt and context
│   ├── saga-ai.ts                      # AI saga detection logic
│   ├── auth.ts                         # NextAuth configuration
│   ├── env.ts                          # Zod-validated environment variables
│   ├── sync-videos.ts                  # Video sync implementation
│   ├── sync-transcripts.ts             # Transcript sync implementation
│   ├── sync-sagas.ts                   # Saga sync implementation
│   ├── inngest/                        # Inngest client and functions
│   ├── rate-limit.ts                   # Rate limiting
│   └── route-handler.ts               # API route wrapper (auth, errors, logging)
└── types/                              # TypeScript type definitions
```

## Deployment

Deployed on Vercel with:

- **Cron job** running every 6 hours to clean up stale sync jobs
- **Security headers** including CSP, HSTS, X-Frame-Options, Referrer-Policy
- **CORS** locked to `youtube.joaog.space`
- **Inngest** connected via webhook at `/api/inngest`

## License

[AGPL-3.0](../../LICENSE)
