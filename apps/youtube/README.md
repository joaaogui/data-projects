# YouTube Analyzer

A full-stack web application for deep YouTube channel analysis. Sync an entire channel's video catalog into a database, score every video with a multi-dimensional algorithm, explore AI-detected narrative arcs ("sagas"), compare channels side-by-side, and chat with an AI assistant that has full context about any channel's data.

**Live at [youtube.joaog.space](https://youtube.joaog.space)**

## Features

### Channel Dashboard

Search for any YouTube channel by name or URL and land on a 5-tab dashboard:

**Overview** -- high-level KPIs (subscriber count, total views, upload cadence) alongside a score distribution chart, a top performers section, and trend indicators comparing recent activity to the channel's baseline.

**Videos** -- every video in a sortable, filterable table. Columns include title, publish date, views, likes, comments, engagement rate (per 1K views), and the computed 0-100 score. Supports text search, quick filters (e.g. "hidden gems" for low-view high-score videos), and expandable rows for video detail panels with descriptions, topics, and transcript excerpts.

**Timeline** -- a chronological view of all uploads. Visualizes publishing frequency and performance trends over time, making it easy to spot bursts of activity, shifts in content strategy, or periods where engagement changed.

**Sagas** -- groups of related videos organized into narrative arcs. Sagas are sourced from three places: YouTube playlists (auto-imported), AI detection (analyzing titles, descriptions, and timestamps for patterns), or manual curation (dragging videos between groups). Each saga card shows its date range, video count, and an AI-generated summary. Uncategorized videos are listed separately so you can assign them to existing sagas or create new ones. All corrections are tracked in a saga corrections table for admin review.

**Discover** -- AI-generated insights that go beyond raw numbers:
- *Starter Pack* -- five essential videos for a new viewer, categorized as signature, best, hidden gem, recent hit, and classic
- *Hidden Gems* -- high-engagement videos that flew under the radar (computed client-side using median-based outlier detection)
- *Viral Moments* -- breakout videos with unusually high view counts or atypical topics
- *Channel Trivia* -- fun facts (longest video, most commented, earliest upload, biggest like ratio, etc.)
- *Evolution Timeline* -- AI-generated eras showing how the channel's content evolved over time
- *Channel DNA* -- an AI personality profile built from transcript analysis
- *Rabbit Hole* -- AI-identified related creators mentioned in descriptions and transcripts
- *Similar Videos* -- client-side Jaccard similarity across topic tags

### Video Scoring

Every video is scored on a 0-100 scale using five weighted components:

| Component | Weight | What it measures |
|-----------|--------|-----------------|
| Reach | 30% | View count on a log scale, relative to the channel's own distribution |
| Engagement | 25% | Like rate + comment rate (per 1K views), with comments weighted 5x over likes |
| Momentum | 20% | Views per day adjusted for video age, with a confidence factor using sqrt(days) |
| Efficiency | 15% | Engagement per minute of content, so a 5-minute video with 10K views scores differently than a 45-minute one |
| Community | 10% | Comment-to-view ratio and overall discussion depth |

Scores are computed using sigmoid normalization with configurable midpoints and steepness. Videos are bucketed by duration (short/medium/long) so they are compared within their own class. The final score is a **power mean** (p=0.5) of the five components, which balances between arithmetic and geometric means to reward videos that perform well across all dimensions rather than spiking in just one.

**Score labels:**
- 70+ Excellent -- "Exceptional performance across all dimensions"
- 55+ Very Good -- "Above average, strong audience engagement"
- 40+ Good -- "Solid performance within expectations"
- 25+ Fair -- "Below average, room for improvement"
- 0+ Low -- "Needs attention, low engagement"

The algorithm also computes derived rates stored alongside each video: `likeRate`, `commentRate`, `engagementRate` (per 1K views), `viewsPerDay`, `viewsPerHour`, `viewsPerContentMin`, and `engagementPerMinute`.

### Sync Pipeline

Videos, transcripts, and sagas are synced from the YouTube Data API through a multi-step pipeline:

1. **Video sync** -- fetches all uploads via the channel's uploads playlist, paginating through the YouTube Data API. For each video, it pulls metadata (title, description, publish date, duration) and statistics (views, likes, comments, favorites), then computes scores using the channel's own distribution as the baseline.

2. **Transcript sync** -- pulls auto-generated or manual transcripts for each video using the YouTube transcript API. Stores full text, an excerpt, and language info.

3. **Saga sync** -- imports the channel's playlists, maps playlist videos to the synced catalog, then runs AI analysis to detect additional narrative arcs that aren't captured by playlists.

Each step runs as an **Inngest background job** with concurrency limits (max 3 simultaneous syncs) and retry policies (2 retries on failure). Progress is tracked in the `sync_jobs` table and streamed to the client in real-time via **Server-Sent Events** (SSE). The UI shows a sync status bar with live progress, and users can cancel running jobs.

A **scheduled cleanup job** runs every 6 hours (via Vercel cron + Inngest) to mark stale running jobs as failed and purge old completed/failed job records.

### AI Features

Powered by the Vercel AI SDK with Google Gemini 2.0 Flash or Groq Llama 3.1 8B as providers:

**AI Chat (Cmd+J)** -- a streaming chat drawer that can answer natural language questions about any synced channel. The system prompt includes the channel's video catalog (titles, scores, views, engagement rates) and transcript excerpts, compressed to fit within token limits. Supports multi-turn conversations. Examples: "what's this channel's most underrated video?", "summarize the gaming saga", "which videos have the highest engagement per minute?".

**Saga Detection** -- AI analyzes video titles, descriptions, and publish dates to identify recurring series and narrative arcs that aren't captured by YouTube playlists. Each suggested saga includes reasoning and per-video evidence explaining why it was grouped.

**Topic Extraction** -- automatic topic tagging for videos based on title and description analysis.

**Discover AI Features** -- the Starter Pack, Evolution Timeline, Channel DNA, and Rabbit Hole features all use AI to generate structured insights from the channel's data (see Discover tab above).

### Channel Comparison

Compare 2-5 channels side-by-side. The comparison view shows each channel's thumbnail, subscriber count, video count, total views, average score, average engagement rate, and top-performing video. Comparisons can be shared via snapshot links that capture the data at creation time and expire automatically.

### Shareable Reports & Comparisons

Generate shareable links for both individual channel reports and multi-channel comparisons. Reports snapshot the key metrics (video count, total views, average score, average engagement, score distribution, top performers, upload cadence) at the time of creation. Shared links have expiration dates and don't require authentication to view.

### Authentication & User Management

Google OAuth with YouTube readonly scope, configured through NextAuth v5. Users can be restricted via an email allowlist (`ALLOWED_EMAILS`). Each user has:

- A **plan** tier (free/pro/enterprise) with configurable daily sync quotas
- **Saved channels** that persist across sessions, with custom labels and pinning
- **Sync usage tracking** with automatic daily resets

### Admin Dashboard

A protected admin interface for monitoring and managing the system:

- **Stats** -- total counts for channels, videos, transcripts, sagas, users, and sync jobs
- **Sync Jobs** -- list of all jobs with status, progress, and expandable log rows
- **Cleanup** -- one-click cleanup for transcripts, sagas, suggestion cache, and stale jobs
- **Bulk Operations** -- batch sync videos/transcripts across multiple channels
- **Saga Corrections** -- review user corrections to AI-detected saga assignments

### Additional UX

- **Command palette (Cmd+K)** -- quick navigation to any channel, tab, or action
- **Context rail sidebar** -- persistent sidebar for switching between dashboard tabs
- **First sync flow** -- guided onboarding when visiting an un-synced channel
- **WebGL animated background** -- Three.js particle effect on the home page (lazy-loaded)
- **Dark/light theme** -- system preference detection with manual toggle
- **SEO** -- dynamic Open Graph metadata, JSON-LD structured data (WebSite + WebApplication schemas), sitemap, robots.txt
- **Error boundaries** -- graceful error handling with recovery options
- **PostHog analytics** -- page views and custom event tracking

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Next.js App Router                      │
│                                                            │
│  ┌──────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │  6 Pages │  │ 42 API      │  │  React Server         │  │
│  │  (SSR)   │  │ Routes      │  │  Components           │  │
│  └──────────┘  └──────┬──────┘  └──────────────────────┘  │
│                       │                                    │
│  ┌────────────────────┼──────────────────────────────┐     │
│  │                    ▼         Server-side           │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │     │
│  │  │ Drizzle  │  │ AI SDK   │  │     Inngest      │ │     │
│  │  │   ORM    │  │(Gemini/  │  │  (background     │ │     │
│  │  │          │  │  Groq)   │  │    jobs)         │ │     │
│  │  └────┬─────┘  └──────────┘  └──────────────────┘ │     │
│  └───────┼───────────────────────────────────────────┘     │
│          │                                                  │
└──────────┼──────────────────────────────────────────────────┘
           │
   ┌───────▼───────┐  ┌───────────────┐  ┌────────────┐
   │ Neon Postgres  │  │ YouTube Data  │  │  Google    │
   │  (13 tables)   │  │   API v3      │  │  OAuth     │
   └───────────────┘  └───────────────┘  └────────────┘
```

## API Routes

42 API routes organized by domain:

### YouTube Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/youtube/search/[query]` | Search YouTube channels by name |
| GET | `/api/youtube/suggest/[query]` | Channel search suggestions (cached in DB) |
| GET | `/api/youtube/channel/[channelId]` | Paginated video list for a channel |
| GET | `/api/youtube/channel/[channelId]/stats` | Channel aggregate stats (views, likes, counts) |
| GET | `/api/youtube/info/[channelId]` | Channel metadata (title, thumbnail, description) |
| GET | `/api/youtube/playlists/[channelId]` | Channel playlists with video IDs |
| POST | `/api/youtube/account/[channelId]` | Authenticated user data (liked videos, subscriptions) |

### Sync Pipeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sync/channel/[channelId]` | Start video sync job |
| POST | `/api/sync/transcripts/[channelId]` | Start transcript sync job |
| POST | `/api/sync/sagas/[channelId]` | Start saga sync job |
| GET | `/api/sync/status/[jobId]` | Get sync job status and progress |
| GET | `/api/sync/stream/[jobId]` | SSE stream of sync progress |
| GET | `/api/sync/active/[channelId]` | Active sync jobs for a channel |
| POST | `/api/sync/cancel/[jobId]` | Cancel a running sync job |

### AI & Discover

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/query` | Streaming AI chat with channel context |
| POST | `/api/youtube/sagas/suggest` | AI-suggested sagas for a channel |
| POST | `/api/youtube/sagas/analyze` | AI batch analysis for saga detection |
| POST | `/api/discover/starter-pack/[channelId]` | AI starter pack (5 key videos) |
| POST | `/api/discover/evolution/[channelId]` | AI evolution timeline (content eras) |
| POST | `/api/discover/dna/[channelId]` | AI personality profile from transcripts |
| POST | `/api/discover/rabbit-hole/[channelId]` | AI-identified related creators |

### Sagas

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sagas/[channelId]` | List sagas for a channel |
| PUT | `/api/sagas/[channelId]` | Create a new saga |
| PATCH | `/api/sagas/[channelId]` | Update saga (rename, reassign videos) |
| DELETE | `/api/sagas/[channelId]` | Delete a saga |
| POST | `/api/sagas/[channelId]/sync-playlists` | Import sagas from YouTube playlists |

### Content

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transcripts/[videoId]` | Transcript for a single video |
| GET | `/api/transcripts/search/[channelId]` | Full-text search across channel transcripts |
| GET | `/api/comments/[videoId]` | Top comments for a video |
| GET | `/api/topics/[channelId]` | Topic tags for a channel's videos |
| GET | `/api/growth/[channelId]` | Channel growth snapshots over time |

### Reports & Sharing

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/compare` | Compare 2-5 channels |
| POST | `/api/compare/share` | Create shared comparison link |
| GET | `/api/compare/share` | Fetch shared comparison by ID |
| POST | `/api/share` | Create shareable channel report |
| GET | `/api/report/[channelId]` | Generate channel report data |
| GET/POST/DELETE | `/api/saved-channels` | CRUD for user's saved channels |

### Admin & System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (DB connectivity) |
| GET | `/api/cron/cleanup` | Scheduled cleanup (Bearer auth) |
| GET/POST/PUT | `/api/inngest` | Inngest webhook handler |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth authentication handlers |
| GET | `/api/admin/stats` | Global system statistics |
| POST | `/api/admin/cleanup` | Manual cleanup operations |
| POST | `/api/admin/bulk` | Bulk sync across channels |
| GET | `/api/admin/sync-jobs` | List all sync jobs |
| GET | `/api/admin/saga-corrections` | List saga corrections |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React Compiler, Turbopack) |
| Language | TypeScript 5 |
| Database | Neon Postgres (serverless driver), Drizzle ORM |
| Auth | NextAuth v5, Google OAuth (YouTube readonly scope) |
| AI | Vercel AI SDK (`generateText`, `streamText`, `useChat`), Google Gemini 2.0 Flash, Groq Llama 3.1 8B |
| Background Jobs | Inngest (event-driven, step functions, concurrency control) |
| Styling | Tailwind CSS 4, CSS variables theming |
| UI | shadcn/ui, Radix UI, Lucide icons |
| Data | TanStack Query v5, TanStack Table v8 |
| 3D | React Three Fiber, Three.js |
| Testing | Vitest, @vitest/coverage-v8 (30-35% coverage thresholds) |
| Analytics | PostHog (page views + custom events) |
| Logging | Pino (structured JSON logs) |
| Validation | Zod (runtime schema validation for env, API inputs) |
| SEO | JSON-LD structured data, dynamic Open Graph, sitemap.xml |
| Deployment | Vercel (with cron, security headers, CSP) |

## Database Schema

13 tables managed by Drizzle ORM on Neon Postgres:

| Table | Rows describe | Key columns |
|-------|--------------|-------------|
| `channels` | YouTube channels | title, subscriberCount, totalViewCount, videoCount, customUrl, description, country |
| `videos` | Individual videos | title, publishedAt, duration, views, likes, comments, score, scoreComponents (5 sub-scores), rates (7 derived metrics), topics, description |
| `transcripts` | Video transcripts | fullText, excerpt, language |
| `sagas` | Video groupings | name, source (playlist/ai-detected/manual), videoIds, dateRange, reasoning, videoEvidence, summary |
| `sync_jobs` | Sync pipeline runs | type (videos/transcripts/sagas), status, progress, logs, error |
| `saga_corrections` | User corrections to sagas | action (assign/unassign/create), videoId, targetSagaId, previousSagaId, neighborContext |
| `shared_reports` | Shareable channel snapshots | channelTitle, snapshotData (videoCount, totalViews, avgScore, topPerformers, cadenceLabel), expiresAt |
| `shared_comparisons` | Shareable comparison snapshots | channelIds, channelTitles, snapshotData (per-channel metrics), expiresAt |
| `comments` | Video comments | authorName, text, likeCount, publishedAt |
| `channel_snapshots` | Historical channel metrics | subscriberCount, viewCount, videoCount, snapshotDate |
| `saved_channels` | User's saved channels | userId, channelId, label, pinned, lastVisitedAt |
| `suggestion_cache` | Cached search suggestions | query, results (channelId, title, thumbnail, videoCount) |
| `users` | User accounts | email, name, plan (free/pro/enterprise), syncQuotaDaily, syncUsageToday |

Foreign keys cascade deletes from channels to videos, transcripts, sagas, sync_jobs, comments, snapshots, and saved_channels. Indexes cover common query patterns (channel lookups, status filters, date ranges, user-channel pairs).

## Environment Variables

Create a `.env.local` file (see `.env.example`):

```env
# Required
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require
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
| `POSTGRES_URL` | Yes | Neon Postgres connection string (use the pooled/serverless endpoint) |
| `AUTH_SECRET` | Yes | Random string for NextAuth session encryption. Generate with `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Yes | Google OAuth client ID from [Cloud Console](https://console.cloud.google.com/) with YouTube Data API v3 and Google OAuth enabled |
| `AUTH_GOOGLE_SECRET` | Yes | Google OAuth client secret |
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key from [Cloud Console](https://console.cloud.google.com/). Used for unauthenticated search and channel lookups |
| `ALLOWED_EMAILS` | No | Comma-separated email allowlist. When set, only these emails can sign in |
| `GROQ_API_KEY` | No | [Groq](https://console.groq.com/) API key. Enables AI features using Llama 3.1 8B |
| `GOOGLE_AI_API_KEY` | No | [Google AI Studio](https://aistudio.google.com/) API key. Enables AI features using Gemini 2.0 Flash (preferred provider) |
| `SYNC_SECRET` | No | Secret token for programmatic sync triggers (e.g. from external services) |
| `CRON_SECRET` | No | Bearer token for Vercel cron cleanup endpoint. Set in Vercel project settings |
| `NEXT_PUBLIC_POSTHOG_KEY` | No | PostHog project API key (client-side, write-only -- safe to expose) |
| `LOG_LEVEL` | No | Pino log level: `trace`, `debug`, `info`, `warn`, `error`, `fatal`. Defaults to `info` in production, `debug` in development |

Environment variables are validated at startup using a Zod schema. Missing required variables cause an immediate error with a clear message. In test environments (Vitest), fallback values are used automatically.

## Scripts

```bash
# Development
pnpm dev             # start dev server on port 3003 (Turbopack)
pnpm build           # production build
pnpm start           # start production server
pnpm lint            # run ESLint
pnpm typecheck       # run TypeScript type checking

# Testing
pnpm test            # run Vitest tests
pnpm test:watch      # run tests in watch mode
pnpm test:coverage   # run tests with V8 coverage report

# Database
pnpm db:push         # push schema changes directly to database
pnpm db:generate     # generate Drizzle migration files
pnpm db:migrate      # run pending migrations
pnpm db:studio       # open Drizzle Studio (visual DB browser)
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                        # Home page (search, features, featured channels, compare CTA)
│   ├── layout.tsx                      # Root layout (fonts, providers, JSON-LD, metadata)
│   ├── sitemap.ts                      # Dynamic sitemap generation
│   ├── robots.ts                       # Robots.txt configuration
│   ├── channel/
│   │   ├── [channelId]/page.tsx        # Channel dashboard (5-tab interface)
│   │   ├── [channelId]/layout.tsx      # Dynamic OG metadata per channel
│   │   └── search/[query]/page.tsx     # Search redirect
│   ├── compare/page.tsx                # Multi-channel comparison view
│   ├── report/[reportId]/page.tsx      # Shared report viewer
│   ├── admin/page.tsx                  # Admin dashboard
│   ├── signin/page.tsx                 # Sign-in page
│   └── api/                            # 42 API route handlers (see API Routes above)
├── components/
│   ├── channel-dashboard.tsx           # Main dashboard orchestrator
│   ├── channel-header.tsx              # Channel info header with KPI pills
│   ├── channel-overview.tsx            # Overview tab
│   ├── videos/                         # Videos tab (filter bar, table, detail panels)
│   ├── timeline-view.tsx               # Timeline tab
│   ├── sagas/                          # Sagas tab (saga cards, detail view, uncategorized section)
│   ├── discover/                       # Discover tab (8 AI/data-driven feature sections)
│   ├── ai-query-chat.tsx               # AI chat drawer (Cmd+J)
│   ├── command-palette.tsx             # Command palette (Cmd+K)
│   ├── context-rail.tsx                # Sidebar navigation rail
│   ├── sync-status-bar.tsx             # Real-time sync progress bar
│   ├── sync-log-panel.tsx              # Expandable sync log viewer
│   ├── first-sync-flow.tsx             # Guided onboarding for first sync
│   ├── search-channel.tsx              # Channel search autocomplete
│   ├── recent-channels.tsx             # Recently visited channels
│   ├── score-ring.tsx                  # Visual score indicator (circular)
│   ├── quick-filters.tsx               # Quick filter pills for video table
│   ├── video-detail-panel.tsx          # Expandable video detail row
│   ├── webgl-background.tsx            # Three.js animated background
│   ├── webgl-background-lazy.tsx       # Lazy-loaded wrapper
│   ├── user-menu.tsx                   # User avatar + dropdown
│   └── error-boundary.tsx              # Error boundary with recovery
├── db/
│   ├── index.ts                        # Drizzle client (Neon serverless driver)
│   └── schema.ts                       # All 13 table definitions
├── hooks/
│   ├── use-channel-context.tsx         # Channel data context provider
│   ├── use-channel-stats.ts            # Channel stats fetching hook
│   └── use-discover-*.ts              # Hooks for each Discover feature
├── lib/
│   ├── scoring.ts                      # 5-component scoring algorithm
│   ├── youtube-server.ts               # YouTube Data API wrapper
│   ├── ai-providers.ts                 # Gemini / Groq provider configuration
│   ├── ai-query.ts                     # AI chat system prompt, context compression
│   ├── ai-insight.ts                   # AI insight generation helpers
│   ├── saga-ai.ts                      # AI saga detection logic
│   ├── saga-summary.ts                 # AI saga summarization
│   ├── topic-extraction.ts             # AI topic extraction
│   ├── transcript.ts                   # Transcript fetching
│   ├── auth.ts                         # NextAuth configuration
│   ├── admin-auth.ts                   # Admin authorization
│   ├── user-service.ts                 # User CRUD and quota management
│   ├── env.ts                          # Zod-validated environment variables
│   ├── constants.ts                    # Scoring config and app constants
│   ├── sync-videos.ts                  # Video sync implementation
│   ├── sync-transcripts.ts             # Transcript sync implementation
│   ├── sync-sagas.ts                   # Saga sync implementation
│   ├── sync-cleanup.ts                 # Stale job cleanup logic
│   ├── sync-job.ts                     # Sync job state management
│   ├── sync-logger.ts                  # Sync-specific structured logging
│   ├── sync-route.ts                   # Shared sync route handler
│   ├── route-handler.ts               # API route wrapper (auth, errors, logging)
│   ├── rate-limit.ts                   # Rate limiting configuration
│   ├── channel-snapshots.ts            # Historical snapshot recording
│   ├── video-mapper.ts                 # YouTube API → DB video mapping
│   ├── youtube-comments.ts             # YouTube comments API
│   ├── format.ts                       # Number/date formatting utilities
│   ├── utils.ts                        # General utilities (median, etc.)
│   ├── errors.ts                       # Custom error classes
│   ├── validation.ts                   # Input validation schemas
│   ├── logger.ts                       # Pino logger configuration
│   ├── analytics.ts                    # PostHog server-side helpers
│   └── inngest/
│       ├── client.ts                   # Inngest client initialization
│       └── functions.ts                # syncChannelPipeline, scheduledCleanup
└── types/
    └── youtube.ts                      # TypeScript type definitions
```

## Deployment

Deployed on Vercel with:

- **Cron job** running `/api/cron/cleanup` every 6 hours to clean up stale sync jobs
- **Security headers** including Content-Security-Policy, HSTS (2-year max-age with preload), X-Frame-Options (DENY), Referrer-Policy, Permissions-Policy (no camera/mic/geo)
- **CORS** locked to `https://youtube.joaog.space` for API routes
- **Inngest** connected via webhook at `/api/inngest` for background job processing
- **Smart builds** using `npx turbo-ignore` to skip rebuilds when only other apps changed

## License

[AGPL-3.0](../../LICENSE)
